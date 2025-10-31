// Initialize ALL PDAs on-chain with REAL transactions
const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');

const PROGRAM_ID = new PublicKey("9G2Fb9kCjUAA5Te38EcJzYkKRYT5gC7LweYArFZJTot");
const walletPath = '/Users/n/my-solana-wallet.json';
const walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));

async function initAllPDAs() {
    console.log('🏗️  Initializing ALL PDAs on-chain...');
    console.log('====================================');

    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // Derive all PDAs
    const [heatmapPDA, heatmapBump] = PublicKey.findProgramAddressSync([Buffer.from("heatmap")], PROGRAM_ID);
    const [governancePDA, governanceBump] = PublicKey.findProgramAddressSync([Buffer.from("governance")], PROGRAM_ID);
    const [ammPoolPDA, ammBump] = PublicKey.findProgramAddressSync([Buffer.from("amm_pool")], PROGRAM_ID);

    console.log('📊 Heatmap PDA:', heatmapPDA.toString());
    console.log('🏛️  Governance PDA:', governancePDA.toString());
    console.log('💧 AMM Pool PDA:', ammPoolPDA.toString());

    // Check which PDAs exist
    const [heatmapExists, governanceExists, ammExists] = await Promise.all([
        connection.getAccountInfo(heatmapPDA).then(info => !!info).catch(() => false),
        connection.getAccountInfo(governancePDA).then(info => !!info).catch(() => false),
        connection.getAccountInfo(ammPoolPDA).then(info => !!info).catch(() => false)
    ]);

    console.log('\n📋 PDA Status:');
    console.log('   Heatmap:', heatmapExists ? '✅ EXISTS' : '❌ MISSING');
    console.log('   Governance:', governanceExists ? '✅ EXISTS' : '❌ MISSING');
    console.log('   AMM Pool:', ammExists ? '✅ EXISTS' : '❌ MISSING');

    if (heatmapExists && governanceExists && ammExists) {
        console.log('\n🎉 All PDAs already exist!');
        return { heatmapPDA, governancePDA, ammPoolPDA };
    }

    console.log('\n🚀 Creating missing PDAs...');

    // For now, let's just create the accounts with basic space
    // In a real implementation, we'd call the program's init instructions
    const space = 1000; // Basic space for now
    const lamports = await connection.getMinimumBalanceForRentExemption(space);

    const transaction = new Transaction();

    if (!heatmapExists) {
        console.log('   Creating Heatmap PDA...');
        transaction.add(
            SystemProgram.createAccount({
                fromPubkey: walletKeypair.publicKey,
                newAccountPubkey: heatmapPDA,
                lamports: lamports,
                space: space,
                programId: PROGRAM_ID,
            })
        );
    }

    if (!governanceExists) {
        console.log('   Creating Governance PDA...');
        transaction.add(
            SystemProgram.createAccount({
                fromPubkey: walletKeypair.publicKey,
                newAccountPubkey: governancePDA,
                lamports: lamports,
                space: space,
                programId: PROGRAM_ID,
            })
        );
    }

    if (!ammExists) {
        console.log('   Creating AMM Pool PDA...');
        transaction.add(
            SystemProgram.createAccount({
                fromPubkey: walletKeypair.publicKey,
                newAccountPubkey: ammPoolPDA,
                lamports: lamports,
                space: space,
                programId: PROGRAM_ID,
            })
        );
    }

    if (transaction.instructions.length === 0) {
        console.log('✅ All PDAs already exist!');
        return { heatmapPDA, governancePDA, ammPoolPDA };
    }

    // Send transaction
    console.log('🚀 Sending REAL transaction...');
    const signature = await connection.sendTransaction(transaction, [walletKeypair]);

    console.log('⏳ Confirming transaction...');
    await connection.confirmTransaction(signature);

    console.log('✅ All PDAs created successfully!');
    console.log('📝 Transaction signature:', signature);
    console.log('🔗 Explorer: https://explorer.solana.com/tx/' + signature + '?cluster=devnet');

    return { heatmapPDA, governancePDA, ammPoolPDA };
}

// Run if called directly
if (require.main === module) {
    initAllPDAs().catch(console.error);
}

module.exports = initAllPDAs;
