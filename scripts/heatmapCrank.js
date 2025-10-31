// CADEN Heatmap Crank Bot - Updates spread data every 400ms (1 slot)
// Demo visual: live candle that moves every slot - "Only Solana can update a spread every 400ms"

const { AnchorProvider, Program, Wallet, BN } = require('@coral-xyz/anchor');
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

class HeatmapCrank {
    constructor() {
        this.connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        this.wallet = new Wallet(walletKeypair);
        this.provider = new AnchorProvider(this.connection, this.wallet, { preflightCommitment: 'processed' });
        this.program = new Program(IDL, this.provider);
        this.isRunning = false;
        this.crankCount = 0;
        this.lastSlot = 0;

        // PDAs
        this.heatmapPDA = PublicKey.findProgramAddressSync([Buffer.from("heatmap")], PROGRAM_ID)[0];
        this.marketPDA = PublicKey.findProgramAddressSync([Buffer.from("market")], PROGRAM_ID)[0];
        this.oraclePDA = PublicKey.findProgramAddressSync([Buffer.from("oracle")], PROGRAM_ID)[0];

        console.log('🔥 CADEN Heatmap Crank Bot Initialized');
        console.log('====================================');
        console.log('⚡ Updates spread data every 400ms (1 slot)');
        console.log('📊 "Only Solana can update a spread every 400ms"');
        console.log('💰 Crank Wallet:', walletKeypair.publicKey.toString());
        console.log('🎯 Program ID:', PROGRAM_ID);
        console.log('📈 Heatmap PDA:', this.heatmapPDA.toString());
    }

    async start() {
        console.log('\\n🚀 Starting Heatmap Crank Bot...');
        this.isRunning = true;

        // Check if heatmap is initialized
        await this.ensureHeatmapInitialized();

        // Start cranking loop
        this.startCrankLoop();

        console.log('✅ Heatmap Crank Bot is now running!');
        console.log('📊 Updating spread data every slot (400ms)...');
        console.log('🔥 Live candle chart will update in real-time!');
    }

    async ensureHeatmapInitialized() {
        try {
            // Check if heatmap exists
            const heatmapAccount = await this.program.account.spreadHeatmap.fetchNullable(this.heatmapPDA);

            if (!heatmapAccount) {
                console.log('🏗️  Initializing Heatmap PDA...');
                const tx = await this.program.methods
                    .initHeatmap()
                    .accounts({
                        heatmap: this.heatmapPDA,
                        admin: walletKeypair.publicKey,
                        systemProgram: new PublicKey("11111111111111111111111111111111"),
                    })
                    .rpc();

                console.log('✅ Heatmap initialized:', tx);
            } else {
                console.log('✅ Heatmap already exists');
                console.log(`   Total Updates: ${heatmapAccount.totalUpdates.toString()}`);
                console.log(`   Current Index: ${heatmapAccount.currentIndex}`);
            }
        } catch (error) {
            console.error('❌ Error initializing heatmap:', error);
        }
    }

    async startCrankLoop() {
        while (this.isRunning) {
            try {
                const currentSlot = await this.connection.getSlot();

                // Only crank if we're on a new slot
                if (currentSlot > this.lastSlot) {
                    await this.crankHeatmap(currentSlot);
                    this.lastSlot = currentSlot;
                }

                // Wait 400ms (approximate slot time on devnet)
                await new Promise(resolve => setTimeout(resolve, 400));

            } catch (error) {
                console.error('❌ Error in crank loop:', error.message);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async crankHeatmap(currentSlot) {
        try {
            // Get current market and oracle data
            const [marketData, oracleData] = await Promise.all([
                this.program.account.market.fetch(this.marketPDA),
                this.program.account.oracleMock.fetch(this.oraclePDA)
            ]);

            const t0Price = oracleData.price.toNumber();
            const t2Price = marketData.t2Price.toNumber();

            // Calculate spread in basis points
            const spreadBps = t0Price > 0 ? Math.round(((t2Price - t0Price) / t0Price) * 10000) : 0;

            console.log(`\\n⚡ SLOT ${currentSlot} - CRANKING HEATMAP`);
            console.log(`   T+0 Price: $${(t0Price / 1e6).toFixed(2)}`);
            console.log(`   T+2 Price: $${(t2Price / 1e6).toFixed(2)}`);
            console.log(`   Spread: ${spreadBps}bps ${this.getSpreadColor(spreadBps)}`);

            // Execute crank transaction
            const tx = await this.program.methods
                .crankHeatmap()
                .accounts({
                    heatmap: this.heatmapPDA,
                    market: this.marketPDA,
                    oracleMock: this.oraclePDA,
                })
                .rpc();

            this.crankCount++;

            console.log(`   ✅ Cranked! TX: ${tx.slice(0, 8)}...`);
            console.log(`   📊 Total Cranks: ${this.crankCount}`);

            // Show dramatic effect for demo
            if (Math.abs(spreadBps) > 50) { // > 0.5%
                console.log(`   🔥 HIGH SPREAD DETECTED! ${Math.abs(spreadBps)}bps`);
                console.log(`   🎯 This is why we need 400ms updates!`);
            }

            // Emit WebSocket-style update for frontend
            this.emitHeatmapUpdate({
                slot: currentSlot,
                t0Price,
                t2Price,
                spreadBps,
                timestamp: Date.now(),
                crankCount: this.crankCount
            });

        } catch (error) {
            console.error(`❌ Failed to crank slot ${currentSlot}:`, error.message);
        }
    }

    getSpreadColor(spreadBps) {
        if (spreadBps > 50) return '🟢'; // Green for positive spread > 0.5%
        if (spreadBps < -50) return '🔴'; // Red for negative spread < -0.5%
        return '🟡'; // Yellow for small spread
    }

    emitHeatmapUpdate(data) {
        // This would normally emit to WebSocket clients
        // For demo, we'll just log the update in a format that shows real-time nature
        console.log(`   📡 LIVE UPDATE: Slot ${data.slot} | Spread ${data.spreadBps}bps | Crank #${data.crankCount}`);

        // Write to a file that the frontend can poll (simple WebSocket alternative)
        const updateFile = '/Users/n/hackathons/solana/seam/app/public/heatmap-live.json';
        try {
            fs.writeFileSync(updateFile, JSON.stringify({
                ...data,
                lastUpdate: new Date().toISOString()
            }, null, 2));
        } catch (error) {
            // Ignore file write errors
        }
    }

    async getHeatmapData() {
        try {
            const heatmapAccount = await this.program.account.spreadHeatmap.fetch(this.heatmapPDA);

            // Extract the circular buffer data
            const buffer = heatmapAccount.buffer;
            const currentIndex = heatmapAccount.currentIndex;
            const totalUpdates = heatmapAccount.totalUpdates.toNumber();

            // Reconstruct the data in chronological order
            const orderedData = [];
            const startIndex = totalUpdates >= 300 ? currentIndex : 0;
            const dataCount = Math.min(totalUpdates, 300);

            for (let i = 0; i < dataCount; i++) {
                const index = (startIndex + i) % 300;
                const point = buffer[index];

                if (point.slot > 0) { // Only include valid data points
                    orderedData.push({
                        slot: point.slot.toString(),
                        t0Price: point.t0Price.toString(),
                        t2Price: point.t2Price.toString(),
                        spreadBps: point.spreadBps,
                        timestamp: point.timestamp.toString()
                    });
                }
            }

            return {
                totalUpdates,
                currentIndex,
                dataPoints: orderedData
            };

        } catch (error) {
            console.error('Error fetching heatmap data:', error);
            return null;
        }
    }

    stop() {
        console.log('\\n🛑 Stopping Heatmap Crank Bot...');
        this.isRunning = false;
        console.log('✅ Crank bot stopped');
        console.log(`📊 Final Stats: ${this.crankCount} cranks executed`);
        console.log('🔥 Heatmap data preserved in circular buffer');
    }
}

// Main execution
async function main() {
    const crank = new HeatmapCrank();
    await crank.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        crank.stop();
        process.exit(0);
    });

    // Demo: Show heatmap data every 10 seconds
    setInterval(async () => {
        const data = await crank.getHeatmapData();
        if (data && data.dataPoints.length > 0) {
            const latest = data.dataPoints[data.dataPoints.length - 1];
            console.log(`\\n📊 HEATMAP STATUS: ${data.dataPoints.length}/300 points | Latest: ${latest.spreadBps}bps`);
        }
    }, 10000);
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = HeatmapCrank;
