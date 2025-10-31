// Real Mock Oracle Script for Seam Demo
// This script makes actual calls to your deployed Seam program

const { AnchorProvider, Program, Wallet } = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Load your deployed program ID
const PROGRAM_ID = "9G2Fb9kCjUAA5Te38EcJzYkKRYT5gC7LweYArFZJTot";

// Load your wallet
const walletPath = '/Users/n/my-solana-wallet.json';
const walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));

// Load the IDL
const idlPath = path.join(__dirname, '../app/src/idl/seam.json');
console.log(`📁 Loading IDL from: ${idlPath}`);
const IDL = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
console.log(`✅ IDL loaded successfully`);

async function main() {
    console.log('🚀 Starting Real Mock Oracle Script for Seam Demo...');
    console.log('📊 Making actual calls to your deployed program');
    console.log(`🎯 Program ID: ${PROGRAM_ID.toString()}`);
    console.log('');

    // Connect to dev-net
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // Create wallet and provider
    const wallet = new Wallet(walletKeypair);
    const provider = new AnchorProvider(connection, wallet, { preflightCommitment: 'processed' });

    // Create program instance
    console.log('🔧 Creating program instance...');
    console.log('IDL type:', typeof IDL);
    console.log('PROGRAM_ID:', PROGRAM_ID);
    const programId = new PublicKey(PROGRAM_ID);
    console.log('Program ID created:', programId.toString());

    const program = new Program(IDL, programId, provider);
    console.log('✅ Program instance created successfully');

    // Get PDAs
    const [marketPDA] = PublicKey.findProgramAddressSync([Buffer.from("market")], programId);
    const [oracleMockPDA] = PublicKey.findProgramAddressSync([Buffer.from("oracle_mock")], programId);

    console.log(`📊 Market PDA: ${marketPDA.toString()}`);
    console.log(`🔮 Oracle Mock PDA: ${oracleMockPDA.toString()}`);
    console.log('');

    // Check if market exists
    try {
        const marketAccount = await program.account.market.fetch(marketPDA);
        console.log('✅ Market found!');
        console.log(`   T+0 Price: $${(marketAccount.t0Price.toNumber() / 1000000).toFixed(2)}`);
        console.log(`   T+2 Price: $${(marketAccount.t2Price.toNumber() / 1000000).toFixed(2)}`);
        console.log(`   Status: ${marketAccount.status}`);
        console.log(`   Expiry Slot: ${marketAccount.expirySlot.toString()}`);
        console.log('');
    } catch (error) {
        console.log('❌ Market not found. You need to initialize it first.');
        console.log('   Run: anchor test (or initialize market manually)');
        return;
    }

    // Check if oracle exists
    try {
        const oracleAccount = await program.account.oracleMock.fetch(oracleMockPDA);
        console.log('✅ Oracle Mock found!');
        console.log(`   Current Price: $${(oracleAccount.price.toNumber() / 1000000).toFixed(2)}`);
        console.log(`   Updated Slot: ${oracleAccount.updatedSlot.toString()}`);
        console.log('');
    } catch (error) {
        console.log('❌ Oracle Mock not found. You need to initialize it first.');
        console.log('   Run: anchor test (or initialize oracle manually)');
        return;
    }

    // Start price updates
    const originalPrice = 5000000; // $50.00 (6 decimals)
    let currentPrice = originalPrice;
    let callCount = 0;
    const maxCalls = 10; // Reduced for demo
    const maxTotalMove = 0.05; // 5% max total move

    console.log(`📈 Starting price updates every 30 seconds (max ${maxCalls} calls)...`);
    console.log(`🎯 Max total move: ${(maxTotalMove * 100).toFixed(1)}%`);
    console.log('');

    const updateInterval = setInterval(async () => {
        try {
            callCount++;

            // Calculate random price movement (-0.5% to +0.5%)
            const randomMove = (Math.random() - 0.5) * 0.01; // -0.5% to +0.5%
            const newPrice = Math.floor(currentPrice * (1 + randomMove));

            // Check if we've exceeded max total move
            const totalMove = Math.abs(newPrice - originalPrice) / originalPrice;
            if (totalMove > maxTotalMove) {
                console.log(`🛑 Max total move (${(maxTotalMove * 100).toFixed(1)}%) reached. Stopping updates.`);
                clearInterval(updateInterval);
                return;
            }

            console.log(`📊 Call ${callCount}/${maxCalls} - Updating oracle price...`);
            console.log(`   Price: $${(currentPrice / 1000000).toFixed(2)} → $${(newPrice / 1000000).toFixed(2)}`);

            // Make actual call to update oracle
            const { BN } = require('@coral-xyz/anchor');
            const tx = await program.methods
                .updateOracle(new BN(newPrice))
                .accounts({
                    oracleMock: oracleMockPDA,
                    market: marketPDA,
                    admin: walletKeypair.publicKey,
                })
                .rpc();

            console.log(`   ✅ Transaction: ${tx}`);
            console.log(`   Total Change: ${((newPrice - originalPrice) / originalPrice * 100).toFixed(3)}%`);
            console.log('');

            currentPrice = newPrice;

            // Stop after max calls
            if (callCount >= maxCalls) {
                console.log(`⏰ Reached max calls (${maxCalls}). Market should be settled.`);
                clearInterval(updateInterval);
            }

        } catch (error) {
            console.error(`❌ Error updating oracle (call ${callCount}):`, error.message);
            if (error.message.includes('insufficient funds')) {
                console.log('💡 You need more SOL for transaction fees. Run: solana airdrop 2');
            }
        }
    }, 30000); // 30 seconds

    // Stop after 5 minutes
    setTimeout(() => {
        console.log('⏰ 5 minutes elapsed. Stopping oracle updates.');
        clearInterval(updateInterval);
    }, 300000); // 5 minutes

    console.log('🎬 Ready for demo recording!');
    console.log('📋 Real transaction signatures will be logged');
    console.log('');
}

main().catch(console.error);
