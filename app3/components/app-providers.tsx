import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SolanaProvider } from './solana/solana-provider';
import { ClusterProvider } from './cluster/cluster-provider';
import { Platform } from 'react-native';
import { WebWalletProvider } from './WebWalletProvider';

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
        <QueryClientProvider client={queryClient}>
            <ClusterProvider>
                <SolanaProvider>
                    <WebWalletProvider>
                        {children}
                    </WebWalletProvider>
                </SolanaProvider>
            </ClusterProvider>
        </QueryClientProvider>
    );
}