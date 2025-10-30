import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors } from '@/constants/colors';
import { useMarketData } from '@/hooks/useMarketData';
import { useResponsive } from '@/hooks/useResponsive';

export function SpreadHeatmap() {
    const { data: marketData, loading, error } = useMarketData();
    const { width: screenWidth, isDesktop } = useResponsive();
    const [spreadHistory, setSpreadHistory] = useState<Array<{ slot: number, spread: number }>>([
        { slot: 0, spread: 200 }, // Initialize with realistic spread data
        { slot: 1, spread: 200 },
        { slot: 2, spread: 200 }
    ]);
    const [chartWidth, setChartWidth] = useState<number | null>(null);

    // Update spread history when market data changes (400ms updates) - only when data actually changes
    useEffect(() => {
        if (marketData && marketData.t0Price > 0 && marketData.t2Price > 0) {
            const spread = ((marketData.t2Price - marketData.t0Price) / marketData.t0Price) * 10000;
            if (!isNaN(spread) && isFinite(spread)) {
                setSpreadHistory(prev => {
                    const lastItem = prev[prev.length - 1];
                    // Only update if the spread actually changed
                    if (lastItem && lastItem.spread === spread) {
                        return prev;
                    }
                    return [...prev.slice(-49), { slot: marketData.currentSlot, spread }];
                });
            }
        }
    }, [marketData]);

    const chartData = React.useMemo(() => {
        // Ensure we have at least some data to render
        const dataPoints = spreadHistory.slice(-20);
        if (dataPoints.length === 0) {
            // Provide default data to prevent errors
            return {
                labels: Array(20).fill(''),
                datasets: [
                    {
                        data: Array(20).fill(0),
                        color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                        strokeWidth: 2,
                    },
                ],
            };
        }
        return {
            labels: dataPoints.map((_, i) => ''),
            datasets: [
                {
                    data: dataPoints.map(d => d.spread),
                    color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                    strokeWidth: 2,
                },
            ],
        };
    }, [spreadHistory]);

    const chartConfig = {
        backgroundColor: colors.surface,
        backgroundGradientFrom: colors.surface,
        backgroundGradientTo: colors.surface,
        decimalPlaces: 2,
        color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(187, 187, 187, ${opacity})`,
        style: {
            borderRadius: 16,
        },
        propsForDots: {
            r: '0',
        },
        propsForBackgroundLines: {
            strokeDasharray: '',
            stroke: colors.border,
            strokeWidth: 1,
        },
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Live Spread (T+0 vs T+2)</Text>
                <View style={styles.statusContainer}>
                    <Text style={styles.statusText}>
                        {loading ? 'Loading...' : 'Live'}
                    </Text>
                </View>
            </View>

            <View
                style={styles.chartContainer}
                onLayout={e => setChartWidth(e.nativeEvent.layout.width)}
            >
                <LineChart
                    data={chartData}
                    width={chartWidth ?? (isDesktop ? Math.min(screenWidth - 120, 800) : screenWidth - 40)}
                    height={isDesktop ? 220 : 180}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                    withHorizontalLabels={false}
                    withVerticalLabels={true}
                    withDots={false}
                    withShadow={false}
                    withScrollableDot={false}
                />
            </View>

            <View style={styles.footer}>
                <Text style={styles.spreadValue}>
                    Spread {spreadHistory.length > 0 ? spreadHistory[spreadHistory.length - 1].spread.toFixed(0) : loading ? '...' : '0'} bps
                </Text>
                <Text style={styles.slotText}>
                    Slot {marketData?.currentSlot ? marketData.currentSlot.toLocaleString() : loading ? '...' : '0'}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.glassBackground,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        padding: 16,
        marginHorizontal: 20,
        marginVertical: 8,
        minHeight: 180,
        ...(Platform.OS === 'web' && {
            marginHorizontal: 0,
            padding: 24,
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
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    loadingDots: {
        flexDirection: 'row',
        gap: 4,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.textSecondary,
    },
    statusText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    chartContainer: {
        alignItems: 'center',
        marginBottom: 16,
        overflow: 'hidden',
        width: '100%',
        borderRadius: 16,
    },
    chart: {
        borderRadius: 16,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    spreadValue: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    slotText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
});
