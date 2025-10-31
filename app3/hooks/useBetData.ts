import { useEffect, useState, useCallback } from 'react';
import { useWallet } from './useWallet';
import { useCadenProgram } from './useCadenProgram';

let hasInitialLoad = false; // Track if initial load completed
let isFetching = false; // Prevent concurrent fetches
let retryDelay = 1000; // Exponential backoff for rate limiting

export interface BetData {
    betId: number;
    assetSymbol: string;
    isLong: boolean;
    betAmount: number;      // 6dp USD
    entryPrice: number;     // 6dp
    createdSlot: number;
    isSettled: boolean;
    settlementValue: number;
}

export function useBetData() {
    const { publicKey } = useWallet();
    const { program } = useCadenProgram();
    const [data, setData] = useState<BetData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const run = useCallback(async () => {
        if (!program || !publicKey) {
            setData([]);
            if (!hasInitialLoad) {
                setLoading(false);
                hasInitialLoad = true;
            }
            return;
        }

        // Only set loading on first load
        if (!hasInitialLoad) {
            setLoading(true);
        }
        setError(null);

        // Prevent concurrent fetches
        if (isFetching) return;
        isFetching = true;

        try {
            // Fetch bet accounts for the user
            const bets = await (program.account as any).bet.all([
                { memcmp: { offset: 8, bytes: publicKey.toBase58() } } // owner at offset 8
            ]);

            // Enhanced debug: Log the actual blockchain data structure with detailed inspection
            if (bets.length > 0) {
                const firstBet = bets[0].account;
                console.log('🔍 ========== BET DATA DEBUG ==========');
                console.log('🔍 Total bets found:', bets.length);
                console.log('🔍 First bet - Full account object:', firstBet);
                console.log('🔍 First bet - betAmount RAW:', firstBet.betAmount);
                console.log('🔍 First bet - betAmount type:', typeof firstBet.betAmount);
                console.log('🔍 First bet - betAmount toNumber():', firstBet.betAmount?.toNumber?.());
                console.log('🔍 First bet - betAmount toString():', firstBet.betAmount?.toString?.());
                console.log('🔍 First bet - entryPrice RAW:', firstBet.entryPrice);
                console.log('🔍 First bet - entryPrice type:', typeof firstBet.entryPrice);
                console.log('🔍 First bet - entryPrice toNumber():', firstBet.entryPrice?.toNumber?.());
                console.log('🔍 First bet - entryPrice toString():', firstBet.entryPrice?.toString?.());
                console.log('🔍 First bet - betId:', firstBet.betId);
                console.log('🔍 First bet - assetSymbol:', firstBet.assetSymbol);
                console.log('🔍 First bet - isLong:', firstBet.isLong);
                console.log('🔍 First bet - isSettled:', firstBet.isSettled);

                // Try different conversion methods (using camelCase)
                let testBetAmount = 0;
                if (firstBet.betAmount) {
                    if (typeof firstBet.betAmount === 'number') {
                        testBetAmount = firstBet.betAmount;
                    } else if (typeof firstBet.betAmount === 'string') {
                        testBetAmount = parseInt(firstBet.betAmount, 10) || 0;
                    } else if (firstBet.betAmount.toNumber) {
                        testBetAmount = firstBet.betAmount.toNumber();
                    } else if (firstBet.betAmount.toString) {
                        testBetAmount = parseInt(firstBet.betAmount.toString(), 10) || 0;
                    }
                }

                let testEntryPrice = 0;
                if (firstBet.entryPrice) {
                    if (typeof firstBet.entryPrice === 'number') {
                        testEntryPrice = firstBet.entryPrice;
                    } else if (typeof firstBet.entryPrice === 'string') {
                        testEntryPrice = parseInt(firstBet.entryPrice, 10) || 0;
                    } else if (firstBet.entryPrice.toNumber) {
                        testEntryPrice = firstBet.entryPrice.toNumber();
                    } else if (firstBet.entryPrice.toString) {
                        testEntryPrice = parseInt(firstBet.entryPrice.toString(), 10) || 0;
                    }
                }

                console.log('🔍 First bet - Parsed betAmount:', testBetAmount, `($${(testBetAmount / 1_000000).toFixed(2)} USD)`);
                console.log('🔍 First bet - Parsed entryPrice:', testEntryPrice, `($${(testEntryPrice / 1_000000).toFixed(2)} USD)`);

                // Show all bets summary (using camelCase)
                console.log('🔍 All bets summary:');
                bets.forEach((bet: any, index: number) => {
                    const amount = bet.account.betAmount?.toNumber?.() ?? bet.account.betAmount ?? 0;
                    const price = bet.account.entryPrice?.toNumber?.() ?? bet.account.entryPrice ?? 0;
                    console.log(`  Bet ${index + 1}: ID=${bet.account.betId?.toNumber?.() ?? bet.account.betId}, Amount=${amount} ($${(amount / 1_000000).toFixed(2)}), Price=${price} ($${(price / 1_000000).toFixed(2)}), Symbol=${bet.account.assetSymbol}, Long=${bet.account.isLong}`);
                });
                console.log('🔍 =====================================');
            }

            // Anchor converts Rust snake_case to JavaScript camelCase
            const mapped: BetData[] = bets.map((b: any) => ({
                betId: b.account.betId?.toNumber?.() ?? b.account.betId ?? 0,
                assetSymbol: b.account.assetSymbol ?? 'BTC',
                isLong: b.account.isLong ?? false,
                betAmount: b.account.betAmount?.toNumber?.() ?? b.account.betAmount ?? 0,
                entryPrice: b.account.entryPrice?.toNumber?.() ?? b.account.entryPrice ?? 0,
                createdSlot: b.account.createdSlot?.toNumber?.() ?? b.account.createdSlot ?? 0,
                isSettled: b.account.isSettled ?? false,
                settlementValue: b.account.settlementValue?.toNumber?.() ?? b.account.settlementValue ?? 0,
            }));

            setData(mapped);
        } catch (e: any) {
            console.error('Error fetching bets:', e);

            // Handle rate limiting with exponential backoff
            if (e.message?.includes('429') || e.message?.includes('Too Many Requests')) {
                console.log(`Rate limited, retrying in ${retryDelay}ms...`);
                setTimeout(() => {
                    retryDelay = Math.min(retryDelay * 2, 10000); // Max 10 seconds
                    run();
                }, retryDelay);
                return; // Don't reset loading state yet
            }

            setError(e.message || 'Failed to fetch bets');
            setData([]);
            retryDelay = 1000; // Reset retry delay on success
        } finally {
            isFetching = false; // Always reset fetching flag
            if (!hasInitialLoad) {
                setLoading(false);
                hasInitialLoad = true;
            }
        }
    }, [program, publicKey]);

    useEffect(() => {
        run();

        // Add polling interval
        const interval = setInterval(run, 5000); // Poll every 5 seconds
        return () => clearInterval(interval);
    }, [run]);

    return { data, loading, error };
}
