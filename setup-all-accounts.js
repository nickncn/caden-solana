import { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } from '@solana/web3.js';
import { createMint, createAccount, mintTo, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
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

console.log('🚀 CADEN COMPLETE ACCOUNT SETUP');
console.log('================================');
console.log(`Wallet: ${walletKeypair.publicKey.toString()}`);
console.log(`Program ID: ${program.programId.toString()}\n`);

// Store created mints for later use
const createdMints = {};

async function createTokenMint(decimals = 6, symbol = 'TOKEN') {
    console.log(`  Creating ${symbol} mint...`);
    const mint = await createMint(
        connection,
        walletKeypair,
        walletKeypair.publicKey,
        null,
        decimals
    );
    console.log(`  ✅ ${symbol} mint: ${mint.toString()}`);
    return mint;
}

async function setupAllAccounts() {
    try {
        // Step 1: Create all required token mints
        console.log('📍 Step 1: Creating Token Mints...');
        createdMints.USDC = await createTokenMint(6, 'USDC');
        createdMints.CADEN = await createTokenMint(6, 'CADEN');
        createdMints.LONG = await createTokenMint(6, 'LONG');
        createdMints.SHORT = await createTokenMint(6, 'SHORT');
        console.log('');

        // Step 2: Initialize Oracle Mock
        console.log('📍 Step 2: Initialize Oracle Mock...');
        const [oraclePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('oracle')],
            program.programId
        );

        try {
            const oracleTx = await program.methods
                .initOracle()
                .accounts({
                    oracleMock: oraclePDA,
                    admin: walletKeypair.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log(`  ✅ Oracle initialized: ${oracleTx}`);
        } catch (e) {
            console.log(`  ⚠️ Oracle already exists: ${e.message.slice(0, 50)}...`);
        }
        console.log('');

        // Step 3: Initialize Market
        console.log('📍 Step 3: Initialize Market...');
        const [marketPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('market')],
            program.programId
        );
        const [usdcVaultPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('usdc_vault')],
            program.programId
        );

        try {
            const marketTx = await program.methods
                .initMarket()
                .accounts({
                    market: marketPDA,
                    user: walletKeypair.publicKey,
                    usdcVault: usdcVaultPDA,
                    usdcMint: createdMints.USDC,
                    oracleMock: oraclePDA,
                    tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .rpc();
            console.log(`  ✅ Market initialized: ${marketTx}`);
        } catch (e) {
            console.log(`  ❌ Market init failed: ${e.message.slice(0, 100)}`);
        }
        console.log('');

        // Step 4: Initialize Token Mint (CFD mint)
        console.log('📍 Step 4: Initialize CFD Token Mint...');
        const [tokenMintPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('token_mint')],
            program.programId
        );
        const [cfdMintPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('mint')],
            program.programId
        );

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
            console.log(`  ✅ CFD Token Mint initialized: ${initTokenTx}`);
        } catch (e) {
            console.log(`  ❌ CFD Token Mint failed: ${e.message.slice(0, 100)}`);
        }
        console.log('');

        // Step 5: Initialize Heatmap
        console.log('📍 Step 5: Initialize Heatmap...');
        const [heatmapPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('heatmap')],
            program.programId
        );

        try {
            const heatmapTx = await program.methods
                .initHeatmap()
                .accounts({
                    heatmap: heatmapPDA,
                    admin: walletKeypair.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log(`  ✅ Heatmap initialized: ${heatmapTx}`);
        } catch (e) {
            console.log(`  ❌ Heatmap failed: ${e.message.slice(0, 100)}`);
        }
        console.log('');

        // Step 6: Initialize Governance
        console.log('📍 Step 6: Initialize Governance...');
        const [governancePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('governance')],
            program.programId
        );
        const [stakedCadenMintPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('staked_caden_mint')],
            program.programId
        );
        const [protocolFeeVaultPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('protocol_fee_vault')],
            program.programId
        );
        const [buybackVaultPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('buyback_vault')],
            program.programId
        );

        try {
            const governanceTx = await program.methods
                .initGovernance()
                .accounts({
                    governance: governancePDA,
                    cadenMint: createdMints.CADEN,
                    stakedCadenMint: stakedCadenMintPDA,
                    protocolFeeVault: protocolFeeVaultPDA,
                    buybackVault: buybackVaultPDA,
                    usdcMint: createdMints.USDC,
                    admin: walletKeypair.publicKey,
                    tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .rpc();
            console.log(`  ✅ Governance initialized: ${governanceTx}`);
        } catch (e) {
            console.log(`  ❌ Governance failed: ${e.message.slice(0, 100)}`);
        }
        console.log('');

        // Step 7: Initialize AMM Pool
        console.log('📍 Step 7: Initialize AMM Pool...');
        const [poolPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('amm_pool')],
            program.programId
        );
        const [lpMintPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('lp_mint')],
            program.programId
        );
        const [longVaultPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('long_vault')],
            program.programId
        );
        const [shortVaultPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('short_vault')],
            program.programId
        );

        try {
            const ammTx = await program.methods
                .initAmmPool()
                .accounts({
                    pool: poolPDA,
                    longMint: createdMints.LONG,
                    shortMint: createdMints.SHORT,
                    lpMint: lpMintPDA,
                    longVault: longVaultPDA,
                    shortVault: shortVaultPDA,
                    admin: walletKeypair.publicKey,
                    tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .rpc();
            console.log(`  ✅ AMM Pool initialized: ${ammTx}`);
        } catch (e) {
            console.log(`  ❌ AMM Pool failed: ${e.message.slice(0, 100)}`);
        }
        console.log('');

        // Step 8: Update Oracle Price (small change to avoid OracleMoveTooLarge)
        console.log('📍 Step 8: Update Oracle Price...');
        try {
            const updateTx = await program.methods
                .updateOracle(new BN(1000)) // Small price to avoid OracleMoveTooLarge
                .accounts({
                    oracleMock: oraclePDA,
                    market: marketPDA,
                    admin: walletKeypair.publicKey,
                })
                .rpc();
            console.log(`  ✅ Oracle price updated: ${updateTx}`);
        } catch (e) {
            console.log(`  ❌ Oracle update failed: ${e.message.slice(0, 100)}`);
        }
        console.log('');

        // Step 9: Test mintCfd (now that all dependencies exist)
        console.log('📍 Step 9: Test mintCfd...');
        const [positionPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('position'), walletKeypair.publicKey.toBuffer()],
            program.programId
        );

        try {
            // Create user token accounts first
            const userCfdAccount = await getOrCreateAssociatedTokenAccount(
                connection,
                walletKeypair,
                cfdMintPDA,
                walletKeypair.publicKey
            );

            const userUsdcAccount = await getOrCreateAssociatedTokenAccount(
                connection,
                walletKeypair,
                createdMints.USDC,
                walletKeypair.publicKey
            );

            // Mint some USDC to user for testing
            await mintTo(
                connection,
                walletKeypair,
                createdMints.USDC,
                userUsdcAccount.address,
                walletKeypair,
                1000000 // 1 USDC (6 decimals)
            );

            const mintCfdTx = await program.methods
                .mintCfd({ long: {} }, new BN(1000), new BN(1))
                .accounts({
                    position: positionPDA,
                    market: marketPDA,
                    marketUsdcVault: usdcVaultPDA,
                    cfdMint: cfdMintPDA,
                    userCfdAccount: userCfdAccount.address,
                    userUsdcAccount: userUsdcAccount.address,
                    user: walletKeypair.publicKey,
                    oracleMock: oraclePDA,
                    tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
                    associatedTokenProgram: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log(`  ✅ mintCfd executed: ${mintCfdTx}`);
        } catch (e) {
            console.log(`  ❌ mintCfd failed: ${e.message.slice(0, 100)}`);
        }

        console.log('\n🎉 SETUP COMPLETE!');
        console.log('==================');
        console.log('\nCreated Mints:');
        console.log(`  USDC: ${createdMints.USDC.toString()}`);
        console.log(`  CADEN: ${createdMints.CADEN.toString()}`);
        console.log(`  LONG: ${createdMints.LONG.toString()}`);
        console.log(`  SHORT: ${createdMints.SHORT.toString()}`);

        console.log('\nProgram PDAs:');
        console.log(`  Oracle: ${oraclePDA.toString()}`);
        console.log(`  Market: ${marketPDA.toString()}`);
        console.log(`  USDC Vault: ${usdcVaultPDA.toString()}`);
        console.log(`  CFD Mint: ${cfdMintPDA.toString()}`);
        console.log(`  Heatmap: ${heatmapPDA.toString()}`);
        console.log(`  Governance: ${governancePDA.toString()}`);
        console.log(`  AMM Pool: ${poolPDA.toString()}`);

        console.log('\n✅ ALL FEATURES SHOULD NOW WORK WITH REAL TRANSACTIONS!');

    } catch (error) {
        console.error('❌ Setup failed:', error.message);
    }
}

setupAllAccounts();
