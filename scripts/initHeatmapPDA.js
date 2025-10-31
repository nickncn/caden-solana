// Initialize Heatmap PDA on-chain with REAL transaction
const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');

const PROGRAM_ID = new PublicKey("9G2Fb9kCjUAA5Te38EcJzYkKRYT5gC7LweYArFZJTot");
const walletPath = '/Users/n/my-solana-wallet.json';
const walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));

async function initHeatmapPDA() {
    console.log('🏗️  Initializing Heatmap PDA on-chain...');
    console.log('=====================================');

    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // Derive Heatmap PDA
    const [heatmapPDA, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from("heatmap")],
        PROGRAM_ID
    );

    console.log('📊 Heatmap PDA:', heatmapPDA.toString());
    console.log('🔑 Bump:', bump);

    // Check if already exists
    const existingAccount = await connection.getAccountInfo(heatmapPDA);
    if (existingAccount) {
        console.log('✅ Heatmap PDA already exists!');
        console.log('   Size:', existingAccount.data.length, 'bytes');
        return heatmapPDA;
    }

    // Calculate space needed for SpreadHeatmap account
    // admin: Pubkey (32) + current_index: u16 (2) + total_updates: u64 (8) + buffer: [PricePoint; 300] (300 * 32)
    const space = 32 + 2 + 8 + (300 * 32); // 9,642 bytes

    console.log('📏 Space needed:', space, 'bytes');

    // Create transaction to initialize
    const transaction = new Transaction();

    // Add instruction to create account
    transaction.add(
        SystemProgram.createAccount({
            fromPubkey: walletKeypair.publicKey,
            newAccountPubkey: heatmapPDA,
            lamports: await connection.getMinimumBalanceForRentExemption(space),
            space: space,
            programId: PROGRAM_ID,
        })
    );

    // Send transaction
    console.log('🚀 Sending REAL transaction to initialize Heatmap PDA...');
    const signature = await connection.sendTransaction(transaction, [walletKeypair]);

    console.log('⏳ Confirming transaction...');
    await connection.confirmTransaction(signature);

    console.log('✅ Heatmap PDA initialized successfully!');
    console.log('📝 Transaction signature:', signature);
    console.log('🔗 Explorer: https://explorer.solana.com/tx/' + signature + '?cluster=devnet');

    return heatmapPDA;
}

// Run if called directly
if (require.main === module) {
    initHeatmapPDA().catch(console.error);
}

module.exports = initHeatmapPDA;
