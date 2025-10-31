# Caden Mobile - Solana CFD Trading App

A native mobile application for CFD trading on Solana, built with React Native and Expo.

## Features

- **Live Spread Heatmap**: Real-time T+0 vs T+2 price spreads
- **CFD Trading**: Long/Short positions with leverage
- **AMM Pool**: Liquidity provision and swapping
- **Governance**: Staking and fee claiming
- **Mobile Wallet Integration**: Solana Mobile Wallet Adapter

## Tech Stack

- **Framework**: React Native with Expo
- **Navigation**: Expo Router
- **State Management**: Zustand
- **Blockchain**: Solana Web3.js + Mobile Wallet Adapter
- **Styling**: React Native StyleSheet with custom design tokens

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI
- Android Studio (for Android development)
- Xcode (for iOS development)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Run on Android:
```bash
npm run android
```

4. Run on iOS:
```bash
npm run ios
```

## Project Structure

```
app3/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Spread heatmap
│   │   ├── trade.tsx      # Trading interface
│   │   ├── amm.tsx        # AMM pool
│   │   └── governance.tsx # Staking & governance
├── components/            # React Native components
│   ├── SpreadHeatmap.tsx
│   ├── TradingInterface.tsx
│   ├── AmmInterface.tsx
│   ├── GovernanceInterface.tsx
│   ├── MarketCard.tsx
│   ├── PositionCard.tsx
│   └── providers/         # Context providers
├── constants/             # Design tokens & colors
├── hooks/                 # Custom hooks
├── idl/                   # Solana program IDL
└── utils/                 # Utility functions
```

## Design System

The app uses a dark theme with purple/teal accents:

- **Primary**: Purple (#8B5CF6)
- **Secondary**: Teal (#14B8A6)
- **Background**: Deep dark (#0A0A0A)
- **Surface**: Dark gray (#1A1A1A)
- **Text**: White (#FFFFFF)

## Solana Integration

- **Program ID**: `9KQZbyCoHybRrGwTf7dyjMfuwW29XhxCwgEKVsLVNp3W`
- **Network**: Devnet
- **Wallet**: Mobile Wallet Adapter
- **Features**: CFD trading, AMM, governance

## Building for Production

### Android APK

```bash
npm run android:build
```

### iOS App

```bash
npm run ios
```

## Development

### Code Style

- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting

### Testing

```bash
npm run lint:check
npm run fmt:check
```

## Known Issues

- Chart library temporarily disabled (react-native-chart-kit needs proper installation)
- Some TypeScript errors may appear until dependencies are fully installed
- Mobile Wallet Adapter requires physical device for testing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License - see LICENSE file for details.