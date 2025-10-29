import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Platform } from 'react-native';
import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

export interface WebWalletProviderState {
    isConnected: boolean;
    publicKey: PublicKey | null;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
}

const WebWalletContext = createContext<WebWalletProviderState>({} as WebWalletProviderState);

export function WebWalletProvider({ children }: { children: ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [publicKey, setPublicKey] = useState<PublicKey | null>(null);

    const connect = async () => {
        try {
            if (Platform.OS === 'web') {
                // Web: Use browser wallet extension
                if (typeof window !== 'undefined' && (window as any).solana) {
                    const provider = (window as any).solana;
                    if (!provider.isConnected) {
                        const response = await provider.connect();
                        setIsConnected(true);
                        setPublicKey(new PublicKey(response.publicKey.toString()));
                    } else {
                        // Already connected
                        setIsConnected(true);
                        setPublicKey(new PublicKey(provider.publicKey.toString()));
                    }
                } else {
                    throw new Error('No wallet found. Please install Phantom or another Solana wallet.');
                }
            } else {
                // Mobile: Use Mobile Wallet Adapter
                const result = await transact(async (wallet: Web3MobileWallet) => {
                    const authorization = await wallet.authorize({
                        cluster: 'devnet',
                        identity: {
                            name: 'Caden',
                            uri: 'https://caden.app',
                            icon: 'https://caden.app/icon.png',
                        },
                    });
                    return authorization;
                });

                setIsConnected(true);
                setPublicKey(new PublicKey(result.accounts[0].address));
            }
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            throw new Error('Failed to connect to wallet.');
        }
    };

    const disconnect = async () => {
        try {
            console.log('🔍 Disconnecting wallet...');
            setIsConnected(false);
            setPublicKey(null);

            // Disconnect from provider if on web
            if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).solana) {
                const provider = (window as any).solana;
                if (provider.isConnected) {
                    await provider.disconnect();
                }
            }

            console.log('✅ Wallet disconnected');
        } catch (error) {
            console.error('Failed to disconnect wallet:', error);
            // Still disconnect locally even if wallet disconnect fails
            setIsConnected(false);
            setPublicKey(null);
        }
    };

    return (
        <WebWalletContext.Provider value={{ isConnected, publicKey, connect, disconnect }}>
            {children}
        </WebWalletContext.Provider>
    );
}

export function useWebWallet(): WebWalletProviderState {
    return useContext(WebWalletContext);
}
