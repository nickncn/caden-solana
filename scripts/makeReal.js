// Make Real Integration Script - Convert all mocks to real on-chain calls
const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const { createMint, createAccount, mintTo, getAssociatedTokenAddress, createAssociatedTokenAccount } = require('@solana/spl-token');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');

const PROGRAM_ID = "9G2Fb9kCjUAA5Te38EcJzYkKRYT5gC7LweYArFZJTot";
const walletPath = '/Users/n/my-solana-wallet.json';

async function main() {
    console.log('🚀 Making CADEN Real - Converting Mocks to On-Chain Implementation');
    console.log('================================================================');

    // Setup connection and wallet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));

    // Setup Anchor
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(walletKeypair), {});
    anchor.setProvider(provider);

    // Load program
    const idl = JSON.parse(fs.readFileSync('/Users/n/hackathons/solana/seam/app/src/idl/seam.json', 'utf8'));
    const programId = new PublicKey(PROGRAM_ID);
    const program = new anchor.Program(idl, programId, provider);

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

    // Get Oracle PDA
    const [oraclePDA] = PublicKey.findProgramAddressSync([Buffer.from("oracle")], program.programId);

    try {
        // Check if oracle exists
        await program.account.oracleMock.fetch(oraclePDA);
        console.log('✅ Oracle already exists:', oraclePDA.toString());
    } catch (error) {
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
        const initialPrice = new anchor.BN(50 * 1e6); // $50.00 with 6 decimals
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

    console.log('\n📊 STEP 3: Initialize Market');
    console.log('============================');

    // Get Market PDA
    const [marketPDA] = PublicKey.findProgramAddressSync([Buffer.from("market")], program.programId);
    const [usdcVaultPDA] = PublicKey.findProgramAddressSync([Buffer.from("usdc_vault")], program.programId);

    try {
        // Check if market exists
        await program.account.market.fetch(marketPDA);
        console.log('✅ Market already exists:', marketPDA.toString());
    } catch (error) {
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
                tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .rpc();

        console.log('✅ Market initialized:', tx);
    }

    console.log('\n🪙 STEP 4: Initialize CADEN-CFD Token Mint');
    console.log('==========================================');

    // Get CFD Mint PDA
    const [cfdMintPDA] = PublicKey.findProgramAddressSync([Buffer.from("mint")], program.programId);
    const [tokenMintPDA] = PublicKey.findProgramAddressSync([Buffer.from("token_mint")], program.programId);

    try {
        // Check if CFD mint exists
        await connection.getAccountInfo(cfdMintPDA);
        console.log('✅ CADEN-CFD mint already exists:', cfdMintPDA.toString());
    } catch (error) {
        // Initialize CFD token mint
        console.log('🪙 Initializing CADEN-CFD Token Mint...');
        const tx = await program.methods
            .initTokenMint()
            .accounts({
                tokenMint: tokenMintPDA,
                mint: cfdMintPDA,
                user: walletKeypair.publicKey,
                tokenProgram: anchor.utils.token.TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .rpc();

        console.log('✅ CADEN-CFD mint initialized:', tx);
    }

    console.log('\n📝 STEP 5: Update Frontend Configuration');
    console.log('=======================================');

    // Create config file for frontend
    const config = {
        PROGRAM_ID: PROGRAM_ID,
        USDC_MINT: usdcMint.toString(),
        MARKET_PDA: marketPDA.toString(),
        ORACLE_PDA: oraclePDA.toString(),
        CFD_MINT_PDA: cfdMintPDA.toString(),
        USDC_VAULT_PDA: usdcVaultPDA.toString(),
        USER_USDC_ACCOUNT: userUsdcAccount.toString(),
        NETWORK: 'devnet',
        RPC_URL: 'https://api.devnet.solana.com'
    };

    fs.writeFileSync('/Users/n/hackathons/solana/seam/app/src/config/realConfig.json', JSON.stringify(config, null, 2));
    console.log('✅ Frontend config created: app/src/config/realConfig.json');

    console.log('\n🎉 SUCCESS! CADEN is now REAL!');
    console.log('==============================');
    console.log('✅ Custom USDC mint created with 10,000 USDC');
    console.log('✅ Oracle initialized with $50.00 price');
    console.log('✅ Market initialized and active');
    console.log('✅ CADEN-CFD token mint ready');
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
