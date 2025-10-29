import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useBetData } from '@/hooks/useBetData';

export function ActivePositions() {
    const { data: betData, loading } = useBetData();

    // Filter active (unsettled) bets
    const activeBets = betData?.filter(bet => !bet.isSettled) || [];

    const renderBet = (bet: any) => {
        const betAmountUSD = (bet.betAmount || 0) / 1_000000;
        const entryPriceUSD = (bet.entryPrice || 0) / 1_000000;
        const sideColor = bet.isLong ? '#10B981' : '#EF4444';
        const sideText = bet.isLong ? 'LONG' : 'SHORT';

        return (
            <View key={bet.betId} style={styles.positionCard}>
                <View style={styles.positionHeader}>
                    <View style={styles.assetContainer}>
                        <Text style={styles.assetSymbol}>{bet.assetSymbol}</Text>
                        <View style={[styles.sideBadge, { backgroundColor: sideColor }]}>
                            <Text style={styles.sideText}>{sideText}</Text>
                        </View>
                    </View>
                    <Text style={styles.betAmount}>
                        ${betAmountUSD.toFixed(2)}
                    </Text>
                </View>

                <View style={styles.positionDetails}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Entry Price:</Text>
                        <Text style={styles.detailValue}>${entryPriceUSD.toFixed(2)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Status:</Text>
                        <Text style={[styles.detailValue, { color: '#F59E0B' }]}>Active</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Bet ID:</Text>
                        <Text style={styles.detailValue}>#{bet.betId}</Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Active Bets</Text>
                <Text style={styles.count}>{activeBets.length} bets</Text>
            </View>

            {activeBets.length > 0 ? (
                <View style={styles.positionsList}>
                    {activeBets.map(renderBet)}
                </View>
            ) : (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No active bets</Text>
                    <Text style={styles.emptySubtext}>Place a bet to see it here</Text>
                </View>
            )}
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    count: {
        fontSize: 14,
        color: '#BBBBBB',
    },
    positionsList: {
        gap: 12,
    },
    positionCard: {
        backgroundColor: '#2A2A2A',
        borderRadius: 8,
        padding: 12,
    },
    positionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    assetContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    assetSymbol: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    sideBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    sideText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    betAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    positionDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailLabel: {
        fontSize: 12,
        color: '#BBBBBB',
    },
    detailValue: {
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    emptyText: {
        fontSize: 16,
        color: '#666666',
        marginBottom: 4,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#888888',
    },
});
