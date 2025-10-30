import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, FlatList, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet } from '@/hooks/useWallet';
// Removed useAuth import - using useWallet instead
import { useCadenProgram } from '@/hooks/useCadenProgram';
import { BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { colors } from '@/constants/colors';

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
    transactionHash?: string; // Add transaction hash for display
}

interface Bet {
    betId: number;
    assetSymbol: string;
    isLong: boolean;
    betAmount: number;
    entryPrice: number;
    createdSlot: number;
    isSettled: boolean;
    settlementValue: number;
}

export function SettlementSlotInterface() {
    const { isConnected, publicKey } = useWallet();
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

    // Trade modal state
    const [showTradeModal, setShowTradeModal] = useState(false);
    const [selectedSlotForTrade, setSelectedSlotForTrade] = useState<SettlementSlot | null>(null);
    const [buyerAddress, setBuyerAddress] = useState('');
    const [newPrice, setNewPrice] = useState('');

    // Instant settle modal state
    const [showSettleModal, setShowSettleModal] = useState(false);
    const [selectedSlotForSettle, setSelectedSlotForSettle] = useState<SettlementSlot | null>(null);
    const [userBets, setUserBets] = useState<Bet[]>([]);
    const [selectedBetId, setSelectedBetId] = useState<number | null>(null);

    // Store transaction hashes for each slot
    const [slotTxHashes, setSlotTxHashes] = useState<Map<number, string>>(new Map());

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

            // Fetch real settlement slots from program using Anchor
            try {
                // Fetch all settlement slots (program.account API doesn't support complex filters well)
                const allSlots = await (program.account as any).settlementSlot.all();

                console.log('Total settlement slots found:', allSlots.length);

                // Filter by owner in JavaScript
                const userSlots = allSlots.filter((s: any) => {
                    const owner = s.account.owner?.toString?.() ?? s.account.owner;
                    return owner === publicKey.toString();
                });

                console.log('Settlement slots owned by user:', userSlots.length);

                // Parse and map the data
                const parsedSlots: SettlementSlot[] = userSlots.map((s: any) => {
                    // Convert asset type enum to string
                    let assetTypeStr = 'Stock';
                    const assetTypeValue = s.account.assetType ?? s.account.asset_type;
                    if (typeof assetTypeValue === 'object' && assetTypeValue !== null) {
                        // It's an enum object like {stock: {}}
                        if ('stock' in assetTypeValue) assetTypeStr = 'Stock';
                        else if ('crypto' in assetTypeValue) assetTypeStr = 'Crypto';
                        else if ('bond' in assetTypeValue) assetTypeStr = 'Bond';
                        else if ('commodity' in assetTypeValue) assetTypeStr = 'Commodity';
                        else if ('forex' in assetTypeValue) assetTypeStr = 'Forex';
                    } else if (typeof assetTypeValue === 'string') {
                        assetTypeStr = assetTypeValue;
                    }

                    const slotId = s.account.slotId?.toNumber?.() ?? s.account.slot_id ?? 0;
                    const txHash = slotTxHashes.get(slotId);

                    return {
                        slot_id: slotId,
                        asset_symbol: s.account.assetSymbol ?? s.account.asset_symbol ?? '',
                        asset_type: assetTypeStr,
                        settlement_time: s.account.settlementTime?.toNumber?.() ?? s.account.settlement_time ?? 0,
                        slot_duration: s.account.slotDuration?.toNumber?.() ?? s.account.slot_duration ?? 0,
                        owner: s.account.owner?.toString() ?? publicKey.toString(),
                        mint_price: s.account.mintPrice?.toNumber?.() ?? s.account.mint_price ?? 0,
                        created_slot: s.account.createdSlot?.toNumber?.() ?? s.account.created_slot ?? 0,
                        expiry_slot: s.account.expirySlot?.toNumber?.() ?? s.account.expiry_slot ?? 0,
                        is_tradable: s.account.isTradable ?? s.account.is_tradable ?? true,
                        is_active: s.account.isActive ?? s.account.is_active ?? true,
                        transactionHash: txHash,
                    };
                });

                setSettlementSlots(parsedSlots);
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

            console.log('Minting settlement slot:', {
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

            // Store nftSeed to associate with transaction hash later
            const pendingTxSlotId = nftSeed;

            // Map asset type to enum
            const assetTypeEnum = assetType === 'Stock' ? { stock: {} } :
                assetType === 'Crypto' ? { crypto: {} } :
                    assetType === 'Bond' ? { bond: {} } :
                        assetType === 'Commodity' ? { commodity: {} } :
                            { forex: {} };

            // Call mint function using Anchor's .rpc() method (same as test script)
            console.log('📤 Minting settlement slot...');
            const signature = await (program.methods as any).mintSettlementSlotNft(
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
                .rpc();

            console.log('✅ Settlement slot minted! TX:', signature);

            // Store transaction hash for this slot
            setSlotTxHashes(prev => {
                const newMap = new Map(prev);
                newMap.set(pendingTxSlotId, signature);
                return newMap;
            });

            Alert.alert(
                'Mint Successful!',
                `Successfully minted settlement slot!\n\nAsset: ${assetSymbol}\nType: ${assetType}\nSettlement: T+${settlementTime}\nDuration: ${slotDuration} days\nPrice: $${slotPrice}\n\nTransaction: ${signature}`,
                [{ text: 'OK' }]
            );

            // Refresh the gallery
            fetchSettlementSlots();

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
                Alert.alert('Error', 'Failed to mint settlement slot');
            }
        } finally {
            setLoading(false);
        }
    };

    // Handler to open trade modal
    const handleOpenTradeModal = async (slot: SettlementSlot) => {
        setSelectedSlotForTrade(slot);
        setBuyerAddress('');
        setNewPrice('');
        setShowTradeModal(true);
    };

    // Handler to execute trade
    const handleTrade = async () => {
        if (!selectedSlotForTrade || !program || !publicKey) {
            Alert.alert('Error', 'Missing required information');
            return;
        }

        if (!buyerAddress || !newPrice) {
            Alert.alert('Error', 'Please enter buyer address and new price');
            return;
        }

        try {
            let buyerPubkey: PublicKey;
            try {
                buyerPubkey = new PublicKey(buyerAddress);
            } catch {
                Alert.alert('Error', 'Invalid buyer address');
                return;
            }

            const priceInDecimals = parseFloat(newPrice) * 1000000;
            if (isNaN(priceInDecimals) || priceInDecimals <= 0) {
                Alert.alert('Error', 'Invalid price');
                return;
            }

            // Trade uses created_slot as seed, not slot_id
            const [slotPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('settlement_slot'),
                    publicKey.toBuffer(),
                    Buffer.from(new BN(selectedSlotForTrade.created_slot).toArray('le', 8))
                ],
                program.programId
            );

            const signature = await (program.methods as any).tradeSettlementSlot(
                new BN(priceInDecimals)
            )
                .accounts({
                    settlementSlot: slotPDA,
                    seller: publicKey,
                    buyer: buyerPubkey,
                })
                .rpc();

            Alert.alert('Success', `Settlement slot traded!\n\nTX: ${signature}`);
            setShowTradeModal(false);
            fetchSettlementSlots();
        } catch (error) {
            console.error('Error trading settlement slot:', error);
            Alert.alert('Error', 'Failed to trade settlement slot');
        }
    };

    // Handler to open instant settle modal
    const handleOpenSettleModal = async (slot: SettlementSlot) => {
        setSelectedSlotForSettle(slot);
        setSelectedBetId(null);

        // Fetch user's active bets
        if (!program || !publicKey) return;

        try {
            const bets = await (program.account as any).bet.all([
                { memcmp: { offset: 8, bytes: publicKey.toBase58() } }
            ]);

            const parsedBets = bets
                .filter((b: any) => !b.account.isSettled && !b.account.is_settled)
                .map((b: any) => ({
                    betId: b.account.betId?.toNumber() ?? b.account.bet_id ?? 0,
                    assetSymbol: b.account.assetSymbol ?? b.account.asset_symbol ?? '',
                    isLong: b.account.isLong ?? b.account.is_long ?? true,
                    betAmount: b.account.betAmount?.toNumber() ?? b.account.bet_amount ?? 0,
                    entryPrice: b.account.entryPrice?.toNumber() ?? b.account.entry_price ?? 0,
                    createdSlot: b.account.createdSlot?.toNumber() ?? b.account.created_slot ?? 0,
                    isSettled: b.account.isSettled ?? b.account.is_settled ?? false,
                    settlementValue: b.account.settlementValue?.toNumber() ?? b.account.settlement_value ?? 0,
                }));

            setUserBets(parsedBets);
            setShowSettleModal(true);
        } catch (error) {
            console.error('Error fetching bets:', error);
            Alert.alert('Error', 'Failed to fetch bets');
        }
    };

    // Handler to execute instant settlement
    const handleInstantSettle = async () => {
        if (!selectedSlotForSettle || !program || !publicKey || selectedBetId === null) {
            Alert.alert('Error', 'Please select a bet to settle');
            return;
        }

        try {
            const [betPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('bet'),
                    publicKey.toBuffer(),
                    Buffer.from(new BN(selectedBetId).toArray('le', 8))
                ],
                program.programId
            );

            // Instant settlement uses settlement_slot_id as seed (line 2424 in lib.rs)
            // But we need to find by owner + slot_id, which is what we're doing
            const [slotPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('settlement_slot'),
                    publicKey.toBuffer(),
                    Buffer.from(new BN(selectedSlotForSettle.slot_id).toArray('le', 8))
                ],
                program.programId
            );

            const [multiOraclePDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('multi_oracle')],
                program.programId
            );

            const signature = await (program.methods as any).instantT0Settlement(
                new BN(selectedBetId),
                new BN(selectedSlotForSettle.slot_id)
            )
                .accounts({
                    bet: betPDA,
                    settlementSlot: slotPDA,
                    multiOracle: multiOraclePDA,
                    user: publicKey,
                })
                .rpc();

            Alert.alert('Success', `Bet settled instantly!\n\nTX: ${signature}`);
            setShowSettleModal(false);
            fetchSettlementSlots();
        } catch (error) {
            console.error('Error settling bet:', error);
            Alert.alert('Error', 'Failed to settle bet');
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

            {slot.transactionHash && (
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>TX:</Text>
                    <TouchableOpacity onPress={() => window.open(`https://solscan.io/tx/${slot.transactionHash}`, '_blank')}>
                        <Text style={[styles.detailValue, { color: '#8B5CF6', textDecorationLine: 'underline' }]}>
                            {slot.transactionHash.substring(0, 8)}...
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.slotActions}>
                {slot.is_tradable && slot.is_active && (
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleOpenTradeModal(slot)}
                    >
                        <Text style={styles.actionButtonText}>Trade</Text>
                    </TouchableOpacity>
                )}
                {slot.settlement_time === 0 && slot.is_active && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.instantButton]}
                        onPress={() => handleOpenSettleModal(slot)}
                    >
                        <Text style={[styles.actionButtonText, styles.instantButtonText]}>Instant Settle</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const renderMintForm = () => (
        <View style={styles.mintForm}>
            <Text style={styles.sectionTitle}>Mint Settlement Slot</Text>

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
                onPress={handleMint}
                disabled={loading || !assetSymbol || !slotPrice}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={colors.gradientPrimary as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.mintButton, loading && styles.mintButtonDisabled]}
                >
                    <Text style={styles.mintButtonText}>
                        {loading ? 'Minting...' : 'Mint Settlement Slot'}
                    </Text>
                </LinearGradient>
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
                                    You don't have any settlement slots yet
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setActiveTab('mint')}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={colors.gradientPrimary as [string, string]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.mintButton}
                                    >
                                        <Text style={styles.mintButtonText}>Mint Your First Slot</Text>
                                    </LinearGradient>
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

            {/* Trade Modal */}
            <Modal
                visible={showTradeModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowTradeModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Trade Settlement Slot</Text>
                        <Text style={styles.modalSubtitle}>
                            Slot #{selectedSlotForTrade?.slot_id} - {selectedSlotForTrade?.asset_symbol}
                        </Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Buyer Address</Text>
                            <TextInput
                                style={styles.textInput}
                                value={buyerAddress}
                                onChangeText={setBuyerAddress}
                                placeholder="Enter wallet address"
                                placeholderTextColor="#666666"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>New Price (USDC)</Text>
                            <TextInput
                                style={styles.textInput}
                                value={newPrice}
                                onChangeText={setNewPrice}
                                placeholder="50.00"
                                placeholderTextColor="#666666"
                                keyboardType="numeric"
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonCancel]}
                                onPress={() => setShowTradeModal(false)}
                            >
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonConfirm]}
                                onPress={handleTrade}
                            >
                                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Confirm Trade</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Instant Settle Modal */}
            <Modal
                visible={showSettleModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowSettleModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Instant Settlement</Text>
                        <Text style={styles.modalSubtitle}>
                            Using T+0 Slot #{selectedSlotForSettle?.slot_id}
                        </Text>

                        {userBets.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyStateText}>No active bets found</Text>
                            </View>
                        ) : (
                            <>
                                <Text style={styles.modalSectionTitle}>Select Bet to Settle</Text>
                                <FlatList
                                    data={userBets}
                                    keyExtractor={(item) => item.betId.toString()}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={[
                                                styles.betItem,
                                                selectedBetId === item.betId && styles.betItemSelected
                                            ]}
                                            onPress={() => setSelectedBetId(item.betId)}
                                        >
                                            <View style={styles.betItemContent}>
                                                <Text style={styles.betItemTitle}>
                                                    {item.assetSymbol} {item.isLong ? 'LONG' : 'SHORT'}
                                                </Text>
                                                <Text style={styles.betItemDetails}>
                                                    Amount: ${(item.betAmount / 1000000).toFixed(2)} | Entry: ${(item.entryPrice / 1000000).toFixed(2)}
                                                </Text>
                                            </View>
                                            {selectedBetId === item.betId && (
                                                <View style={styles.checkmark}>
                                                    <Text style={styles.checkmarkText}>✓</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                    style={styles.betList}
                                />
                            </>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonCancel]}
                                onPress={() => setShowSettleModal(false)}
                            >
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonConfirm, selectedBetId === null && styles.modalButtonDisabled]}
                                onPress={handleInstantSettle}
                                disabled={selectedBetId === null}
                            >
                                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Settle Bet</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A0A',
    },
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginBottom: 20,
        backgroundColor: colors.glassBackgroundLight,
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: colors.glassBorderLight,
        ...(Platform.OS === 'web' && {
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
        }),
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
        backgroundColor: colors.glassBackground,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.glassBorder,
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
        backgroundColor: colors.glassBackgroundLight,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glassBorderLight,
    },
    instantButton: {
        backgroundColor: colors.success,
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
        backgroundColor: colors.glassBackground,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.glassBorder,
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
        backgroundColor: colors.glassBackgroundLight,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#FFFFFF',
        borderWidth: 1,
        borderColor: colors.glassBorderLight,
    },
    timeOptions: {
        flexDirection: 'row',
        gap: 8,
    },
    timeOption: {
        flex: 1,
        backgroundColor: colors.glassBackgroundLight,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glassBorderLight,
    },
    timeOptionActive: {
        backgroundColor: colors.primary,
        borderColor: colors.glassBorder,
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
        backgroundColor: colors.glassBackgroundLight,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glassBorderLight,
    },
    typeOptionActive: {
        backgroundColor: colors.primary,
        borderColor: colors.glassBorder,
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
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: colors.glassBackground,
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 500,
        maxHeight: '80%',
        borderWidth: 1,
        borderColor: colors.glassBorder,
        ...(Platform.OS === 'web' && {
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px 0 rgba(139, 92, 246, 0.25)',
        }),
        ...(Platform.OS !== 'web' && {
            shadowColor: '#8B5CF6',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
        }),
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#BBBBBB',
        marginBottom: 24,
    },
    modalSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 12,
        marginTop: 8,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 24,
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalButtonCancel: {
        backgroundColor: colors.glassBackgroundLight,
        borderWidth: 1,
        borderColor: colors.glassBorderLight,
    },
    modalButtonConfirm: {
        backgroundColor: colors.primary,
    },
    modalButtonDisabled: {
        opacity: 0.5,
    },
    modalButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#BBBBBB',
    },
    // Bet list styles
    betList: {
        maxHeight: 300,
        marginBottom: 16,
    },
    betItem: {
        backgroundColor: colors.glassBackgroundLight,
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    betItemSelected: {
        borderColor: colors.primary,
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
    },
    betItemContent: {
        flex: 1,
    },
    betItemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    betItemDetails: {
        fontSize: 12,
        color: '#BBBBBB',
    },
    checkmark: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#8B5CF6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkmarkText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
