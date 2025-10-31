import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SpreadHeatmap } from '@/components/SpreadHeatmap';
import { MarketCard } from '@/components/MarketCard';
import { PositionCard } from '@/components/PositionCard';
import { useBetData } from '@/hooks/useBetData';
import { useMarketData } from '@/hooks/useMarketData';
import { useResponsive } from '@/hooks/useResponsive';
import { colors } from '@/constants/colors';

export default function HomeScreen() {
    const { data: betData, loading } = useBetData();
    const { data: marketData } = useMarketData();
    const { isDesktop } = useResponsive();

    // Get current BTC price from market data
    const currentBTCPrice = marketData?.t0Price || 0; // BTC price in 6 decimals

    // Calculate total P&L from bets
    const totalPnL = betData?.reduce((sum, bet) => {
        const betAmountUSD = (bet.betAmount || 0) / 1_000000;

        if (bet.isSettled) {
            // For settled bets, calculate realized P&L
            const settlementUSD = (bet.settlementValue || 0) / 1_000000;
            return sum + (settlementUSD - betAmountUSD);
        } else {
            // For active bets, calculate unrealized P&L based on current price
            if (bet.assetSymbol === 'BTC' && currentBTCPrice > 0 && bet.entryPrice > 0) {
                const entryPriceUSD = (bet.entryPrice || 0) / 1_000000;
                const currentPriceUSD = currentBTCPrice / 1_000000;

                if (bet.isLong) {
                    // LONG bet: profit if price goes up
                    // P&L = betAmount × (currentPrice - entryPrice) / entryPrice
                    const priceChange = (currentPriceUSD - entryPriceUSD) / entryPriceUSD;
                    return sum + (betAmountUSD * priceChange);
                } else {
                    // SHORT bet: profit if price goes down
                    // P&L = betAmount × (entryPrice - currentPrice) / entryPrice
                    const priceChange = (entryPriceUSD - currentPriceUSD) / entryPriceUSD;
                    return sum + (betAmountUSD * priceChange);
                }
            }
            // If no market data or non-BTC asset, return 0 (no P&L calculated)
            return sum + 0;
        }
    }, 0) || 0;

    const pnlColor = totalPnL >= 0 ? '#10B981' : '#EF4444';
    const pnlSign = totalPnL >= 0 ? '+' : '';

    return (
        <LinearGradient
            colors={colors.gradientBackground as [string, string, string]}
            style={styles.gradientBackground}
        >
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                <View style={[styles.contentWrapper, isDesktop && styles.contentWrapperDesktop]}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Dashboard</Text>
                        <Text style={styles.subtitle}>View your bets and performance</Text>
                    </View>

                    {/* P&L Summary */}
                    <View style={styles.pnlContainer}>
                        <Text style={styles.pnlLabel}>Total P&L</Text>
                        <Text style={[styles.pnlValue, { color: pnlColor }]}>
                            {pnlSign}${totalPnL.toFixed(2)}
                        </Text>
                        <Text style={styles.pnlSubtext}>
                            {loading ? 'Loading bets...' :
                                betData && betData.length > 0 ?
                                    (betData.some(bet => bet.isSettled) ? 'Live tracking' : 'Active bets - P&L on settlement') :
                                    'Connect wallet to track'}
                        </Text>
                    </View>

                    {/* Desktop Grid Layout */}
                    {isDesktop ? (
                        <View style={styles.gridContainer}>
                            <View style={styles.gridLeft}>
                                <MarketCard />
                                <SpreadHeatmap />
                            </View>
                            <View style={styles.gridRight}>
                                <PositionCard />
                            </View>
                        </View>
                    ) : (
                        // Mobile: Stacked layout
                        <>
                            <MarketCard />
                            <SpreadHeatmap />
                            <PositionCard />
                        </>
                    )}
                </View>
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradientBackground: {
        flex: 1,
    },
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    contentWrapper: {
        ...(Platform.OS === 'web' && {
            maxWidth: 1200,
            width: '100%',
            alignSelf: 'center',
        }),
    },
    contentWrapperDesktop: {
        paddingHorizontal: 40,
    },
    header: {
        padding: 20,
        paddingTop: 10,
        ...(Platform.OS === 'web' && {
            paddingHorizontal: 0,
        }),
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#BBBBBB',
    },
    pnlContainer: {
        backgroundColor: colors.glassBackground,
        margin: 20,
        marginTop: 0,
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glassBorder,
        ...(Platform.OS === 'web' && {
            marginHorizontal: 0,
            marginBottom: 24,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px 0 rgba(139, 92, 246, 0.15)',
        }),
        ...(Platform.OS !== 'web' && {
            shadowColor: '#8B5CF6',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 5,
        }),
    },
    pnlLabel: {
        fontSize: 14,
        color: '#BBBBBB',
        marginBottom: 8,
        fontWeight: '500',
    },
    pnlValue: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    pnlSubtext: {
        fontSize: 12,
        color: '#666666',
    },
    // Desktop Grid Layout
    gridContainer: {
        flexDirection: 'row',
        gap: 24,
        alignItems: 'flex-start',
    },
    gridLeft: {
        flex: 2,
        gap: 16,
    },
    gridRight: {
        flex: 1,
        gap: 16,
    },
});
