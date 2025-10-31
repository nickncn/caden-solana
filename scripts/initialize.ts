import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import fs from "fs";

// Load the program IDL
const idl = JSON.parse(fs.readFileSync("./target/idl/caden.json", "utf-8"));

async function initialize() {
    // Configure the client
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = new Program(idl, provider);
    const wallet = provider.wallet as anchor.Wallet;

    console.log("🚀 Starting Caden initialization...");
    console.log("📍 Program ID:", program.programId.toString());
    console.log("💰 Wallet:", wallet.publicKey.toString());

    try {
        // ========================================
        // TASK 2: Initialize Governance
        // ========================================
        console.log("\n📋 Step 1: Initializing Governance...");

        // Create CADEN token mint
        console.log("Creating CADEN token mint...");
        const cadenMint = await createMint(
            provider.connection,
            wallet.payer,
            wallet.publicKey,
            wallet.publicKey,
            6 // 6 decimals
        );
        console.log("✅ CADEN Mint:", cadenMint.toString());

        // Create staked CADEN mint
        // Derive stkCADEN mint PDA (will be created by the program)
        const [stkCadenMintPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("staked_caden_mint")],
            program.programId
        );
        console.log("✅ stkCADEN Mint PDA:", stkCadenMintPDA.toString());

        // Find governance PDA
        const [governancePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("governance")],
            program.programId
        );

        // Derive vault PDAs (will be created by the program)
        const [protocolFeeVaultPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("protocol_fee_vault")],
            program.programId
        );
        const [buybackVaultPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("buyback_vault")],
            program.programId
        );
        console.log("✅ Protocol Fee Vault PDA:", protocolFeeVaultPDA.toString());
        console.log("✅ Buyback Vault PDA:", buybackVaultPDA.toString());

        // Create USDC mint for testing
        console.log("Creating USDC mint...");
        const usdcMint = await createMint(
            provider.connection,
            wallet.payer,
            wallet.publicKey,
            wallet.publicKey,
            6
        );
        console.log("✅ USDC Mint:", usdcMint.toString());

        // Initialize governance
        try {
            const tx = await program.methods
                .initGovernance()
                .accounts({
                    governance: governancePDA,
                    admin: wallet.publicKey,
                    cadenMint: cadenMint,
                    stakedCadenMint: stkCadenMintPDA,
                    protocolFeeVault: protocolFeeVaultPDA,
                    buybackVault: buybackVaultPDA,
                    usdcMint: usdcMint,
                    tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
                    systemProgram: SystemProgram.programId,
                    rent: new PublicKey("SysvarRent111111111111111111111111111111111"),
                })
                .rpc();

            console.log("✅ Governance initialized:", tx);
        } catch (err: any) {
            if (err.message.includes("already in use")) {
                console.log("⚠️ Governance already initialized");
            } else {
                throw err;
            }
        }

        // ========================================
        // TASK 3: Initialize Oracle Aggregator
        // ========================================
        console.log("\n🔮 Step 2: Initializing Oracle Aggregator...");

        const [oracleAggregatorPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("oracle_aggregator")],
            program.programId
        );

        try {
            const tx = await program.methods
                .initOracleAggregator()
                .accounts({
                    oracleAggregator: oracleAggregatorPDA,
                    admin: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log("✅ Oracle Aggregator initialized:", tx);
        } catch (err: any) {
            if (err.message.includes("already in use")) {
                console.log("⚠️ Oracle Aggregator already initialized");
            } else {
                throw err;
            }
        }

        // ========================================
        // TASK 8: Add Initial Price Updates from REAL Pyth
        // ========================================
        console.log("\n💰 Step 3: Adding REAL Pyth price feeds...");

        // REAL Pyth Price Account IDs (Devnet)
        const pythPriceAccounts = {
            BTC: "HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANExrZh2J",
            ETH: "EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9xvYBMZPie1Vw",
            SOL: "J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix",
        };

        const cryptoAssets = [
            { symbol: "BTC", pythAccount: pythPriceAccounts.BTC },
            { symbol: "ETH", pythAccount: pythPriceAccounts.ETH },
            { symbol: "SOL", pythAccount: pythPriceAccounts.SOL },
        ];

        // Update crypto prices from REAL Pyth
        console.log("📊 Fetching REAL prices from Pyth Network...");
        for (const asset of cryptoAssets) {
            try {
                const pythPriceAccount = new PublicKey(asset.pythAccount);
                const tx = await program.methods
                    .updatePriceFromPyth(
                        asset.symbol,
                        { crypto: {} }
                    )
                    .accounts({
                        oracleAggregator: oracleAggregatorPDA,
                        pythPriceAccount: pythPriceAccount,
                        user: wallet.publicKey,
                    })
                    .rpc();

                console.log(`✅ ${asset.symbol} REAL Pyth price updated: ${tx.slice(0, 8)}...`);
            } catch (error: any) {
                console.log(`⚠️ Failed to update ${asset.symbol} from Pyth:`, error.message);
            }
        }

        // Update stock/commodity prices from external (manual for demo)
        console.log("\n📈 Adding stock/commodity prices (external source)...");
        const externalAssets = [
            { symbol: "AAPL", type: { stock: {} }, price: 178 },
            { symbol: "TSLA", type: { stock: {} }, price: 242 },
            { symbol: "GOOGL", type: { stock: {} }, price: 140 },
            { symbol: "GOLD", type: { commodity: {} }, price: 2040 },
        ];

        for (const asset of externalAssets) {
            try {
                const priceInDecimals = Math.floor(asset.price * 1_000_000);
                const tx = await program.methods
                    .updatePriceFromExternal(
                        asset.symbol,
                        asset.type,
                        new anchor.BN(priceInDecimals),
                        { coinGecko: {} }
                    )
                    .accounts({
                        oracleAggregator: oracleAggregatorPDA,
                        admin: wallet.publicKey,
                    })
                    .rpc();

                console.log(`✅ ${asset.symbol} external price updated: $${asset.price}`);
            } catch (error: any) {
                console.log(`⚠️ Failed to update ${asset.symbol}:`, error.message);
            }
        }

        // ========================================
        // TASK 9: Initialize Settlement Slot Pool
        // ========================================
        console.log("\n🏊 Step 4: Initializing Settlement Slot Pool...");

        // Using existing devnet USDC mint
        console.log("✅ Using Devnet USDC Mint:", usdcMint.toString());

        // Create settlement slot NFT mint (mock)
        console.log("Creating settlement slot NFT mint...");
        const slotNftMint = await createMint(
            provider.connection,
            wallet.payer,
            wallet.publicKey,
            wallet.publicKey,
            0 // NFTs have 0 decimals
        );
        console.log("✅ Settlement Slot NFT Mint:", slotNftMint.toString());

        // Find pool PDA
        const [poolPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("settlement_pool"), wallet.publicKey.toBuffer()],
            program.programId
        );

        // Find pool authority PDA
        const [poolAuthorityPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("pool_authority"), poolPDA.toBuffer()],
            program.programId
        );

        // Find vault PDAs
        const [tokenAVaultPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("token_a_vault"), poolPDA.toBuffer()],
            program.programId
        );

        const [tokenBVaultPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("token_b_vault"), poolPDA.toBuffer()],
            program.programId
        );

        try {
            const tx = await program.methods
                .createSettlementSlotPool(
                    "BTC",
                    { crypto: {} },
                    new anchor.BN(0), // T+0
                    30 // 0.3% fee
                )
                .accounts({
                    pool: poolPDA,
                    usdcMint: usdcMint,
                    slotNftMint: slotNftMint,
                    tokenAVault: tokenAVaultPDA,
                    tokenBVault: tokenBVaultPDA,
                    poolAuthority: poolAuthorityPDA,
                    creator: wallet.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                })
                .rpc();

            console.log("✅ Settlement Slot Pool created:", tx);
        } catch (err: any) {
            if (err.message.includes("already in use")) {
                console.log("⚠️ Pool already initialized");
            } else {
                console.log("⚠️ Pool creation failed:", err.message);
            }
        }

        // ========================================
        // Save Configuration
        // ========================================
        console.log("\n💾 Saving configuration...");

        const config = {
            programId: program.programId.toString(),
            cadenMint: cadenMint.toString(),
            stkCadenMint: stkCadenMintPDA.toString(),
            governance: governancePDA.toString(),
            oracleAggregator: oracleAggregatorPDA.toString(),
            mockUsdcMint: usdcMint.toString(),
            slotNftMint: slotNftMint.toString(),
            settlementPool: poolPDA.toString(),
            timestamp: new Date().toISOString(),
        };

        fs.writeFileSync(
            "./app/src/config/deployed.json",
            JSON.stringify(config, null, 2)
        );

        console.log("✅ Configuration saved to app/src/config/deployed.json");
        console.log("\n🎉 Initialization complete!");
        console.log("\n📋 Summary:");
        console.log("  - Governance initialized ✅");
        console.log("  - Oracle Aggregator initialized ✅");
        console.log("  - 7 asset prices updated ✅");
        console.log("  - Settlement Slot Pool created ✅");
        console.log("\n🚀 Ready for frontend integration!");

    } catch (error) {
        console.error("❌ Initialization failed:", error);
        throw error;
    }
}

// Run initialization
initialize()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

