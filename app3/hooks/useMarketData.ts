import { useEffect, useState, useRef } from 'react';
import { useConnection } from './useConnection';
import { useCadenProgram } from './useCadenProgram';
import { PublicKey } from '@solana/web3.js';

interface MarketData {
    t0Price: number;
    t2Price: number;
    expirySlot: number;
    status: 'Active' | 'Settled';
    currentSlot: number;
}

// Helper function to get MultiOracle PDA
function getMultiOraclePDA(programId: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from('multi_oracle')],
        programId
    );
    return pda;
}

const marketDataCache: { data: MarketData | null; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_TTL = 2000; // 2 second cache to reduce API calls
let isFetching = false; // Prevent concurrent fetches
let hasInitialLoad = false; // Track if initial load completed

export function useMarketData() {
    const connection = useConnection();
    const { program } = useCadenProgram();
    const [data, setData] = useState<MarketData | null>(marketDataCache.data);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchMarketData = async () => {
        if (isFetching) return; // Skip if already fetching

        if (!connection) {
            console.log("Connection not available, using mock data");
            // Use mock data when connection is not available
            const mockData: MarketData = {
                t0Price: 95000000, // $95,000 BTC
                t2Price: 3500000,  // $3,500 ETH
                expirySlot: 200000000, // Mock slot
                status: 'Active',
                currentSlot: 200000000
            };
            setData(mockData);
            marketDataCache.data = mockData;
            marketDataCache.timestamp = Date.now();
            if (!hasInitialLoad) {
                setLoading(false);
                hasInitialLoad = true;
            }
            return;
        }

        if (!program) {
            if (!marketDataCache.data) {
                console.log("Program not available, using mock data");
            }
            // Use mock data when program is not available
            let currentSlot;
            try {
                currentSlot = await connection.getSlot();
            } catch (slotError) {
                console.error("Error getting slot, using fallback:", slotError);
                currentSlot = Math.floor(Date.now() / 1000); // Use timestamp as fallback slot
            }

            const mockData: MarketData = {
                t0Price: 95000000, // $95,000 BTC
                t2Price: 3500000,  // $3,500 ETH
                expirySlot: currentSlot + 172800,
                status: 'Active',
                currentSlot
            };
            setData(mockData);
            marketDataCache.data = mockData;
            marketDataCache.timestamp = Date.now();
            if (!hasInitialLoad) {
                setLoading(false);
                hasInitialLoad = true;
            }
            return;
        }

        // Use cache if available and not expired
        if (marketDataCache.data && (Date.now() - marketDataCache.timestamp < CACHE_TTL)) {
            setData(marketDataCache.data);
            if (!hasInitialLoad) {
                setLoading(false);
                hasInitialLoad = true;
            }
            return;
        }

        try {
            isFetching = true;
            // Only set loading on initial load
            if (!hasInitialLoad) {
                setLoading(true);
            }
            setError(null);

            let currentSlot;
            try {
                currentSlot = await connection.getSlot();
            } catch (networkError) {
                currentSlot = Math.floor(Date.now() / 1000);
            }

            const multiOraclePDA = getMultiOraclePDA(program.programId);

            let fetchedMarketData: MarketData;
            try {
                const multiOracleAccount = await (program.account as any).multiAssetOracle.fetch(multiOraclePDA);

                const oracleData = multiOracleAccount as any;

                // Find BTC price in asset_prices array
                let btcPrice = 95000000; // Default BTC price ($95,000)
                let ethPrice = 3500000;  // Default ETH price ($3,500)

                if (oracleData.assetPrices && Array.isArray(oracleData.assetPrices)) {
                    for (const assetPrice of oracleData.assetPrices) {
                        if (assetPrice.assetSymbol === 'BTC') {
                            btcPrice = assetPrice.price?.toNumber?.() || assetPrice.price || btcPrice;
                        } else if (assetPrice.assetSymbol === 'ETH') {
                            ethPrice = assetPrice.price?.toNumber?.() || assetPrice.price || ethPrice;
                        }
                    }
                }

                // Use BTC as T+0 price, ETH as T+2 price for spread calculation
                const t0Price = btcPrice;
                const t2Price = ethPrice; // In real implementation, this would be BTC price at T+2
                const expirySlot = currentSlot + 172800; // 48 hours

                fetchedMarketData = {
                    t0Price,
                    t2Price,
                    expirySlot,
                    status: 'Active',
                    currentSlot
                };

                console.log(`📊 Real prices: BTC=$${(btcPrice / 1000000).toFixed(2)}, ETH=$${(ethPrice / 1000000).toFixed(2)}`);
            } catch (accountError) {
                console.log("MultiOracle account fetch failed, using mock data:", accountError);
                // Fallback to mock data if accounts not initialized
                fetchedMarketData = {
                    t0Price: 95000000, // $95,000 BTC
                    t2Price: 3500000,  // $3,500 ETH
                    expirySlot: currentSlot + 172800,
                    status: 'Active',
                    currentSlot
                };
            }

            setData(fetchedMarketData);
            marketDataCache.data = fetchedMarketData;
            marketDataCache.timestamp = Date.now();
            if (!hasInitialLoad) {
                setLoading(false);
                hasInitialLoad = true;
            }

        } catch (e) {
            if (!marketDataCache.data) {
                console.error("Error fetching market data:", e);
            }
            setError('Failed to fetch market data');
            // Fallback to mock data on error
            let currentSlot;
            try {
                currentSlot = await connection.getSlot();
            } catch (slotError) {
                console.error("Error getting slot in catch block, using fallback:", slotError);
                currentSlot = Math.floor(Date.now() / 1000);
            }
            const mockData: MarketData = {
                t0Price: 95000000, // $95,000 BTC
                t2Price: 3500000,  // $3,500 ETH
                expirySlot: currentSlot + 172800,
                status: 'Active',
                currentSlot
            };
            setData(mockData);
            marketDataCache.data = mockData;
            marketDataCache.timestamp = Date.now();
            if (!hasInitialLoad) {
                setLoading(false);
                hasInitialLoad = true;
            }
        } finally {
            isFetching = false;
        }
    };

    useEffect(() => {
        fetchMarketData();
        intervalRef.current = setInterval(fetchMarketData, 5000) as any; // Poll every 5 seconds to reduce API calls
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [connection, program]);

    return { data, loading, error };
}
