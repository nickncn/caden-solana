import { Tabs } from 'expo-router';
import { WalletButton } from '@/components/WalletButton';
import { View, StyleSheet, Platform } from 'react-native';
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

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: '#8B5CF6',
                tabBarInactiveTintColor: '#BBBBBB',
                tabBarStyle: {
                    backgroundColor: 'transparent', // Fully transparent for seamless glass
                    borderTopColor: colors.glassBorder,
                    borderTopWidth: 1,
                    height: 60,
                    ...(Platform.OS === 'web' && {
                        backdropFilter: 'blur(30px)',
                        WebkitBackdropFilter: 'blur(30px)',
                        background: 'rgba(15, 10, 46, 0.3)',
                    }),
                    ...(Platform.OS !== 'web' && {
                        backgroundColor: colors.glassBackground, // Use colored bg on mobile
                        shadowColor: '#8B5CF6',
                        shadowOffset: { width: 0, height: -2 },
                        shadowOpacity: 0.15,
                        shadowRadius: 8,
                        elevation: 3,
                    }),
                },
                headerStyle: {
                    backgroundColor: 'transparent', // Fully transparent for seamless glass
                    borderBottomColor: colors.glassBorder,
                    borderBottomWidth: 1,
                    ...(Platform.OS === 'web' && {
                        backdropFilter: 'blur(30px)',
                        WebkitBackdropFilter: 'blur(30px)',
                        background: 'rgba(15, 10, 46, 0.3)',
                    }),
                    ...(Platform.OS !== 'web' && {
                        backgroundColor: colors.glassBackground, // Use colored bg on mobile
                        shadowColor: '#8B5CF6',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.15,
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
                    headerTitle: 'Caden',
                    tabBarLabel: 'Dashboard',
                    tabBarIcon: ({ color, size }) => <TrendingUp size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="trade"
                options={{
                    headerTitle: 'Caden',
                    tabBarLabel: 'Trade',
                    tabBarIcon: ({ color, size }) => <ArrowLeftRight size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="spread"
                options={{
                    headerTitle: 'Caden',
                    tabBarLabel: 'Mint Slots',
                    tabBarIcon: ({ color, size }) => <Coins size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="settlement-slots"
                options={{
                    headerTitle: 'Caden',
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
});