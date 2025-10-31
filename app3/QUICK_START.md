# 🚀 Quick Start Guide - Caden Mobile

## Prerequisites
- Node.js 18+
- Android Studio (for Android)
- Xcode (for iOS, macOS only)

## Setup (5 minutes)

### 1. Install Dependencies
```bash
cd app3
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Run on Device/Emulator

#### Android
```bash
npm run android
```

#### iOS (macOS only)
```bash
npm run ios
```

## Features Ready to Test

✅ **Live Spread Heatmap** - Real-time T+0 vs T+2 price spreads  
✅ **CFD Trading** - Long/Short positions with leverage  
✅ **AMM Pool** - Liquidity provision and swapping  
✅ **Governance** - Staking and fee claiming  
✅ **Mobile Wallet** - Solana Mobile Wallet Adapter  

## Solana Integration

- **Program ID**: `9KQZbyCoHybRrGwTf7dyjMfuwW29XhxCwgEKVsLVNp3W`
- **Network**: Devnet
- **Features**: Real CFD trading, AMM, governance

## Building for Production

### Android APK
```bash
npm run android:build
```

### iOS App
```bash
npm run ios
```

## Troubleshooting

### Common Issues
1. **Metro bundler issues**: Clear cache with `npx expo start --clear`
2. **Android build fails**: Ensure Android Studio and SDK are installed
3. **iOS build fails**: Ensure Xcode is installed and updated
4. **Wallet connection**: Requires physical device for Mobile Wallet Adapter

### Getting Help
- Check `README.md` for detailed documentation
- Run `npm run lint:check` to check for code issues
- Ensure all dependencies are installed with `npm install`

## Hackathon Submission

This app is ready for Solana Mobile track submission with:
- ✅ Native mobile app (not web)
- ✅ Solana Mobile SDK integration
- ✅ Real blockchain program integration
- ✅ Professional UI/UX
- ✅ All required features implemented

**Build APK**: `npm run android:build`  
**Test on device**: `npm run android`
