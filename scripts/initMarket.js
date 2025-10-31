const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { Program, AnchorProvider } = require('@coral-xyz/anchor');
const fs = require('fs');

const PROGRAM_ID = new PublicKey('9G2Fb9kCjUAA5Te38EcJzYkKRYT5gC7LweYArFZJTot');
const MARKET_PDA = new PublicKey('4oY44HUPmK7HWRU2DpU4HbEuFesc3r3JHdAu3CHKUX5y');
const ORACLE_PDA = new PublicKey('AqogDtHF8ffHnxCCYKzPNgVSqqRnapsWbAn2ZGbADRVJ');

async function initMarket() {
    try {
        console.log('🚀 Initializing Market Account...');

        // Load wallet
        const walletKeypair = JSON.parse(fs.readFileSync('/Users/n/my-solana-wallet.json', 'utf8'));
        const wallet = Keypair.fromSecretKey(new Uint8Array(walletKeypair));

        // Create connection
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

        // Load IDL
        const idl = JSON.parse(fs.readFileSync('./app3/idl/caden.json', 'utf8'));

        // Create provider and program
        const provider = new AnchorProvider(connection, wallet, { preflightCommitment: 'processed' });
        const program = new Program(idl, PROGRAM_ID, provider);

        console.log('📍 Program ID:', PROGRAM_ID.toString());
        console.log('📍 Market PDA:', MARKET_PDA.toString());
        console.log('📍 Oracle PDA:', ORACLE_PDA.toString());
        console.log('📍 Wallet:', wallet.publicKey.toString());

        // Initialize market
        console.log('📋 Initializing market...');
        const tx = await program.methods
            .initMarket()
            .accounts({
                market: MARKET_PDA,
                oracle: ORACLE_PDA,
                authority: wallet.publicKey,
                systemProgram: new PublicKey('11111111111111111111111111111111'),
            })
            .rpc();

        console.log('✅ Market initialized successfully!');
        console.log('Transaction:', tx);

        // Verify account exists
        const accountInfo = await connection.getAccountInfo(MARKET_PDA);
        if (accountInfo) {
            console.log('✅ Market account verified and exists');
        } else {
            console.log('❌ Market account still not found');
        }

    } catch (error) {
        console.error('❌ Error initializing market:', error);
    }
}

initMarket();