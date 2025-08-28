# Discord NFT Sales Bot for Hedera

## Overview
This project is a Discord bot designed to provide real-time NFT marketplace analytics for the Hedera blockchain. Its primary purpose is to monitor NFT sales and listings across multiple marketplaces (SentX and Kabila) and deliver rich, comprehensive notifications to Discord servers. The bot aims to offer users up-to-date sales data, including pricing, buyer/seller information, and NFT metadata, enhancing transparency and accessibility within the Hedera NFT ecosystem.

## Recent Updates (August 2025)
**Forever Mint Tracking for Wild Tigers**: Implemented comprehensive Forever Mint monitoring specifically for Wild Tigers NFTs on SentX marketplace. The bot now automatically detects new Wild Tigers mints, displays rich embed notifications with NFT images, rarity information, minter account details, and mint costs. Added dedicated database table for tracking processed mints to prevent duplicates.

**Enhanced HTS Token Payment Support**: Fixed critical bug in HTS payment detection and added comprehensive HTS listings test functionality. The bot now properly detects and monitors NFT sales and listings paid with HTS tokens like PAWS, SAUCE, and KARATE across all tracked collections.

**Command Security Enhancement**: Hidden `/announce` command from regular users, making it development-only via `ENABLE_DEV_COMMANDS` environment variable. Users now see only 8 essential commands while development team retains full broadcasting capabilities.

**Fixed Remove-All Timeout**: Extended `/remove-all` command timeout from 30 to 60 seconds and improved error handling to prevent interaction failures when users don't respond quickly enough.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The bot is built as a Node.js 20 application, utilizing Discord.js v14 for Discord API integration. PostgreSQL, managed with Drizzle ORM, serves as the primary data store, ensuring type-safe database operations and schema migrations. A cron-based system (`node-cron`) monitors marketplaces every 5 seconds. API interactions with external services are handled via Axios.

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