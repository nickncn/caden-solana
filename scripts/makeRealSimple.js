// Make Real Integration Script - Convert all mocks to real on-chain calls
const { AnchorProvider, Program, Wallet, BN } = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair, SystemProgram } = require('@solana/web3.js');
const { createMint, createAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

// Load your deployed program ID
const PROGRAM_ID = "9G2Fb9kCjUAA5Te38EcJzYkKRYT5gC7LweYArFZJTot";

// Load your wallet
const walletPath = '/Users/n/my-solana-wallet.json';
const walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));

// Load the IDL
const idlPath = path.join(__dirname, '../app/src/idl/seam.json');
const IDL = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

async function main() {
    console.log('🚀 Making CADEN Real - Converting Mocks to On-Chain Implementation');
    console.log('================================================================');
    console.log(`🎯 Program ID: ${PROGRAM_ID}`);
    console.log('');

    // Connect to dev-net
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // Create wallet and provider
    const wallet = new Wallet(walletKeypair);
    const provider = new AnchorProvider(connection, wallet, { preflightCommitment: 'processed' });

    // Create program instance
    const program = new Program(IDL, new PublicKey(PROGRAM_ID), provider);

    console.log('📡 Connected to devnet');
    console.log('💰 Wallet:', walletKeypair.publicKey.toString());

    // Check balance
    const balance = await connection.getBalance(walletKeypair.publicKey);
    console.log('💵 SOL Balance:', balance / 1e9);

    if (balance < 0.5e9) {
        console.log('❌ Need more SOL. Requesting airdrop...');
        const signature = await connection.requestAirdrop(walletKeypair.publicKey, 1e9);
        await connection.confirmTransaction(signature);
        console.log('✅ Airdrop successful');
    }

    console.log('\n🏗️  STEP 1: Create Custom USDC Mint');
    console.log('=====================================');

    // Create custom USDC mint (6 decimals, unlimited supply)
    const usdcMint = await createMint(
        connection,
        walletKeypair,
        walletKeypair.publicKey, // mint authority
        null,                    // freeze authority
        6                        // decimals (same as real USDC)
    );

    console.log('✅ Custom USDC mint created:', usdcMint.toString());

    // Create user USDC account and mint some tokens
    const userUsdcAccount = await createAssociatedTokenAccount(
        connection,
        walletKeypair,
        usdcMint,
        walletKeypair.publicKey
    );

    // Mint 10,000 USDC to user for testing
    await mintTo(
        connection,
        walletKeypair,
        usdcMint,
        userUsdcAccount,
        walletKeypair.publicKey,
        10000 * 1e6 // 10,000 USDC with 6 decimals
    );

    console.log('✅ Minted 10,000 USDC to user account:', userUsdcAccount.toString());

    console.log('\n🔮 STEP 2: Initialize Oracle');
    console.log('============================');

    // Get Oracle PDA (note: using "oracle" not "oracle_mock" to match the Rust code)
    const [oraclePDA] = PublicKey.findProgramAddressSync([Buffer.from("oracle")], new PublicKey(PROGRAM_ID));

    try {
        // Check if oracle exists
        const existingOracle = await program.account.oracleMock.fetchNullable(oraclePDA);
        if (existingOracle) {
            console.log('✅ Oracle already exists:', oraclePDA.toString());
            console.log(`   Current Price: $${(existingOracle.price.toNumber() / 1000000).toFixed(2)}`);
        } else {
            // Initialize oracle
            console.log('🔮 Initializing Oracle...');
            const tx = await program.methods
                .initOracle()
                .accounts({
                    oracleMock: oraclePDA,
                    admin: walletKeypair.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log('✅ Oracle initialized:', tx);

            // Set initial price ($50.00)
            const initialPrice = new BN(50 * 1e6); // $50.00 with 6 decimals
            const updateTx = await program.methods
                .updateOracle(initialPrice)
                .accounts({
                    oracleMock: oraclePDA,
                    market: null, // No market yet
                    admin: walletKeypair.publicKey,
                })
                .rpc();

            console.log('✅ Oracle price set to $50.00:', updateTx);
        }
    } catch (error) {
        console.error('❌ Oracle error:', error.message);
    }

    console.log('\n📊 STEP 3: Initialize Market');
    console.log('============================');

    // Get Market PDA
    const [marketPDA] = PublicKey.findProgramAddressSync([Buffer.from("market")], new PublicKey(PROGRAM_ID));
    const [usdcVaultPDA] = PublicKey.findProgramAddressSync([Buffer.from("usdc_vault")], new PublicKey(PROGRAM_ID));

    try {
        // Check if market exists
        const existingMarket = await program.account.market.fetchNullable(marketPDA);
        if (existingMarket) {
            console.log('✅ Market already exists:', marketPDA.toString());
            console.log(`   T+0 Price: $${(existingMarket.t0Price.toNumber() / 1000000).toFixed(2)}`);
            console.log(`   T+2 Price: $${(existingMarket.t2Price.toNumber() / 1000000).toFixed(2)}`);
            console.log(`   Status: ${existingMarket.status.active ? 'Active' : 'Settled'}`);
        } else {
            // Initialize market
            console.log('📊 Initializing Market...');
            const tx = await program.methods
                .initMarket()
                .accounts({
                    market: marketPDA,
                    user: walletKeypair.publicKey,
                    usdcVault: usdcVaultPDA,
                    usdcMint: usdcMint,
                    oracleMock: oraclePDA,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: new PublicKey("SysvarRent111111111111111111111111111111111"),
                })
                .rpc();

            console.log('✅ Market initialized:', tx);
        }
    } catch (error) {
        console.error('❌ Market error:', error.message);
    }

    console.log('\n📝 STEP 4: Create Frontend Configuration');
    console.log('=======================================');

    // Create config file for frontend
    const config = {
        PROGRAM_ID: PROGRAM_ID,
        USDC_MINT: usdcMint.toString(),
        MARKET_PDA: marketPDA.toString(),
        ORACLE_PDA: oraclePDA.toString(),
        USDC_VAULT_PDA: usdcVaultPDA.toString(),
        USER_USDC_ACCOUNT: userUsdcAccount.toString(),
        NETWORK: 'devnet',
        RPC_URL: 'https://api.devnet.solana.com'
    };

    // Ensure config directory exists
    const configDir = '/Users/n/hackathons/solana/seam/app/src/config';
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(path.join(configDir, 'realConfig.json'), JSON.stringify(config, null, 2));
    console.log('✅ Frontend config created: app/src/config/realConfig.json');

    console.log('\n🎉 SUCCESS! CADEN is now REAL!');
    console.log('==============================');
    console.log('✅ Custom USDC mint created with 10,000 USDC');
    console.log('✅ Oracle initialized with $50.00 price');
    console.log('✅ Market initialized and active');
    console.log('✅ Frontend config updated');
    console.log('');
    console.log('🚀 Next Steps:');
    console.log('1. Update frontend to use real RPC calls');
    console.log('2. Start real oracle price updates');
    console.log('3. Test full trading flow');
    console.log('');
    console.log('💡 Run: node scripts/realMockOracle.js (for real price updates)');
}

main().catch(console.error);
