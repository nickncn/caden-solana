import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { colors } from '@/constants/colors';
import { useMarketData } from '@/hooks/useMarketData';
import { useResponsive } from '@/hooks/useResponsive';

export function MarketCard() {
    const { data: marketData, loading, error } = useMarketData();
    const { isDesktop } = useResponsive();

    // Memoize expensive calculations to prevent unnecessary re-renders
    const displayData = useMemo(() => {
        if (!marketData) return null;

        // Check if prices are valid
        if (!marketData.t0Price || !marketData.t2Price || marketData.t0Price === 0) return null;

        const spread = ((marketData.t2Price - marketData.t0Price) / marketData.t0Price * 10000);
        if (isNaN(spread) || !isFinite(spread)) return null;

        return {
            t0Price: (marketData.t0Price / 1000000).toFixed(2),
            t2Price: (marketData.t2Price / 1000000).toFixed(2),
            currentSpread: spread.toFixed(0),
            currentSlot: marketData.currentSlot.toLocaleString(),
        };
    }, [marketData]);

    // Always render the same structure to prevent layout jumping
    const showLoading = loading;
    const showError = error;
    const showData = !loading && !error && displayData;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Market Status</Text>
                <View style={[styles.statusBadge, showError && styles.errorBadge, !showLoading && !showError && styles.activeBadge]}>
                    <Text style={styles.statusText}>
                        {showLoading ? 'Loading...' : showError ? 'Error' : 'Active'}
                    </Text>
                </View>
            </View>

            <View style={styles.content}>
                {/* Always render the same structure to prevent layout shifts */}
                <View style={styles.priceContainer}>
                    <View style={styles.priceCard}>
                        <Text style={styles.priceLabel}>T+0 Price</Text>
                        <Text style={styles.priceValue}>
                            {showData ? `$${displayData.t0Price}` : showLoading ? '...' : 'N/A'}
                        </Text>
                    </View>
                    <View style={styles.priceCard}>
                        <Text style={styles.priceLabel}>T+2 Price</Text>
                        <Text style={styles.priceValue}>
                            {showData ? `$${displayData.t2Price}` : showLoading ? '...' : 'N/A'}
                        </Text>
                    </View>
                </View>

                <View style={styles.spreadContainer}>
                    <Text style={styles.spreadLabel}>Current Spread</Text>
                    <Text style={styles.spreadValue}>
                        {showData ? `${displayData.currentSpread} bps` : showLoading ? '...' : 'N/A'}
                    </Text>
                </View>

                <View style={styles.slotContainer}>
                    <Text style={styles.slotLabel}>Current Slot</Text>
                    <Text style={styles.slotValue}>
                        {showData ? displayData.currentSlot : showLoading ? '...' : 'N/A'}
                    </Text>
                </View>

                {/* Show error message only if there's an error */}
                {showError && (
                    <Text style={styles.errorText}>Failed to load market data</Text>
                )}
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
        minHeight: 180, // Fixed min height to prevent jumping
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
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    statusBadge: {
        backgroundColor: colors.success,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    activeBadge: {
        backgroundColor: colors.success,
    },
    errorBadge: {
        backgroundColor: colors.error,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text,
    },
    content: {
        gap: 16,
    },
    priceContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    priceCard: {
        flex: 1,
        backgroundColor: colors.glassBackgroundLight,
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glassBorderLight,
    },
    priceLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    priceValue: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    spreadContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.glassBackgroundLight,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.glassBorderLight,
    },
    spreadLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    spreadValue: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.primary,
    },
    slotContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.surfaceVariant,
        borderRadius: 12,
        padding: 12,
    },
    slotLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    slotValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    loadingText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 14,
        color: colors.error,
        textAlign: 'center',
        padding: 20,
    },
});
