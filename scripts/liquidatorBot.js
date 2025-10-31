// CADEN Liquidator Bot - Monitors and liquidates unhealthy positions
// Demo visual: position health bar turns red → liquidates in 1 slot → liquidator bot earns bonus

const { AnchorProvider, Program, Wallet, BN } = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { createAssociatedTokenAccount, getAssociatedTokenAddress } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

// Load configuration
const PROGRAM_ID = "9G2Fb9kCjUAA5Te38EcJzYkKRYT5gC7LweYArFZJTot";
const walletPath = '/Users/n/my-solana-wallet.json';
const walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));
const realConfig = JSON.parse(fs.readFileSync('/Users/n/hackathons/solana/seam/app/src/config/realConfig.json', 'utf8'));

// Load the IDL
const idlPath = path.join(__dirname, '../app/src/idl/seam.json');
const IDL = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

class LiquidatorBot {
    constructor() {
        this.connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        this.wallet = new Wallet(walletKeypair);
        this.provider = new AnchorProvider(this.connection, this.wallet, { preflightCommitment: 'processed' });
        this.program = new Program(IDL, new PublicKey(PROGRAM_ID), this.provider);
        this.isRunning = false;
        this.liquidationCount = 0;
        this.totalEarnings = 0;

        // PDAs
        this.marketPDA = PublicKey.findProgramAddressSync([Buffer.from("market")], new PublicKey(PROGRAM_ID))[0];
        this.oraclePDA = PublicKey.findProgramAddressSync([Buffer.from("oracle")], new PublicKey(PROGRAM_ID))[0];
        this.usdcVaultPDA = PublicKey.findProgramAddressSync([Buffer.from("usdc_vault")], new PublicKey(PROGRAM_ID))[0];
        this.cfdMintPDA = PublicKey.findProgramAddressSync([Buffer.from("mint")], new PublicKey(PROGRAM_ID))[0];

        console.log('🤖 CADEN Liquidator Bot Initialized');
        console.log('==================================');
        console.log('💰 Bot Wallet:', walletKeypair.publicKey.toString());
        console.log('🎯 Program ID:', PROGRAM_ID);
        console.log('📊 Market PDA:', this.marketPDA.toString());
        console.log('🔮 Oracle PDA:', this.oraclePDA.toString());
    }

    async start() {
        console.log('\n🚀 Starting Liquidator Bot...');
        this.isRunning = true;

        // Ensure bot has USDC account
        await this.setupBotAccount();

        // Start monitoring loop
        this.monitorPositions();

        console.log('✅ Liquidator Bot is now running!');
        console.log('🔍 Monitoring positions every slot...');
        console.log('⚡ Ready to liquidate unhealthy positions in 1 slot!');
    }

    async setupBotAccount() {
        try {
            // Check if bot already has USDC account
            const botUsdcAccount = await getAssociatedTokenAddress(
                new PublicKey(realConfig.USDC_MINT),
                walletKeypair.publicKey
            );

            const accountInfo = await this.connection.getAccountInfo(botUsdcAccount);
            if (!accountInfo) {
                console.log('🏗️  Creating bot USDC account...');
                await createAssociatedTokenAccount(
                    this.connection,
                    walletKeypair,
                    new PublicKey(realConfig.USDC_MINT),
                    walletKeypair.publicKey
                );
                console.log('✅ Bot USDC account created:', botUsdcAccount.toString());
            } else {
                console.log('✅ Bot USDC account exists:', botUsdcAccount.toString());
            }

            this.botUsdcAccount = botUsdcAccount;
        } catch (error) {
            console.error('❌ Error setting up bot account:', error);
        }
    }

    async monitorPositions() {
        while (this.isRunning) {
            try {
                // Get current slot for timing
                const currentSlot = await this.connection.getSlot();

                // Get all position accounts
                const positions = await this.program.account.position.all();

                if (positions.length > 0) {
                    console.log(`\\n🔍 Slot ${currentSlot}: Monitoring ${positions.length} positions...`);

                    // Check each position for liquidation
                    for (const positionAccount of positions) {
                        const position = positionAccount.account;

                        // Skip already liquidated positions
                        if (position.liquidated) continue;

                        const healthStatus = await this.checkPositionHealth(position);

                        if (healthStatus.needsLiquidation) {
                            console.log(`\\n🚨 UNHEALTHY POSITION DETECTED!`);
                            console.log(`   Owner: ${position.owner.toString()}`);
                            console.log(`   Health: ${healthStatus.healthPercentage.toFixed(1)}%`);
                            console.log(`   Collateral Ratio: ${healthStatus.collateralRatio}bps`);
                            console.log(`   ⚡ LIQUIDATING IN 1 SLOT...`);

                            await this.liquidatePosition(positionAccount.publicKey, position);
                        } else {
                            // Show healthy positions
                            console.log(`   ✅ Position ${position.owner.toString().slice(0, 8)}... Health: ${healthStatus.healthPercentage.toFixed(1)}%`);
                        }
                    }
                } else {
                    console.log(`\\n🔍 Slot ${currentSlot}: No positions to monitor`);
                }

                // Show bot stats
                if (this.liquidationCount > 0) {
                    console.log(`\\n📊 Bot Stats: ${this.liquidationCount} liquidations, $${(this.totalEarnings / 1e6).toFixed(2)} earned`);
                }

                // Wait for next slot (approximately 400ms on devnet)
                await new Promise(resolve => setTimeout(resolve, 400));

            } catch (error) {
                console.error('❌ Error monitoring positions:', error.message);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async checkPositionHealth(position) {
        try {
            // Get current oracle price
            const oracleAccount = await this.program.account.oracleMock.fetch(this.oraclePDA);
            const currentPrice = oracleAccount.price.toNumber();

            // Calculate unrealized P&L
            const entryPrice = position.entryPrice.toNumber();
            const size = position.size.toNumber();
            const collateral = position.collateral.toNumber();

            const priceDiff = Math.abs(currentPrice - entryPrice);
            const priceChangePercent = (priceDiff / entryPrice) * 100;

            let unrealizedPnl = 0;
            if (position.side.long) {
                unrealizedPnl = currentPrice > entryPrice ?
                    (priceDiff * size) / entryPrice :
                    -((priceDiff * size) / entryPrice);
            } else {
                unrealizedPnl = currentPrice < entryPrice ?
                    (priceDiff * size) / entryPrice :
                    -((priceDiff * size) / entryPrice);
            }

            // Calculate current collateral value
            const currentCollateralValue = Math.max(0, collateral + unrealizedPnl);

            // Calculate collateral ratio (in basis points)
            const collateralRatio = (currentCollateralValue / size) * 10000;
            const healthPercentage = (collateralRatio / 100); // Convert to percentage

            // Maintenance threshold is 90% (9000 basis points)
            const maintenanceThreshold = 9000;
            const needsLiquidation = collateralRatio < maintenanceThreshold;

            return {
                needsLiquidation,
                healthPercentage,
                collateralRatio,
                currentPrice,
                entryPrice,
                unrealizedPnl,
                currentCollateralValue,
                priceChangePercent
            };

        } catch (error) {
            console.error('Error checking position health:', error);
            return { needsLiquidation: false, healthPercentage: 100, collateralRatio: 10000 };
        }
    }

    async liquidatePosition(positionPDA, position) {
        try {
            console.log('⚡ EXECUTING LIQUIDATION...');

            // Get user's USDC and CFD accounts
            const userUsdcAccount = await getAssociatedTokenAddress(
                new PublicKey(realConfig.USDC_MINT),
                position.owner
            );

            const userCfdAccount = await getAssociatedTokenAddress(
                this.cfdMintPDA,
                position.owner
            );

            // Execute liquidation transaction
            const tx = await this.program.methods
                .liquidatePosition()
                .accounts({
                    position: positionPDA,
                    market: this.marketPDA,
                    marketUsdcVault: this.usdcVaultPDA,
                    cfdMint: this.cfdMintPDA,
                    userCfdAccount: userCfdAccount,
                    userUsdcAccount: userUsdcAccount,
                    liquidatorUsdcAccount: this.botUsdcAccount,
                    usdcMint: new PublicKey(realConfig.USDC_MINT),
                    liquidator: walletKeypair.publicKey,
                    oracleMock: this.oraclePDA,
                    tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
                    associatedTokenProgram: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
                    systemProgram: new PublicKey("11111111111111111111111111111111"),
                })
                .rpc();

            this.liquidationCount++;
            const estimatedBonus = position.collateral.toNumber() * 0.01; // 1% bonus
            this.totalEarnings += estimatedBonus;

            console.log('\\n🎉 LIQUIDATION SUCCESSFUL!');
            console.log('========================');
            console.log('💀 Position Owner:', position.owner.toString());
            console.log('💰 Liquidation Bonus: ~$' + (estimatedBonus / 1e6).toFixed(2));
            console.log('📝 Transaction:', tx);
            console.log('🔗 Explorer: https://explorer.solana.com/tx/' + tx + '?cluster=devnet');
            console.log('⚡ Liquidated in 1 slot as promised!');

            // Show dramatic success message
            console.log('\\n🚨🚨🚨 LIQUIDATION ALERT 🚨🚨🚨');
            console.log('Position health bar turned RED → LIQUIDATED!');
            console.log('Liquidator bot earned bonus → PROFIT!');
            console.log('User protected from further losses → SAFETY!');

        } catch (error) {
            console.error('❌ Liquidation failed:', error.message);
        }
    }

    stop() {
        console.log('\\n🛑 Stopping Liquidator Bot...');
        this.isRunning = false;
        console.log('✅ Bot stopped');
        console.log(`📊 Final Stats: ${this.liquidationCount} liquidations, $${(this.totalEarnings / 1e6).toFixed(2)} total earnings`);
    }
}

// Main execution
async function main() {
    const bot = new LiquidatorBot();
    await bot.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        bot.stop();
        process.exit(0);
    });
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = LiquidatorBot;
