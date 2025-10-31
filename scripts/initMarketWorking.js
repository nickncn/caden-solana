const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const { Program, AnchorProvider } = require('@coral-xyz/anchor');
const fs = require('fs');

async function initMarketWorking() {
    try {
        console.log('🚀 Initializing Market Account...');

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

        // Load IDL from app3
        const idl = JSON.parse(fs.readFileSync('./app3/idl/caden.json', 'utf8'));

        // Create provider and program
        const provider = new AnchorProvider(connection, wallet, { preflightCommitment: 'processed' });
        const program = new Program(idl, PROGRAM_ID, provider);

        console.log('📋 Calling initMarket instruction...');

        // Call initMarket instruction
        const tx = await program.methods
            .initMarket()
            .accounts({
                market: MARKET_PDA,
                oracle: ORACLE_PDA,
                authority: wallet.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        console.log('✅ Market initialized successfully!');
        console.log('Transaction:', tx);

        // Verify account exists
        const newMarketAccount = await connection.getAccountInfo(MARKET_PDA);
        if (newMarketAccount) {
            console.log('✅ Market account verified and exists');
            console.log('Account size:', newMarketAccount.data.length, 'bytes');
        } else {
            console.log('❌ Market account still not found after creation');
        }

    } catch (error) {
        console.error('❌ Error initializing market:', error);
        console.error('Error details:', error.message);
    }
}

initMarketWorking();
