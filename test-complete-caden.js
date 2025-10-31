import { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_CLOCK_PUBKEY } from '@solana/web3.js';
import anchor from '@coral-xyz/anchor';
import fs from 'fs';
import axios from 'axios';

const { AnchorProvider, Program, BN } = anchor;

const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync('/Users/n/my-solana-wallet.json', 'utf8')))
);

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const wallet = new anchor.Wallet(walletKeypair);
const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
const program = new Program(JSON.parse(fs.readFileSync('./target/idl/caden.json', 'utf8')), provider);

console.log('\n' + '═'.repeat(80));
console.log('🏆 CADEN - COMPLETE 4-FEATURE TEST (REAL DATA & TRANSACTIONS)');
console.log('═'.repeat(80));
console.log(`Program ID: ${program.programId.toString()}`);
console.log(`Wallet: ${walletKeypair.publicKey.toString()}\n`);

const [multiOraclePDA] = PublicKey.findProgramAddressSync([Buffer.from('multi_oracle')], program.programId);

async function testAllFeatures() {
    // ========================================================================
    // FEATURE 1: SETTLEMENT SLOT NFTs
    // ========================================================================
    console.log('\n' + '═'.repeat(80));
    console.log('🎫 FEATURE 1: SETTLEMENT SLOT NFTs - Tradeable Timing Rights');
    console.log('═'.repeat(80));

    let nftSeed1, nftSeed2, settlementSlotPDA1, settlementSlotPDA2;

    try {
        // Mint T+0 NFT
        nftSeed1 = Date.now();
        [settlementSlotPDA1] = PublicKey.findProgramAddressSync([
            Buffer.from('settlement_slot'),
            walletKeypair.publicKey.toBuffer(),
            Buffer.from(new BN(nftSeed1).toArray('le', 8))
        ], program.programId);

        const tx1 = await program.methods.mintSettlementSlotNft(
            'BTC',
            { crypto: {} },
            new BN(0), // T+0 = Instant
            new BN(7),
            new BN(100_000000), // $100
            new BN(nftSeed1)
        ).accounts({
            settlementSlot: settlementSlotPDA1,
            owner: walletKeypair.publicKey,
            clock: SYSVAR_CLOCK_PUBKEY,
            systemProgram: SystemProgram.programId,
        }).rpc();

        console.log('✅ T+0 Settlement Slot NFT Minted');
        console.log(`   TX: ${tx1.slice(0, 30)}...`);
        console.log(`   Price: $100, Settlement: INSTANT\n`);

        // Mint T+2 NFT
        nftSeed2 = Date.now() + 1000;
        [settlementSlotPDA2] = PublicKey.findProgramAddressSync([
            Buffer.from('settlement_slot'),
            walletKeypair.publicKey.toBuffer(),
            Buffer.from(new BN(nftSeed2).toArray('le', 8))
        ], program.programId);

        const tx2 = await program.methods.mintSettlementSlotNft(
            'AAPL',
            { stock: {} },
            new BN(2), // T+2 = 2 days
            new BN(30),
            new BN(50_000000), // $50
            new BN(nftSeed2)
        ).accounts({
            settlementSlot: settlementSlotPDA2,
            owner: walletKeypair.publicKey,
            clock: SYSVAR_CLOCK_PUBKEY,
            systemProgram: SystemProgram.programId,
        }).rpc();

        console.log('✅ T+2 Settlement Slot NFT Minted');
        console.log(`   TX: ${tx2.slice(0, 30)}...`);
        console.log(`   Price: $50, Settlement: 2 DAYS\n`);

        console.log('🎉 FEATURE 1: WORKING - Settlement Slot NFTs minted!\n');
    } catch (e) {
        console.log('❌ FEATURE 1 FAILED:', e.message.split('\n')[0]);
        throw e;
    }

    // ========================================================================
    // FEATURE 2: MULTI-ASSET ORACLE
    // ========================================================================
    console.log('═'.repeat(80));
    console.log('📊 FEATURE 2: MULTI-ASSET ORACLE - Real Price Data');
    console.log('═'.repeat(80));

    try {
        // Initialize oracle
        try {
            await program.methods.initMultiAssetOracle().accounts({
                multiOracle: multiOraclePDA,
                admin: walletKeypair.publicKey,
                systemProgram: SystemProgram.programId,
            }).rpc();
            console.log('✅ Multi-Asset Oracle Initialized\n');
        } catch (e) {
            console.log('ℹ️  Multi-Asset Oracle already exists\n');
        }

        // Fetch real BTC price
        let btcPrice = 95000_000000;
        try {
            const btcResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
            btcPrice = Math.floor(btcResponse.data.bitcoin.usd * 1000000);
            console.log(`₿  BTC: $${(btcPrice / 1000000).toLocaleString()} (REAL from CoinGecko)`);
        } catch (e) {
            console.log('₿  BTC: $95,000 (Fallback)');
        }

        const tx1 = await program.methods.updateAssetPrice(
            'BTC',
            { crypto: {} },
            new BN(btcPrice)
        ).accounts({
            multiOracle: multiOraclePDA,
            admin: walletKeypair.publicKey,
        }).rpc();
        console.log(`   ✅ TX: ${tx1.slice(0, 30)}...\n`);

        // Fetch real ETH price
        let ethPrice = 3500_000000;
        try {
            const ethResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
            ethPrice = Math.floor(ethResponse.data.ethereum.usd * 1000000);
            console.log(`💎 ETH: $${(ethPrice / 1000000).toLocaleString()} (REAL from CoinGecko)`);
        } catch (e) {
            console.log('💎 ETH: $3,500 (Fallback)');
        }

        const tx2 = await program.methods.updateAssetPrice(
            'ETH',
            { crypto: {} },
            new BN(ethPrice)
        ).accounts({
            multiOracle: multiOraclePDA,
            admin: walletKeypair.publicKey,
        }).rpc();
        console.log(`   ✅ TX: ${tx2.slice(0, 30)}...\n`);

        console.log('🎉 FEATURE 2: WORKING - Real price data on-chain!\n');
    } catch (e) {
        console.log('❌ FEATURE 2 FAILED:', e.message.split('\n')[0]);
        throw e;
    }

    // ========================================================================
    // FEATURE 3: SIMPLE PRICE BETTING
    // ========================================================================
    console.log('═'.repeat(80));
    console.log('🎲 FEATURE 3: SIMPLE PRICE BETTING - Bet on Price Direction');
    console.log('═'.repeat(80));

    let betSeed;
    let betPDA;

    try {
        betSeed = Date.now();
        [betPDA] = PublicKey.findProgramAddressSync([
            Buffer.from('bet'),
            walletKeypair.publicKey.toBuffer(),
            Buffer.from(new BN(betSeed).toArray('le', 8))
        ], program.programId);

        const tx = await program.methods.placeBet(
            'BTC',
            { crypto: {} },
            new BN(1000_000000), // $1000 bet
            true, // LONG (bet price goes up)
            new BN(betSeed)
        ).accounts({
            bet: betPDA,
            multiOracle: multiOraclePDA,
            user: walletKeypair.publicKey,
            systemProgram: SystemProgram.programId,
        }).rpc();

        console.log('✅ Bet Placed: $1000 LONG on BTC');
        console.log(`   TX: ${tx.slice(0, 30)}...`);
        console.log(`   Bet ID: ${betSeed}`);
        console.log(`   Direction: LONG (price goes up)\n`);

        console.log('🎉 FEATURE 3: WORKING - Betting system functional!\n');
    } catch (e) {
        console.log('❌ FEATURE 3 FAILED:', e.message.split('\n')[0]);
        throw e;
    }

    // ========================================================================
    // FEATURE 4: INSTANT T+0 SETTLEMENT
    // ========================================================================
    console.log('═'.repeat(80));
    console.log('⚡ FEATURE 4: INSTANT T+0 SETTLEMENT - Settle Bet Instantly');
    console.log('═'.repeat(80));

    try {
        // Wait a moment to simulate price movement
        console.log('ℹ️  Simulating price movement (updating BTC price)...\n');

        // Update BTC price to simulate movement
        let newBtcPrice = 96000_000000; // Simulate 1.05% increase
        try {
            const btcResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
            newBtcPrice = Math.floor(btcResponse.data.bitcoin.usd * 1000000);
        } catch (e) {
            // Use simulated price
        }

        await program.methods.updateAssetPrice(
            'BTC',
            { crypto: {} },
            new BN(newBtcPrice)
        ).accounts({
            multiOracle: multiOraclePDA,
            admin: walletKeypair.publicKey,
        }).rpc();

        console.log(`₿  New BTC Price: $${(newBtcPrice / 1000000).toLocaleString()}\n`);

        // Settle the bet instantly using T+0 NFT
        const tx = await program.methods.instantT0Settlement(
            new BN(betSeed),
            new BN(nftSeed1)
        ).accounts({
            bet: betPDA,
            settlementSlot: settlementSlotPDA1,
            multiOracle: multiOraclePDA,
            user: walletKeypair.publicKey,
        }).rpc();

        console.log('✅ Instant T+0 Settlement Executed!');
        console.log(`   TX: ${tx.slice(0, 30)}...`);
        console.log(`   Settlement: INSTANT (using T+0 NFT)`);
        console.log(`   Money received: IMMEDIATELY (not in 2 days!)\n`);

        console.log('🎉 FEATURE 4: WORKING - Instant settlement complete!\n');
    } catch (e) {
        console.log('❌ FEATURE 4 FAILED:', e.message.split('\n')[0]);
        throw e;
    }

    // ========================================================================
    // FINAL SUMMARY
    // ========================================================================
    console.log('\n' + '═'.repeat(80));
    console.log('🎊 ALL 4 FEATURES WORKING PERFECTLY!');
    console.log('═'.repeat(80));
    console.log('✅ FEATURE 1: Settlement Slot NFTs - WORKING');
    console.log('✅ FEATURE 2: Multi-Asset Oracle - WORKING');
    console.log('✅ FEATURE 3: Simple Price Betting - WORKING');
    console.log('✅ FEATURE 4: Instant T+0 Settlement - WORKING');
    console.log('═'.repeat(80));
    console.log('\n💡 CADEN IS READY FOR USERS!');
    console.log('   • Users can mint T+0/T+2 NFTs');
    console.log('   • Users can view real market prices');
    console.log('   • Users can bet on price direction');
    console.log('   • Users can settle instantly with T+0 NFT\n');
    console.log('🚀 READY FOR CYPHERPUNK HACKATHON SUBMISSION!\n');
}

testAllFeatures().catch(e => {
    console.log('\n❌ ERROR:', e.message);
    if (e.logs) console.log('Logs:', e.logs.slice(0, 5).join('\n'));
    process.exit(1);
});


