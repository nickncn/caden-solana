// Simple PDA initialization script
const { Connection, PublicKey, Keypair, Transaction, SystemProgram, TransactionInstruction } = require('@solana/web3.js');
const { createMint, getOrCreateAssociatedTokenAccount, mintTo } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

const PROGRAM_ID = new PublicKey("9G2Fb9kCjUAA5Te38EcJzYkKRYT5gC7LweYArFZJTot");
const walletPath = '/Users/n/my-solana-wallet.json';
const walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));

async function initializePDAs() {
    console.log('🚀 INITIALIZING CADEN PDAs (Simple Method)');
    console.log('===========================================');
    console.log('Program ID:', PROGRAM_ID.toString());
    console.log('Wallet:', walletKeypair.publicKey.toString());

    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    try {
        // 1. Create token mints
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

        // 2. Calculate PDA addresses
        console.log('\n📍 Calculating PDA addresses...');
        
        const [marketPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("market")],
            PROGRAM_ID
        );
        console.log('📍 Market PDA:', marketPDA.toString());

        const [oracleMockPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("oracle_mock")],
            PROGRAM_ID
        );
        console.log('📍 Oracle Mock PDA:', oracleMockPDA.toString());

        const [heatmapPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("heatmap")],
            PROGRAM_ID
        );
        console.log('📍 Heatmap PDA:', heatmapPDA.toString());

        const [governancePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("governance")],
            PROGRAM_ID
        );
        console.log('📍 Governance PDA:', governancePDA.toString());

        const [ammPoolPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("amm_pool")],
            PROGRAM_ID
        );
        console.log('📍 AMM Pool PDA:', ammPoolPDA.toString());

        // 3. Check which PDAs exist
        console.log('\n🔍 Checking PDA status...');
        
        const marketAccount = await connection.getAccountInfo(marketPDA);
        console.log('📊 Market PDA:', marketAccount ? '✅ EXISTS' : '❌ MISSING');
        
        const oracleAccount = await connection.getAccountInfo(oracleMockPDA);
        console.log('🔮 Oracle Mock PDA:', oracleAccount ? '✅ EXISTS' : '❌ MISSING');
        
        const heatmapAccount = await connection.getAccountInfo(heatmapPDA);
        console.log('📈 Heatmap PDA:', heatmapAccount ? '✅ EXISTS' : '❌ MISSING');
        
        const governanceAccount = await connection.getAccountInfo(governancePDA);
        console.log('🏛️ Governance PDA:', governanceAccount ? '✅ EXISTS' : '❌ MISSING');
        
        const ammPoolAccount = await connection.getAccountInfo(ammPoolPDA);
        console.log('💎 AMM Pool PDA:', ammPoolAccount ? '✅ EXISTS' : '❌ MISSING');

        // 4. Create user token accounts and mint some tokens
        console.log('\n💰 Setting up user token accounts...');
        
        // Create CADEN token account for user
        const cadenTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            walletKeypair,
            cadenMint,
            walletKeypair.publicKey
        );
        console.log('✅ CADEN token account:', cadenTokenAccount.address.toString());

        // Mint 1000 CADEN tokens to user
        await mintTo(
            connection,
            walletKeypair,
            cadenMint,
            cadenTokenAccount.address,
            walletKeypair,
            1000 * 10**9 // 1000 tokens with 9 decimals
        );
        console.log('✅ Minted 1000 CADEN tokens');

        // Create USDC token account for user
        const usdcTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            walletKeypair,
            usdcMint,
            walletKeypair.publicKey
        );
        console.log('✅ USDC token account:', usdcTokenAccount.address.toString());

        // Mint 10000 USDC tokens to user
        await mintTo(
            connection,
            walletKeypair,
            usdcMint,
            usdcTokenAccount.address,
            walletKeypair,
            10000 * 10**6 // 10000 tokens with 6 decimals
        );
        console.log('✅ Minted 10000 USDC tokens');

        // 5. Create configuration file
        const config = {
            PROGRAM_ID: PROGRAM_ID.toString(),
            MARKET_PDA: marketPDA.toString(),
            ORACLE_PDA: oracleMockPDA.toString(),
            HEATMAP_PDA: heatmapPDA.toString(),
            GOVERNANCE_PDA: governancePDA.toString(),
            AMM_POOL_PDA: ammPoolPDA.toString(),
            CADEN_MINT: cadenMint.toString(),
            USDC_MINT: usdcMint.toString(),
            USER_CADEN_ACCOUNT: cadenTokenAccount.address.toString(),
            USER_USDC_ACCOUNT: usdcTokenAccount.address.toString(),
            AUTHORITY: walletKeypair.publicKey.toString(),
            NETWORK: "devnet",
            RPC_URL: "https://api.devnet.solana.com",
            INITIALIZED_AT: new Date().toISOString(),
            STATUS: "TOKENS_READY_PDAS_NEED_INIT"
        };

        const configPath = path.join(__dirname, '../app3/config/cadenConfig.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
        console.log('✅ Configuration saved to:', configPath);

        console.log('\n🎉 SETUP COMPLETED!');
        console.log('===================');
        console.log('✅ Token mints created');
        console.log('✅ User token accounts created');
        console.log('✅ User has 1000 CADEN tokens');
        console.log('✅ User has 10000 USDC tokens');
        console.log('✅ PDA addresses calculated');
        console.log('\n⚠️  PDAs need to be initialized via the frontend or direct program calls');
        console.log('🚀 Your tokens are ready for trading!');

        console.log('\n📋 NEXT STEPS:');
        console.log('1. Use the frontend to initialize PDAs');
        console.log('2. Start trading with your tokens');
        console.log('3. Monitor the heatmap for real-time data');

    } catch (error) {
        console.error('❌ Error during setup:', error);
        console.error('Stack:', error.stack);
    }
}

initializePDAs().catch(console.error);
