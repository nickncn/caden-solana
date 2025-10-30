import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useBetData } from '@/hooks/useBetData';
import { colors } from '@/constants/colors';

export function PortfolioOverview() {
    const { data: betData, loading } = useBetData();

    // Calculate stats from bet data
    const settledBets = betData?.filter(bet => bet.isSettled) || [];
    const totalPnL = settledBets.reduce((sum, bet) => {
        const betAmountUSD = bet.betAmount / 1_000000;
        const settlementUSD = bet.settlementValue / 1_000000;
        return sum + (settlementUSD - betAmountUSD);
    }, 0);

    const winningTrades = settledBets.filter(bet => {
        const betAmountUSD = bet.betAmount / 1_000000;
        const settlementUSD = bet.settlementValue / 1_000000;
        return settlementUSD > betAmountUSD;
    }).length;

    const winRate = settledBets.length > 0 ? (winningTrades / settledBets.length) * 100 : 0;

    const avgWin = winningTrades > 0 ? settledBets
        .filter(bet => {
            const betAmountUSD = bet.betAmount / 1_000000;
            const settlementUSD = bet.settlementValue / 1_000000;
            return settlementUSD > betAmountUSD;
        })
        .reduce((sum, bet) => {
            const betAmountUSD = bet.betAmount / 1_000000;
            const settlementUSD = bet.settlementValue / 1_000000;
            return sum + (settlementUSD - betAmountUSD);
        }, 0) / winningTrades : 0;

    const losingTrades = settledBets.length - winningTrades;
    const avgLoss = losingTrades > 0 ? settledBets
        .filter(bet => {
            const betAmountUSD = bet.betAmount / 1_000000;
            const settlementUSD = bet.settlementValue / 1_000000;
            return settlementUSD < betAmountUSD;
        })
        .reduce((sum, bet) => {
            const betAmountUSD = bet.betAmount / 1_000000;
            const settlementUSD = bet.settlementValue / 1_000000;
            return sum + (settlementUSD - betAmountUSD);
        }, 0) / losingTrades : 0;

    const stats = {
        totalPnL,
        winRate,
        totalTrades: betData?.length || 0,
        winningTrades,
        losingTrades,
        avgWin,
        avgLoss,
    };

    const pnlColor = stats.totalPnL >= 0 ? '#10B981' : '#EF4444';
    const pnlSign = stats.totalPnL >= 0 ? '+' : '';

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Portfolio Overview</Text>

            <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Total P&L</Text>
                    <Text style={[styles.statValue, { color: pnlColor }]}>
                        {pnlSign}${stats.totalPnL.toFixed(2)}
                    </Text>
                </View>

                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Win Rate</Text>
                    <Text style={styles.statValue}>{stats.winRate.toFixed(1)}%</Text>
                </View>

                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Total Bets</Text>
                    <Text style={styles.statValue}>{stats.totalTrades}</Text>
                </View>

                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Avg Win</Text>
                    <Text style={[styles.statValue, { color: '#10B981' }]}>
                        +${stats.avgWin.toFixed(2)}
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.glassBackground,
        borderRadius: 12,
        padding: 16,
        margin: 16,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        ...(Platform.OS === 'web' && {
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
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 16,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: colors.glassBackgroundLight,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glassBorderLight,
    },
    statLabel: {
        fontSize: 12,
        color: '#BBBBBB',
        marginBottom: 4,
        fontWeight: '500',
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
});
