import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '@/constants/colors';
import { useBetData } from '@/hooks/useBetData';
import { useRouter } from 'expo-router';

export function PositionCard() {
    const { data: betData, loading, error } = useBetData();
    const router = useRouter();

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Active Bets</Text>
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>Loading...</Text>
                    </View>
                </View>
                <View style={styles.container}>
                    <Text style={styles.loadingText}>Loading bet data...</Text>
                </View>
            </View>
        );
    }

    if (error || !betData || betData.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Active Bets</Text>
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>0</Text>
                    </View>
                </View>
                <View style={styles.container}>
                    <Text style={styles.emptyText}>No active bets found</Text>
                    <TouchableOpacity style={styles.actionButton}>
                        <Text style={styles.actionButtonText}>Place Bet</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // Show the most recent bet
    const latestBet = betData[betData.length - 1];
    const betAmountUSD = (latestBet.betAmount || 0) / 1_000000; // Convert from 6 decimals with null check
    const entryPriceUSD = (latestBet.entryPrice || 0) / 1_000000; // Convert from 6 decimals with null check
    const isLong = latestBet.isLong;
    const sideColor = isLong ? colors.success : colors.danger;
    const sideText = isLong ? 'LONG' : 'SHORT';

    const handleViewAllBets = () => {
        router.push('/(tabs)/settlement-slots');
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Active Bets</Text>
                <View style={styles.countBadge}>
                    <Text style={styles.countText}>{betData.length}</Text>
                </View>
            </View>

            <View style={styles.betContainer}>
                <View style={styles.betHeader}>
                    <Text style={styles.assetSymbol}>{latestBet.assetSymbol}</Text>
                    <View style={[styles.sideBadge, { backgroundColor: sideColor }]}>
                        <Text style={styles.sideText}>{sideText}</Text>
                    </View>
                </View>

                <View style={styles.betDetails}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Amount</Text>
                        <Text style={styles.detailValue}>${betAmountUSD.toFixed(2)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Entry Price</Text>
                        <Text style={styles.detailValue}>${entryPriceUSD.toFixed(2)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Status</Text>
                        <Text style={[styles.detailValue, { color: latestBet.isSettled ? colors.success : colors.warningColor }]}>
                            {latestBet.isSettled ? 'Settled' : 'Active'}
                        </Text>
                    </View>
                </View>

                {latestBet.isSettled && (
                    <View style={styles.settlementContainer}>
                        <Text style={styles.settlementLabel}>Settlement Value</Text>
                        <Text style={styles.settlementValue}>
                            ${((latestBet.settlementValue || 0) / 1_000000).toFixed(2)}
                        </Text>
                    </View>
                )}
            </View>

            {betData.length > 1 && (
                <TouchableOpacity style={styles.viewAllButton} onPress={handleViewAllBets}>
                    <Text style={styles.viewAllText}>View All Bets ({betData.length})</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.borderLight,
        padding: 16,
        marginHorizontal: 20,
        marginVertical: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    countBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: colors.primary,
    },
    countText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text,
    },
    betContainer: {
        marginBottom: 16,
    },
    betHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    assetSymbol: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
    },
    sideBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    sideText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: colors.text,
    },
    betDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    detailRow: {
        alignItems: 'center',
        flex: 1,
    },
    detailLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    settlementContainer: {
        backgroundColor: colors.surfaceVariant,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    settlementLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    settlementValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.success,
    },
    viewAllButton: {
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: 'center',
    },
    viewAllText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    actionButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    loadingText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        padding: 20,
    },
    emptyText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        padding: 20,
        marginBottom: 16,
    },
});
