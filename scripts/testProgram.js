const { AnchorProvider, Program, Wallet } = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Load configuration
const PROGRAM_ID = new PublicKey("9G2Fb9kCjUAA5Te38EcJzYkKRYT5gC7LweYArFZJTot");
const walletPath = '/Users/n/my-solana-wallet.json';
const walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));

// Load the IDL
const idlPath = path.join(__dirname, '../app/src/idl/seam.json');
const IDL = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

async function testProgram() {
    try {
        console.log('Testing program connection...');
        console.log('PROGRAM_ID:', PROGRAM_ID.toString());
        console.log('IDL programId:', IDL.programId);
        console.log('IDL name:', IDL.name);

        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        const wallet = new Wallet(walletKeypair);
        const provider = new AnchorProvider(connection, wallet, { preflightCommitment: 'processed' });

        console.log('Creating program...');
        const program = new Program(IDL, PROGRAM_ID, provider);
        console.log('✅ Program created successfully!');

        // Test getting program account
        const programAccount = await connection.getAccountInfo(PROGRAM_ID);
        console.log('Program account exists:', !!programAccount);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

testProgram();
