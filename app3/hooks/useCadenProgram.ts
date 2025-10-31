import { useConnection } from './useConnection';
import { useWallet } from './useWallet';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { useMemo } from 'react';
import IDL from '../idl/caden.json';
import { Platform } from 'react-native';

// Define config type
interface CadenConfig {
    PROGRAM_ID: string;
    MARKET_PDA: string;
    ORACLE_PDA: string;
    HEATMAP_PDA: string;
    GOVERNANCE_PDA: string;
    AMM_POOL_PDA: string;
    CADEN_MINT: string;
    USDC_MINT: string;
    USER_CADEN_ACCOUNT?: string;
    USER_USDC_ACCOUNT?: string;
    AUTHORITY?: string;
    NETWORK?: string;
    RPC_URL?: string;
}

// Try to import config safely
let config: CadenConfig;
try {
    config = require('../config/cadenConfig.json');
    console.log('Config loaded successfully:', config);
} catch (error) {
    console.error('Failed to load config:', error);
    // Fallback to hardcoded config
    config = {
        PROGRAM_ID: "3ZstoPk7ho2fAyotF3NTKFjJESr21qAjNXQuVaGSpQ5L",
        MARKET_PDA: "4oY44HUPmK7HWRU2DpU4HbEuFesc3r3JHdAu3CHKUX5y",
        ORACLE_PDA: "71yqWzd862fFCKaZwqaTfJK433NsNU5fNyFFnWuYzJb1",
        HEATMAP_PDA: "C8kyjntML17cgw1WEbPR7z24wyQoGrj777rYjLExMWhR",
        GOVERNANCE_PDA: "GCESYJhA1UewFuhavfzEBx5vcTCZrTr5qavZ1Sa7j3Xp",
        AMM_POOL_PDA: "7wpwzcFD2tmXtadvSPMN11C3rN5JTx9bpRqZvx93UaBS",
        CADEN_MINT: "F6ptuRxuPP9MrA2DbvkcFnmoY93Ykr5VdRRpmxLKjQKH",
        USDC_MINT: "HxkoRFKoM7kP2gFBbzDodB3nBji3KQ939wjJ5ZEC1B54"
    };
    console.log('Using fallback config:', config);
}

export function useCadenProgram() {
    const connection = useConnection();
    const { publicKey, signTransaction, signAllTransactions } = useWallet();

    // Use useMemo to prevent unnecessary program recreation
    const program = useMemo(() => {
        if (!connection) {
            return null;
        }

        if (!config) {
            console.error('❌ Config not loaded');
            return null;
        }

        try {
            // Create PROGRAM_ID safely
            let programId;
            try {
                programId = new PublicKey(config.PROGRAM_ID);
            } catch (error) {
                console.error('Failed to create PROGRAM_ID:', error);
                return null;
            }

            // CRITICAL: Only use real wallet for transactions, fail if not available
            if (!publicKey || !signTransaction || !signAllTransactions) {
                console.warn('❌ No real wallet available for transactions!');
                return null;
            }

            // For web, use Phantom directly for Anchor compatibility
            let wallet: any;
            if (typeof window !== 'undefined' && (window as any).solana) {
                // Use Phantom's wallet adapter directly for better compatibility
                wallet = {
                    publicKey,
                    signTransaction: async (tx: any) => {
                        const provider = (window as any).solana;
                        return await provider.signTransaction(tx);
                    },
                    signAllTransactions: async (txs: any[]) => {
                        const provider = (window as any).solana;
                        return await provider.signAllTransactions(txs);
                    },
                };
            } else {
                // Fallback to the provided signing functions
                wallet = {
                    publicKey,
                    signTransaction,
                    signAllTransactions,
                };
            }

            // Create AnchorProvider
            const provider = new AnchorProvider(
                connection,
                wallet,
                { preflightCommitment: 'processed' }
            );

            // Create real program with proper IDL
            const program = new Program(IDL as any, provider);
            console.log('✅ Anchor Program created:', program.programId.toString());

            return program;
        } catch (error) {
            console.error('Failed to create program:', error);
            return null;
        }
    }, [connection, config, publicKey]); // Removed signTransaction/signAllTransactions to prevent recreation

    return {
        program,
        connection,
        wallet: { publicKey, signTransaction, signAllTransactions },
        payer: publicKey,
        programId: config?.PROGRAM_ID,
    };
}

// Helper functions for PDA generation
export function getMarketPDA(): PublicKey {
    return new PublicKey(config.MARKET_PDA);
}

export function getPositionPDA(user: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), user.toBuffer()],
        new PublicKey(config.PROGRAM_ID)
    );
    return pda;
}

export function getOracleMockPDA(): PublicKey {
    return new PublicKey(config.ORACLE_PDA);
}

export function getHeatmapPDA(): PublicKey {
    return new PublicKey(config.HEATMAP_PDA);
}

export function getGovernancePDA(): PublicKey {
    return new PublicKey(config.GOVERNANCE_PDA);
}

export function getAmmPoolPDA(): PublicKey {
    return new PublicKey(config.AMM_POOL_PDA);
}

export function getCadenMint(): PublicKey {
    return new PublicKey(config.CADEN_MINT);
}

export function getUsdcMint(): PublicKey {
    return new PublicKey(config.USDC_MINT);
}
