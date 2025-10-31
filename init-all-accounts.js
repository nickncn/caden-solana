import { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import anchor from '@coral-xyz/anchor';
import fs from 'fs';

const { AnchorProvider, Program, BN } = anchor;

// Load wallet
const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync('/Users/n/my-solana-wallet.json', 'utf8')))
);

// Setup connection and provider
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const wallet = new anchor.Wallet(walletKeypair);
const provider = new AnchorProvider(connection, wallet, {});
const program = new Program(JSON.parse(fs.readFileSync('./target/idl/caden.json', 'utf8')), provider);

console.log('🚀 CADEN ACCOUNT INITIALIZATION');
console.log('================================');
console.log(`Wallet: ${walletKeypair.publicKey.toString()}`);
console.log(`Program ID: ${program.programId.toString()}\n`);

const USDC_MINT = new PublicKey('EPjFWaLb3odcccccccccccccccccccccccccccccccc'); // Placeholder, will use actual devnet USDC

async function initializeAllAccounts() {
    try {
        // Step 1: Initialize Oracle Mock
        console.log('📍 Step 1: Initialize Oracle Mock...');
        const [oraclePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('oracle')],
            program.programId
        );
        console.log(`  Oracle PDA: ${oraclePDA.toString()}`);

        try {
            const oracleTx = await program.methods
                .initOracle()
                .accounts({
                    oracleMock: oraclePDA,
                    admin: walletKeypair.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log(`  ✅ Oracle initialized: ${oracleTx}\n`);
        } catch (e) {
            console.log(`  ⚠️ Oracle already exists or error: ${e.message.slice(0, 80)}\n`);
        }

        // Step 2: Initialize Market (requires oracle)
        console.log('📍 Step 2: Initialize Market...');
        const [marketPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('market')],
            program.programId
        );
        const [usdcVaultPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('usdc_vault')],
            program.programId
        );
        console.log(`  Market PDA: ${marketPDA.toString()}`);
        console.log(`  USDC Vault PDA: ${usdcVaultPDA.toString()}`);

        try {
            const marketTx = await program.methods
                .initMarket()
                .accounts({
                    market: marketPDA,
                    user: walletKeypair.publicKey,
                    usdcVault: usdcVaultPDA,
                    usdcMint: USDC_MINT,
                    oracleMock: oraclePDA,
                    tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .rpc();
            console.log(`  ✅ Market initialized: ${marketTx}\n`);
        } catch (e) {
            console.log(`  ❌ Market init failed: ${e.message.slice(0, 100)}\n`);
        }

        // Step 3: Initialize Token Mint (CFD mint)
        console.log('📍 Step 3: Initialize Token Mint (CFD)...');
        const [tokenMintPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('token_mint')],
            program.programId
        );
        const [cfdMintPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('mint')],
            program.programId
        );
        console.log(`  Token Mint PDA: ${tokenMintPDA.toString()}`);
        console.log(`  CFD Mint PDA: ${cfdMintPDA.toString()}`);

        try {
            const initTokenTx = await program.methods
                .initTokenMint()
                .accounts({
                    tokenMint: tokenMintPDA,
                    mint: cfdMintPDA,
                    user: walletKeypair.publicKey,
                    tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .rpc();
            console.log(`  ✅ Token Mint initialized: ${initTokenTx}\n`);
        } catch (e) {
            console.log(`  ❌ Token Mint init failed: ${e.message.slice(0, 100)}\n`);
        }

        // Step 4: Initialize Heatmap
        console.log('📍 Step 4: Initialize Heatmap...');
        const [heatmapPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('heatmap')],
            program.programId
        );
        console.log(`  Heatmap PDA: ${heatmapPDA.toString()}`);

        try {
            const heatmapTx = await program.methods
                .initHeatmap()
                .accounts({
                    heatmap: heatmapPDA,
                    admin: walletKeypair.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log(`  ✅ Heatmap initialized: ${heatmapTx}\n`);
        } catch (e) {
            console.log(`  ❌ Heatmap init failed: ${e.message.slice(0, 100)}\n`);
        }

        // Step 5: Update Oracle Price
        console.log('📍 Step 5: Update Oracle Price...');
        try {
            const updateTx = await program.methods
                .updateOracle(new BN(50000))
                .accounts({
                    oracleMock: oraclePDA,
                    market: marketPDA,
                    admin: walletKeypair.publicKey,
                })
                .rpc();
            console.log(`  ✅ Oracle price updated: ${updateTx}\n`);
        } catch (e) {
            console.log(`  ❌ Oracle update failed: ${e.message.slice(0, 100)}\n`);
        }

        console.log('🎉 Initialization sequence complete!');
        console.log('\nGenerated Account PDAs:');
        console.log(`  Oracle Mock: ${oraclePDA.toString()}`);
        console.log(`  Market: ${marketPDA.toString()}`);
        console.log(`  USDC Vault: ${usdcVaultPDA.toString()}`);
        console.log(`  CFD Mint: ${cfdMintPDA.toString()}`);
        console.log(`  Heatmap: ${heatmapPDA.toString()}`);

    } catch (error) {
        console.error('❌ Initialization failed:', error.message);
    }
}

initializeAllAccounts();
