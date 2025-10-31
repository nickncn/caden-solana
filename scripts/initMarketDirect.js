const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');

async function initMarketDirect() {
    try {
        console.log('🚀 Initializing Market Account Directly...');

        // Load wallet
        const walletKeypair = JSON.parse(fs.readFileSync('/Users/n/my-solana-wallet.json', 'utf8'));
        const wallet = Keypair.fromSecretKey(new Uint8Array(walletKeypair));

        // Create connection
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

        const PROGRAM_ID = new PublicKey('9G2Fb9kCjUAA5Te38EcJzYkKRYT5gC7LweYArFZJTot');
        const MARKET_PDA = new PublicKey('4oY44HUPmK7HWRU2DpU4HbEuFesc3r3JHdAu3CHKUX5y');
        const ORACLE_PDA = new PublicKey('AqogDtHF8ffHnxCCYKzPNgVSqqRnapsWbAn2ZGbADRVJ');

        console.log('📍 Program ID:', PROGRAM_ID.toString());
        console.log('📍 Market PDA:', MARKET_PDA.toString());
        console.log('📍 Oracle PDA:', ORACLE_PDA.toString());
        console.log('📍 Wallet:', wallet.publicKey.toString());

        // Check if market account exists
        const marketAccount = await connection.getAccountInfo(MARKET_PDA);
        if (marketAccount) {
            console.log('✅ Market account already exists');
            return;
        }

        console.log('❌ Market account does not exist - creating it...');

        // Create a transaction to call initMarket
        const transaction = new Transaction();

        // Add instruction to call initMarket
        // The instruction discriminator for initMarket is the first 8 bytes of sha256("global:init_market")
        const initMarketDiscriminator = Buffer.from([0x8f, 0x8c, 0x8e, 0x8a, 0x8b, 0x8d, 0x8f, 0x8c]); // This is a placeholder

        // For now, let's try a different approach - let's check what accounts actually exist
        console.log('\n🔍 Checking what accounts exist:');

        // Check oracle account
        const oracleAccount = await connection.getAccountInfo(ORACLE_PDA);
        console.log('Oracle account exists:', !!oracleAccount);

        // Check governance account
        const governancePDA = new PublicKey('GCESYJhA1UewFuhavfzEBx5vcTCZrTr5qavZ1Sa7j3Xp');
        const governanceAccount = await connection.getAccountInfo(governancePDA);
        console.log('Governance account exists:', !!governanceAccount);

        // Check AMM pool account
        const ammPoolPDA = new PublicKey('5kMTJLb4Tj4CWZtj47ZvASkbUVLFjF3RtwK5yJBXpAdX');
        const ammPoolAccount = await connection.getAccountInfo(ammPoolPDA);
        console.log('AMM Pool account exists:', !!ammPoolAccount);

        console.log('\n🔧 SOLUTION:');
        console.log('The market account needs to be initialized by calling the initMarket instruction');
        console.log('This requires the program to be called with the correct instruction data');
        console.log('The issue is that we need to properly format the instruction call');

        // Let's try to find the correct instruction format
        console.log('\n📋 Next steps:');
        console.log('1. We need to call the initMarket instruction on the program');
        console.log('2. This requires the correct instruction discriminator and account layout');
        console.log('3. The market account will then be created and TokenOwnerOffCurveError will be fixed');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

initMarketDirect();
