const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const { AnchorProvider, Program } = require('@coral-xyz/anchor');
const fs = require('fs');

async function initMarketNow() {
    try {
        console.log('🚀 INITIALIZING MARKET ACCOUNT NOW...');

        // Load wallet
        const walletKeypair = JSON.parse(fs.readFileSync('/Users/n/my-solana-wallet.json', 'utf8'));
        const wallet = Keypair.fromSecretKey(new Uint8Array(walletKeypair));

        // Create connection
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

        const PROGRAM_ID = new PublicKey('9G2Fb9kCjUAA5Te38EcJzYkKRYT5gC7LweYArFZJTot');
        const MARKET_PDA = new PublicKey('4oY44HUPmK7HWRU2DpU4HbEuFesc3r3JHdAu3CHKUX5y');
        const ORACLE_PDA = new PublicKey('AqogDtHF8ffHnxCCYKzPNgVSqqRnapsWbAn2ZGbADRVJ');

        console.log('📍 Program ID:', PROGRAM_ID.toString());
        console.log('📍 Market PDA:', MARKET_PDA.toString());
        console.log('📍 Oracle PDA:', ORACLE_PDA.toString());
        console.log('📍 Wallet:', wallet.publicKey.toString());

        // Check if market account exists
        const marketAccount = await connection.getAccountInfo(MARKET_PDA);
        if (marketAccount) {
            console.log('✅ Market account already exists!');
            return;
        }

        console.log('❌ Market account missing - creating it now...');

        // Load IDL
        const idl = JSON.parse(fs.readFileSync('/Users/n/hackathons/solana/seam/target/idl/caden.json', 'utf8'));

        // Create provider and program with proper wallet interface
        const walletObj = {
            publicKey: wallet.publicKey,
            signTransaction: async (tx) => {
                tx.sign(wallet);
                return tx;
            },
            signAllTransactions: async (txs) => {
                txs.forEach(tx => tx.sign(wallet));
                return txs;
            }
        };

        const provider = new AnchorProvider(connection, walletObj, { preflightCommitment: 'processed' });
        const program = new Program(idl, provider);

        console.log('🔧 Calling initMarket instruction...');

        // Get USDC mint and calculate oracle mock PDA
        const USDC_MINT = new PublicKey('Eati6U8iAP5EGxL78NsxbuHjrvJ9i14HpdGYKUftr7zG');

        // Calculate oracle mock PDA using the correct seed
        const [ORACLE_MOCK_PDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("oracle")],
            PROGRAM_ID
        );

        console.log('📍 Oracle Mock PDA:', ORACLE_MOCK_PDA.toString());

        // First, initialize the oracle mock if it doesn't exist
        const oracleMockAccount = await connection.getAccountInfo(ORACLE_MOCK_PDA);
        if (!oracleMockAccount) {
            console.log('🔧 Initializing oracle mock first...');
            const initOracleTx = await program.methods
                .initOracle()
                .accounts({
                    oracleMock: ORACLE_MOCK_PDA,
                    admin: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log('✅ Oracle mock initialized:', initOracleTx);
        } else {
            console.log('✅ Oracle mock already exists');
        }

        // Call initMarket instruction
        const tx = await program.methods
            .initMarket()
            .accounts({
                market: MARKET_PDA,
                oracle: ORACLE_PDA,
                oracleMock: ORACLE_MOCK_PDA,
                usdcMint: USDC_MINT,
                admin: wallet.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        console.log('✅ Market account created successfully!');
        console.log('📝 Transaction:', tx);

        // Verify it was created
        const newMarketAccount = await connection.getAccountInfo(MARKET_PDA);
        if (newMarketAccount) {
            console.log('🎉 CONFIRMED: Market account now exists!');
            console.log('🎉 TokenOwnerOffCurveError should be FIXED!');
        } else {
            console.log('❌ Market account still missing after transaction');
        }

    } catch (error) {
        console.error('❌ Error creating market account:', error);
        console.log('\n🔍 Error details:', error.message);

        // If it's a stack size error, try a simpler approach
        if (error.message.includes('stack') || error.message.includes('Stack')) {
            console.log('\n🔧 Stack size error detected. Trying alternative approach...');
            console.log('The program has compilation issues that prevent proper initialization.');
            console.log('This is why the market account was never created in the first place.');
        }
    }
}

initMarketNow();
