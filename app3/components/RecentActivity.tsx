import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { colors } from '@/constants/colors';
import { useBetData } from '@/hooks/useBetData';

export function RecentActivity() {
    const { data: betData, loading } = useBetData();

    // Format timestamp relative to now based on createdSlot
    const formatTimestamp = (createdSlot: number) => {
        // Rough estimate: slots advance roughly every 400ms
        // Get current slot estimate (approximate)
        const currentSlot = Date.now() / 400; // Rough slot estimate
        const slotDiff = currentSlot - createdSlot;
        const minutesAgo = Math.floor(slotDiff * 400 / 60000); // Convert to minutes

        if (minutesAgo < 1) return 'Just now';
        if (minutesAgo < 60) return `${minutesAgo} min ago`;
        const hoursAgo = Math.floor(minutesAgo / 60);
        if (hoursAgo < 24) return `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago`;
        const daysAgo = Math.floor(hoursAgo / 24);
        return `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;
    };

    // Generate activity from bet data
    const activityData = useMemo(() => {
        if (!betData || betData.length === 0) return [];

        // Sort by createdSlot (most recent first) and take last 10
        const sortedBets = [...betData]
            .sort((a, b) => (b.createdSlot || 0) - (a.createdSlot || 0))
            .slice(0, 10);

        return sortedBets.map((bet) => {
            const isSettled = bet.isSettled ?? false;
            const betAmountUSD = (bet.betAmount || 0) / 1_000000;
            const settlementUSD = (bet.settlementValue || 0) / 1_000000;

            let type = 'mint'; // Default for active bets
            let amount = 0;

            if (isSettled && bet.settlementValue > 0) {
                // Calculate P&L
                const pnl = settlementUSD - betAmountUSD;
                if (pnl > 0) {
                    type = 'win';
                    amount = pnl;
                } else if (pnl < 0) {
                    type = 'loss';
                    amount = pnl;
                }
            }

            // Generate transaction hash placeholder (in production, fetch from blockchain)
            const txHash = `tx${bet.betId}${bet.createdSlot}`.slice(0, 16) + '...' + bet.betId.toString().slice(-6);

            return {
                id: bet.betId.toString(),
                type,
                asset: bet.assetSymbol,
                amount,
                timestamp: formatTimestamp(bet.createdSlot || 0),
                txHash,
                betId: bet.betId,
            };
        });
    }, [betData]);

    const renderActivityItem = (item: any) => {
        const isWin = item.type === 'win';
        const isLoss = item.type === 'loss';
        const isMint = item.type === 'mint';

        let icon = '';
        let color = '#FFFFFF';
        let description = '';

        if (isWin) {
            icon = '';
            color = '#10B981';
            description = `Won ${item.asset} bet`;
        } else if (isLoss) {
            icon = '';
            color = '#EF4444';
            description = `Lost ${item.asset} bet`;
        } else if (isMint) {
            icon = '';
            color = '#8B5CF6';
            description = `Placed ${item.asset} bet`;
        }

        const handleTxClick = () => {
            // In production, open Solscan link
            const solscanUrl = `https://solscan.io/tx/${item.txHash}?cluster=devnet`;
            if (typeof window !== 'undefined') {
                window.open(solscanUrl, '_blank');
            }
        };

        return (
            <View key={item.id} style={styles.activityItem}>
                <View style={styles.activityLeft}>
                    <Text style={styles.activityIcon}>{icon}</Text>
                    <View style={styles.activityInfo}>
                        <Text style={styles.activityDescription}>{description}</Text>
                        <Text style={styles.activityTime}>{item.timestamp}</Text>
                    </View>
                </View>
                <View style={styles.activityRight}>
                    {!isMint && (
                        <Text style={[styles.activityAmount, { color }]}>
                            {item.amount > 0 ? '+' : ''}${item.amount.toFixed(2)}
                        </Text>
                    )}
                    <TouchableOpacity onPress={handleTxClick}>
                        <Text style={styles.activityTx}>
                            {item.txHash}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Recent Activity</Text>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Loading activity...</Text>
                </View>
            </View>
        );
    }

    if (!betData || betData.length === 0) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Recent Activity</Text>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No recent activity</Text>
                    <Text style={styles.emptySubtext}>Your bets and transactions will appear here</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Recent Activity</Text>

            <ScrollView style={styles.activityList} showsVerticalScrollIndicator={false}>
                {activityData.length > 0 ? (
                    activityData.map(renderActivityItem)
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No recent activity</Text>
                        <Text style={styles.emptySubtext}>Your bets and transactions will appear here</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.glassBackground,
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
        borderRadius: 12,
        padding: 16,
        margin: 16,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        maxHeight: 300,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 16,
    },
    activityList: {
        gap: 12,
    },
    activityItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    activityLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    activityIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    activityInfo: {
        flex: 1,
    },
    activityDescription: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    activityTime: {
        fontSize: 12,
        color: '#BBBBBB',
        marginTop: 2,
    },
    activityRight: {
        alignItems: 'flex-end',
    },
    activityAmount: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    activityTx: {
        fontSize: 10,
        color: '#666666',
        marginTop: 2,
        fontFamily: 'monospace',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    emptyText: {
        fontSize: 16,
        color: '#FFFFFF',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 12,
        color: '#BBBBBB',
        textAlign: 'center',
    },
});
