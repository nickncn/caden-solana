import { useMemo } from 'react';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { Platform } from 'react-native';
import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { useAuth } from '@/components/auth/auth-provider';

export function useWalletSigning() {
    const { refreshAuth } = useAuth();

    const signTransaction = useMemo(() => {
        return async (transaction: Transaction | VersionedTransaction) => {
            if (Platform.OS === 'web') {
                // Web: Use browser wallet extension
                if (typeof window !== 'undefined' && (window as any).solana) {
                    const provider = (window as any).solana;
                    if (provider.signTransaction) {
                        return await provider.signTransaction(transaction);
                    }
                }
                throw new Error('Web wallet not available. Please connect a wallet extension.');
            } else {
                // Mobile: Use Mobile Wallet Adapter
                try {
                    return await transact(async (wallet: Web3MobileWallet) => {
                        const result = await wallet.signTransactions({
                            transactions: [transaction],
                        });
                        return (result as any).signedTransactions[0];
                    });
                } catch (error) {
                    // If it's an auth error, try to refresh and retry once
                    if (error instanceof Error &&
                        (error.message.includes('auth_token not valid') ||
                            error.message.includes('SolanaMobileWalletAdapterProtocolError'))) {
                        console.log('Auth error detected, attempting refresh...');
                        try {
                            await refreshAuth();
                            // Retry the transaction after refresh
                            return await transact(async (wallet: Web3MobileWallet) => {
                                const result = await wallet.signTransactions({
                                    transactions: [transaction],
                                });
                                return (result as any).signedTransactions[0];
                            });
                        } catch (refreshError) {
                            console.error('Refresh and retry failed:', refreshError);
                            throw refreshError;
                        }
                    }
                    throw error;
                }
            }
        };
    }, [refreshAuth]);

    const signAllTransactions = useMemo(() => {
        return async (transactions: (Transaction | VersionedTransaction)[]): Promise<(Transaction | VersionedTransaction)[]> => {
            if (Platform.OS === 'web') {
                // Web: Use browser wallet extension
                if (typeof window !== 'undefined' && (window as any).solana) {
                    const provider = (window as any).solana;
                    if (provider.signAllTransactions) {
                        return await provider.signAllTransactions(transactions);
                    }
                }
                throw new Error('Web wallet not available. Please connect a wallet extension.');
            } else {
                // Mobile: Use Mobile Wallet Adapter
                try {
                    return await transact(async (wallet: Web3MobileWallet) => {
                        const result = await wallet.signTransactions({
                            transactions,
                        });
                        return (result as any).signedTransactions;
                    });
                } catch (error) {
                    // If it's an auth error, try to refresh and retry once
                    if (error instanceof Error &&
                        (error.message.includes('auth_token not valid') ||
                            error.message.includes('SolanaMobileWalletAdapterProtocolError'))) {
                        console.log('Auth error detected, attempting refresh...');
                        try {
                            await refreshAuth();
                            // Retry the transaction after refresh
                            return await transact(async (wallet: Web3MobileWallet) => {
                                const result = await wallet.signTransactions({
                                    transactions,
                                });
                                return (result as any).signedTransactions;
                            });
                        } catch (refreshError) {
                            console.error('Refresh and retry failed:', refreshError);
                            throw refreshError;
                        }
                    }
                    throw error;
                }
            }
        };
    }, [refreshAuth]);

    return {
        signTransaction,
        signAllTransactions,
    };
}
