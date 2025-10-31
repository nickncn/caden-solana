import { useWebWallet } from '@/components/WebWalletProvider';

export function useWallet() {
    const { isConnected, publicKey, connect, disconnect } = useWebWallet();

    console.log('🔍 useWallet - Web wallet state:', { isConnected, publicKey: publicKey?.toString() });

    // REAL mobile wallet signing functions
    const signTransaction = async (transaction: any) => {
        console.log('🔍 REAL mobile wallet signing transaction...');
        // This will fail if no real wallet is connected - that's what we want
        throw new Error('Real mobile wallet signing not implemented. Please connect a real mobile wallet.');
    };

    const signAllTransactions = async (transactions: any[]) => {
        console.log('🔍 REAL mobile wallet signing all transactions...');
        // This will fail if no real wallet is connected - that's what we want
        throw new Error('Real mobile wallet signing not implemented. Please connect a real mobile wallet.');
    };

    return {
        isConnected,
        publicKey,
        connect,
        disconnect,
        // Provide mock signing functions for demo
        signTransaction: isConnected ? signTransaction : undefined,
        signAllTransactions: isConnected ? signAllTransactions : undefined,
    };
}
