import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SettlementSlotInterface } from '@/components/SettlementSlotInterface';
import { colors } from '@/constants/colors';

export default function SpreadScreen() {
    return (
        <LinearGradient
            colors={colors.gradientBackground as [string, string, string]}
            style={styles.gradientBackground}
        >
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                <View style={styles.contentWrapper}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Mint Slots</Text>
                        <Text style={styles.subtitle}>Create Settlement Slots</Text>
                    </View>

                    <SettlementSlotInterface />
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
            paddingHorizontal: 40,
        }),
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
});
