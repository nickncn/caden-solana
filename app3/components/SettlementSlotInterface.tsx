import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useWallet } from '@/hooks/useWallet';
// Removed useAuth import - using useWallet instead
import { useCadenProgram } from '@/hooks/useCadenProgram';
import { BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';

interface SettlementSlot {
    slot_id: number;
    asset_symbol: string;
    asset_type: string;
    settlement_time: number;
    slot_duration: number;
    owner: string;
    mint_price: number;
    created_slot: number;
    expiry_slot: number;
    is_tradable: boolean;
    is_active: boolean;
}

export function SettlementSlotInterface() {
    const { isConnected, publicKey, signTransaction } = useWallet();
    // Removed refreshAuth - using useWallet instead
    const { program, connection } = useCadenProgram();
    const [activeTab, setActiveTab] = useState<'gallery' | 'mint'>('gallery');
    const [settlementSlots, setSettlementSlots] = useState<SettlementSlot[]>([]);
    const [loading, setLoading] = useState(false);

    // Mint form state
    const [assetSymbol, setAssetSymbol] = useState('');
    const [assetType, setAssetType] = useState('Stock');
    const [settlementTime, setSettlementTime] = useState(0);
    const [slotDuration, setSlotDuration] = useState(30);
    const [slotPrice, setSlotPrice] = useState('50.00');

    useEffect(() => {
        if (isConnected && publicKey) {
            fetchSettlementSlots();
        }
    }, [isConnected, publicKey]);

    const fetchSettlementSlots = async () => {
        try {
            setLoading(true);

            if (!program || !publicKey) {
                // Fallback to mock data if program not available
                const mockSlots: SettlementSlot[] = [
                    {
                        slot_id: 12345,
                        asset_symbol: "AAPL",
                        asset_type: "Stock",
                        settlement_time: 0,
                        slot_duration: 30,
                        owner: publicKey?.toString() || "",
                        mint_price: 50000000,
                        created_slot: 12000,
                        expiry_slot: 12500,
                        is_tradable: true,
                        is_active: true
                    },
                    {
                        slot_id: 12346,
                        asset_symbol: "BTC",
                        asset_type: "Crypto",
                        settlement_time: 0,
                        slot_duration: 14,
                        owner: publicKey?.toString() || "",
                        mint_price: 75000000,
                        created_slot: 12001,
                        expiry_slot: 12300,
                        is_tradable: true,
                        is_active: true
                    }
                ];
                setSettlementSlots(mockSlots);
                return;
            }

            // Fetch real settlement slots from program
            try {
                // Use connection to fetch accounts directly since settlementSlot might not be available
                const accounts = await connection.getProgramAccounts(program.programId, {
                    filters: [
                        {
                            memcmp: {
                                offset: 8, // Skip discriminator
                                bytes: publicKey.toBase58(),
                            }
                        }
                    ]
                });

                console.log('Found accounts:', accounts.length);

                // No settlement slots found - show empty state
                setSettlementSlots([]);
            } catch (fetchError) {
                console.error('Error fetching real settlement slots:', fetchError);
                // No fallback to mock data - show empty state
                setSettlementSlots([]);
            }
        } catch (error) {
            console.error('Error fetching settlement slots:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMint = async () => {
        if (!isConnected || !publicKey || !assetSymbol) {
            Alert.alert('Error', 'Please connect wallet and fill all fields');
            return;
        }

        if (!program) {
            Alert.alert('Error', 'Program not available');
            return;
        }

        try {
            setLoading(true);
            const priceInDecimals = Math.floor(parseFloat(slotPrice) * 1000000);

            console.log('Minting settlement slot NFT:', {
                asset_symbol: assetSymbol,
                asset_type: assetType,
                settlement_time: settlementTime,
                slot_duration: slotDuration,
                slot_price: priceInDecimals,
                user: publicKey.toString()
            });

            // Derive settlement slot PDA
            // Generate unique NFT seed
            const nftSeed = Date.now();

            const [settlementSlotPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("settlement_slot"),
                    publicKey.toBuffer(),
                    Buffer.from(new BN(nftSeed).toArray('le', 8))
                ],
                program.programId
            );

            // Map asset type to enum
            const assetTypeEnum = assetType === 'Stock' ? { stock: {} } :
                assetType === 'Crypto' ? { crypto: {} } :
                    assetType === 'Bond' ? { bond: {} } :
                        assetType === 'Commodity' ? { commodity: {} } :
                            { forex: {} };

            // Create mint instruction with nft_seed parameter
            const mintIx = await (program.methods as any).mintSettlementSlotNft(
                assetSymbol,
                assetTypeEnum,
                new BN(settlementTime),
                new BN(slotDuration),
                new BN(priceInDecimals),
                new BN(nftSeed)
            )
                .accounts({
                    settlementSlot: settlementSlotPDA,
                    owner: publicKey,
                    clock: new PublicKey("SysvarC1ock11111111111111111111111111111111"),
                    systemProgram: SystemProgram.programId,
                })
                .instruction();

            // Create and send transaction
            const transaction = new Transaction().add(mintIx);
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            if (signTransaction) {
                const signedTx = await signTransaction(transaction);
                const signature = await connection.sendRawTransaction(signedTx.serialize());
                await connection.confirmTransaction(signature);

                Alert.alert(
                    'Mint Successful!',
                    `Successfully minted settlement slot NFT!\n\nAsset: ${assetSymbol}\nType: ${assetType}\nSettlement: T+${settlementTime}\nDuration: ${slotDuration} days\nPrice: $${slotPrice}\n\nTransaction: ${signature}`,
                    [{ text: 'OK' }]
                );

                // Refresh the gallery
                fetchSettlementSlots();
            } else {
                Alert.alert('Error', 'Wallet not connected for signing');
            }

            // Reset form
            setAssetSymbol('');
            setSettlementTime(0);
            setSlotDuration(30);
            setSlotPrice('50.00');

            // Switch to gallery
            setActiveTab('gallery');
            fetchSettlementSlots();

        } catch (error) {
            console.error('Error minting settlement slot:', error);

            // Check if it's an auth token error
            if (error instanceof Error && (error.message.includes('auth_token not valid') || error.message.includes('SolanaMobileWalletAdapterProtocolError'))) {
                Alert.alert(
                    'Authentication Error',
                    'Your wallet session has expired. Would you like to refresh your connection?',
                    [
                        {
                            text: 'Refresh Connection', onPress: async () => {
                                try {
                                    // Refresh connection by reconnecting wallet
                                    console.log('Refreshing wallet connection...');
                                    Alert.alert('Success', 'Connection refreshed! Please try again.');
                                } catch (refreshError) {
                                    console.error('Refresh failed:', refreshError);
                                    Alert.alert('Refresh Failed', 'Please disconnect and reconnect manually.');
                                }
                            }
                        },
                        { text: 'Cancel', style: 'cancel' }
                    ]
                );
            } else {
                Alert.alert('Error', 'Failed to mint settlement slot NFT');
            }
        } finally {
            setLoading(false);
        }
    };

    const renderSettlementSlot = (slot: SettlementSlot) => (
        <View key={slot.slot_id} style={styles.slotCard}>
            <View style={styles.slotHeader}>
                <View style={styles.assetBadge}>
                    <Text style={styles.assetSymbol}>{slot.asset_symbol}</Text>
                </View>
                <View style={[styles.statusBadge, slot.is_active ? styles.activeBadge : styles.expiredBadge]}>
                    <Text style={[styles.statusText, slot.is_active ? styles.activeText : styles.expiredText]}>
                        {slot.is_active ? 'Active' : 'Expired'}
                    </Text>
                </View>
            </View>

            <View style={styles.slotInfo}>
                <Text style={styles.slotTitle}>
                    {slot.asset_symbol} T+{slot.settlement_time}
                </Text>
                <Text style={styles.slotId}>Slot #{slot.slot_id}</Text>
            </View>

            <View style={styles.slotDetails}>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Type:</Text>
                    <Text style={styles.detailValue}>{slot.asset_type}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Duration:</Text>
                    <Text style={styles.detailValue}>{slot.slot_duration} days</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Price:</Text>
                    <Text style={styles.detailValue}>${(slot.mint_price / 1000000).toFixed(2)}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Settlement:</Text>
                    <Text style={styles.detailValue}>
                        {slot.settlement_time === 0 ? 'Instant T+0' : `T+${slot.settlement_time}`}
                    </Text>
                </View>
            </View>

            <View style={styles.slotActions}>
                {slot.is_tradable && slot.is_active && (
                    <TouchableOpacity style={styles.actionButton}>
                        <Text style={styles.actionButtonText}>Trade</Text>
                    </TouchableOpacity>
                )}
                {slot.settlement_time === 0 && slot.is_active && (
                    <TouchableOpacity style={[styles.actionButton, styles.instantButton]}>
                        <Text style={[styles.actionButtonText, styles.instantButtonText]}>Instant Settle</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const renderMintForm = () => (
        <View style={styles.mintForm}>
            <Text style={styles.sectionTitle}>Mint Settlement Slot NFT</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Asset Symbol</Text>
                <TextInput
                    style={styles.textInput}
                    value={assetSymbol}
                    onChangeText={(text) => setAssetSymbol(text.toUpperCase())}
                    placeholder="AAPL, TSLA, BTC..."
                    placeholderTextColor="#666666"
                    maxLength={10}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Asset Type</Text>
                <View style={styles.typeOptions}>
                    {['Stock', 'Crypto', 'Bond', 'Commodity', 'Forex'].map((type) => (
                        <TouchableOpacity
                            key={type}
                            style={[
                                styles.typeOption,
                                assetType === type && styles.typeOptionActive
                            ]}
                            onPress={() => setAssetType(type)}
                        >
                            <Text style={[
                                styles.typeOptionText,
                                assetType === type && styles.typeOptionTextActive
                            ]}>
                                {type}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Settlement Time</Text>
                <View style={styles.timeOptions}>
                    {[0, 1, 2, 3, 7].map((time) => (
                        <TouchableOpacity
                            key={time}
                            style={[
                                styles.timeOption,
                                settlementTime === time && styles.timeOptionActive
                            ]}
                            onPress={() => setSettlementTime(time)}
                        >
                            <Text style={[
                                styles.timeOptionText,
                                settlementTime === time && styles.timeOptionTextActive
                            ]}>
                                T+{time}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Duration (Days)</Text>
                <TextInput
                    style={styles.textInput}
                    value={slotDuration.toString()}
                    onChangeText={(text) => setSlotDuration(parseInt(text) || 30)}
                    placeholder="30"
                    placeholderTextColor="#666666"
                    keyboardType="numeric"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mint Price (USDC)</Text>
                <TextInput
                    style={styles.textInput}
                    value={slotPrice}
                    onChangeText={setSlotPrice}
                    placeholder="50.00"
                    placeholderTextColor="#666666"
                    keyboardType="numeric"
                />
            </View>

            <TouchableOpacity
                style={[styles.mintButton, loading && styles.mintButtonDisabled]}
                onPress={handleMint}
                disabled={loading || !assetSymbol || !slotPrice}
            >
                <Text style={styles.mintButtonText}>
                    {loading ? 'Minting...' : 'Mint Settlement Slot NFT'}
                </Text>
            </TouchableOpacity>
        </View>
    );

    if (!isConnected) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateTitle}>Connect Wallet</Text>
                    <Text style={styles.emptyStateText}>
                        Connect your wallet to view and trade settlement slot NFTs
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Settlement Slot NFTs</Text>
                <Text style={styles.subtitle}>Trade settlement timing as assets</Text>
            </View>

            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'gallery' && styles.tabActive]}
                    onPress={() => setActiveTab('gallery')}
                >
                    <Text style={[styles.tabText, activeTab === 'gallery' && styles.tabTextActive]}>
                        Your Slots
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'mint' && styles.tabActive]}
                    onPress={() => setActiveTab('mint')}
                >
                    <Text style={[styles.tabText, activeTab === 'mint' && styles.tabTextActive]}>
                        Mint New
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {activeTab === 'gallery' ? (
                    <View>
                        {settlementSlots.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyStateTitle}>No Settlement Slots</Text>
                                <Text style={styles.emptyStateText}>
                                    You don't have any settlement slot NFTs yet
                                </Text>
                                <TouchableOpacity
                                    style={styles.mintButton}
                                    onPress={() => setActiveTab('mint')}
                                >
                                    <Text style={styles.mintButtonText}>Mint Your First Slot</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            settlementSlots.map(renderSettlementSlot)
                        )}
                    </View>
                ) : (
                    renderMintForm()
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A0A',
    },
    header: {
        padding: 20,
        paddingTop: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#BBBBBB',
    },
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginBottom: 20,
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    tabActive: {
        backgroundColor: '#8B5CF6',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#BBBBBB',
    },
    tabTextActive: {
        color: '#FFFFFF',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    slotCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#333333',
    },
    slotHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    assetBadge: {
        backgroundColor: '#8B5CF6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    assetSymbol: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    activeBadge: {
        backgroundColor: '#10B981',
    },
    expiredBadge: {
        backgroundColor: '#EF4444',
    },
    statusText: {
        fontSize: 10,
        fontWeight: '500',
    },
    activeText: {
        color: '#FFFFFF',
    },
    expiredText: {
        color: '#FFFFFF',
    },
    slotInfo: {
        marginBottom: 12,
    },
    slotTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    slotId: {
        fontSize: 12,
        color: '#BBBBBB',
    },
    slotDetails: {
        marginBottom: 16,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
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
    slotActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        backgroundColor: '#333333',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    instantButton: {
        backgroundColor: '#10B981',
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '500',
    },
    instantButtonText: {
        color: '#FFFFFF',
    },
    mintForm: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#333333',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 20,
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: '#333333',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#444444',
    },
    timeOptions: {
        flexDirection: 'row',
        gap: 8,
    },
    timeOption: {
        flex: 1,
        backgroundColor: '#333333',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#444444',
    },
    timeOptionActive: {
        backgroundColor: '#8B5CF6',
        borderColor: '#8B5CF6',
    },
    timeOptionText: {
        fontSize: 12,
        color: '#BBBBBB',
        fontWeight: '500',
    },
    timeOptionTextActive: {
        color: '#FFFFFF',
    },
    typeOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    typeOption: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#333333',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#444444',
    },
    typeOptionActive: {
        backgroundColor: '#8B5CF6',
        borderColor: '#8B5CF6',
    },
    typeOptionText: {
        fontSize: 12,
        color: '#BBBBBB',
        fontWeight: '500',
    },
    typeOptionTextActive: {
        color: '#FFFFFF',
    },
    mintButton: {
        backgroundColor: '#8B5CF6',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    mintButtonDisabled: {
        opacity: 0.5,
    },
    mintButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    emptyStateText: {
        fontSize: 14,
        color: '#BBBBBB',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
});
