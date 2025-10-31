import { PublicKey } from '@solana/web3.js';

const programId = new PublicKey('F1MT5rFtMHWHicaTnwxvmSZoCu48ePiDb6t9ttSwE6dv');
const owner = new PublicKey('A4SgovXySuLeYbMLR3Fc2EG4QTuNnYvcguesoitrfDCv');
const expectedPDA = '8p7FukgvYiSd9hkyH5MioUcU4zhGHjWjVEia78C1hX77';

console.log('Finding correct slot value for PDA...\n');

// Try different slot values around the current one
const currentSlot = 416497577n;

for (let i = -100n; i < 100n; i++) {
    const testSlot = currentSlot + i;
    const slotBuffer = Buffer.alloc(8);
    slotBuffer.writeBigUInt64LE(testSlot);
    
    const [pda] = PublicKey.findProgramAddressSync([
        Buffer.from('settlement_slot'),
        owner.toBuffer(),
        slotBuffer
    ], programId);
    
    if (pda.toString() === expectedPDA) {
        console.log('✅ FOUND IT!');
        console.log('Slot:', testSlot.toString());
        console.log('Offset from current:', i.toString());
        break;
    }
}

