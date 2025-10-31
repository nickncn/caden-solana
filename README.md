# Caden - Settlement Slot Trading on Solana

Caden tokenizes settlement timing as NFTs, enabling instant T+0 settlement across multiple asset classes on Solana.

## Core Features

**Settlement Slot NFTs**
Mint and trade T+0, T+1, or T+2 settlement slots as NFTs. Own a T+0 slot to settle trades instantly instead of waiting 2 days.

**Multi-Asset Trading**
Trade 5 asset classes:
- Stocks (AAPL, TSLA, GOOGL)
- Crypto (BTC, ETH, SOL)
- Bonds (US10Y, TLT)
- Commodities (GOLD, OIL, WHEAT)
- Forex (EUR/USD, GBP/USD)

**Instant Settlement**
T+0 NFT holders can settle trades immediately. No T+2 waiting period.

## Program Information

**Deployed Program ID (Devnet)**
```
3ZstoPk7ho2fAyotF3NTKFjJESr21qAjNXQuVaGSpQ5L
```

## Setup

**Prerequisites**
- Node.js 18+
- Rust 1.70+
- Anchor framework
- Solana CLI tools

**Build Program**
```bash
anchor build
```

**Deploy to Devnet**
```bash
anchor deploy --provider.cluster devnet
```

**Run Mobile App**
```bash
cd app3
npm install
npm start
```

## Architecture

- **Solana Program**: `/programs/seam/src/lib.rs` - Anchor program handling settlement slots, CFD trading, and multi-asset markets
- **Mobile App**: `/app3` - React Native/Expo app for iOS and Android
- **Oracle**: Pyth Network integration for real-time price feeds

## Key Instructions

**Initialize Market**
```bash
node scripts/initMarket.js
```

**Test Core Features**
```bash
node test-complete-caden.js
```

## Tech Stack

- Solana + Anchor (smart contracts)
- React Native + Expo (mobile)
- Pyth Network (price feeds)
- TypeScript (frontend)

## License

MIT