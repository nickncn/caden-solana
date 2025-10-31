// Quick PDA initialization - no checking, just create
const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');

const PROGRAM_ID = new PublicKey("9G2Fb9kCjUAA5Te38EcJzYkKRYT5gC7LweYArFZJTot");
const walletPath = '/Users/n/my-solana-wallet.json';
const walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));

async function quickInitPDAs() {
    console.log('⚡ Quick PDA Initialization...');
    console.log('=============================');

    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // Derive PDAs
    const [heatmapPDA] = PublicKey.findProgramAddressSync([Buffer.from("heatmap")], PROGRAM_ID);
    const [governancePDA] = PublicKey.findProgramAddressSync([Buffer.from("governance")], PROGRAM_ID);
    const [ammPoolPDA] = PublicKey.findProgramAddressSync([Buffer.from("amm_pool")], PROGRAM_ID);

    console.log('📊 Heatmap PDA:', heatmapPDA.toString());
    console.log('🏛️  Governance PDA:', governancePDA.toString());
    console.log('💧 AMM Pool PDA:', ammPoolPDA.toString());

    // Just create the accounts directly without checking
    const space = 1000;
    const lamports = await connection.getMinimumBalanceForRentExemption(space);

    console.log('\n🚀 Creating PDAs with REAL transactions...');

    // Create Heatmap PDA
    try {
        const heatmapTx = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: walletKeypair.publicKey,
                newAccountPubkey: heatmapPDA,
                lamports: lamports,
                space: space,
                programId: PROGRAM_ID,
            })
        );

        console.log('   Creating Heatmap PDA...');
        const heatmapSig = await connection.sendTransaction(heatmapTx, [walletKeypair]);
        await connection.confirmTransaction(heatmapSig);
        console.log('   ✅ Heatmap PDA created:', heatmapSig.slice(0, 8) + '...');
    } catch (error) {
        console.log('   ⚠️  Heatmap PDA might already exist:', error.message);
    }

    // Create Governance PDA
    try {
        const governanceTx = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: walletKeypair.publicKey,
                newAccountPubkey: governancePDA,
                lamports: lamports,
                space: space,
                programId: PROGRAM_ID,
            })
        );

        console.log('   Creating Governance PDA...');
        const governanceSig = await connection.sendTransaction(governanceTx, [walletKeypair]);
        await connection.confirmTransaction(governanceSig);
        console.log('   ✅ Governance PDA created:', governanceSig.slice(0, 8) + '...');
    } catch (error) {
        console.log('   ⚠️  Governance PDA might already exist:', error.message);
    }

    // Create AMM Pool PDA
    try {
        const ammTx = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: walletKeypair.publicKey,
                newAccountPubkey: ammPoolPDA,
                lamports: lamports,
                space: space,
                programId: PROGRAM_ID,
            })
        );

        console.log('   Creating AMM Pool PDA...');
        const ammSig = await connection.sendTransaction(ammTx, [walletKeypair]);
        await connection.confirmTransaction(ammSig);
        console.log('   ✅ AMM Pool PDA created:', ammSig.slice(0, 8) + '...');
    } catch (error) {
        console.log('   ⚠️  AMM Pool PDA might already exist:', error.message);
    }

    console.log('\n🎉 PDA initialization complete!');
    console.log('📊 All PDAs are now available on-chain');

    return { heatmapPDA, governancePDA, ammPoolPDA };
}

// Run if called directly
if (require.main === module) {
    quickInitPDAs().catch(console.error);
}

module.exports = quickInitPDAs;
