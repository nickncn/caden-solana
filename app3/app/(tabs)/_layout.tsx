import { Tabs } from 'expo-router';
import { WalletButton } from '@/components/WalletButton';
import { View, StyleSheet, Platform, Image, Text } from 'react-native';
import { colors } from '@/constants/colors';

// Create simple icon components for web compatibility
const TrendingUp = ({ size, color }: { size: number; color: string }) => (
    <View style={{ width: size, height: size, backgroundColor: color, borderRadius: 2 }} />
);

const ArrowLeftRight = ({ size, color }: { size: number; color: string }) => (
    <View style={{ width: size, height: size, backgroundColor: color, borderRadius: 2 }} />
);

const Coins = ({ size, color }: { size: number; color: string }) => (
    <View style={{ width: size, height: size, backgroundColor: color, borderRadius: size / 2 }} />
);

const Lock = ({ size, color }: { size: number; color: string }) => (
    <View style={{ width: size, height: size, backgroundColor: color, borderRadius: 2 }} />
);

const Layers = ({ size, color }: { size: number; color: string }) => (
    <View style={{ width: size, height: size, backgroundColor: color, borderRadius: size / 4 }} />
);

// Custom header component with logo
const HeaderTitle = () => (
    <View style={styles.headerTitleContainer}>
        <Image
            source={require('@/assets/caden.png')}
            style={styles.logo}
            resizeMode="contain"
        />
        <Text style={styles.headerTitle}>Caden</Text>
    </View>
);

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: '#8B5CF6',
                tabBarInactiveTintColor: '#BBBBBB',
                tabBarStyle: {
                    backgroundColor: '#1A0A2E', // Solid purple matching gradientBackground[1]
                    borderTopColor: 'rgba(139, 92, 246, 0.3)',
                    borderTopWidth: 0.5,
                    height: 60,
                    paddingTop: 8,
                    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    ...(Platform.OS === 'web' && {
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        boxShadow: '0 -4px 24px 0 rgba(139, 92, 246, 0.15)',
                    }),
                    ...(Platform.OS !== 'web' && {
                        shadowColor: '#8B5CF6',
                        shadowOffset: { width: 0, height: -2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        elevation: 3,
                    }),
                },
                headerStyle: {
                    backgroundColor: '#1A0A2E', // Solid purple matching gradientBackground[1]
                    borderBottomColor: 'rgba(139, 92, 246, 0.3)',
                    borderBottomWidth: 0.5,
                    ...(Platform.OS === 'web' && {
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        boxShadow: '0 4px 24px 0 rgba(139, 92, 246, 0.15)',
                    }),
                    ...(Platform.OS !== 'web' && {
                        shadowColor: '#8B5CF6',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        elevation: 3,
                    }),
                },
                headerTintColor: '#FFFFFF',
                headerTitleStyle: {
                    fontWeight: '600',
                },
                headerRight: () => (
                    <View style={styles.headerRight}>
                        <WalletButton />
                    </View>
                ),
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    headerTitle: () => <HeaderTitle />,
                    tabBarLabel: 'Dashboard',
                    tabBarIcon: ({ color, size }) => <TrendingUp size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="trade"
                options={{
                    headerTitle: () => <HeaderTitle />,
                    tabBarLabel: 'Trade',
                    tabBarIcon: ({ color, size }) => <ArrowLeftRight size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="spread"
                options={{
                    headerTitle: () => <HeaderTitle />,
                    tabBarLabel: 'Mint Slots',
                    tabBarIcon: ({ color, size }) => <Coins size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="settlement-slots"
                options={{
                    headerTitle: () => <HeaderTitle />,
                    tabBarLabel: 'Portfolio',
                    tabBarIcon: ({ color, size }) => <Layers size={size} color={color} />,
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    headerRight: {
        marginRight: 16,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    logo: {
        width: 60,
        height: 60,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});