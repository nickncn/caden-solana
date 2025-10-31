import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SolanaProvider } from './solana/solana-provider';
import { ClusterProvider } from './cluster/cluster-provider';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WebWalletProvider } from './WebWalletProvider';
import { colors } from '@/constants/colors';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
        },
    },
});

export function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <LinearGradient
            colors={colors.gradientBackground as [string, string, string]}
            style={styles.gradientContainer}
        >
            <QueryClientProvider client={queryClient}>
                <ClusterProvider>
                    <SolanaProvider>
                        <WebWalletProvider>
                            {children}
                        </WebWalletProvider>
                    </SolanaProvider>
                </ClusterProvider>
            </QueryClientProvider>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradientContainer: {
        flex: 1,
    },
});