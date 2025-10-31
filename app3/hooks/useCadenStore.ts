import { create } from 'zustand';

interface SpreadData {
    slot: number;
    spread: number;
}

interface CadenStore {
    // Market data
    currentSlot: number;
    currentSpread: number;
    spreadHistory: SpreadData[];

    // Position data
    health: number;
    pnl: number;
    pnlPercent: number;
    isLongPosition: boolean;

    // Trading data
    leverage: number;
    tradeAmount: number;
    isTrading: boolean;

    // UI state
    isConnected: boolean;
    activeTab: 'long' | 'short';
    activeNavTab: 'spread' | 'trade' | 'pool' | 'stake';
    isUpdating: boolean;

    // Actions
    setCurrentSlot: (slot: number) => void;
    setCurrentSpread: (spread: number) => void;
    addSpreadData: (data: SpreadData) => void;
    setHealth: (health: number) => void;
    setPnl: (pnl: number, percent: number) => void;
    setLeverage: (leverage: number) => void;
    setTradeAmount: (amount: number) => void;
    setIsTrading: (trading: boolean) => void;
    setIsConnected: (connected: boolean) => void;
    setActiveTab: (tab: 'long' | 'short') => void;
    setActiveNavTab: (tab: 'spread' | 'trade' | 'pool' | 'stake') => void;
    updateSimulation: () => void;
    handleTrade: () => Promise<void>;
}

export const useCadenStore = create<CadenStore>((set: any, get: any) => ({
    // Initial state
    currentSlot: 146525520,
    currentSpread: 1.4,
    spreadHistory: Array.from({ length: 300 }, (_, i) => ({
        slot: 146525220 + i,
        spread: 1.2 + Math.random() * 0.6,
    })),
    health: 92,
    pnl: 12.40,
    pnlPercent: 4.13,
    isLongPosition: true,
    leverage: 3,
    tradeAmount: 100,
    isTrading: false,
    isConnected: true,
    activeTab: 'long',
    activeNavTab: 'spread',
    isUpdating: false,

    // Actions
    setCurrentSlot: (slot: number) => set({ currentSlot: slot }),
    setCurrentSpread: (spread: number) => set({ currentSpread: spread }),
    addSpreadData: (data: SpreadData) => set((state: any) => ({
        spreadHistory: [...state.spreadHistory.slice(1), data],
    })),
    setHealth: (health: number) => set({ health }),
    setPnl: (pnl: number, percent: number) => set({ pnl, pnlPercent: percent }),
    setLeverage: (leverage: number) => set({ leverage }),
    setTradeAmount: (amount: number) => set({ tradeAmount: amount }),
    setIsTrading: (trading: boolean) => set({ isTrading: trading }),
    setIsConnected: (connected: boolean) => set({ isConnected: connected }),
    setActiveTab: (tab: 'long' | 'short') => set({ activeTab: tab }),
    setActiveNavTab: (tab: 'spread' | 'trade' | 'pool' | 'stake') => set({ activeNavTab: tab }),

    updateSimulation: () => {
        const state = get();
        const newSlot = state.currentSlot + 1;
        const newSpread = 1.2 + Math.random() * 0.6;

        set({
            currentSlot: newSlot,
            currentSpread: parseFloat(newSpread.toFixed(2)),
            isUpdating: true,
        });

        get().addSpreadData({ slot: newSlot, spread: newSpread });

        const healthChange = (Math.random() - 0.5) * 2;
        const newHealth = Math.max(50, Math.min(100, state.health + healthChange));
        set({ health: parseFloat(newHealth.toFixed(1)) });

        const pnlChange = (Math.random() - 0.5) * 2;
        const newPnl = state.pnl + pnlChange;
        const newPnlPercent = (newPnl / state.tradeAmount) * 100;
        set({
            pnl: parseFloat(newPnl.toFixed(2)),
            pnlPercent: parseFloat(newPnlPercent.toFixed(2)),
        });

        // Reset updating flag after a short delay
        setTimeout(() => {
            set({ isUpdating: false });
        }, 150);
    },

    handleTrade: async () => {
        const state = get();
        set({ isTrading: true });

        // Simulate trading process
        await new Promise(resolve => setTimeout(resolve, 1500));

        // TODO: Implement real trading logic with Solana program
        // This would involve:
        // 1. Connect to wallet
        // 2. Create transaction
        // 3. Sign and send transaction
        // 4. Update position data

        set({ isTrading: false });
    },
}));
