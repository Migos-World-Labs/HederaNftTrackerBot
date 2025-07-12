# Discord NFT Sales Bot for Hedera Blockchain

[![Discord](https://img.shields.io/badge/Discord-Bot-blue)](https://discord.com/api/oauth2/authorize?client_id=1018256324519264265&permissions=19520&scope=bot%20applications.commands)
[![Hedera](https://img.shields.io/badge/Blockchain-Hedera-green)](https://hedera.com)
[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-blue)](https://postgresql.org)

A sophisticated Discord bot that provides real-time NFT marketplace analytics for the Hedera blockchain ecosystem. Monitor sales and listings across multiple marketplaces (SentX and Kabila) with advanced rarity data enrichment and comprehensive Discord integration.

## 🌟 Key Features

- **Multi-Marketplace Monitoring**: SentX and Kabila marketplace integration
- **Real-time Notifications**: 3-second monitoring intervals for immediate alerts
- **Advanced Rarity Data**: Authoritative SentX rarity enrichment across all platforms
- **Whale Tier Classification**: Automatic collector level detection
- **Rich Discord Embeds**: Professional notifications with images and metadata
- **Server-specific Configuration**: Independent collection tracking per Discord server
- **Comprehensive Image Support**: Hashinals, IPFS, and multiple CDN sources

## 🚀 Quick Start

### 1. Invite Bot to Discord
```
https://discord.com/api/oauth2/authorize?client_id=1018256324519264265&permissions=19520&scope=bot%20applications.commands
```

### 2. Add Your First Collection
```
/add 0.0.6024491 Wild Tigers
```

### 3. Test Functionality
```
/test
```

## 📋 Commands

| Command | Description |
|---------|-------------|
| `/add` | Add NFT collection to track |
| `/remove` | Remove specific collection |
| `/remove-all` | Remove all collections (with confirmation) |
| `/list` | Show tracked collections |
| `/set-listings-channel` | Configure separate listings channel |
| `/status` | Bot status and server info |
| `/support` | Get help and join support server |
| `/test` | Test bot functionality |

## 🏗️ Technical Architecture

### Backend Stack
- **Runtime**: Node.js 20 with Discord.js v14
- **Database**: PostgreSQL with Drizzle ORM (Neon serverless)
- **Monitoring**: Node-cron for scheduled marketplace checks
- **HTTP Client**: Axios with rate limiting and error handling

### API Integration
- **SentX API**: Primary marketplace data and rarity information
- **Kabila API**: Secondary marketplace for expanded coverage
- **Hedera Mirror Node**: NFT metadata and holder information
- **CoinGecko/CoinMarketCap**: Real-time HBAR/USD exchange rates

### Data Management
- **Type-safe Operations**: Drizzle ORM with automated migrations
- **Duplicate Prevention**: Advanced sale/listing ID tracking
- **Cache Management**: Rate limiting and exchange rate caching
- **Connection Pooling**: Efficient database connection management

## 🔧 Development Setup

### Prerequisites
- Node.js 20+
- PostgreSQL database
- Discord Bot Token
- SentX API Key

### Environment Variables
```bash
DISCORD_TOKEN=your_discord_bot_token
SENTX_API_KEY=your_sentx_api_key
DATABASE_URL=your_postgresql_connection_string
```

### Installation
```bash
# Install dependencies
npm install

# Run database migrations
npm run db:push

# Start the bot
npm start
```

## 📊 Supported Marketplaces

### SentX (Primary)
- Comprehensive API integration
- Authoritative rarity data source
- Collection floor prices and analytics
- Historical sales data

### Kabila (Secondary)  
- Expanded marketplace coverage
- Activity filtering and monitoring
- Cross-enrichment with SentX rarity data
- Alternative trading venue tracking

## 🎨 Notification Features

### Sales Notifications
- **Pricing**: HBAR and USD values with live exchange rates
- **Rarity**: Rank, tier classification, and percentage rarity
- **Participants**: Buyer/seller addresses with whale tier indicators
- **Metadata**: NFT images, collection links, marketplace URLs
- **Analytics**: Previous purchase prices and profit/loss calculations

### Listing Notifications
- **Listing Details**: Price, seller information, listing timestamp
- **Rarity Data**: SentX rank and rarity tier classification
- **Seller Insights**: Collection holdings and whale tier status
- **Direct Links**: View listing and collection marketplace URLs

## 🖼️ Advanced Image Support

### Hashinals Integration
- **HCS-5 Standard**: Native support for on-chain stored NFTs
- **Multiple CDNs**: SentX Hashinals service and HashPack CDN
- **Topic Resolution**: Direct HCS topic message parsing
- **Fallback Sources**: Comprehensive image URL resolution

### IPFS Support
- **CIDv0/CIDv1**: Full Content Identifier support
- **Gateway Fallbacks**: Multiple IPFS gateway options
- **Data URI**: Direct data embedding support
- **Metadata Parsing**: JSON metadata image extraction

## 📈 Performance & Reliability

### Scalability
- **Multi-server Support**: Unlimited Discord servers
- **Independent Configuration**: Per-server collection tracking
- **Rate Limiting**: Respects Discord and marketplace API limits
- **Connection Pooling**: Efficient database resource management

### Error Handling
- **Graceful Degradation**: Continues operation during API failures
- **Comprehensive Logging**: Detailed error tracking and debugging
- **Health Monitoring**: Automatic API health checks
- **Recovery Mechanisms**: Automatic retry logic and fallbacks

### Data Integrity
- **Validation Systems**: Strict data validation before display
- **Duplicate Prevention**: Advanced ID generation and tracking
- **Cleanup Automation**: Automatic removal of old processed records
- **Source Attribution**: Clear indication of data sources and enrichment

## 🌍 Supported Collections

The bot works with any Hedera NFT collection, with optimized support for:

- **Wild Tigers** (`0.0.6024491`)
- **The Ape Anthology** (`0.0.8308459`) - KOKO LABS
- **Hashinals** (`0.0.5552189`)
- **Hedera Monkeys** (`0.0.2173899`)
- **Rooster Cartel** (multiple collections)
- **Kekistan** (`0.0.8233324`)
- **HeliSwap Pool Tokens** (`0.0.8233316`)

## 📝 Documentation

- **[Quick Start Guide](quick-start.md)** - Get up and running in minutes
- **[User Guide](user-guide.md)** - Comprehensive usage instructions
- **[Setup Guide](setup-guide.md)** - Detailed installation and configuration
- **[Guía Rápida](guia-rapida.md)** - Spanish quick start guide

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **[Bot Invite Link](https://discord.com/api/oauth2/authorize?client_id=1018256324519264265&permissions=19520&scope=bot%20applications.commands)**
- **[SentX Marketplace](https://sentx.io)**
- **[Kabila Marketplace](https://market.kabila.app)**
- **[Hedera Network](https://hedera.com)**

---

*Built with ❤️ for the Hedera NFT community*