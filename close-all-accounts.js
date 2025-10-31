import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from '@solana/web3.js';
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

const accountsToClose = [
    'market',
    'usdc_vault',
    'mint',
    'token_mint',
    'heatmap',
    'governance',
    'staked_caden_mint',
    'protocol_fee_vault',
    'buyback_vault',
    'amm_pool',
    'lp_mint',
    'long_vault',
    'short_vault',
];

async function closeAccounts() {
    for (const seed of accountsToClose) {
        const [pda] = PublicKey.findProgramAddressSync([Buffer.from(seed)], program.programId);

        try {
            const accountInfo = await connection.getAccountInfo(pda);
            if (accountInfo && accountInfo.owner.equals(program.programId)) {
                console.log(`Closing ${seed}: ${pda.toString()}`);
                const tx = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: pda,
                        toPubkey: walletKeypair.publicKey,
                        lamports: accountInfo.lamports,
                    })
                );
                await provider.sendAndConfirm(tx);
                console.log(`✅ Closed ${seed}`);
            } else {
                console.log(`⏭️  ${seed} doesn't exist or not owned by program`);
            }
        } catch (e) {
            console.log(`⚠️  Could not close ${seed}: ${e.message}`);
        }
    }
}

closeAccounts();
