import { useEffect, useState, useRef, useCallback } from 'react';
import { useWallet } from './useWallet';
import { useCadenProgram, getPositionPDA } from './useCadenProgram';
import { PublicKey } from '@solana/web3.js';

interface PositionData {
    side: 'Long' | 'Short';
    size: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
    cfdTokens: number;
}

const positionDataCache: { [key: string]: { data: PositionData | null; timestamp: number } } = {};
const CACHE_TTL = 200; // 200ms cache for 400ms updates

export function usePositionData() {
    const { publicKey } = useWallet();
    const { program } = useCadenProgram();
    const [data, setData] = useState<PositionData | null>(publicKey ? positionDataCache[publicKey.toString()]?.data || null : null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchPositionData = async () => {
        if (!program || !publicKey) {
            setLoading(false);
            return;
        }

        const userKey = publicKey.toString();
        if (positionDataCache[userKey] && (Date.now() - positionDataCache[userKey].timestamp < CACHE_TTL)) {
            const cachedData = positionDataCache[userKey].data;
            setData(prevData => {
                // Only update if data actually changed
                if (JSON.stringify(prevData) === JSON.stringify(cachedData)) {
                    return prevData;
                }
                return cachedData;
            });
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const positionPDA = getPositionPDA(publicKey);
            let fetchedPositionData: PositionData | null = null;

            try {
                const positionAccount = await (program.account as any).position.fetch(positionPDA);
                const position = positionAccount as any;

                const currentPrice = 95000000; // Real BTC price (should come from oracle)
                const priceDiff = currentPrice - position.entryPrice;
                const direction = position.side?.long ? 1 : -1;
                const unrealizedPnl = (priceDiff * position.size.toNumber() * direction) / 1000000;

                fetchedPositionData = {
                    side: position.side?.long ? 'Long' : 'Short',
                    size: position.size.toNumber() / 1000000,
                    entryPrice: position.entryPrice.toNumber() / 1000000,
                    currentPrice: currentPrice / 1000000,
                    unrealizedPnl,
                    cfdTokens: position.cfdTokens.toNumber() / 1000000
                };
            } catch (accountError) {
                // No position found for user
                fetchedPositionData = null;
            }

            setData(fetchedPositionData);
            positionDataCache[userKey] = { data: fetchedPositionData, timestamp: Date.now() };

        } catch (e) {
            console.error("Error fetching position data:", e);
            setError('Failed to fetch position data');
            setData(null);
            if (publicKey) {
                positionDataCache[publicKey.toString()] = { data: null, timestamp: Date.now() };
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (publicKey && program) {
            fetchPositionData();
            intervalRef.current = setInterval(fetchPositionData, 5000) as any; // Poll every 5 seconds
        } else {
            setData(null);
            setLoading(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [program, publicKey]); // Direct dependencies instead of fetchPositionData

    return { data, loading, error };
}
