import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { colors } from '@/constants/colors';
import { useWebWallet } from '@/components/WebWalletProvider';

export default function SignInScreen() {
    const webAuth = useWebWallet();

    // Use web wallet for all platforms now
    const { connect } = webAuth;

    const handleConnect = async () => {
        try {
            await connect();
        } catch (error) {
            console.error('Failed to connect:', error);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Welcome to Caden</Text>
                <Text style={styles.subtitle}>Connect your wallet to start trading</Text>

                <TouchableOpacity style={styles.connectButton} onPress={handleConnect}>
                    <Text style={styles.connectButtonText}>Connect Wallet</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        marginBottom: 32,
        textAlign: 'center',
    },
    connectButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 12,
    },
    connectButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
});
