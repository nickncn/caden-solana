import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';
import { useCadenProgram } from '@/hooks/useCadenProgram';
import { useWallet } from '@/hooks/useWallet';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useResponsive } from '@/hooks/useResponsive';

export function BettingInterface() {
    const [direction, setDirection] = useState<'long' | 'short'>('long');
    const [amount, setAmount] = useState('100');
    const [asset, setAsset] = useState('BTC');
    const [isBetting, setIsBetting] = useState(false);
    const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
    const [txHash, setTxHash] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string>('');

    const { program, connection } = useCadenProgram();
    const { publicKey } = useWallet();
    const { isDesktop } = useResponsive();

    const handlePlaceBet = async () => {
        if (!publicKey) {
            Alert.alert('Error', 'Please connect your wallet');
            return;
        }

        if (!program) {
            Alert.alert('Error', 'Program not initialized');
            return;
        }

        const betAmount = parseFloat(amount);
        if (isNaN(betAmount) || betAmount < 10) {
            Alert.alert('Error', 'Minimum bet is $10');
            return;
        }

        try {
            setIsBetting(true);
            setTxStatus('pending');
            setTxHash('');
            setErrorMessage('');

            console.log('🚀 Starting bet placement...');
            console.log('Asset:', asset);
            console.log('Amount:', betAmount);
            console.log('Direction:', direction);
            console.log('PublicKey:', publicKey.toString());

            // Generate unique bet seed
            const betSeed = Date.now();
            const [betPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('bet'),
                    publicKey.toBuffer(),
                    Buffer.from(new BN(betSeed).toArray('le', 8))
                ],
                program.programId
            );

            const [multiOraclePDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('multi_oracle')],
                program.programId
            );

            console.log('Bet PDA:', betPDA.toString());
            console.log('Oracle PDA:', multiOraclePDA.toString());

            console.log('📝 Creating transaction...');

            // Build the transaction instruction
            const ix = await (program.methods as any).placeBet(
                asset,
                { crypto: {} },
                new BN(betAmount * 1_000000), // Convert to 6 decimals
                direction === 'long',
                new BN(betSeed)
            ).accounts({
                bet: betPDA,
                multiOracle: multiOraclePDA,
                user: publicKey,
                systemProgram: SystemProgram.programId,
            }).instruction();

            // Create and send transaction manually to get full control
            console.log('📤 Sending transaction...');
            const signature = await (window as any).solana.sendTransaction(ix, connection, {
                preflightCommitment: 'confirmed',
            });

            console.log('📊 Transaction sent:', signature);

            // Wait for confirmation
            console.log('⏳ Waiting for confirmation...');
            const confirmation = await connection.confirmTransaction(signature, 'confirmed');

            console.log('✅ Transaction confirmed!');
            console.log('Signature:', signature);
            console.log('Confirmation:', confirmation);

            // Create Solscan URL
            const solscanUrl = `https://solscan.io/tx/${signature}?cluster=devnet`;
            console.log('🔗 Solscan URL:', solscanUrl);

            setTxHash(signature);
            setTxStatus('success');

            // Show success alert with clickable link
            Alert.alert(
                'Bet Placed!',
                `Successfully placed ${direction.toUpperCase()} bet of $${amount} on ${asset}\n\nTX: ${signature.slice(0, 8)}...${signature.slice(-8)}\n\nView on Solscan: ${solscanUrl}`,
                [
                    {
                        text: 'View Transaction',
                        onPress: () => {
                            if (typeof window !== 'undefined') {
                                window.open(solscanUrl, '_blank');
                            }
                        }
                    },
                    {
                        text: 'OK',
                        onPress: () => {
                            setTxStatus('idle');
                            setAmount('100');
                        }
                    }
                ]
            );
        } catch (error: any) {
            console.error('❌ Bet error:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));

            // Extract error message with better handling
            let errorMsg = 'Failed to place bet';
            let errorLogs = '';

            try {
                // Try to get logs from the error if available
                if (error.logs && Array.isArray(error.logs)) {
                    errorLogs = error.logs.join('\n');
                    console.log('Error logs:', errorLogs);
                }

                // Check for common error patterns
                if (error.message) {
                    errorMsg = error.message;

                    // Special handling for "already processed" errors (this means success!)
                    if (error.message.includes('already been processed') ||
                        error.message.includes('already processed')) {
                        console.log('✅ Transaction was already processed (success!)');
                        setTxHash('already-processed');
                        setTxStatus('success');
                        Alert.alert(
                            'Bet Placed!',
                            `Your ${direction.toUpperCase()} bet of $${amount} on ${asset} was placed successfully!\n\nThe transaction was already processed on the blockchain.`,
                            [{
                                text: 'OK', onPress: () => {
                                    setTxStatus('idle');
                                    setAmount('100');
                                }
                            }]
                        );
                        return;
                    }
                } else if (error.toString) {
                    errorMsg = error.toString();
                }

                // If we have logs, append them to the error message
                if (errorLogs) {
                    errorMsg += '\n\nLogs:\n' + errorLogs;
                }
            } catch (parseError) {
                console.error('Error parsing error:', parseError);
            }

            setErrorMessage(errorMsg);
            setTxStatus('error');

            // Show detailed error alert
            Alert.alert(
                'Transaction Failed',
                errorMsg,
                [{
                    text: 'OK', onPress: () => {
                        setTxStatus('idle');
                    }
                }]
            );
        } finally {
            setIsBetting(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Place Bet</Text>

                {/* Asset Selection */}
                <View style={styles.section}>
                    <Text style={styles.label}>Asset</Text>
                    <View style={styles.assetRow}>
                        {['BTC', 'ETH'].map((a) => (
                            <TouchableOpacity
                                key={a}
                                style={[styles.assetButton, asset === a && styles.assetButtonActive]}
                                onPress={() => setAsset(a)}
                            >
                                <Text style={[styles.assetButtonText, asset === a && styles.assetButtonTextActive]}>
                                    {a}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Direction Selection */}
                <View style={styles.section}>
                    <Text style={styles.label}>Direction</Text>
                    <View style={styles.directionRow}>
                        <TouchableOpacity
                            style={[styles.directionButton, direction === 'long' && styles.longButton]}
                            onPress={() => setDirection('long')}
                        >
                            <Text style={[styles.directionText, direction === 'long' && styles.directionTextActive]}>
                                LONG
                            </Text>
                            <Text style={styles.directionSubtext}>Price goes up</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.directionButton, direction === 'short' && styles.shortButton]}
                            onPress={() => setDirection('short')}
                        >
                            <Text style={[styles.directionText, direction === 'short' && styles.directionTextActive]}>
                                SHORT
                            </Text>
                            <Text style={styles.directionSubtext}>Price goes down</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Amount Input */}
                <View style={styles.section}>
                    <Text style={styles.label}>Amount (USD)</Text>
                    <TextInput
                        style={styles.input}
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="numeric"
                        placeholder="100"
                        placeholderTextColor="#666666"
                    />
                    <Text style={styles.hint}>Minimum: $10</Text>
                </View>

                {/* Place Bet Button */}
                <TouchableOpacity
                    onPress={handlePlaceBet}
                    disabled={isBetting}
                    style={styles.betButtonContainer}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={
                            txStatus === 'success'
                                ? colors.gradientSuccess as [string, string]
                                : txStatus === 'error'
                                    ? colors.gradientDanger as [string, string]
                                    : colors.gradientPrimary as [string, string]
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                            styles.betButton,
                            isBetting && styles.betButtonDisabled,
                        ]}
                    >
                        {isBetting ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <ActivityIndicator color="#FFFFFF" />
                                <Text style={styles.betButtonText}>
                                    {txStatus === 'pending' ? 'Waiting for confirmation...' : 'Processing...'}
                                </Text>
                            </View>
                        ) : (
                            <Text style={styles.betButtonText}>
                                Place {direction.toUpperCase()} Bet: ${amount}
                            </Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                {/* Transaction Status Display */}
                {txStatus === 'success' && txHash && txHash !== 'already-processed' && (
                    <View style={styles.statusContainer}>
                        <Text style={styles.successText}>
                            ✅ Bet placed successfully!
                        </Text>
                        <Text style={styles.txHashText}>
                            TX: {txHash.slice(0, 8)}...{txHash.slice(-8)}
                        </Text>
                        <TouchableOpacity
                            onPress={() => {
                                const solscanUrl = `https://solscan.io/tx/${txHash}?cluster=devnet`;
                                if (typeof window !== 'undefined') {
                                    window.open(solscanUrl, '_blank');
                                }
                            }}
                            style={styles.linkButton}
                        >
                            <Text style={styles.linkButtonText}>🔗 View on Solscan</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {txStatus === 'error' && errorMessage && (
                    <View style={styles.statusContainer}>
                        <Text style={styles.errorText}>
                            ❌ Error: {errorMessage}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        ...(Platform.OS === 'web' && {
            maxWidth: 1200,
            width: '100%',
            alignSelf: 'center',
            paddingHorizontal: 40,
        }),
    },
    card: {
        backgroundColor: colors.glassBackground,
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        ...(Platform.OS === 'web' && {
            padding: 32,
            borderRadius: 16,
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
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 20,
    },
    section: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        color: '#BBBBBB',
        marginBottom: 8,
        fontWeight: '500',
    },
    assetRow: {
        flexDirection: 'row',
        gap: 12,
    },
    assetButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        backgroundColor: colors.glassBackgroundLight,
        borderWidth: 1,
        borderColor: colors.glassBorderLight,
        alignItems: 'center',
    },
    assetButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.glassBorder,
    },
    assetButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#BBBBBB',
    },
    assetButtonTextActive: {
        color: '#FFFFFF',
    },
    directionRow: {
        flexDirection: 'row',
        gap: 12,
    },
    directionButton: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: colors.glassBackgroundLight,
        borderWidth: 1,
        borderColor: colors.glassBorderLight,
        alignItems: 'center',
    },
    longButton: {
        backgroundColor: colors.success,
        borderColor: colors.glowSuccess,
    },
    shortButton: {
        backgroundColor: colors.danger,
        borderColor: colors.glowDanger,
    },
    directionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#BBBBBB',
        marginBottom: 4,
    },
    directionTextActive: {
        color: '#FFFFFF',
    },
    directionSubtext: {
        fontSize: 12,
        color: '#BBBBBB',
    },
    input: {
        backgroundColor: colors.glassBackgroundLight,
        borderWidth: 1,
        borderColor: colors.glassBorderLight,
        borderRadius: 8,
        padding: 16,
        fontSize: 16,
        color: '#FFFFFF',
    },
    hint: {
        fontSize: 12,
        color: '#666666',
        marginTop: 4,
    },
    betButtonContainer: {
        marginTop: 8,
        borderRadius: 12,
        overflow: 'hidden',
    },
    betButton: {
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        ...(Platform.OS === 'web' && {
            paddingVertical: 18,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 15px 0 rgba(139, 92, 246, 0.4)',
        }),
        ...(Platform.OS !== 'web' && {
            shadowColor: '#8B5CF6',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.5,
            shadowRadius: 8,
            elevation: 8,
        }),
    },
    betButtonDisabled: {
        opacity: 0.6,
    },
    betButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    statusContainer: {
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#1A1A1A',
    },
    successText: {
        fontSize: 14,
        color: '#10B981',
        fontWeight: '500',
    },
    errorText: {
        fontSize: 14,
        color: '#EF4444',
        fontWeight: '500',
    },
    txHashText: {
        fontSize: 12,
        color: '#888888',
        marginTop: 4,
        fontFamily: 'monospace',
    },
    linkButton: {
        marginTop: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        alignItems: 'center',
        overflow: 'hidden',
    },
    linkButtonText: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '600',
    },
});

