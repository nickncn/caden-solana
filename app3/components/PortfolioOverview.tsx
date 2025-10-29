import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useBetData } from '@/hooks/useBetData';

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
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        padding: 16,
        margin: 16,
        borderWidth: 1,
        borderColor: '#333333',
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
        backgroundColor: '#2A2A2A',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
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
