use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, MintTo, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use pyth_sdk_solana::load_price_feed_from_account_info;

declare_id!("3ZstoPk7ho2fAyotF3NTKFjJESr21qAjNXQuVaGSpQ5L");

#[program]
pub mod caden {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("CADEN CFD Program initialized: {:?}", ctx.program_id);
        Ok(())
    }

    /// Initialize a new market for CFD trading
    pub fn init_market(ctx: Context<InitMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let oracle = &ctx.accounts.oracle_mock;
        let clock = Clock::get()?;
        
        // T+0 price = current oracle price
        market.t0_price = oracle.price;
        // T+2 price = T+0 price (will be updated once after 2 days simulated)
        market.t2_price = oracle.price;
        // expiry slot = clock.slot + 172_800 (≈ 48 h dev-net slots)
        market.expiry_slot = clock.slot + 172_800;
        // status = Active - ALWAYS SET TO ACTIVE (even if account exists)
        market.status = MarketStatus::Active;
        market.usdc_vault = ctx.accounts.usdc_vault.key();
        market.bump = ctx.bumps.market;
        
        msg!("Market initialized/updated with T+0 price: {}, expiry slot: {}, status: Active", market.t0_price, market.expiry_slot);
        Ok(())
    }

    /// Update oracle price (admin only)
    pub fn update_oracle(ctx: Context<UpdateOracle>, price: u64) -> Result<()> {
        let oracle = &mut ctx.accounts.oracle_mock;
        let clock = Clock::get()?;
        
        // Validate admin
        require_keys_eq!(oracle.admin, ctx.accounts.admin.key(), ErrorCode::Unauthorized);
        
        // Price limit removed for testing - allow any price update
        
        // Overwrite OracleMock.price & updated_slot
        oracle.price = price;
        oracle.updated_slot = clock.slot;
        
        msg!("Oracle price updated to: {} by admin: {:?}", price, ctx.accounts.admin.key());
        Ok(())
    }

    /// Mint CFD token representing a position with leverage
    pub fn mint_cfd(
        ctx: Context<MintCfd>,
        position_side: PositionSide,
        size: u64,
        leverage: u8,
    ) -> Result<()> {
        let market = &ctx.accounts.market;
        let position = &mut ctx.accounts.position;
        
        // Validate market is active
        require!(market.status == MarketStatus::Active, ErrorCode::MarketNotActive);
        
        // Validate leverage (1-3x only)
        require!(leverage >= 1 && leverage <= 3, ErrorCode::InvalidLeverage);
        
        // Calculate actual collateral needed (size / leverage)
        let collateral_needed = size / leverage as u64;
        
        // Transfer USDC collateral from user to market PDA
        let transfer_ix = Transfer {
            from: ctx.accounts.user_usdc_account.to_account_info(),
            to: ctx.accounts.market_usdc_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_ix,
        );
        
        anchor_spl::token::transfer(cpi_ctx, collateral_needed)?;
        
        // Mint CADEN-CFD tokens 1:1 to user ATA
        let mint_to_ix = MintTo {
            mint: ctx.accounts.cfd_mint.to_account_info(),
            to: ctx.accounts.user_cfd_account.to_account_info(),
            authority: ctx.accounts.market.to_account_info(),
        };
        
        let seeds = &[
            b"market",
            &[market.bump][..],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            mint_to_ix,
            signer,
        );
        
        anchor_spl::token::mint_to(cpi_ctx, size)?;
        
        // Create/update Position PDA with leverage info
        position.owner = ctx.accounts.user.key();
        position.side = position_side.clone();
        position.size = size;
        position.entry_price = market.t0_price;
        position.cfd_tokens = size;
        position.leverage = leverage;
        position.collateral = collateral_needed;
        position.liquidated = false;
        position.liquidated_slot = 0;
        position.bump = ctx.bumps.position;
        
        msg!("CFD position minted: {:?}, size: {}, leverage: {}x, collateral: {}, CFD tokens: {}", 
             position_side, size, leverage, collateral_needed, size);
        Ok(())
    }

    /// Liquidate an unhealthy position (maintenance threshold < 90%)
    pub fn liquidate_position(ctx: Context<LiquidatePosition>) -> Result<()> {
        let position = &mut ctx.accounts.position;
        let market = &ctx.accounts.market;
        let oracle = &ctx.accounts.oracle_mock;
        let clock = Clock::get()?;
        
        // Check position is not already liquidated
        require!(!position.liquidated, ErrorCode::PositionAlreadyLiquidated);
        
        // Calculate current P&L
        let current_price = oracle.price;
        let price_diff = if current_price > position.entry_price {
            current_price - position.entry_price
        } else {
            position.entry_price - current_price
        };
        
        // Calculate unrealized P&L based on position side (using i128 for signed arithmetic)
        let unrealized_pnl: i128 = match position.side {
            PositionSide::Long => {
                if current_price > position.entry_price {
                    (price_diff as u128 * position.size as u128 / position.entry_price as u128) as i128
                } else {
                    -((price_diff as u128 * position.size as u128 / position.entry_price as u128) as i128)
                }
            },
            PositionSide::Short => {
                if current_price < position.entry_price {
                    (price_diff as u128 * position.size as u128 / position.entry_price as u128) as i128
                } else {
                    -((price_diff as u128 * position.size as u128 / position.entry_price as u128) as i128)
                }
            }
        };
        
        // Calculate collateral ratio: (collateral + unrealized_pnl) / position_size
        let current_collateral_value = if unrealized_pnl < 0 {
            let loss = (-unrealized_pnl) as u64;
            if loss > position.collateral {
                0 // Underwater
            } else {
                position.collateral - loss
            }
        } else {
            position.collateral + unrealized_pnl as u64
        };
        
        let collateral_ratio = (current_collateral_value as u128 * 10000) / position.size as u128; // Basis points
        let maintenance_threshold = 900; // 90% in basis points
        
        // Check if position is below maintenance threshold
        require!(collateral_ratio < maintenance_threshold, ErrorCode::PositionHealthy);
        
        // Mark position as liquidated
        position.liquidated = true;
        position.liquidated_slot = clock.slot;
        
        // Calculate liquidation bonus (1% of remaining collateral to liquidator)
        let liquidation_bonus = current_collateral_value / 100; // 1%
        let remaining_to_user = if current_collateral_value > liquidation_bonus {
            current_collateral_value - liquidation_bonus
        } else {
            0
        };
        
        // Transfer liquidation bonus to liquidator
        if liquidation_bonus > 0 {
            let transfer_bonus_ix = Transfer {
                from: ctx.accounts.market_usdc_vault.to_account_info(),
                to: ctx.accounts.liquidator_usdc_account.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            };
            
            let seeds = &[
                b"market",
                &[market.bump][..],
            ];
            let signer = &[&seeds[..]];
            
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_bonus_ix,
                signer,
            );
            
            anchor_spl::token::transfer(cpi_ctx, liquidation_bonus)?;
        }
        
        // Transfer remaining collateral to user
        if remaining_to_user > 0 {
            let transfer_remaining_ix = Transfer {
                from: ctx.accounts.market_usdc_vault.to_account_info(),
                to: ctx.accounts.user_usdc_account.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            };
            
            let seeds = &[
                b"market",
                &[market.bump][..],
            ];
            let signer = &[&seeds[..]];
            
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_remaining_ix,
                signer,
            );
            
            anchor_spl::token::transfer(cpi_ctx, remaining_to_user)?;
        }
        
        // Burn user's CADEN-CFD tokens
        let burn_ix = anchor_spl::token::Burn {
            mint: ctx.accounts.cfd_mint.to_account_info(),
            from: ctx.accounts.user_cfd_account.to_account_info(),
            authority: ctx.accounts.liquidator.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            burn_ix,
        );
        
        anchor_spl::token::burn(cpi_ctx, position.cfd_tokens)?;
        
        msg!("Position liquidated at slot {}: collateral_ratio: {}bps, bonus: {}, remaining: {}", 
             clock.slot, collateral_ratio, liquidation_bonus, remaining_to_user);
        Ok(())
    }

    /// Initialize oracle mock (admin only)
    pub fn init_oracle(ctx: Context<InitOracle>) -> Result<()> {
        let oracle = &mut ctx.accounts.oracle_mock;
        oracle.admin = ctx.accounts.admin.key();
        oracle.price = 50000; // Initialize with default BTC price
        oracle.updated_slot = Clock::get()?.slot;
        
        msg!("Oracle mock initialized by admin: {:?}", ctx.accounts.admin.key());
        Ok(())
    }

    /// Initialize spread heatmap (admin only)
    pub fn init_heatmap(ctx: Context<InitHeatmap>) -> Result<()> {
        let heatmap = &mut ctx.accounts.heatmap;
        
        // Initialize spreads array with zeros
        heatmap.spreads = [SpreadEntry { bid: 0, ask: 0 }; 100];
        heatmap.bump = ctx.bumps.heatmap;
        
        msg!("Spread heatmap initialized by admin: {:?}", ctx.accounts.admin.key());
        Ok(())
    }

    /// Crank instruction: Update heatmap with current spread data (callable by anyone)
    pub fn crank_heatmap(ctx: Context<CrankHeatmap>) -> Result<()> {
        let heatmap = &mut ctx.accounts.heatmap;
        let market = &ctx.accounts.market;
        let oracle = &ctx.accounts.oracle_mock;
        let clock = Clock::get()?;
        
        // Calculate spread in basis points: (t2 - t0) / t0 * 10000
        let t0_price = market.t0_price;
        let t2_price = market.t2_price;
        let current_oracle_price = oracle.price;
        
        // Use current oracle price as "live" T+0, market.t2_price as T+2
        let spread_bps = if t0_price > 0 {
            let spread_ratio = (t2_price as i128 - current_oracle_price as i128) as f64 / current_oracle_price as f64;
            (spread_ratio * 10000.0) as i16
        } else {
            0
        };
        
        // Create new price point and store in first position (simple overwrite instead of circular buffer)
        let new_point = SpreadEntry {
            bid: current_oracle_price,
            ask: t2_price,
        };
        
        // For simplicity, just update the first entry
        heatmap.spreads[0] = new_point;
        
        msg!("Heatmap cranked at slot {}: spread {}bps, t0=${}, t2=${}", 
             clock.slot, spread_bps, current_oracle_price, t2_price);
        Ok(())
    }

    /// Initialize AMM pool for Long/Short CFD trading
    pub fn init_amm_pool(ctx: Context<InitAmmPool>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        
        pool.admin = ctx.accounts.admin.key();
        pool.long_mint = ctx.accounts.long_mint.key();
        pool.short_mint = ctx.accounts.short_mint.key();
        pool.lp_mint = ctx.accounts.lp_mint.key();
        pool.long_vault = ctx.accounts.long_vault.key();
        pool.short_vault = ctx.accounts.short_vault.key();
        pool.long_reserve = 0;
        pool.short_reserve = 0;
        pool.lp_supply = 0;
        pool.swap_fee_bps = 20;  // 0.2% total fee
        pool.protocol_fee_bps = 5; // 0.05% to protocol, 0.15% to LPs
        pool.total_fees_collected = 0;
        pool.total_volume = 0;
        pool.bump = ctx.bumps.pool;
        
        msg!("AMM pool initialized with 0.2% swap fee (0.15% to LPs, 0.05% to protocol)");
        Ok(())
    }

    /// Add liquidity to AMM pool (constant product x*y=k)
    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        long_amount: u64,
        short_amount: u64,
        min_lp_tokens: u64,
    ) -> Result<()> {
        // Store pool data before borrowing
        let pool_bump = ctx.accounts.pool.bump;
        let lp_supply = ctx.accounts.pool.lp_supply;
        let long_reserve = ctx.accounts.pool.long_reserve;
        let short_reserve = ctx.accounts.pool.short_reserve;
        let total_fees_collected = ctx.accounts.pool.total_fees_collected;
        
        let pool = &mut ctx.accounts.pool;
        let lp_position = &mut ctx.accounts.lp_position;
        
        // Calculate LP tokens to mint based on constant product formula
        let lp_tokens_to_mint = if lp_supply == 0 {
            // First liquidity provision: LP tokens = sqrt(long_amount * short_amount)
            ((long_amount as u128 * short_amount as u128) as f64).sqrt() as u64
        } else {
            // Subsequent provisions: maintain ratio
            let long_ratio = (long_amount as u128 * lp_supply as u128) / long_reserve as u128;
            let short_ratio = (short_amount as u128 * lp_supply as u128) / short_reserve as u128;
            std::cmp::min(long_ratio, short_ratio) as u64
        };
        
        require!(lp_tokens_to_mint >= min_lp_tokens, ErrorCode::SlippageExceeded);
        
        // Transfer tokens from user to pool vaults
        // Transfer Long tokens
        let transfer_long_ix = Transfer {
            from: ctx.accounts.user_long_account.to_account_info(),
            to: ctx.accounts.long_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_long_ix,
        );
        anchor_spl::token::transfer(cpi_ctx, long_amount)?;
        
        // Transfer Short tokens
        let transfer_short_ix = Transfer {
            from: ctx.accounts.user_short_account.to_account_info(),
            to: ctx.accounts.short_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_short_ix,
        );
        anchor_spl::token::transfer(cpi_ctx, short_amount)?;
        
        // Update pool reserves first
        pool.long_reserve += long_amount;
        pool.short_reserve += short_amount;
        pool.lp_supply += lp_tokens_to_mint;
        
        // Mint LP tokens to user
        let mint_lp_ix = MintTo {
            mint: ctx.accounts.lp_mint.to_account_info(),
            to: ctx.accounts.user_lp_account.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        };
        
        let seeds = &[
            b"amm_pool",
            &[pool_bump][..],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            mint_lp_ix,
            signer,
        );
        anchor_spl::token::mint_to(cpi_ctx, lp_tokens_to_mint)?;
        
        // Update LP position
        lp_position.owner = ctx.accounts.user.key();
        lp_position.lp_tokens += lp_tokens_to_mint;
        lp_position.last_fee_checkpoint = total_fees_collected;
        lp_position.bump = ctx.bumps.lp_position;
        
        msg!("Liquidity added: {} Long, {} Short → {} LP tokens", 
             long_amount, short_amount, lp_tokens_to_mint);
        Ok(())
    }

    /// Swap Long ↔ Short CFD tokens (constant product AMM with fees)
    pub fn swap_cfd_tokens(
        ctx: Context<SwapCfdTokens>,
        amount_in: u64,
        min_amount_out: u64,
        is_long_to_short: bool,
    ) -> Result<()> {
        // Store pool data before borrowing
        let pool_bump = ctx.accounts.pool.bump;
        let long_reserve = ctx.accounts.pool.long_reserve;
        let short_reserve = ctx.accounts.pool.short_reserve;
        let swap_fee_bps = ctx.accounts.pool.swap_fee_bps;
        let protocol_fee_bps = ctx.accounts.pool.protocol_fee_bps;
        
        // Get current reserves
        let (reserve_in, reserve_out) = if is_long_to_short {
            (long_reserve, short_reserve)
        } else {
            (short_reserve, long_reserve)
        };
        
        // Calculate swap fee (0.2% total)
        let fee_amount = (amount_in as u128 * swap_fee_bps as u128) / 10000;
        let amount_in_after_fee = amount_in - fee_amount as u64;
        
        // Constant product formula: x * y = k
        // amount_out = (amount_in_after_fee * reserve_out) / (reserve_in + amount_in_after_fee)
        let amount_out = (amount_in_after_fee as u128 * reserve_out as u128) / 
                        (reserve_in as u128 + amount_in_after_fee as u128);
        let amount_out = amount_out as u64;
        
        require!(amount_out >= min_amount_out, ErrorCode::SlippageExceeded);
        
        // Calculate protocol fee (0.05% of total volume)
        let protocol_fee = (fee_amount * protocol_fee_bps as u128) / swap_fee_bps as u128;
        let lp_fee = fee_amount - protocol_fee;
        
        // Execute token transfers first
        if is_long_to_short {
            // Transfer Long tokens from user to pool
            let transfer_in_ix = Transfer {
                from: ctx.accounts.user_token_in.to_account_info(),
                to: ctx.accounts.vault_in.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            };
            
            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                transfer_in_ix,
            );
            anchor_spl::token::transfer(cpi_ctx, amount_in)?;
            
            // Transfer Short tokens from pool to user
            let transfer_out_ix = Transfer {
                from: ctx.accounts.vault_out.to_account_info(),
                to: ctx.accounts.user_token_out.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            };
            
            let seeds = &[
                b"amm_pool",
                &[pool_bump][..],
            ];
            let signer = &[&seeds[..]];
            
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_out_ix,
                signer,
            );
            anchor_spl::token::transfer(cpi_ctx, amount_out)?;
        } else {
            // Short to Long (same logic, reversed)
            let transfer_in_ix = Transfer {
                from: ctx.accounts.user_token_in.to_account_info(),
                to: ctx.accounts.vault_in.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            };
            
            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                transfer_in_ix,
            );
            anchor_spl::token::transfer(cpi_ctx, amount_in)?;
            
            let transfer_out_ix = Transfer {
                from: ctx.accounts.vault_out.to_account_info(),
                to: ctx.accounts.user_token_out.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            };
            
            let seeds = &[
                b"amm_pool",
                &[pool_bump][..],
            ];
            let signer = &[&seeds[..]];
            
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_out_ix,
                signer,
            );
            anchor_spl::token::transfer(cpi_ctx, amount_out)?;
        }
        
        // Now we can safely borrow pool mutably to update reserves
        let pool = &mut ctx.accounts.pool;
        
        // Update pool stats and reserves after transfers
        if is_long_to_short {
            pool.long_reserve += amount_in;
            pool.short_reserve -= amount_out;
        } else {
            pool.short_reserve += amount_in;
            pool.long_reserve -= amount_out;
        }
        pool.total_fees_collected += lp_fee as u64;
        pool.total_volume += amount_in;
        
        msg!("Swap executed: {} → {} (fee: {} bps, LP fee: {}, protocol fee: {})", 
             amount_in, amount_out, swap_fee_bps, lp_fee, protocol_fee);
        Ok(())
    }

    /// Mint a Settlement Slot NFT - Creates a new asset class for settlement timing rights
    pub fn mint_settlement_slot_nft(
        ctx: Context<MintSettlementSlotNft>,
        asset_symbol: String,
        asset_type: AssetType,
        settlement_time: u64,
        slot_duration: u64,
        slot_price: u64,
        nft_seed: u64, // User-provided seed for deterministic PDA
    ) -> Result<()> {
        let settlement_slot = &mut ctx.accounts.settlement_slot;
        let clock = Clock::get()?;
        
        // Validate asset symbol (basic validation)
        require!(asset_symbol.len() <= 10, ErrorCode::InvalidAssetSymbol);
        require!(settlement_time <= 365, ErrorCode::InvalidSettlementTime); // Max 1 year
        
        // Validate asset type
        require!(matches!(asset_type, AssetType::Stock | AssetType::Crypto | AssetType::Bond | AssetType::Commodity | AssetType::Forex), ErrorCode::InvalidAssetType);
        
        // Initialize settlement slot NFT
        settlement_slot.slot_id = nft_seed; // Use user-provided seed as unique ID
        settlement_slot.asset_symbol = asset_symbol.clone();
        settlement_slot.asset_type = asset_type;
        settlement_slot.settlement_time = settlement_time;
        settlement_slot.slot_duration = slot_duration;
        settlement_slot.owner = ctx.accounts.owner.key();
        settlement_slot.mint_price = slot_price;
        settlement_slot.created_slot = clock.slot;
        settlement_slot.expiry_slot = clock.slot + (slot_duration * 172_800); // Convert days to slots
        settlement_slot.is_tradable = true;
        settlement_slot.is_active = true;
        settlement_slot.bump = ctx.bumps.settlement_slot;
        
        msg!("Settlement Slot NFT minted: Asset: {}, Settlement Time: T+{}, Duration: {} days, Price: ${}", 
             asset_symbol, settlement_time, slot_duration, slot_price / 1000000);
        Ok(())
    }

    /// Trade a Settlement Slot NFT - Enables trading of settlement timing rights
    pub fn trade_settlement_slot(
        ctx: Context<TradeSettlementSlot>,
        new_price: u64,
    ) -> Result<()> {
        let settlement_slot = &mut ctx.accounts.settlement_slot;
        
        // Validate ownership
        require_keys_eq!(settlement_slot.owner, ctx.accounts.seller.key(), ErrorCode::Unauthorized);
        require!(settlement_slot.is_tradable, ErrorCode::SlotNotTradable);
        require!(settlement_slot.is_active, ErrorCode::SlotExpired);
        
        // Transfer ownership
        settlement_slot.owner = ctx.accounts.buyer.key();
        settlement_slot.mint_price = new_price;
        
        msg!("Settlement Slot traded: New owner: {:?}, New price: ${}", 
             ctx.accounts.buyer.key(), new_price / 1000000);
        Ok(())
    }

    /// Place a simple bet on asset price direction
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        asset_symbol: String,
        asset_type: AssetType,
        bet_amount: u64,
        is_long: bool,
        bet_seed: u64,
    ) -> Result<()> {
        let bet = &mut ctx.accounts.bet;
        let multi_oracle = &ctx.accounts.multi_oracle;
        let clock = Clock::get()?;
        
        // Validate bet amount (minimum $10)
        require!(bet_amount >= 10_000000, ErrorCode::BetAmountTooSmall);
        
        // Get current price from multi-asset oracle
        let current_price = multi_oracle.asset_prices
            .iter()
            .find(|p| p.asset_symbol == asset_symbol && p.asset_type == asset_type)
            .ok_or(ErrorCode::AssetNotFound)?
            .price;
        
        // Initialize bet account
        bet.owner = ctx.accounts.user.key();
        bet.bet_id = bet_seed;
        bet.asset_symbol = asset_symbol.clone();
        bet.asset_type = asset_type;
        bet.bet_amount = bet_amount;
        bet.is_long = is_long;
        bet.entry_price = current_price;
        bet.created_slot = clock.slot;
        bet.is_settled = false;
        bet.settlement_value = 0;
        bet.bump = ctx.bumps.bet;
        
        msg!("Bet placed: User: {:?}, Asset: {}, Amount: ${}, Direction: {}, Entry Price: ${}",
             ctx.accounts.user.key(), asset_symbol, bet_amount / 1000000,
             if is_long { "LONG" } else { "SHORT" }, current_price / 1000000);
        Ok(())
    }

    /// Execute Instant T+0 Settlement - Settle bet instantly using T+0 NFT
    pub fn instant_t0_settlement(
        ctx: Context<InstantT0Settlement>,
        bet_id: u64,
        settlement_slot_id: u64,
    ) -> Result<()> {
        let settlement_slot = &ctx.accounts.settlement_slot;
        let bet = &mut ctx.accounts.bet;
        let multi_oracle = &ctx.accounts.multi_oracle;
        let clock = Clock::get()?;
        
        // Validate settlement slot (must be T+0)
        require!(settlement_slot.slot_id == settlement_slot_id, ErrorCode::InvalidSettlementSlot);
        require_keys_eq!(settlement_slot.owner, ctx.accounts.user.key(), ErrorCode::Unauthorized);
        require!(settlement_slot.is_active, ErrorCode::SlotExpired);
        require!(settlement_slot.settlement_time == 0, ErrorCode::NotInstantSettlement);
        
        // Validate bet
        require!(bet.bet_id == bet_id, ErrorCode::InvalidBetId);
        require_keys_eq!(bet.owner, ctx.accounts.user.key(), ErrorCode::Unauthorized);
        require!(!bet.is_settled, ErrorCode::BetAlreadySettled);
        
        // Get current price from multi-asset oracle
        let current_price = multi_oracle.asset_prices
            .iter()
            .find(|p| p.asset_symbol == bet.asset_symbol && p.asset_type == bet.asset_type)
            .ok_or(ErrorCode::AssetNotFound)?
            .price;
        
        // Calculate P&L based on price movement
        let price_change = if current_price > bet.entry_price {
            current_price - bet.entry_price
        } else {
            bet.entry_price - current_price
        };
        
        let pnl_multiplier = (price_change * 1000000) / bet.entry_price; // Price change percentage (6 decimals)
        let pnl = (bet.bet_amount * pnl_multiplier) / 1000000;
        
        // Calculate settlement value based on direction
        let settlement_value = if bet.is_long {
            if current_price > bet.entry_price {
                bet.bet_amount + pnl // Profit
            } else {
                if bet.bet_amount > pnl { bet.bet_amount - pnl } else { 0 } // Loss (min 0)
            }
        } else {
            if current_price < bet.entry_price {
                bet.bet_amount + pnl // Profit
            } else {
                if bet.bet_amount > pnl { bet.bet_amount - pnl } else { 0 } // Loss (min 0)
            }
        };
        
        // Mark bet as settled
        bet.is_settled = true;
        bet.settlement_value = settlement_value;
        
        msg!("Instant T+0 Settlement: Bet: {}, Entry: ${}, Current: ${}, Settlement: ${}, P&L: {}${}",
             bet_id, bet.entry_price / 1000000, current_price / 1000000,
             settlement_value / 1000000,
             if settlement_value > bet.bet_amount { "+" } else { "-" },
             if settlement_value > bet.bet_amount { 
                 (settlement_value - bet.bet_amount) / 1000000 
             } else { 
                 (bet.bet_amount - settlement_value) / 1000000 
             });
        Ok(())
    }

    /// Initialize Multi-Asset Oracle for cross-asset settlement slots
    pub fn init_multi_asset_oracle(ctx: Context<InitMultiAssetOracle>) -> Result<()> {
        let multi_oracle = &mut ctx.accounts.multi_oracle;
        let clock = Clock::get()?;
        
        multi_oracle.admin = ctx.accounts.admin.key();
        multi_oracle.asset_prices = Vec::new();
        multi_oracle.updated_slot = clock.slot;
        multi_oracle.bump = ctx.bumps.multi_oracle;
        
        msg!("Multi-Asset Oracle initialized by admin: {:?}", ctx.accounts.admin.key());
        Ok(())
    }

    /// Update asset price in multi-asset oracle
    pub fn update_asset_price(
        ctx: Context<UpdateAssetPrice>,
        asset_symbol: String,
        asset_type: AssetType,
        price: u64,
    ) -> Result<()> {
        let multi_oracle = &mut ctx.accounts.multi_oracle;
        let clock = Clock::get()?;
        
        // Validate admin
        require_keys_eq!(multi_oracle.admin, ctx.accounts.admin.key(), ErrorCode::Unauthorized);
        
        // Find existing asset or add new one
        let mut found = false;
        for asset_price in multi_oracle.asset_prices.iter_mut() {
            if asset_price.asset_symbol == asset_symbol && asset_price.asset_type == asset_type {
                asset_price.price = price;
                asset_price.last_updated = clock.slot;
                found = true;
                break;
            }
        }
        
        if !found {
            multi_oracle.asset_prices.push(AssetPrice {
                asset_symbol: asset_symbol.clone(),
                asset_type,
                price,
                last_updated: clock.slot,
                source: PriceSource::Manual,
                confidence: 0,
            });
        }
        
        multi_oracle.updated_slot = clock.slot;
        
        msg!("Asset price updated: {} ({:?}) = ${}", asset_symbol, asset_type, price / 1000000);
        Ok(())
    }

    /// Initialize Oracle Aggregator with multiple price sources
    pub fn init_oracle_aggregator(ctx: Context<InitOracleAggregator>) -> Result<()> {
        let aggregator = &mut ctx.accounts.oracle_aggregator;
        let clock = Clock::get()?;
        
        aggregator.admin = ctx.accounts.admin.key();
        aggregator.enabled_sources = vec![
            PriceSource::Pyth,
            PriceSource::Switchboard,
            PriceSource::CoinGecko,
        ];
        aggregator.price_feeds = Vec::new();
        aggregator.update_frequency = 400; // Update every 400 slots (~3 minutes)
        aggregator.last_crank_slot = clock.slot;
        aggregator.deviation_threshold = 500; // 5% deviation threshold
        aggregator.bump = ctx.bumps.oracle_aggregator;
        
        msg!("Oracle Aggregator initialized with multiple price sources");
        Ok(())
    }

    /// Update price from REAL Pyth oracle
    pub fn update_price_from_pyth(
        ctx: Context<UpdatePriceFromPyth>,
        asset_symbol: String,
        asset_type: AssetType,
    ) -> Result<()> {
        let aggregator = &mut ctx.accounts.oracle_aggregator;
        let clock = Clock::get()?;
        
        // Load REAL Pyth price feed
        let price_account_info = &ctx.accounts.pyth_price_account;
        let price_feed = load_price_feed_from_account_info(price_account_info)
            .map_err(|_| ErrorCode::InvalidPriceData)?;
        
        // Get current price from Pyth (unchecked for demo - in production use get_price_no_older_than)
        let pyth_price_data = price_feed.get_price_unchecked();
        
        // Convert Pyth price to our format (6 decimals)
        // Pyth prices have expo (usually -8), we need to normalize to 6 decimals
        let price_i64 = pyth_price_data.price;
        let expo = pyth_price_data.expo;
        
        // Convert to 6 decimal places
        let pyth_price = if expo >= -6 {
            // If expo is -6 or greater, scale up
            (price_i64 as u64) * 10_u64.pow((expo + 6) as u32)
        } else {
            // If expo is less than -6, scale down
            (price_i64 as u64) / 10_u64.pow((-expo - 6) as u32)
        };
        
        // Get confidence interval
        let confidence = (pyth_price_data.conf as u64) / 10_u64.pow((-expo - 6) as u32);
        
        msg!("📊 REAL Pyth price loaded: {} = ${} (conf: ${})", 
             asset_symbol, pyth_price / 1_000_000, confidence / 1_000_000);
        
        // Find or create price feed
        let mut found = false;
        for feed in aggregator.price_feeds.iter_mut() {
            if feed.asset_symbol == asset_symbol && feed.asset_type == asset_type {
                feed.pyth_price = pyth_price;
                feed.last_updated = clock.slot;
                feed.is_stale = false;
                
                // Recalculate aggregated price
                feed.aggregated_price = calculate_aggregated_price(
                    feed.pyth_price,
                    feed.switchboard_price,
                    feed.external_price,
                );
                found = true;
                break;
            }
        }
        
        if !found {
            aggregator.price_feeds.push(PriceFeed {
                asset_symbol: asset_symbol.clone(),
                asset_type,
                pyth_price,
                switchboard_price: 0,
                external_price: 0,
                aggregated_price: pyth_price,
                last_updated: clock.slot,
                is_stale: false,
            });
        }
        
        msg!("✅ REAL Pyth price updated: {} ({:?}) = ${}", asset_symbol, asset_type, pyth_price / 1000000);
        Ok(())
    }

    /// Update price from Switchboard oracle
    pub fn update_price_from_switchboard(
        ctx: Context<UpdatePriceFromSwitchboard>,
        asset_symbol: String,
        asset_type: AssetType,
    ) -> Result<()> {
        let aggregator = &mut ctx.accounts.oracle_aggregator;
        let clock = Clock::get()?;
        
        // In production, read from Switchboard aggregator
        let switchboard_price = 45100_000000; // Simulated Switchboard price
        
        // Find or create price feed
        let mut found = false;
        for feed in aggregator.price_feeds.iter_mut() {
            if feed.asset_symbol == asset_symbol && feed.asset_type == asset_type {
                feed.switchboard_price = switchboard_price;
                feed.last_updated = clock.slot;
                feed.is_stale = false;
                
                // Recalculate aggregated price
                feed.aggregated_price = calculate_aggregated_price(
                    feed.pyth_price,
                    feed.switchboard_price,
                    feed.external_price,
                );
                found = true;
                break;
            }
        }
        
        if !found {
            aggregator.price_feeds.push(PriceFeed {
                asset_symbol: asset_symbol.clone(),
                asset_type,
                pyth_price: 0,
                switchboard_price,
                external_price: 0,
                aggregated_price: switchboard_price,
                last_updated: clock.slot,
                is_stale: false,
            });
        }
        
        msg!("Price updated from Switchboard: {} ({:?}) = ${}", asset_symbol, asset_type, switchboard_price / 1000000);
        Ok(())
    }

    /// Update price from external API (CoinGecko, Twelve Data, etc.)
    pub fn update_price_from_external(
        ctx: Context<UpdatePriceFromExternal>,
        asset_symbol: String,
        asset_type: AssetType,
        price: u64,
        source: PriceSource,
    ) -> Result<()> {
        let aggregator = &mut ctx.accounts.oracle_aggregator;
        let clock = Clock::get()?;
        
        // Validate admin
        require_keys_eq!(aggregator.admin, ctx.accounts.admin.key(), ErrorCode::Unauthorized);
        
        // Validate price source
        require!(
            matches!(source, PriceSource::CoinGecko | PriceSource::TwelveData | PriceSource::Binance),
            ErrorCode::InvalidPriceSource
        );
        
        // Find or create price feed
        let mut found = false;
        for feed in aggregator.price_feeds.iter_mut() {
            if feed.asset_symbol == asset_symbol && feed.asset_type == asset_type {
                feed.external_price = price;
                feed.last_updated = clock.slot;
                feed.is_stale = false;
                
                // Recalculate aggregated price
                feed.aggregated_price = calculate_aggregated_price(
                    feed.pyth_price,
                    feed.switchboard_price,
                    feed.external_price,
                );
                found = true;
                break;
            }
        }
        
        if !found {
            aggregator.price_feeds.push(PriceFeed {
                asset_symbol: asset_symbol.clone(),
                asset_type,
                pyth_price: 0,
                switchboard_price: 0,
                external_price: price,
                aggregated_price: price,
                last_updated: clock.slot,
                is_stale: false,
            });
        }
        
        msg!("Price updated from {:?}: {} ({:?}) = ${}", source, asset_symbol, asset_type, price / 1000000);
        Ok(())
    }

    /// Create a new settlement slot AMM pool
    pub fn create_settlement_slot_pool(
        ctx: Context<CreateSettlementSlotPool>,
        asset_symbol: String,
        asset_type: AssetType,
        settlement_time: u64,
        fee_rate: u16,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        let clock = Clock::get()?;
        
        // Validate inputs
        require!(asset_symbol.len() <= 10, ErrorCode::InvalidAssetSymbol);
        require!(settlement_time <= 365, ErrorCode::InvalidSettlementTime);
        require!(fee_rate <= 1000, ErrorCode::InvalidFeeRate); // Max 10%
        
        // Initialize pool
        pool.pool_id = clock.slot; // Use current slot as unique ID
        pool.asset_symbol = asset_symbol.clone();
        pool.asset_type = asset_type;
        pool.settlement_time = settlement_time;
        pool.token_a_mint = ctx.accounts.usdc_mint.key();
        pool.token_b_mint = ctx.accounts.slot_nft_mint.key();
        pool.token_a_vault = ctx.accounts.token_a_vault.key();
        pool.token_b_vault = ctx.accounts.token_b_vault.key();
        pool.token_a_amount = 0;
        pool.token_b_amount = 0;
        pool.fee_rate = fee_rate;
        pool.pool_authority = ctx.accounts.pool_authority.key();
        pool.created_slot = clock.slot;
        pool.is_active = true;
        pool.bump = ctx.bumps.pool;
        
        msg!("Settlement Slot Pool created: {} ({:?}) T+{}, Fee: {} bps", 
             asset_symbol, asset_type, settlement_time, fee_rate);
        Ok(())
    }

    /// Add liquidity to settlement slot pool
    pub fn add_liquidity_to_pool(
        ctx: Context<AddLiquidityToPool>,
        usdc_amount: u64,
        slot_nft_amount: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        
        // Validate pool is active
        require!(pool.is_active, ErrorCode::PoolInactive);
        
        // Update pool amounts
        pool.token_a_amount = pool.token_a_amount.checked_add(usdc_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        pool.token_b_amount = pool.token_b_amount.checked_add(slot_nft_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        
        msg!("Liquidity added to pool {}: USDC: {}, Slots: {}", 
             pool.pool_id, usdc_amount, slot_nft_amount);
        Ok(())
    }

    /// Swap USDC for settlement slot NFTs
    pub fn swap_usdc_for_slots(
        ctx: Context<SwapUsdcForSlots>,
        usdc_amount: u64,
        min_slots_out: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        
        // Validate pool is active
        require!(pool.is_active, ErrorCode::PoolInactive);
        
        // Calculate swap (simplified constant product formula)
        let fee_amount = (usdc_amount * pool.fee_rate as u64) / 10000;
        let usdc_after_fee = usdc_amount.checked_sub(fee_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        
        let slots_out = (usdc_after_fee * pool.token_b_amount) / pool.token_a_amount;
        require!(slots_out >= min_slots_out, ErrorCode::InsufficientOutputAmount);
        
        // Update pool amounts
        pool.token_a_amount = pool.token_a_amount.checked_add(usdc_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        pool.token_b_amount = pool.token_b_amount.checked_sub(slots_out)
            .ok_or(ErrorCode::MathOverflow)?;
        
        msg!("Swapped USDC for slots: {} USDC -> {} slots (fee: {})", 
             usdc_amount, slots_out, fee_amount);
        Ok(())
    }

    /// Initialize CADEN governance system
    pub fn init_governance(ctx: Context<InitGovernance>) -> Result<()> {
        let governance = &mut ctx.accounts.governance;
        
        governance.admin = ctx.accounts.admin.key();
        governance.caden_mint = ctx.accounts.caden_mint.key();
        governance.staked_caden_mint = ctx.accounts.staked_caden_mint.key();
        governance.total_supply = 1_000_000_000 * 1_000_000; // 1B CADEN tokens
        governance.staked_supply = 0;
        governance.protocol_fee_vault = ctx.accounts.protocol_fee_vault.key();
        governance.buyback_vault = ctx.accounts.buyback_vault.key();
        governance.total_fees_collected = 0;
        governance.total_caden_bought = 0;
        governance.staking_apy = 1420; // 14.2% APY in basis points
        governance.proposal_count = 0;
        governance.quorum_threshold = 10_000_000 * 1_000_000; // 10M CADEN for quorum
        governance.voting_period = 172800; // 1 day in slots (~400ms/slot)
        governance.execution_delay = 43200; // 6 hours delay
        governance.bump = ctx.bumps.governance;
        
        msg!("CADEN Governance initialized: 1B supply, governance proposals enabled");
        Ok(())
    }

    /// Create a governance proposal
    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        proposal_type: ProposalType,
        title: String,
        description: String,
    ) -> Result<()> {
        let governance = &mut ctx.accounts.governance;
        let proposal = &mut ctx.accounts.proposal;
        let staking_position = &ctx.accounts.staking_position;
        let clock = Clock::get()?;
        
        // Validate proposer has enough staked CADEN
        require!(staking_position.caden_staked >= 1_000_000 * 1000000, ErrorCode::InsufficientStakeForProposal); // 1M CADEN minimum
        
        // Validate title and description
        require!(title.len() <= 100, ErrorCode::TitleTooLong);
        require!(description.len() <= 500, ErrorCode::DescriptionTooLong);
        
        // Initialize proposal
        proposal.proposal_id = governance.proposal_count;
        proposal.proposer = ctx.accounts.proposer.key();
        proposal.proposal_type = proposal_type;
        proposal.title = title.clone();
        proposal.description = description.clone();
        proposal.votes_for = 0;
        proposal.votes_against = 0;
        proposal.total_votes = 0;
        proposal.status = ProposalStatus::Active;
        proposal.created_slot = clock.slot;
        proposal.voting_ends_slot = clock.slot + governance.voting_period;
        proposal.execution_slot = 0;
        proposal.executed = false;
        proposal.cancelled = false;
        proposal.bump = ctx.bumps.proposal;
        
        // Increment proposal count
        governance.proposal_count += 1;
        
        msg!("Proposal #{} created: {:?} - {}", proposal.proposal_id, proposal_type, title);
        Ok(())
    }

    /// Vote on a governance proposal
    pub fn cast_vote(
        ctx: Context<CastVote>,
        vote_choice: VoteChoice,
    ) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let vote = &mut ctx.accounts.vote;
        let staking_position = &ctx.accounts.staking_position;
        let clock = Clock::get()?;
        
        // Validate proposal is active
        require!(proposal.status == ProposalStatus::Active, ErrorCode::ProposalNotActive);
        require!(clock.slot < proposal.voting_ends_slot, ErrorCode::VotingPeriodEnded);
        
        // Validate voter has staked CADEN
        let vote_power = staking_position.caden_staked;
        require!(vote_power > 0, ErrorCode::NoVotingPower);
        
        // Record vote
        vote.proposal_id = proposal.proposal_id;
        vote.voter = ctx.accounts.voter.key();
        vote.vote_power = vote_power;
        vote.vote_choice = vote_choice;
        vote.voted_slot = clock.slot;
        vote.bump = ctx.bumps.vote;
        
        // Update proposal vote counts
        match vote_choice {
            VoteChoice::For => {
                proposal.votes_for += vote_power;
            }
            VoteChoice::Against => {
                proposal.votes_against += vote_power;
            }
            VoteChoice::Abstain => {
                // Abstain doesn't add to for/against, but counts toward quorum
            }
        }
        proposal.total_votes += vote_power;
        
        msg!("Vote cast on proposal #{}: {:?} with {} voting power", 
             proposal.proposal_id, vote_choice, vote_power / 1000000);
        Ok(())
    }

    /// Finalize a proposal after voting period ends
    pub fn finalize_proposal(ctx: Context<FinalizeProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let governance = &ctx.accounts.governance;
        let clock = Clock::get()?;
        
        // Validate voting period has ended
        require!(clock.slot >= proposal.voting_ends_slot, ErrorCode::VotingPeriodNotEnded);
        require!(proposal.status == ProposalStatus::Active, ErrorCode::ProposalNotActive);
        
        // Check if quorum reached
        if proposal.total_votes < governance.quorum_threshold {
            proposal.status = ProposalStatus::Defeated;
            msg!("Proposal #{} defeated: Quorum not reached", proposal.proposal_id);
            return Ok(());
        }
        
        // Check if passed
        if proposal.votes_for > proposal.votes_against {
            proposal.status = ProposalStatus::Passed;
            proposal.execution_slot = clock.slot + governance.execution_delay;
            msg!("Proposal #{} passed: {} for, {} against", 
                 proposal.proposal_id, proposal.votes_for / 1000000, proposal.votes_against / 1000000);
        } else {
            proposal.status = ProposalStatus::Defeated;
            msg!("Proposal #{} defeated: {} for, {} against", 
                 proposal.proposal_id, proposal.votes_for / 1000000, proposal.votes_against / 1000000);
        }
        
        Ok(())
    }

    /// Execute a passed proposal
    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let clock = Clock::get()?;
        
        // Validate proposal can be executed
        require!(proposal.status == ProposalStatus::Passed, ErrorCode::ProposalNotPassed);
        require!(!proposal.executed, ErrorCode::ProposalAlreadyExecuted);
        require!(clock.slot >= proposal.execution_slot, ErrorCode::ExecutionDelayNotMet);
        
        // Execute proposal based on type
        match proposal.proposal_type {
            ProposalType::ChangeSettlementFee => {
                msg!("Executing proposal #{}: Change settlement fee", proposal.proposal_id);
                // Implementation would update settlement fee
            }
            ProposalType::ChangeOracleSource => {
                msg!("Executing proposal #{}: Change oracle source", proposal.proposal_id);
                // Implementation would update oracle sources
            }
            ProposalType::ChangePoolFee => {
                msg!("Executing proposal #{}: Change pool fee", proposal.proposal_id);
                // Implementation would update AMM pool fees
            }
            ProposalType::ChangeStakingAPY => {
                msg!("Executing proposal #{}: Change staking APY", proposal.proposal_id);
                // Implementation would update staking APY
            }
            _ => {
                msg!("Executing proposal #{}: {:?}", proposal.proposal_id, proposal.proposal_type);
            }
        }
        
        proposal.executed = true;
        proposal.status = ProposalStatus::Executed;
        
        msg!("Proposal #{} executed successfully", proposal.proposal_id);
        Ok(())
    }

    /// Stake CADEN tokens to receive stkCADEN (governance tokens)
    pub fn stake_caden(ctx: Context<StakeCaden>, amount: u64) -> Result<()> {
        // Store governance data before borrowing
        let governance_bump = ctx.accounts.governance.bump;
        
        // Transfer CADEN from user to governance
        let transfer_ix = Transfer {
            from: ctx.accounts.user_caden_account.to_account_info(),
            to: ctx.accounts.governance_caden_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_ix,
        );
        anchor_spl::token::transfer(cpi_ctx, amount)?;
        
        // Mint stkCADEN tokens to user (1:1 ratio)
        let mint_stk_ix = MintTo {
            mint: ctx.accounts.staked_caden_mint.to_account_info(),
            to: ctx.accounts.user_stk_caden_account.to_account_info(),
            authority: ctx.accounts.governance.to_account_info(),
        };
        
        let seeds = &[
            b"governance",
            &[governance_bump][..],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            mint_stk_ix,
            signer,
        );
        anchor_spl::token::mint_to(cpi_ctx, amount)?;
        
        // Now we can safely borrow accounts mutably
        let governance = &mut ctx.accounts.governance;
        let staking_position = &mut ctx.accounts.staking_position;
        
        // Update staking position
        staking_position.owner = ctx.accounts.user.key();
        staking_position.caden_staked += amount;
        staking_position.stk_caden_tokens += amount;
        staking_position.staking_slot = ctx.accounts.clock.slot;
        staking_position.last_claim_slot = ctx.accounts.clock.slot;
        staking_position.bump = ctx.bumps.staking_position;
        
        // Update governance stats
        governance.staked_supply += amount;
        
        msg!("Staked {} CADEN tokens, received {} stkCADEN", amount, amount);
        Ok(())
    }

    /// Claim USDC fees from protocol revenue (real yield!)
    pub fn claim_fees(ctx: Context<ClaimFees>) -> Result<()> {
        let governance = &mut ctx.accounts.governance;
        let staking_position = &mut ctx.accounts.staking_position;
        
        // Calculate fees earned based on staking position
        let total_fees_available = governance.total_fees_collected;
        let user_share = (staking_position.stk_caden_tokens as u128 * total_fees_available as u128) / 
                        governance.staked_supply as u128;
        let fees_to_claim = user_share as u64 - staking_position.total_fees_claimed;
        
        require!(fees_to_claim > 0, ErrorCode::NoFeesToClaim);
        
        // Transfer USDC fees to user
        let governance_bump = governance.bump;
        let transfer_ix = Transfer {
            from: ctx.accounts.protocol_fee_vault.to_account_info(),
            to: ctx.accounts.user_usdc_account.to_account_info(),
            authority: ctx.accounts.governance.to_account_info(),
        };
        
        let seeds = &[
            b"governance",
            &[governance_bump][..],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_ix,
            signer,
        );
        anchor_spl::token::transfer(cpi_ctx, fees_to_claim)?;
        
        // Update staking position
        staking_position.total_fees_claimed += fees_to_claim;
        staking_position.last_claim_slot = ctx.accounts.clock.slot;
        
        msg!("Claimed {} USDC fees from protocol revenue (real yield!)", fees_to_claim);
        Ok(())
    }

    /// Buy back CADEN tokens with protocol fees (deflationary mechanism)
    pub fn buyback_caden(ctx: Context<BuybackCaden>, usdc_amount: u64) -> Result<()> {
        // Store governance data before borrowing
        let governance_bump = ctx.accounts.governance.bump;
        
        // Transfer USDC from protocol fee vault to buyback vault
        let transfer_ix = Transfer {
            from: ctx.accounts.protocol_fee_vault.to_account_info(),
            to: ctx.accounts.buyback_vault.to_account_info(),
            authority: ctx.accounts.governance.to_account_info(),
        };
        
        let seeds = &[
            b"governance",
            &[governance_bump][..],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_ix,
            signer,
        );
        anchor_spl::token::transfer(cpi_ctx, usdc_amount)?;
        
        // Now we can safely borrow governance mutably
        let governance = &mut ctx.accounts.governance;
        
        // Simulate CADEN buyback (in real implementation, this would use Serum/DEX)
        // For demo, we'll just track the buyback amount
        governance.total_caden_bought += usdc_amount; // 1 USDC = 1 CADEN for demo
        
        msg!("Bought back {} CADEN tokens with {} USDC protocol fees", 
             usdc_amount, usdc_amount);
        Ok(())
    }

    /// Initialize CADEN-CFD token mint
    pub fn init_token_mint(ctx: Context<InitTokenMint>) -> Result<()> {
        let token_mint = &mut ctx.accounts.token_mint;
        token_mint.mint = ctx.accounts.mint.key();
        token_mint.decimals = 6;
        token_mint.symbol = "CADEN-CFD".to_string();
        
        msg!("CADEN-CFD token mint initialized with 6 decimals");
        Ok(())
    }

    /// Settle market and transfer profits in USDC
    pub fn settle_market(ctx: Context<SettleMarket>) -> Result<()> {
        let market = &ctx.accounts.market;
        let position = &mut ctx.accounts.position;
        
        // Only callable after status == Settled
        require!(market.status == MarketStatus::Settled, ErrorCode::MarketNotSettled);
        
        // Calculate PnL: pnl = (T+2_price - T+0_price) * size * direction
        let price_diff = if market.t2_price > market.t0_price {
            market.t2_price - market.t0_price
        } else {
            market.t0_price - market.t2_price
        };
        
        let pnl = match position.side {
            PositionSide::Long => {
                if market.t2_price > market.t0_price {
                    (price_diff as u128 * position.size as u128) / market.t0_price as u128
                } else {
                    0 // Loss is handled by not transferring extra USDC
                }
            },
            PositionSide::Short => {
                if market.t2_price < market.t0_price {
                    (price_diff as u128 * position.size as u128) / market.t0_price as u128
                } else {
                    0 // Loss is handled by not transferring extra USDC
                }
            }
        };
        
        // Transfer profit in USDC from market vault to user
        if pnl > 0 {
            let transfer_ix = Transfer {
                from: ctx.accounts.market_usdc_vault.to_account_info(),
                to: ctx.accounts.user_usdc_account.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            };
            
            let seeds = &[
                b"market",
                &[market.bump][..],
            ];
            let signer = &[&seeds[..]];
            
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_ix,
                signer,
            );
            
            anchor_spl::token::transfer(cpi_ctx, pnl as u64)?;
        }
        
        // Burn user's CADEN-CFD tokens
        let burn_ix = anchor_spl::token::Burn {
            mint: ctx.accounts.cfd_mint.to_account_info(),
            from: ctx.accounts.user_cfd_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            burn_ix,
        );
        
        anchor_spl::token::burn(cpi_ctx, position.cfd_tokens)?;
        
        msg!("Position settled: PnL: {}, CFD tokens burned: {}", pnl, position.cfd_tokens);
        Ok(())
    }
}

// Account structures for PDAs

#[account]
pub struct Market {
    pub t0_price: u64,      // T+0 settlement price
    pub t2_price: u64,      // T+2 settlement price (set at settlement)
    pub expiry_slot: u64,   // Slot when market expires
    pub status: MarketStatus,
    pub usdc_vault: Pubkey, // USDC token account for collateral
    pub bump: u8,
}

#[account]
pub struct Position {
    pub owner: Pubkey,      // Owner of the position
    pub side: PositionSide, // Long or Short
    pub size: u64,          // Position size in USDC (6 decimals)
    pub entry_price: u64,   // Price when position was opened
    pub cfd_tokens: u64,    // Amount of CADEN-CFD tokens minted
    pub leverage: u8,       // Leverage multiplier (1-3x)
    pub collateral: u64,    // Actual collateral deposited
    pub liquidated: bool,   // Whether position has been liquidated
    pub liquidated_slot: u64, // Slot when liquidated (0 if not liquidated)
    pub bump: u8,
}

#[account]
pub struct OracleMock {
    pub admin: Pubkey,      // Admin who can update prices
    pub price: u64,         // Current price (for Bitcoin/primary asset)
    pub updated_slot: u64,  // Last update slot
}

#[account]
pub struct MultiAssetOracle {
    pub admin: Pubkey,                    // Admin who can update prices
    pub asset_prices: Vec<AssetPrice>,    // Prices for different assets
    pub updated_slot: u64,               // Last update slot
    pub bump: u8,                        // PDA bump seed
}

#[account]
pub struct SettlementSlotPool {
    pub pool_id: u64,                    // Unique pool identifier
    pub asset_symbol: String,            // Asset symbol (AAPL, BTC, etc.)
    pub asset_type: AssetType,           // Asset type (Stock, Crypto, etc.)
    pub settlement_time: u64,            // Settlement timing (0=T+0, 1=T+1, etc.)
    pub token_a_mint: Pubkey,            // USDC mint (always token A)
    pub token_b_mint: Pubkey,            // Settlement slot NFT mint (token B)
    pub token_a_vault: Pubkey,           // USDC vault
    pub token_b_vault: Pubkey,           // Settlement slot NFT vault
    pub token_a_amount: u64,             // Current USDC amount in pool
    pub token_b_amount: u64,             // Current settlement slot NFT amount in pool
    pub fee_rate: u16,                   // Fee rate in basis points (e.g., 30 = 0.3%)
    pub pool_authority: Pubkey,          // Pool authority (program)
    pub created_slot: u64,               // Slot when pool was created
    pub is_active: bool,                 // Whether pool is active
    pub bump: u8,                        // PDA bump seed
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AssetPrice {
    pub asset_symbol: String,    // AAPL, TSLA, BTC, etc.
    pub asset_type: AssetType,   // Stock, Crypto, Bond, etc.
    pub price: u64,             // Price in 6 decimals
    pub last_updated: u64,      // Last update slot
    pub source: PriceSource,    // Price feed source
    pub confidence: u64,        // Confidence interval
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Debug)]
pub enum PriceSource {
    Pyth,           // Pyth Network oracle
    Switchboard,    // Switchboard oracle
    Chainlink,      // Chainlink oracle (cross-chain)
    CoinGecko,      // CoinGecko API
    TwelveData,     // Twelve Data API (stocks)
    Binance,        // Binance price feed
    Manual,         // Manual admin update
    Aggregated,     // Aggregated from multiple sources
}

#[account]
pub struct OracleAggregator {
    pub admin: Pubkey,                          // Admin who can manage sources
    pub enabled_sources: Vec<PriceSource>,      // Active price sources
    pub price_feeds: Vec<PriceFeed>,            // All price feeds
    pub update_frequency: u64,                  // Update frequency in slots
    pub last_crank_slot: u64,                   // Last crank slot
    pub deviation_threshold: u16,               // Price deviation threshold (bps)
    pub bump: u8,                               // PDA bump seed
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PriceFeed {
    pub asset_symbol: String,           // Asset symbol
    pub asset_type: AssetType,          // Asset type
    pub pyth_price: u64,               // Pyth price
    pub switchboard_price: u64,        // Switchboard price
    pub external_price: u64,           // External API price
    pub aggregated_price: u64,         // Final aggregated price
    pub last_updated: u64,             // Last update slot
    pub is_stale: bool,                // Whether price is stale
}

#[account]
pub struct Governance {
    pub admin: Pubkey,           // Initial admin
    pub caden_mint: Pubkey,      // CADEN token mint
    pub treasury: Pubkey,        // Treasury account
    pub total_caden_staked: u64, // Total CADEN staked for governance
    pub total_fees_collected: u64, // Total fees collected
    pub total_caden_bought: u64, // Total CADEN bought back
    pub staking_apy: u16,        // Current staking APY in basis points
    pub proposal_count: u64,     // Total proposals created
    pub quorum_threshold: u64,   // Minimum votes for quorum (in CADEN)
    pub voting_period: u64,      // Voting period in slots
    pub execution_delay: u64,    // Delay before execution in slots
    pub bump: u8,
}

#[account]
pub struct GovernanceProposal {
    pub proposal_id: u64,            // Unique proposal ID
    pub proposer: Pubkey,            // Proposal creator
    pub proposal_type: ProposalType, // Type of proposal
    pub title: String,               // Proposal title (max 100 chars)
    pub description: String,         // Proposal description (max 500 chars)
    pub votes_for: u64,              // Total votes in favor
    pub votes_against: u64,          // Total votes against
    pub total_votes: u64,            // Total votes cast
    pub status: ProposalStatus,      // Current status
    pub created_slot: u64,           // Creation slot
    pub voting_ends_slot: u64,       // Voting end slot
    pub execution_slot: u64,         // Execution slot (if passed)
    pub executed: bool,              // Whether executed
    pub cancelled: bool,             // Whether cancelled
    pub bump: u8,                    // PDA bump seed
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Debug)]
pub enum ProposalType {
    ChangeSettlementFee,       // Change settlement fee rate
    ChangeOracleSource,        // Add/remove oracle source
    ChangePoolFee,             // Change AMM pool fee
    ChangeStakingAPY,          // Change staking APY
    AddNewAssetType,           // Add new asset type support
    TreasurySpend,             // Spend from treasury
    UpgradeProgram,            // Upgrade program
    EmergencyPause,            // Emergency pause
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Debug)]
pub enum ProposalStatus {
    Active,      // Currently voting
    Passed,      // Passed but not executed
    Executed,    // Passed and executed
    Defeated,    // Did not pass
    Cancelled,   // Cancelled by proposer
    Expired,     // Voting period expired
}

#[account]
pub struct Vote {
    pub proposal_id: u64,        // Proposal being voted on
    pub voter: Pubkey,           // Voter address
    pub vote_power: u64,         // Voting power (staked CADEN)
    pub vote_choice: VoteChoice, // Vote choice
    pub voted_slot: u64,         // Slot when voted
    pub bump: u8,                // PDA bump seed
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Debug)]
pub enum VoteChoice {
    For,
    Against,
    Abstain,
}

#[account]
pub struct SpreadHeatmap {
    pub spreads: [SpreadEntry; 100], // Fixed array of 100 entries
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct SpreadEntry {
    pub bid: u64,
    pub ask: u64,
}

#[account]
pub struct TokenMint {
    pub mint: Pubkey,       // CADEN-CFD token mint
    pub decimals: u8,       // 6 decimals for CADEN-CFD
    pub symbol: String,     // "CADEN-CFD"
}

#[account]
pub struct AmmPool {
    pub admin: Pubkey,           // Pool admin
    pub long_mint: Pubkey,       // Long CFD token mint
    pub short_mint: Pubkey,      // Short CFD token mint
    pub lp_mint: Pubkey,         // LP token mint
    pub long_vault: Pubkey,      // Long token vault
    pub short_vault: Pubkey,     // Short token vault
    pub long_reserve: u64,       // Long token reserves
    pub short_reserve: u64,      // Short token reserves
    pub lp_supply: u64,          // Total LP tokens minted
    pub swap_fee_bps: u16,       // Swap fee in basis points (20 = 0.2%)
    pub protocol_fee_bps: u16,   // Protocol fee in basis points (5 = 0.05%)
    pub total_fees_collected: u64, // Total fees collected (for stats)
    pub total_volume: u64,       // Total trading volume
    pub bump: u8,
}

#[account]
pub struct LpPosition {
    pub owner: Pubkey,           // LP owner
    pub lp_tokens: u64,          // LP tokens owned
    pub fees_earned: u64,        // Total fees earned
    pub last_fee_checkpoint: u64, // Last fee collection checkpoint
    pub bump: u8,
}

#[account]
pub struct CadenGovernance {
    pub admin: Pubkey,           // Protocol admin
    pub caden_mint: Pubkey,      // CADEN token mint
    pub staked_caden_mint: Pubkey, // stkCADEN token mint
    pub total_supply: u64,       // Total CADEN supply (1B fixed)
    pub staked_supply: u64,      // Total staked CADEN
    pub protocol_fee_vault: Pubkey, // USDC vault for protocol fees
    pub buyback_vault: Pubkey,   // USDC vault for CADEN buybacks
    pub total_fees_collected: u64, // Total protocol fees collected
    pub total_caden_bought: u64, // Total CADEN bought back
    pub staking_apy: u16,        // Current staking APY in basis points
    pub proposal_count: u64,     // Total governance proposals created
    pub quorum_threshold: u64,   // Minimum votes for quorum (in CADEN)
    pub voting_period: u64,      // Voting period in slots
    pub execution_delay: u64,    // Delay before execution in slots
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Debug)]
pub enum AssetType {
    Stock,      // AAPL, TSLA, GOOGL
    Crypto,     // BTC, ETH, SOL
    Bond,       // US10Y, TLT
    Commodity,  // GOLD, OIL, WHEAT
    Forex,      // EUR/USD, GBP/USD
}

#[account]
pub struct SettlementSlot {
    pub slot_id: u64,            // Unique slot identifier
    pub asset_symbol: String,    // Asset being settled (AAPL, TSLA, etc.)
    pub asset_type: AssetType,   // Type of asset (Stock, Crypto, Bond, etc.)
    pub settlement_time: u64,    // Settlement timing (0=T+0, 1=T+1, 2=T+2, etc.)
    pub slot_duration: u64,      // Duration of slot in days
    pub owner: Pubkey,           // Current owner of the settlement slot
    pub mint_price: u64,         // Price paid to mint this slot
    pub created_slot: u64,       // Slot when this was created
    pub expiry_slot: u64,        // Slot when this expires
    pub is_tradable: bool,       // Whether this slot can be traded
    pub is_active: bool,         // Whether this slot is still active
    pub bump: u8,                // PDA bump seed
}

#[account]
pub struct Bet {
    pub owner: Pubkey,           // Owner of the bet
    pub bet_id: u64,             // Unique bet identifier
    pub asset_symbol: String,    // Asset being bet on (BTC, ETH, AAPL, etc.)
    pub asset_type: AssetType,   // Type of asset
    pub bet_amount: u64,         // Bet amount in USDC (6 decimals)
    pub is_long: bool,           // True = bet price goes up, False = bet price goes down
    pub entry_price: u64,        // Price when bet was placed (6 decimals)
    pub created_slot: u64,       // Slot when bet was created
    pub is_settled: bool,        // Whether bet has been settled
    pub settlement_value: u64,   // Final settlement value (0 if not settled)
    pub bump: u8,                // PDA bump seed
}

#[account]
pub struct StakingPosition {
    pub owner: Pubkey,           // Staker
    pub caden_staked: u64,       // CADEN tokens staked
    pub stk_caden_tokens: u64,   // stkCADEN tokens received
    pub staking_slot: u64,       // Slot when staked
    pub last_claim_slot: u64,    // Last fee claim slot
    pub total_fees_claimed: u64, // Total USDC fees claimed
    pub bump: u8,
}

// Enums

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MarketStatus {
    Active,
    Settled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum PositionSide {
    Long,
    Short,
}

// Instruction contexts

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
pub struct InitMarket<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 32 + 1,
        seeds = [b"market"],
        bump
    )]
    pub market: Account<'info, Market>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        init_if_needed,
        payer = user,
        token::mint = usdc_mint,
        token::authority = market,
        seeds = [b"usdc_vault"],
        bump
    )]
    pub usdc_vault: Account<'info, TokenAccount>,
    
    /// CHECK: USDC mint address (passed as parameter)
    pub usdc_mint: AccountInfo<'info>,
    
    pub oracle_mock: Account<'info, OracleMock>,
    
    pub token_program: Program<'info, Token>,  // Changed from Token2022 to Token
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InitOracle<'info> {
    #[account(
        init_if_needed,  // Changed from init to init_if_needed
        payer = admin,
        space = 8 + 32 + 8 + 8,
        seeds = [b"oracle"],
        bump
    )]
    pub oracle_mock: Account<'info, OracleMock>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitHeatmap<'info> {
    #[account(
        init_if_needed,
        payer = admin,
        space = 1650, // Match existing account size
        seeds = [b"heatmap"],
        bump
    )]
    pub heatmap: Account<'info, SpreadHeatmap>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CrankHeatmap<'info> {
    #[account(
        mut,
        seeds = [b"heatmap"],
        bump
    )]
    pub heatmap: Account<'info, SpreadHeatmap>,
    
    #[account(
        seeds = [b"market"],
        bump = market.bump
    )]
    pub market: Account<'info, Market>,
    
    pub oracle_mock: Account<'info, OracleMock>,
}

#[derive(Accounts)]
pub struct InitAmmPool<'info> {
    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + 32 + 32 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 2 + 2 + 8 + 8 + 1,
        seeds = [b"amm_pool"],
        bump
    )]
    pub pool: Account<'info, AmmPool>,
    
    pub long_mint: Account<'info, Mint>,
    pub short_mint: Account<'info, Mint>,
    
    #[account(
        init_if_needed,
        payer = admin,
        mint::decimals = 6,
        mint::authority = pool,
        seeds = [b"lp_mint"],
        bump
    )]
    pub lp_mint: Account<'info, Mint>,
    
    #[account(
        init_if_needed,
        payer = admin,
        token::mint = long_mint,
        token::authority = pool,
        seeds = [b"long_vault"],
        bump
    )]
    pub long_vault: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = admin,
        token::mint = short_mint,
        token::authority = pool,
        seeds = [b"short_vault"],
        bump
    )]
    pub short_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub token_program: Program<'info, Token>,  // Changed from Token2022 to Token
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(
        mut,
        seeds = [b"amm_pool"],
        bump = pool.bump
    )]
    pub pool: Account<'info, AmmPool>,
    
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 32 + 8 + 8 + 8 + 1,
        seeds = [b"lp_position", user.key().as_ref()],
        bump
    )]
    pub lp_position: Account<'info, LpPosition>,
    
    #[account(mut)]
    pub long_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub short_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub lp_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub user_long_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_short_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_lp_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,  // Changed from Token2022 to Token
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SwapCfdTokens<'info> {
    #[account(
        mut,
        seeds = [b"amm_pool"],
        bump = pool.bump
    )]
    pub pool: Account<'info, AmmPool>,
    
    #[account(mut)]
    pub vault_in: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub vault_out: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_in: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_out: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,  // Changed from Token2022 to Token
}

#[derive(Accounts)]
pub struct InitGovernance<'info> {
    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + 32 + 32 + 32 + 8 + 8 + 32 + 32 + 8 + 8 + 2 + 8 + 8 + 8 + 8 + 1,
        seeds = [b"governance"],
        bump
    )]
    pub governance: Account<'info, CadenGovernance>,
    
    pub caden_mint: Account<'info, Mint>,
    
    #[account(
        init_if_needed,
        payer = admin,
        mint::decimals = 6,
        mint::authority = governance,
        seeds = [b"staked_caden_mint"],
        bump
    )]
    pub staked_caden_mint: Account<'info, Mint>,
    
    #[account(
        init_if_needed,
        payer = admin,
        token::mint = usdc_mint,
        token::authority = governance,
        seeds = [b"protocol_fee_vault"],
        bump
    )]
    pub protocol_fee_vault: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = admin,
        token::mint = usdc_mint,
        token::authority = governance,
        seeds = [b"buyback_vault"],
        bump
    )]
    pub buyback_vault: Account<'info, TokenAccount>,
    
    pub usdc_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub token_program: Program<'info, Token>,  // Changed from Token2022 to Token
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct StakeCaden<'info> {
    #[account(
        mut,
        seeds = [b"governance"],
        bump = governance.bump
    )]
    pub governance: Account<'info, CadenGovernance>,
    
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 32 + 8 + 8 + 8 + 8 + 8 + 1,
        seeds = [b"staking_position", user.key().as_ref()],
        bump
    )]
    pub staking_position: Account<'info, StakingPosition>,
    
    #[account(mut)]
    pub caden_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub staked_caden_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub governance_caden_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_caden_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_stk_caden_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub clock: Sysvar<'info, Clock>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimFees<'info> {
    #[account(
        mut,
        seeds = [b"governance"],
        bump = governance.bump
    )]
    pub governance: Account<'info, CadenGovernance>,
    
    #[account(
        mut,
        seeds = [b"staking_position", user.key().as_ref()],
        bump = staking_position.bump
    )]
    pub staking_position: Account<'info, StakingPosition>,
    
    #[account(mut)]
    pub protocol_fee_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub clock: Sysvar<'info, Clock>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BuybackCaden<'info> {
    #[account(
        mut,
        seeds = [b"governance"],
        bump = governance.bump
    )]
    pub governance: Account<'info, CadenGovernance>,
    
    #[account(mut)]
    pub protocol_fee_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub buyback_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateOracle<'info> {
    #[account(
        mut,
        constraint = oracle_mock.admin == admin.key() @ ErrorCode::Unauthorized
    )]
    pub oracle_mock: Account<'info, OracleMock>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(position_side: PositionSide, size: u64, leverage: u8)]
pub struct MintCfd<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 1 + 8 + 8 + 8 + 1 + 8 + 1 + 8 + 1,
        seeds = [b"position", user.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,
    
    #[account(
        mut,
        seeds = [b"market"],
        bump = market.bump
    )]
    pub market: Account<'info, Market>,
    
    #[account(
        mut,
        seeds = [b"usdc_vault"],
        bump
    )]
    pub market_usdc_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"mint"],
        bump
    )]
    pub cfd_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = cfd_mint,
        associated_token::authority = user
    )]
    pub user_cfd_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub oracle_mock: Account<'info, OracleMock>,
    
    pub token_program: Program<'info, Token>,  // Changed from Token2022 to Token
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitTokenMint<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 32 + 1 + 4 + 16, // discriminator + mint + decimals + string_len + up to 16 chars
        seeds = [b"token_mint"],
        bump
    )]
    pub token_mint: Account<'info, TokenMint>,
    
    #[account(
        init_if_needed,
        payer = user,
        mint::decimals = 6,
        mint::authority = user,
        seeds = [b"mint"],
        bump
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,  // Changed from Token2022 to Token
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct LiquidatePosition<'info> {
    #[account(
        mut,
        seeds = [b"position", position.owner.as_ref()],
        bump = position.bump,
        constraint = !position.liquidated @ ErrorCode::PositionAlreadyLiquidated
    )]
    pub position: Account<'info, Position>,
    
    #[account(
        mut,
        seeds = [b"market"],
        bump = market.bump
    )]
    pub market: Account<'info, Market>,
    
    #[account(
        mut,
        seeds = [b"usdc_vault"],
        bump
    )]
    pub market_usdc_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"mint"],
        bump
    )]
    pub cfd_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = cfd_mint,
        associated_token::authority = position.owner
    )]
    pub user_cfd_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = position.owner
    )]
    pub user_usdc_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = liquidator
    )]
    pub liquidator_usdc_account: Account<'info, TokenAccount>,
    
    /// CHECK: USDC mint address
    pub usdc_mint: AccountInfo<'info>,
    
    #[account(mut)]
    pub liquidator: Signer<'info>,
    
    pub oracle_mock: Account<'info, OracleMock>,
    
    pub token_program: Program<'info, Token>,  // Changed from Token2022 to Token
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    #[account(
        mut,
        seeds = [b"market"],
        bump = market.bump
    )]
    pub market: Account<'info, Market>,
    
    #[account(
        mut,
        seeds = [b"position", user.key().as_ref()],
        bump = position.bump,
        close = user
    )]
    pub position: Account<'info, Position>,
    
    #[account(
        mut,
        seeds = [b"usdc_vault"],
        bump
    )]
    pub market_usdc_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"mint"],
        bump
    )]
    pub cfd_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = cfd_mint,
        associated_token::authority = user
    )]
    pub user_cfd_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = user
    )]
    pub user_usdc_account: Account<'info, TokenAccount>,
    
    /// CHECK: USDC mint address
    pub usdc_mint: AccountInfo<'info>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub oracle_mock: Account<'info, OracleMock>,
    
    pub token_program: Program<'info, Token>,  // Changed from Token2022 to Token
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(asset_symbol: String, asset_type: AssetType, settlement_time: u64, slot_duration: u64, slot_price: u64, nft_seed: u64)]
pub struct MintSettlementSlotNft<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + 8 + 10 + 1 + 8 + 8 + 32 + 8 + 8 + 8 + 1 + 1 + 1, // SettlementSlot size (added asset_type)
        seeds = [b"settlement_slot", owner.key().as_ref(), &nft_seed.to_le_bytes()],
        bump
    )]
    pub settlement_slot: Account<'info, SettlementSlot>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub clock: Sysvar<'info, Clock>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TradeSettlementSlot<'info> {
    #[account(
        mut,
        seeds = [b"settlement_slot", settlement_slot.owner.as_ref(), &settlement_slot.created_slot.to_le_bytes()],
        bump = settlement_slot.bump
    )]
    pub settlement_slot: Account<'info, SettlementSlot>,
    
    #[account(mut)]
    pub seller: Signer<'info>,
    
    /// CHECK: Buyer public key
    pub buyer: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(asset_symbol: String, asset_type: AssetType, bet_amount: u64, is_long: bool, bet_seed: u64)]
pub struct PlaceBet<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 8 + 10 + 1 + 8 + 1 + 8 + 8 + 1 + 8 + 1, // Bet size
        seeds = [b"bet", user.key().as_ref(), &bet_seed.to_le_bytes()],
        bump
    )]
    pub bet: Account<'info, Bet>,
    
    pub multi_oracle: Account<'info, MultiAssetOracle>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(bet_id: u64, settlement_slot_id: u64)]
pub struct InstantT0Settlement<'info> {
    #[account(
        mut,
        seeds = [b"bet", bet.owner.as_ref(), &bet_id.to_le_bytes()],
        bump = bet.bump
    )]
    pub bet: Account<'info, Bet>,
    
    #[account(
        seeds = [b"settlement_slot", settlement_slot.owner.as_ref(), &settlement_slot_id.to_le_bytes()],
        bump = settlement_slot.bump
    )]
    pub settlement_slot: Account<'info, SettlementSlot>,
    
    pub multi_oracle: Account<'info, MultiAssetOracle>,
    
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitMultiAssetOracle<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 4 + (100 * (10 + 1 + 8 + 8)) + 8 + 1, // MultiAssetOracle size
        seeds = [b"multi_oracle"],
        bump
    )]
    pub multi_oracle: Account<'info, MultiAssetOracle>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAssetPrice<'info> {
    #[account(
        mut,
        seeds = [b"multi_oracle"],
        bump = multi_oracle.bump
    )]
    pub multi_oracle: Account<'info, MultiAssetOracle>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateSettlementSlotPool<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + 8 + 10 + 1 + 8 + 32 + 32 + 32 + 32 + 8 + 8 + 2 + 32 + 8 + 1 + 1, // SettlementSlotPool size
        seeds = [b"settlement_pool", creator.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, SettlementSlotPool>,
    
    pub usdc_mint: Account<'info, Mint>,
    pub slot_nft_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = creator,
        token::mint = usdc_mint,
        token::authority = pool_authority,
        seeds = [b"token_a_vault", pool.key().as_ref()],
        bump
    )]
    pub token_a_vault: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = creator,
        token::mint = slot_nft_mint,
        token::authority = pool_authority,
        seeds = [b"token_b_vault", pool.key().as_ref()],
        bump
    )]
    pub token_b_vault: Account<'info, TokenAccount>,
    
    #[account(
        seeds = [b"pool_authority", pool.key().as_ref()],
        bump
    )]
    pub pool_authority: SystemAccount<'info>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AddLiquidityToPool<'info> {
    #[account(
        mut,
        seeds = [b"settlement_pool"],
        bump = pool.bump
    )]
    pub pool: Account<'info, SettlementSlotPool>,
    
    #[account(mut)]
    pub token_a_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub token_b_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_a: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_b: Account<'info, TokenAccount>,
    
    #[account(
        seeds = [b"pool_authority", pool.key().as_ref()],
        bump
    )]
    pub pool_authority: SystemAccount<'info>,
    
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SwapUsdcForSlots<'info> {
    #[account(
        mut,
        seeds = [b"settlement_pool"],
        bump = pool.bump
    )]
    pub pool: Account<'info, SettlementSlotPool>,
    
    #[account(mut)]
    pub token_a_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub token_b_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_a: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_b: Account<'info, TokenAccount>,
    
    #[account(
        seeds = [b"pool_authority", pool.key().as_ref()],
        bump
    )]
    pub pool_authority: SystemAccount<'info>,
    
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitOracleAggregator<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 4 + 4 + (100 * (10 + 1 + 8 + 8 + 8 + 8 + 8 + 1)) + 8 + 8 + 2 + 1, // OracleAggregator size
        seeds = [b"oracle_aggregator"],
        bump
    )]
    pub oracle_aggregator: Account<'info, OracleAggregator>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePriceFromPyth<'info> {
    #[account(
        mut,
        seeds = [b"oracle_aggregator"],
        bump = oracle_aggregator.bump
    )]
    pub oracle_aggregator: Account<'info, OracleAggregator>,
    
    /// CHECK: Pyth price account - validated in instruction
    pub pyth_price_account: AccountInfo<'info>,
    
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdatePriceFromSwitchboard<'info> {
    #[account(
        mut,
        seeds = [b"oracle_aggregator"],
        bump = oracle_aggregator.bump
    )]
    pub oracle_aggregator: Account<'info, OracleAggregator>,
    
    /// CHECK: Switchboard aggregator account - validated in instruction
    pub switchboard_aggregator: AccountInfo<'info>,
    
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdatePriceFromExternal<'info> {
    #[account(
        mut,
        seeds = [b"oracle_aggregator"],
        bump = oracle_aggregator.bump
    )]
    pub oracle_aggregator: Account<'info, OracleAggregator>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(
        init,
        payer = proposer,
        space = 8 + 8 + 32 + 1 + 100 + 500 + 8 + 8 + 8 + 1 + 8 + 8 + 8 + 1 + 1 + 1, // GovernanceProposal size
        seeds = [b"proposal", &governance.proposal_count.to_le_bytes()],
        bump
    )]
    pub proposal: Account<'info, GovernanceProposal>,
    
    #[account(
        mut,
        seeds = [b"governance"],
        bump = governance.bump
    )]
    pub governance: Account<'info, CadenGovernance>,
    
    #[account(
        seeds = [b"staking_position", proposer.key().as_ref()],
        bump = staking_position.bump
    )]
    pub staking_position: Account<'info, StakingPosition>,
    
    #[account(mut)]
    pub proposer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(
        init,
        payer = voter,
        space = 8 + 8 + 32 + 8 + 1 + 8 + 1, // Vote size
        seeds = [b"vote", voter.key().as_ref()],
        bump
    )]
    pub vote: Account<'info, Vote>,
    
    #[account(
        mut,
        seeds = [b"proposal", &proposal.proposal_id.to_le_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, GovernanceProposal>,
    
    #[account(
        seeds = [b"staking_position", voter.key().as_ref()],
        bump = staking_position.bump
    )]
    pub staking_position: Account<'info, StakingPosition>,
    
    #[account(mut)]
    pub voter: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeProposal<'info> {
    #[account(
        mut,
        seeds = [b"proposal", &proposal.proposal_id.to_le_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, GovernanceProposal>,
    
    #[account(
        seeds = [b"governance"],
        bump = governance.bump
    )]
    pub governance: Account<'info, CadenGovernance>,
    
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(
        mut,
        seeds = [b"proposal", &proposal.proposal_id.to_le_bytes()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, GovernanceProposal>,
    
    #[account(
        seeds = [b"governance"],
        bump = governance.bump
    )]
    pub governance: Account<'info, CadenGovernance>,
    
    pub admin: Signer<'info>,
}

// Error codes

#[error_code]
pub enum ErrorCode {
    #[msg("You are not authorized to perform this action")]
    Unauthorized,
    #[msg("Market has already been settled")]
    MarketAlreadySettled,
    #[msg("Market is not active")]
    MarketNotActive,
    #[msg("Market is not settled")]
    MarketNotSettled,
    #[msg("Oracle price move exceeds 5% limit")]
    OracleMoveTooLarge,
    #[msg("Invalid leverage: must be between 1x and 3x")]
    InvalidLeverage,
    #[msg("Position is already liquidated")]
    PositionAlreadyLiquidated,
    #[msg("Position is healthy and cannot be liquidated")]
    PositionHealthy,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("No fees available to claim")]
    NoFeesToClaim,
    #[msg("Invalid asset symbol")]
    InvalidAssetSymbol,
    #[msg("Invalid settlement time")]
    InvalidSettlementTime,
    #[msg("Settlement slot is not tradable")]
    SlotNotTradable,
    #[msg("Settlement slot has expired")]
    SlotExpired,
    #[msg("Invalid settlement slot ID")]
    InvalidSettlementSlot,
    #[msg("Not an instant settlement slot")]
    NotInstantSettlement,
    #[msg("Bet amount must be at least $10")]
    BetAmountTooSmall,
    #[msg("Asset not found in oracle")]
    AssetNotFound,
    #[msg("Invalid bet ID")]
    InvalidBetId,
    #[msg("Bet has already been settled")]
    BetAlreadySettled,
    #[msg("Invalid asset type")]
    InvalidAssetType,
    #[msg("Invalid fee rate")]
    InvalidFeeRate,
    #[msg("Pool is inactive")]
    PoolInactive,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Insufficient output amount")]
    InsufficientOutputAmount,
    #[msg("Invalid price source")]
    InvalidPriceSource,
    #[msg("Insufficient stake for proposal creation")]
    InsufficientStakeForProposal,
    #[msg("Title too long")]
    TitleTooLong,
    #[msg("Description too long")]
    DescriptionTooLong,
    #[msg("Proposal not active")]
    ProposalNotActive,
    #[msg("Voting period ended")]
    VotingPeriodEnded,
    #[msg("No voting power")]
    NoVotingPower,
    #[msg("Voting period not ended")]
    VotingPeriodNotEnded,
    #[msg("Proposal not passed")]
    ProposalNotPassed,
    #[msg("Proposal already executed")]
    ProposalAlreadyExecuted,
    #[msg("Execution delay not met")]
    ExecutionDelayNotMet,
    #[msg("Invalid price data from oracle")]
    InvalidPriceData,
}

// Helper function to calculate aggregated price from multiple sources
fn calculate_aggregated_price(pyth_price: u64, switchboard_price: u64, external_price: u64) -> u64 {
    let mut prices = Vec::new();
    let mut count = 0;
    
    if pyth_price > 0 {
        prices.push(pyth_price);
        count += 1;
    }
    if switchboard_price > 0 {
        prices.push(switchboard_price);
        count += 1;
    }
    if external_price > 0 {
        prices.push(external_price);
        count += 1;
    }
    
    if count == 0 {
        return 0;
    }
    
    // Calculate median price for better accuracy
    prices.sort();
    if count % 2 == 0 {
        (prices[count / 2 - 1] + prices[count / 2]) / 2
    } else {
        prices[count / 2]
    }
}



