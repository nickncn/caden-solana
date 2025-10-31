import { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_CLOCK_PUBKEY } from '@solana/web3.js';
import anchor from '@coral-xyz/anchor';
import fs from 'fs';

const { AnchorProvider, Program, BN } = anchor;

const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync('/Users/n/my-solana-wallet.json', 'utf8')))
);

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const wallet = new anchor.Wallet(walletKeypair);
const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
const program = new Program(JSON.parse(fs.readFileSync('./target/idl/caden.json', 'utf8')), provider);

console.log('Minting Settlement Slot NFT...\n');

async function mintNFT() {
    const clockAccount = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY);
    const clockData = clockAccount.data;
    const slot = clockData.readBigUInt64LE(0);
    
    const slotBuffer = Buffer.alloc(8);
    slotBuffer.writeBigUInt64LE(slot);
    
    const [settlementSlotPDA] = PublicKey.findProgramAddressSync([
        Buffer.from('settlement_slot'),
        walletKeypair.publicKey.toBuffer(),
        slotBuffer
    ], program.programId);

    console.log('Settlement Slot PDA:', settlementSlotPDA.toString());
    console.log('Slot:', slot.toString());
    
    const tx = await program.methods.mintSettlementSlotNft(
        'BTC',
        { crypto: {} },
        new BN(0),
        new BN(7),
        new BN(100_000000)
    ).accounts({
        settlementSlot: settlementSlotPDA,
        owner: walletKeypair.publicKey,
        clock: SYSVAR_CLOCK_PUBKEY,
        systemProgram: SystemProgram.programId,
    }).rpc();
    
    console.log('\n✅ TX:', tx);
    console.log('⚡ Settlement Time: T+0 (Instant)');
    console.log('💰 Mint Price: $100');
}

mintNFT().catch(e => {
    console.log('\n❌ Error:', e.message);
    if (e.logs) console.log('\nLogs:', e.logs.join('\n'));
});
