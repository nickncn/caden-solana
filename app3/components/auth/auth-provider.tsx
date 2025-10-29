import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { PublicKey } from '@solana/web3.js';
import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { Buffer } from 'buffer';

export interface AuthProviderState {
    isConnected: boolean;
    publicKey: PublicKey | null;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthProviderState>({} as AuthProviderState);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [lastAuthTime, setLastAuthTime] = useState<number>(0);

    const connect = async () => {
        try {
            console.log('🚀 Starting wallet connection...');

            // Use a simpler approach for mobile wallet connection
            const authorizationResult = await transact(async (wallet: Web3MobileWallet) => {
                console.log('🔍 Wallet object received:', wallet);
                console.log('🔍 Wallet type:', typeof wallet);
                console.log('🔍 Wallet methods:', Object.keys(wallet));

                try {
                    console.log('🔍 Calling wallet.authorize...');
                    const result = await wallet.authorize({
                        cluster: 'devnet',
                        identity: {
                            name: 'Caden Mobile',
                            uri: 'https://caden.app',
                        },
                    });
                    console.log('✅ Wallet authorization completed:', result);
                    return result;
                } catch (authError) {
                    console.error('❌ Wallet authorization failed:', authError);
                    throw authError;
                }
            });

            console.log('✅ Transact completed, processing result...');
            console.log('Authorization result:', authorizationResult);

            // Store auth token and timestamp
            setAuthToken(authorizationResult.auth_token);
            setLastAuthTime(Date.now());

            // Set connected state
            setIsConnected(true);

            // Validate and set the public key
            const address = authorizationResult.accounts[0]?.address;
            if (address && typeof address === 'string') {
                try {
                    // Handle different address formats
                    let decodedAddress = address;

                    // Check if it's base64 encoded (common with Mobile Wallet Adapter)
                    if (address.includes('=') || address.includes('+') || address.includes('/')) {
                        try {
                            // Try to decode from base64
                            const bytes = Buffer.from(address, 'base64');
                            decodedAddress = new PublicKey(bytes).toString();
                            console.log('Decoded base64 address:', decodedAddress);
                        } catch (base64Error) {
                            console.log('Not base64, trying direct conversion');
                        }
                    }

                    setPublicKey(new PublicKey(decodedAddress));
                    console.log('Successfully connected wallet:', decodedAddress);
                    console.log('Auth token stored:', authorizationResult.auth_token ? 'Yes' : 'No');
                } catch (keyError) {
                    console.error('Invalid public key address:', address, keyError);
                    throw new Error(`Invalid wallet address: ${address}`);
                }
            } else {
                console.error('No valid address found in authorization result:', authorizationResult);
                throw new Error('No wallet address received from authorization');
            }

            console.log('Wallet connection completed successfully');
        } catch (error) {
            console.error('❌ CRITICAL: Failed to connect wallet:', error);
            console.error('Error details:', error);
            console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
            setIsConnected(false);
            setPublicKey(null);
            // Re-throw the error so the UI can handle it
            throw error;
        }
    };

    const disconnect = async () => {
        console.log('🔌 Disconnecting wallet...');
        try {
            // Force clear all wallet state
            setIsConnected(false);
            setPublicKey(null);
            setAuthToken(null);
            setLastAuthTime(0);

            // Clear any cached authentication tokens
            // This forces a fresh authentication on next connect
            console.log('🧹 Cleared wallet state and auth tokens');
            console.log('✅ Wallet disconnected - ready for fresh connection');
        } catch (error) {
            console.error('Error during disconnect:', error);
            // Force clear state even if disconnect fails
            setIsConnected(false);
            setPublicKey(null);
            setAuthToken(null);
            setLastAuthTime(0);
        }
    };

    const refreshAuth = async () => {
        console.log('🔄 Refreshing authentication...');
        try {
            // Check if auth token is expired (older than 30 minutes)
            const now = Date.now();
            const authAge = now - lastAuthTime;
            const thirtyMinutes = 30 * 60 * 1000;

            if (authToken && authAge < thirtyMinutes) {
                console.log('✅ Auth token is still valid, no refresh needed');
                return;
            }

            console.log('🔄 Auth token expired or missing, reconnecting...');
            await disconnect();
            await connect();
            console.log('✅ Authentication refreshed successfully');
        } catch (error) {
            console.error('❌ Failed to refresh authentication:', error);
            // Force disconnect on refresh failure
            await disconnect();
            throw error;
        }
    };

    // Auto-refresh auth token every 25 minutes
    useEffect(() => {
        if (!isConnected || !authToken) return;

        const interval = setInterval(async () => {
            try {
                await refreshAuth();
            } catch (error) {
                console.error('Auto-refresh failed:', error);
            }
        }, 25 * 60 * 1000); // 25 minutes

        return () => clearInterval(interval);
    }, [isConnected, authToken]);

    return (
        <AuthContext.Provider value={{ isConnected, publicKey, connect, disconnect, refreshAuth }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthProviderState {
    return useContext(AuthContext);
}