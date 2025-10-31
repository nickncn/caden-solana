import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import anchor from '@coral-xyz/anchor';
import fs from 'fs';

const { AnchorProvider, Program, BN } = anchor;

const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync('/Users/n/my-solana-wallet.json', 'utf8')))
);

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const wallet = new anchor.Wallet(walletKeypair);
const provider = new AnchorProvider(connection, wallet, {});
const program = new Program(JSON.parse(fs.readFileSync('./target/idl/caden.json', 'utf8')), provider);

const [oraclePDA] = PublicKey.findProgramAddressSync([Buffer.from('oracle')], program.programId);
const [marketPDA] = PublicKey.findProgramAddressSync([Buffer.from('market')], program.programId);

async function fix() {
    // First update oracle to 50000
    console.log('Updating oracle to 50000...');
    await program.methods.updateOracle(new BN(50000)).accounts({
        oracleMock: oraclePDA,
        admin: walletKeypair.publicKey,
    }).rpc();
    console.log('✅ Oracle updated');

    // Check market
    const market = await program.account.market.fetch(marketPDA);
    console.log(`Market status: ${JSON.stringify(market.status)}`);
    console.log(`Market t0_price: ${market.t0Price}`);
    console.log(`Market t2_price: ${market.t2Price}`);
}

fix();
