import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useBetData } from '@/hooks/useBetData';
import { colors } from '@/constants/colors';

export function ActivePositions() {
    const { data: betData, loading, error } = useBetData();

    // Early return for loading state (same pattern as PositionCard)
    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Active Bets</Text>
                    <Text style={styles.count}>Loading...</Text>
                </View>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Loading bets...</Text>
                </View>
            </View>
        );
    }

    // Early return for error state
    if (error) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Active Bets</Text>
                    <Text style={styles.count}>Error</Text>
                </View>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Error loading bets</Text>
                    <Text style={styles.emptySubtext}>{error}</Text>
                </View>
            </View>
        );
    }

    // Filter active (unsettled) bets - check both camelCase and snake_case for compatibility
    const activeBets = betData?.filter(bet => {
        // Handle potential field name mismatch (isSettled vs is_settled)
        const isSettled = (bet as any).isSettled ?? (bet as any).is_settled ?? false;
        return !isSettled;
    }) || [];

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
        backgroundColor: colors.glassBackgroundLight,
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.glassBorderLight,
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
