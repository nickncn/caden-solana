const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');

async function callInitMarket() {
    try {
        console.log('🚀 Calling initMarket instruction...');

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

        console.log('❌ Market account does not exist');
        console.log('\n🔧 CRITICAL ISSUE IDENTIFIED:');
        console.log('The market account is missing, which is causing TokenOwnerOffCurveError');
        console.log('This account needs to be initialized by calling the initMarket instruction');
        console.log('\n📋 WHAT NEEDS TO HAPPEN:');
        console.log('1. Call the initMarket instruction on the deployed program');
        console.log('2. This will create the market account at the expected PDA');
        console.log('3. Once created, TokenOwnerOffCurveError will be fixed');
        console.log('\n🚨 IMMEDIATE ACTION REQUIRED:');
        console.log('The program needs to be called with the initMarket instruction');
        console.log('This is a critical missing piece that prevents all trading/AMM operations');

        // Check wallet balance
        const balance = await connection.getBalance(wallet.publicKey);
        console.log('\n💰 Wallet balance:', balance / 1e9, 'SOL');

        if (balance < 0.01) {
            console.log('⚠️ Low balance - may need to airdrop SOL');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

callInitMarket();
