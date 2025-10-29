import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export function RecentActivity() {
    // Mock data for demo - in real app this would come from API
    const mockActivity = [
        {
            id: '1',
            type: 'win',
            asset: 'BTC',
            amount: 23.45,
            timestamp: '2 min ago',
            txHash: 'abc123...def456',
        },
        {
            id: '2',
            type: 'loss',
            asset: 'ETH',
            amount: -8.90,
            timestamp: '1 hour ago',
            txHash: 'xyz789...ghi012',
        },
        {
            id: '3',
            type: 'mint',
            asset: 'AAPL',
            amount: 0,
            timestamp: '3 hours ago',
            txHash: 'mno345...pqr678',
        },
        {
            id: '4',
            type: 'win',
            asset: 'SOL',
            amount: 15.20,
            timestamp: '1 day ago',
            txHash: 'stu901...vwx234',
        },
    ];

    const renderActivityItem = (item: any) => {
        const isWin = item.type === 'win';
        const isLoss = item.type === 'loss';
        const isMint = item.type === 'mint';

        let icon = '';
        let color = '#FFFFFF';
        let description = '';

        if (isWin) {
            icon = '🎉';
            color = '#10B981';
            description = `Won ${item.asset} bet`;
        } else if (isLoss) {
            icon = '📉';
            color = '#EF4444';
            description = `Lost ${item.asset} bet`;
        } else if (isMint) {
            icon = '🎨';
            color = '#8B5CF6';
            description = `Minted ${item.asset} slot`;
        }

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
                    <Text style={styles.activityTx}>
                        {item.txHash.slice(0, 8)}...{item.txHash.slice(-6)}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Recent Activity</Text>

            <ScrollView style={styles.activityList} showsVerticalScrollIndicator={false}>
                {mockActivity.map(renderActivityItem)}
            </ScrollView>
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
});
