import React, { createContext, useContext, useState, type ReactNode } from 'react';

export interface Cluster {
    name: string;
    endpoint: string;
    network: string;
}

export interface ClusterProviderState {
    selectedCluster: Cluster;
    setSelectedCluster: (cluster: Cluster) => void;
}

const ClusterContext = createContext<ClusterProviderState>({} as ClusterProviderState);

export function ClusterProvider({ children }: { children: ReactNode }) {
    const [selectedCluster, setSelectedCluster] = useState<Cluster>({
        name: 'Devnet',
        endpoint: 'https://api.devnet.solana.com',
        network: 'devnet',
    });

    return (
        <ClusterContext.Provider value={{ selectedCluster, setSelectedCluster }}>
            {children}
        </ClusterContext.Provider>
    );
}

export function useCluster(): ClusterProviderState {
    return useContext(ClusterContext);
}
