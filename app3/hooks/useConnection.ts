import { useSolana } from '@/components/solana/solana-provider';

export function useConnection() {
    const { connection } = useSolana();
    return connection;
}
