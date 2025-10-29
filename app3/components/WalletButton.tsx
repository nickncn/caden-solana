import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native';
import { colors } from '@/constants/colors';
import { useWebWallet } from './WebWalletProvider';

export function WalletButton() {
    const webAuth = useWebWallet();
    const [isConnecting, setIsConnecting] = useState(false);

    // For now, use web wallet for all platforms
    const walletProvider = webAuth;
    const { isConnected, publicKey, connect, disconnect } = walletProvider;

    const handlePress = async () => {
        if (isConnected) {
            disconnect();
        } else {
            setIsConnecting(true);
            try {
                // Add timeout to prevent getting stuck
                const connectionPromise = connect();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Connection timeout - please try again')), 30000)
                );

                await Promise.race([connectionPromise, timeoutPromise]);
                console.log('Wallet connection successful');
            } catch (error) {
                console.error('Wallet connection error:', error);
                const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
                Alert.alert('Connection Failed', errorMessage);
            } finally {
                setIsConnecting(false);
            }
        }
    };

    const getDisplayText = () => {
        console.log('🔍 WalletButton state:', { isConnecting, isConnected, publicKey: publicKey?.toString() });

        if (isConnecting) return 'Connecting...';
        if (!isConnected) return 'Connect Wallet';
        if (!publicKey) return 'Connected';

        const address = publicKey.toString();
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    };

    return (
        <TouchableOpacity style={styles.button} onPress={handlePress}>
            <Text style={styles.buttonText}>{getDisplayText()}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        backgroundColor: colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    buttonText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
    },
});
