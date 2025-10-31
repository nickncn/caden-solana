// Initialize all CADEN program PDAs
const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const { createMint, getOrCreateAssociatedTokenAccount, mintTo, getAssociatedTokenAddress } = require('@solana/spl-token');
const { AnchorProvider, Program, Wallet } = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const PROGRAM_ID = new PublicKey("9G2Fb9kCjUAA5Te38EcJzYkKRYT5gC7LweYArFZJTot");
const walletPath = '/Users/n/my-solana-wallet.json';
const walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));

// Load IDL
const idlPath = path.join(__dirname, '../target/idl/caden.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

async function initializeAllPDAs() {
    console.log('🚀 INITIALIZING ALL CADEN PDAs');
    console.log('==============================');
    console.log('Program ID:', PROGRAM_ID.toString());
    console.log('Wallet:', walletKeypair.publicKey.toString());

    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const wallet = new Wallet(walletKeypair);
    const provider = new AnchorProvider(connection, wallet, {});
    const program = new Program(idl, PROGRAM_ID, provider);

    try {
        // 1. Initialize Market PDA
        console.log('\n📊 Initializing Market PDA...');
        const [marketPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("market")],
            PROGRAM_ID
        );
        
        try {
            const marketAccount = await program.account.market.fetch(marketPDA);
            console.log('✅ Market PDA already exists');
        } catch (error) {
            console.log('🔄 Creating Market PDA...');
            const tx = await program.methods
                .initMarket()
                .accounts({
                    market: marketPDA,
                    authority: walletKeypair.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log('✅ Market PDA created:', tx);
        }

        // 2. Initialize Oracle Mock PDA
        console.log('\n🔮 Initializing Oracle Mock PDA...');
        const [oracleMockPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("oracle_mock")],
            PROGRAM_ID
        );
        
        try {
            const oracleAccount = await program.account.oracleMock.fetch(oracleMockPDA);
            console.log('✅ Oracle Mock PDA already exists');
        } catch (error) {
            console.log('🔄 Creating Oracle Mock PDA...');
            const tx = await program.methods
                .initOracleMock()
                .accounts({
                    oracleMock: oracleMockPDA,
                    authority: walletKeypair.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log('✅ Oracle Mock PDA created:', tx);
        }

        // 3. Initialize Heatmap PDA
        console.log('\n📈 Initializing Heatmap PDA...');
        const [heatmapPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("heatmap")],
            PROGRAM_ID
        );
        
        try {
            const heatmapAccount = await program.account.spreadHeatmap.fetch(heatmapPDA);
            console.log('✅ Heatmap PDA already exists');
        } catch (error) {
            console.log('🔄 Creating Heatmap PDA...');
            const tx = await program.methods
                .initHeatmap()
                .accounts({
                    heatmap: heatmapPDA,
                    authority: walletKeypair.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log('✅ Heatmap PDA created:', tx);
        }

        // 4. Initialize Governance PDA
        console.log('\n🏛️ Initializing Governance PDA...');
        const [governancePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("governance")],
            PROGRAM_ID
        );
        
        try {
            const governanceAccount = await program.account.governance.fetch(governancePDA);
            console.log('✅ Governance PDA already exists');
        } catch (error) {
            console.log('🔄 Creating Governance PDA...');
            const tx = await program.methods
                .initGovernance()
                .accounts({
                    governance: governancePDA,
                    authority: walletKeypair.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log('✅ Governance PDA created:', tx);
        }

        // 5. Initialize AMM Pool PDA
        console.log('\n💎 Initializing AMM Pool PDA...');
        const [ammPoolPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("amm_pool")],
            PROGRAM_ID
        );
        
        try {
            const ammPoolAccount = await program.account.ammPool.fetch(ammPoolPDA);
            console.log('✅ AMM Pool PDA already exists');
        } catch (error) {
            console.log('🔄 Creating AMM Pool PDA...');
            const tx = await program.methods
                .initAmmPool()
                .accounts({
                    pool: ammPoolPDA,
                    authority: walletKeypair.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log('✅ AMM Pool PDA created:', tx);
        }

        // 6. Create and initialize token mints if needed
        console.log('\n🪙 Creating token mints...');
        
        // Create CADEN mint
        console.log('🔄 Creating CADEN mint...');
        const cadenMint = await createMint(
            connection,
            walletKeypair,
            walletKeypair.publicKey,
            walletKeypair.publicKey,
            9 // 9 decimals
        );
        console.log('✅ CADEN mint created:', cadenMint.toString());

        // Create USDC mint
        console.log('🔄 Creating USDC mint...');
        const usdcMint = await createMint(
            connection,
            walletKeypair,
            walletKeypair.publicKey,
            walletKeypair.publicKey,
            6 // 6 decimals
        );
        console.log('✅ USDC mint created:', usdcMint.toString());

        // 7. Create configuration file
        const config = {
            PROGRAM_ID: PROGRAM_ID.toString(),
            MARKET_PDA: marketPDA.toString(),
            ORACLE_PDA: oracleMockPDA.toString(),
            HEATMAP_PDA: heatmapPDA.toString(),
            GOVERNANCE_PDA: governancePDA.toString(),
            AMM_POOL_PDA: ammPoolPDA.toString(),
            CADEN_MINT: cadenMint.toString(),
            USDC_MINT: usdcMint.toString(),
            AUTHORITY: walletKeypair.publicKey.toString(),
            NETWORK: "devnet",
            RPC_URL: "https://api.devnet.solana.com",
            INITIALIZED_AT: new Date().toISOString(),
            STATUS: "FULLY_INITIALIZED"
        };

        const configPath = path.join(__dirname, '../app3/config/cadenConfig.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
        console.log('✅ Configuration saved to:', configPath);

        console.log('\n🎉 ALL PDAs INITIALIZED SUCCESSFULLY!');
        console.log('=====================================');
        console.log('✅ Market PDA:', marketPDA.toString());
        console.log('✅ Oracle Mock PDA:', oracleMockPDA.toString());
        console.log('✅ Heatmap PDA:', heatmapPDA.toString());
        console.log('✅ Governance PDA:', governancePDA.toString());
        console.log('✅ AMM Pool PDA:', ammPoolPDA.toString());
        console.log('✅ CADEN Mint:', cadenMint.toString());
        console.log('✅ USDC Mint:', usdcMint.toString());
        console.log('\n🚀 Your CADEN program is now fully initialized and ready to use!');

    } catch (error) {
        console.error('❌ Error initializing PDAs:', error);
        console.error('Stack:', error.stack);
    }
}

initializeAllPDAs().catch(console.error);
