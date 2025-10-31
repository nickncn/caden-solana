const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { createMint, getOrCreateAssociatedTokenAccount, mintTo } = require('@solana/spl-token');
const { AnchorProvider, Program } = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

// Load IDL
const IDL = require('../app/src/idl/seam.json');
const PROGRAM_ID = new PublicKey('9G2Fb9kCjUAA5Te38EcJzYkKRYT5gC7LweYArFZJTot');

// Load wallet
const walletPath = '/Users/n/my-solana-wallet.json';
const walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));

async function main() {
    console.log('🏛️ Initializing CADEN Governance System');
    console.log('=====================================');

    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const wallet = new Wallet(walletKeypair);
    const provider = new AnchorProvider(connection, wallet, { preflightCommitment: 'processed' });
    const program = new Program(IDL, PROGRAM_ID, provider);

    console.log('📡 Connected to devnet');
    console.log('💰 Wallet:', walletKeypair.publicKey.toString());

    const balance = await connection.getBalance(walletKeypair.publicKey);
    console.log('💵 SOL Balance:', balance / 1e9);

    try {
        // 1. Create CADEN token mint
        console.log('\n🪙 Creating CADEN token mint...');
        const cadenMint = await createMint(
            connection,
            walletKeypair,
            walletKeypair.publicKey, // Mint Authority
            null,                     // Freeze Authority
            6                         // Decimals
        );
        console.log('✅ CADEN mint created:', cadenMint.toString());

        // 2. Create USDC mint (if not exists)
        console.log('\n💵 Creating USDC mint...');
        const usdcMint = await createMint(
            connection,
            walletKeypair,
            walletKeypair.publicKey, // Mint Authority
            null,                     // Freeze Authority
            6                         // Decimals
        );
        console.log('✅ USDC mint created:', usdcMint.toString());

        // 3. Mint some CADEN tokens for testing
        console.log('\n🎁 Minting 1B CADEN tokens...');
        const userCadenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            walletKeypair,
            cadenMint,
            walletKeypair.publicKey
        );

        await mintTo(
            connection,
            walletKeypair,
            cadenMint,
            userCadenAccount.address,
            walletKeypair.publicKey,
            1_000_000_000 * (10 ** 6) // 1B CADEN
        );
        console.log('✅ Minted 1B CADEN to user account');

        // 4. Mint some USDC for protocol fees
        console.log('\n💰 Minting 1M USDC for protocol fees...');
        const userUsdcAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            walletKeypair,
            usdcMint,
            walletKeypair.publicKey
        );

        await mintTo(
            connection,
            walletKeypair,
            usdcMint,
            userUsdcAccount.address,
            walletKeypair.publicKey,
            1_000_000 * (10 ** 6) // 1M USDC
        );
        console.log('✅ Minted 1M USDC to user account');

        // 5. Initialize governance system
        console.log('\n🏛️ Initializing governance system...');

        // Get PDAs
        const [governancePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("governance")],
            PROGRAM_ID
        );

        const [stakedCadenMintPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("staked_caden_mint")],
            PROGRAM_ID
        );

        const [protocolFeeVaultPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("protocol_fee_vault")],
            PROGRAM_ID
        );

        const [buybackVaultPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("buyback_vault")],
            PROGRAM_ID
        );

        const tx = await program.methods
            .initGovernance()
            .accounts({
                governance: governancePDA,
                cadenMint: cadenMint,
                stakedCadenMint: stakedCadenMintPDA,
                protocolFeeVault: protocolFeeVaultPDA,
                buybackVault: buybackVaultPDA,
                usdcMint: usdcMint,
                admin: walletKeypair.publicKey,
                tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
                systemProgram: new PublicKey('11111111111111111111111111111111'),
                rent: new PublicKey('SysvarRent111111111111111111111111111111111'),
            })
            .rpc();

        console.log('✅ Governance system initialized!');
        console.log('📝 Transaction signature:', tx);

        // 6. Update config file
        console.log('\n📝 Updating configuration...');
        const config = {
            USDC_MINT: usdcMint.toString(),
            USER_USDC_ACCOUNT: userUsdcAccount.address.toString(),
            CADEN_MINT: cadenMint.toString(),
            USER_CADEN_ACCOUNT: userCadenAccount.address.toString(),
            GOVERNANCE_PDA: governancePDA.toString(),
            STAKED_CADEN_MINT: stakedCadenMintPDA.toString(),
            PROTOCOL_FEE_VAULT: protocolFeeVaultPDA.toString(),
            BUYBACK_VAULT: buybackVaultPDA.toString(),
        };

        const configPath = path.join(__dirname, '../app/src/config/realConfig.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
        console.log('✅ Configuration updated');

        console.log('\n🎉 CADEN GOVERNANCE SYSTEM READY!');
        console.log('================================');
        console.log('✅ CADEN Mint:', cadenMint.toString());
        console.log('✅ USDC Mint:', usdcMint.toString());
        console.log('✅ Governance PDA:', governancePDA.toString());
        console.log('✅ User CADEN Balance: 1B CADEN');
        console.log('✅ User USDC Balance: 1M USDC');
        console.log('\n🏛️ Ready for staking and governance!');

    } catch (error) {
        console.error('❌ Error initializing governance:', error);
    }
}

class Wallet {
    constructor(keypair) {
        this.keypair = keypair;
    }

    get publicKey() {
        return this.keypair.publicKey;
    }

    signTransaction(tx) {
        tx.sign(this.keypair);
        return tx;
    }

    signAllTransactions(txs) {
        return txs.map(tx => {
            tx.sign(this.keypair);
            return tx;
        });
    }
}

main().catch(console.error);
