import { useMemo } from 'react';
import {
    transact,
    Web3MobileWallet
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {
    Transaction,
    VersionedTransaction,
    PublicKey
} from '@solana/web3.js';
import { useAuth } from '@/components/auth/auth-provider';

export function useMobileWallet() {
    const { refreshAuth } = useAuth();

    const signTransaction = useMemo(() => {
        return async (transaction: Transaction | VersionedTransaction) => {
            try {
                return await transact(async (wallet: Web3MobileWallet) => {
                    const result = await wallet.signTransactions({
                        transactions: [transaction],
                    });
                    return (result as any).signedTransactions[0];
                });
            } catch (error) {
                console.error('Transaction signing failed:', error);

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
        };
    }, [refreshAuth]);

    const signAllTransactions = useMemo(() => {
        return async (transactions: any[]): Promise<any[]> => {
            try {
                return await transact(async (wallet: Web3MobileWallet) => {
                    const result = await wallet.signTransactions({
                        transactions,
                    });
                    return (result as any).signedTransactions;
                });
            } catch (error) {
                console.error('Transaction signing failed:', error);

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
        };
    }, [refreshAuth]);

    return {
        signTransaction,
        signAllTransactions,
    };
}
