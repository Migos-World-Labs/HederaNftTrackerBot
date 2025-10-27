# Discord NFT Sales Bot for Hedera

## Overview
This project is a Discord bot designed to provide real-time NFT marketplace analytics for the Hedera blockchain. Its primary purpose is to monitor NFT sales and listings across multiple marketplaces (SentX and Kabila) and deliver rich, comprehensive notifications to Discord servers. The bot aims to offer users up-to-date sales data, including pricing, buyer/seller information, and NFT metadata, enhancing transparency and accessibility within the Hedera NFT ecosystem.

## Recent Updates (August 2025)
**Critical Rate Limiting Fixes (August 28, 2025)**: Resolved severe SentX API rate limiting that was causing missed Forever Mint notifications. Implemented comprehensive rate limiting solution:
- Extended monitoring intervals from 5 seconds to 15 seconds to reduce API load
- Added exponential backoff system: 60s → 120s → 240s → 300s delays when rate limited
- Built request throttling with minimum 1-second delays between API calls
- Implemented smart recovery that automatically resets delays when requests succeed
- Temporarily disabled intensive rarity enrichment to prevent API overload
- Added rate limit detection and intelligent backoff in monitoring cycles
- Confirmed catch-up functionality: bot detects missed mints within 24 hours when restarting

**Dual Discord Forever Mint Notifications (August 28, 2025)**: Successfully implemented dual Discord server notification system for Forever Mint tracking. The system now:
- Sends Forever Mint notifications to BOTH Migos World Discord and Wild Tigers Discord
- Targets Migos World (910963230317355008) and Wild Tigers (1248509900154343504) servers
- Maintains all existing functionality: golden theme, NFT images, rarity data
- Uses reliable Hashpack CDN (hashpack.b-cdn.net) for optimized NFT image display
- Continues detecting real Forever Mints using SentX launchpad API
- Prevents duplicate notifications using database tracking
- Confirmed live operation with successful notification delivery

**Complete Forever Mint Notification System (August 28, 2025)**: Successfully implemented and tested comprehensive Forever Mint tracking for Wild Tigers NFTs. The system:
- Detects real Forever Mints using SentX launchpad API (/v1/public/launchpad/activity)
- Sends beautiful Discord notifications with golden Forever Mint sticker thumbnails
- Displays NFT images, rarity information, mint costs, and minter details
- Successfully tested notification delivery to Discord channels
- Confirmed detection of actual Forever Mints (Wild Tigers #415 and #339 for 600 HBAR)

**Bored Ape Hedera Club Forever Mint Integration (September 28, 2025)**: Successfully implemented dedicated monitoring system for Bored Ape Hedera Club (token ID 0.0.9656915). The system:
- Monitors token 0.0.9656915 for new Hedera Ape mint activities
- Posts notifications to Discord server 1403386825669873744, channel 1403391275570434218
- Uses SentX launchpad API with specialized collection filtering for Bored Ape activities
- Displays mint details including cost (280-400 HBAR), serial numbers, minter addresses, and NFT images
- Successfully detecting and posting real-time notifications for "Hedera Ape" NFT mints
- Features ape-themed Discord embeds with brown styling and appropriate emojis

**Wild Tiger Raffle Ticket Monitoring (October 27, 2025)**: Successfully implemented dedicated raffle ticket tracking system for Wild Tigers Raffle (token ID 0.0.10053295). The system:
- Monitors token 0.0.10053295 for new Wild Tiger Raffle Ticket mints
- Posts live raffle ticket notifications exclusively to Migos World Discord (channel 1432509660937719839)
- Uses SentX launchpad API to detect raffle ticket mints in real-time
- Displays ticket details including serial numbers, mint costs (50 HBAR), minter addresses, and animated ticket GIFs
- Features raffle-themed Discord embeds with orange/red styling and ticket emojis
- Successfully detecting and posting raffle ticket mints with 15-second monitoring intervals
- Prevents duplicate notifications using in-memory tracking

**Enhanced HTS Token Payment Support**: Fixed critical bug in HTS payment detection and added comprehensive HTS listings test functionality. The bot now properly detects and monitors NFT sales and listings paid with HTS tokens like PAWS, SAUCE, and KARATE across all tracked collections.

**Command Security Enhancement**: Hidden `/announce` command from regular users, making it development-only via `ENABLE_DEV_COMMANDS` environment variable. Users now see only 8 essential commands while development team retains full broadcasting capabilities.

**Fixed Remove-All Timeout**: Extended `/remove-all` command timeout from 30 to 60 seconds and improved error handling to prevent interaction failures when users don't respond quickly enough.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The bot is built as a Node.js 20 application, utilizing Discord.js v14 for Discord API integration. PostgreSQL, managed with Drizzle ORM, serves as the primary data store, ensuring type-safe database operations and schema migrations. A cron-based system (`node-cron`) monitors marketplaces every 5 seconds. API interactions with external services are handled via Axios.

## Future Development Roadmap
**Multi-Mint Tracking System**: Comprehensive roadmap developed for user-configurable mint tracking across Discord servers. Key planned features:
- **User Commands**: `/mint-tracking setup/remove/list/toggle/settings` for collection management
- **Multi-Collection Support**: Extend beyond Wild Tigers to any Hedera NFT collection
- **Advanced Filtering**: Price ranges, rarity filters, and notification themes
- **Analytics Dashboard**: Real-time mint statistics and trend analysis
- **Community Features**: Mint leaderboards, milestones, and cross-server sharing
- **Implementation Timeline**: 4-phase approach over 8 weeks starting with core infrastructure

Detailed specifications available in `docs/ROADMAP.md` and `docs/MULTI_MINT_SPEC.md`.

**Key Architectural Decisions:**
- **Modular Services**: Marketplace-specific logic (SentX, Kabila), Hedera Mirror Node interactions, and currency conversions are encapsulated in dedicated services for maintainability.
- **Robust Data Handling**: Employs PostgreSQL with Drizzle ORM for reliable data persistence, supported by file-based fallback and in-memory caching for performance and resilience.
- **Scalability**: Designed to support multiple Discord servers, incorporating rate limiting, database connection pooling, and API response caching to manage load.
- **Image and Rarity Enrichment**: Includes sophisticated image URL resolution, IPFS conversion, and cross-marketplace rarity enrichment (using SentX data for Kabila NFTs) to provide comprehensive NFT details.

**Core Components:**
- **Discord Bot**: Handles slash commands, channel configuration, and rich embed generation for notifications.
- **Marketplace Services**: Integrations for SentX and Kabila APIs, fetching sales and listings data.
- **Hedera Service**: Connects to Hedera Mirror Node for NFT metadata.
- **Database Schema**: Manages NFT collection tracking, server configurations, bot state, and processed sales/listings for duplicate prevention.
- **Notification System**: Processes fetched data, enriches it, and generates Discord embeds for configured channels, handling duplicate prevention and ensuring cross-marketplace data consistency.

## External Dependencies

**APIs and Services:**
- **Discord API**: For bot interactions and sending messages.
- **SentX API**: NFT marketplace sales and listings data.
- **Kabila API**: NFT marketplace sales and listings data.
- **Hedera Mirror Node**: For NFT metadata and information.
- **CoinGecko/CoinMarketCap**: For real-time cryptocurrency exchange rates (HBAR to USD).
- **Neon Database**: Serverless PostgreSQL hosting.

**NPM Dependencies:**
- `discord.js`: Discord bot framework.
- `axios`: HTTP client for API requests.
- `node-cron`: For scheduling periodic tasks.
- `drizzle-orm`: Type-safe ORM for PostgreSQL.
- `@neondatabase/serverless`: Connector for Neon Database.
- `dotenv`: For environment variable management.