import { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { createMint, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import anchor from '@coral-xyz/anchor';
import fs from 'fs';

const { AnchorProvider, Program } = anchor;

const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync('/Users/n/my-solana-wallet.json', 'utf8')))
);

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const wallet = new anchor.Wallet(walletKeypair);
const provider = new AnchorProvider(connection, wallet, {});
const program = new Program(JSON.parse(fs.readFileSync('./target/idl/caden.json', 'utf8')), provider);

const [oraclePDA] = PublicKey.findProgramAddressSync([Buffer.from('oracle')], program.programId);
const [marketPDA] = PublicKey.findProgramAddressSync([Buffer.from('market')], program.programId);
const [usdcVaultPDA] = PublicKey.findProgramAddressSync([Buffer.from('usdc_vault')], program.programId);

async function reinitMarket() {
    const usdcMint = await createMint(connection, walletKeypair, walletKeypair.publicKey, null, 6);

    console.log('Calling initMarket to update status...');
    await program.methods.initMarket().accounts({
        market: marketPDA,
        user: walletKeypair.publicKey,
        usdcVault: usdcVaultPDA,
        usdcMint: usdcMint,
        oracleMock: oraclePDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
    }).rpc();

    console.log('✅ Market updated');

    const market = await program.account.market.fetch(marketPDA);
    console.log(`Market status: ${JSON.stringify(market.status)}`);
    console.log(`Market t0_price: ${market.t0Price}`);
    console.log(`Market t2_price: ${market.t2Price}`);
}

reinitMarket();
