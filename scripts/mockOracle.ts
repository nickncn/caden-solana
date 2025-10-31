// Mock Oracle Script for Seam Demo
// This script simulates oracle price updates for demo purposes

interface OracleUpdate {
    call: number;
    timestamp: string;
    txSignature: string;
    oldPrice: number;
    newPrice: number;
    priceChange: number;
    totalChange: number;
}

async function main() {
    console.log('🚀 Starting Mock Oracle Script for Seam Demo...');
    console.log('📊 This simulates oracle price updates for your Loom recording');
    console.log('');

    // Simulate initial market data
    const originalPrice = 5000000; // $50.00 (6 decimals)
    let currentPrice = originalPrice;
    let callCount = 0;
    const maxCalls = 120; // 1 hour of 30-second updates
    const maxTotalMove = 0.05; // 5% max total move

    const updates: OracleUpdate[] = [];

    console.log(`📈 Initial T+0 Price: $${(originalPrice / 1000000).toFixed(2)}`);
    console.log(`⏰ Starting price updates every 30 seconds (max ${maxCalls} calls)...`);
    console.log(`🎯 Max total move: ${(maxTotalMove * 100).toFixed(1)}%`);
    console.log('');

    const updateInterval = setInterval(() => {
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
                printSummary(updates);
                return;
            }

            // Generate mock transaction signature
            const txSignature = generateMockTxSignature();

            const priceChange = ((newPrice - currentPrice) / currentPrice * 100);
            const totalChange = ((newPrice - originalPrice) / originalPrice * 100);

            const update: OracleUpdate = {
                call: callCount,
                timestamp: new Date().toISOString(),
                txSignature,
                oldPrice: currentPrice,
                newPrice,
                priceChange,
                totalChange
            };

            updates.push(update);

            console.log(`📊 Call ${callCount}/${maxCalls} - TX: ${txSignature}`);
            console.log(`   Price: $${(currentPrice / 1000000).toFixed(2)} → $${(newPrice / 1000000).toFixed(2)} (${priceChange.toFixed(3)}%)`);
            console.log(`   Total Change: ${totalChange.toFixed(3)}%`);
            console.log('');

            currentPrice = newPrice;

            // Stop after max calls
            if (callCount >= maxCalls) {
                console.log(`⏰ Reached max calls (${maxCalls}). Market should be settled.`);
                clearInterval(updateInterval);
                printSummary(updates);
            }

        } catch (error) {
            console.error(`❌ Error updating oracle (call ${callCount}):`, error);
        }
    }, 30000); // 30 seconds

    // Stop after 1 hour
    setTimeout(() => {
        console.log('⏰ 1 hour elapsed. Stopping oracle updates.');
        clearInterval(updateInterval);
        printSummary(updates);
    }, 3600000); // 1 hour

    console.log('🎬 Ready for demo recording!');
    console.log('📋 Transaction signatures will be logged for your Loom video');
    console.log('');
}

function generateMockTxSignature(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 88; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function printSummary(updates: OracleUpdate[]) {
    console.log('');
    console.log('📋 === DEMO SUMMARY ===');
    console.log(`📊 Total Updates: ${updates.length}`);
    console.log(`💰 Final Price: $${(updates[updates.length - 1]?.newPrice / 1000000).toFixed(2)}`);
    console.log(`📈 Total Change: ${updates[updates.length - 1]?.totalChange.toFixed(3)}%`);
    console.log('');
    console.log('🎬 Transaction Signatures for Loom Video:');
    console.log('Copy these TX signatures for your demo:');
    console.log('');

    updates.forEach((update, index) => {
        if (index % 10 === 0 || index === updates.length - 1) { // Show every 10th update and the last one
            console.log(`${update.call.toString().padStart(3)}. ${update.txSignature}`);
        }
    });

    console.log('');
    console.log('✅ Mock Oracle Demo Complete!');
    console.log('🎥 Ready to record your Loom video showing:');
    console.log('   1. Connect wallet');
    console.log('   2. Mint CFD position');
    console.log('   3. Watch oracle updates');
    console.log('   4. Settle market');
    console.log('   5. Realize P&L');
}

main().catch(console.error);
