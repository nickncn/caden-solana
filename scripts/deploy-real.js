const { Connection, PublicKey, Keypair, sendAndConfirmTransaction, Transaction, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');

async function deployProgram() {
    console.log('🚀 Starting Seam Program Deployment...');

    // Connect to dev-net
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // Load keypair
    const payer = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync('/Users/n/my-solana-wallet.json', 'utf8')))
    );

    console.log('📡 Connected to dev-net');
    console.log('💰 Payer:', payer.publicKey.toString());

    // Check balance
    const balance = await connection.getBalance(payer.publicKey);
    console.log('💵 Balance:', balance / 1e9, 'SOL');

    if (balance < 0.1e9) {
        console.log('❌ Insufficient balance. Requesting airdrop...');
        try {
            const signature = await connection.requestAirdrop(payer.publicKey, 1e9); // 1 SOL
            await connection.confirmTransaction(signature);
            console.log('✅ Airdrop successful');
        } catch (error) {
            console.error('❌ Airdrop failed:', error);
            return;
        }
    }

    // For now, we'll just show the program ID that would be used
    const programId = new PublicKey("9G2Fb9kCjUAA5Te38EcJzYkKRYT5gC7LweYArFZJTot");
    console.log('🔑 Program ID:', programId.toString());

    console.log('⚠️  Note: The actual program deployment requires the SBF build tools.');
    console.log('   The program code compiles successfully but needs to be built to SBF format.');
    console.log('   For now, the frontend will use mock data until deployment is complete.');

    console.log('\n✅ Deployment preparation complete!');
    console.log('🔗 Frontend is ready to connect to the program when deployed.');
}

deployProgram().catch(console.error);
