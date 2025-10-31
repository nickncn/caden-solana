// Create Custom USDC Mint for Testing
const { Connection, Keypair } = require('@solana/web3.js');
const { createMint, createAssociatedTokenAccount, mintTo } = require('@solana/spl-token');
const fs = require('fs');

async function main() {
    console.log('🏗️  Creating Custom USDC Mint for CADEN Testing');
    console.log('===============================================');

    // Setup connection and wallet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('/Users/n/my-solana-wallet.json', 'utf8'))));

    console.log('📡 Connected to devnet');
    console.log('💰 Wallet:', walletKeypair.publicKey.toString());

    // Check balance
    const balance = await connection.getBalance(walletKeypair.publicKey);
    console.log('💵 SOL Balance:', balance / 1e9);

    if (balance < 0.5e9) {
        console.log('❌ Need more SOL. Requesting airdrop...');
        const signature = await connection.requestAirdrop(walletKeypair.publicKey, 1e9);
        await connection.confirmTransaction(signature);
        console.log('✅ Airdrop successful');
    }

    // Create custom USDC mint (6 decimals, unlimited supply)
    console.log('\n🪙 Creating Custom USDC Mint...');
    const usdcMint = await createMint(
        connection,
        walletKeypair,
        walletKeypair.publicKey, // mint authority
        null,                    // freeze authority
        6                        // decimals (same as real USDC)
    );

    console.log('✅ Custom USDC mint created:', usdcMint.toString());

    // Create user USDC account and mint some tokens
    console.log('\n💰 Creating User USDC Account...');
    const userUsdcAccount = await createAssociatedTokenAccount(
        connection,
        walletKeypair,
        usdcMint,
        walletKeypair.publicKey
    );

    console.log('✅ User USDC account created:', userUsdcAccount.toString());

    // Mint 100,000 USDC to user for testing
    console.log('\n🎁 Minting 100,000 USDC for testing...');
    await mintTo(
        connection,
        walletKeypair,
        usdcMint,
        userUsdcAccount,
        walletKeypair.publicKey,
        100000 * 1e6 // 100,000 USDC with 6 decimals
    );

    console.log('✅ Minted 100,000 USDC to user account');

    // Create config file for frontend
    console.log('\n📝 Creating Frontend Configuration...');
    const config = {
        PROGRAM_ID: "9G2Fb9kCjUAA5Te38EcJzYkKRYT5gC7LweYArFZJTot",
        USDC_MINT: usdcMint.toString(),
        USER_USDC_ACCOUNT: userUsdcAccount.toString(),
        NETWORK: 'devnet',
        RPC_URL: 'https://api.devnet.solana.com',
        WALLET_ADDRESS: walletKeypair.publicKey.toString()
    };

    // Ensure config directory exists
    const configDir = '/Users/n/hackathons/solana/seam/app/src/config';
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(configDir + '/realConfig.json', JSON.stringify(config, null, 2));
    console.log('✅ Frontend config created: app/src/config/realConfig.json');

    console.log('\n🎉 SUCCESS! Custom USDC Ready!');
    console.log('==============================');
    console.log('✅ USDC Mint:', usdcMint.toString());
    console.log('✅ User Account:', userUsdcAccount.toString());
    console.log('✅ Balance: 100,000 USDC');
    console.log('');
    console.log('🚀 Next: Update frontend to use real transactions');
}

main().catch(console.error);
