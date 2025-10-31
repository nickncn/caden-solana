const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');

async function simpleInit() {
    try {
        console.log('🚀 Simple Market Initialization...');

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

        console.log('❌ Market account does not exist - this is causing TokenOwnerOffCurveError');
        console.log('🔧 The issue is that the market account needs to be initialized first');
        console.log('📋 This requires calling the initMarket instruction on the program');
        console.log('💡 For now, the app will show TokenOwnerOffCurveError until this is fixed');

        // Check wallet balance
        const balance = await connection.getBalance(wallet.publicKey);
        console.log('💰 Wallet balance:', balance / 1e9, 'SOL');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

simpleInit();
