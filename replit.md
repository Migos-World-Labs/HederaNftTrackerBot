# Discord NFT Sales Bot for Hedera

## Overview

This is a Discord bot application that provides real-time NFT marketplace analytics for the Hedera blockchain ecosystem. The bot monitors NFT sales across multiple marketplaces (SentX and Kabila) and sends rich notifications to Discord servers with comprehensive sales data including pricing, buyer/seller information, and NFT metadata.

## System Architecture

### Backend Architecture
- **Node.js Application**: Built with Node.js 20 using Discord.js v14 for Discord API integration
- **Database Layer**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Cron-based Monitoring**: Uses node-cron for scheduled marketplace monitoring every 10 seconds
- **API Integration**: Axios-based HTTP client for external API calls

### Data Storage Solutions
- **PostgreSQL Database**: Primary data store using Neon Database serverless PostgreSQL
- **Drizzle ORM**: Type-safe database operations with schema migrations
- **File-based Fallback**: JSON file storage for bot state as backup/migration path
- **In-memory Caching**: Rate limiting and currency exchange rate caching

### Authentication and Authorization
- **Discord Bot Token**: Standard Discord bot authentication
- **API Key Management**: Secure storage of marketplace API keys (SentX)
- **Server-based Permissions**: Discord role-based command access

## Key Components

### Discord Bot Implementation (`bot.js`)
- Multi-server Discord bot with slash command support
- Auto-configuration of notification channels
- Rich embed generation for NFT sales notifications
- Rate limiting and error handling for Discord API compliance

### Marketplace Services
- **SentX Service** (`services/sentx.js`): API integration for SentX marketplace sales data
- **Hedera Service** (`services/hedera.js`): Integration with Hedera Mirror Node for NFT metadata
- **Currency Service** (`services/currency.js`): Real-time HBAR to USD conversion using CoinGecko/CoinMarketCap APIs

### Database Schema
- **Collections Table**: Per-server NFT collection tracking
- **Server Configs**: Discord server configuration and channel mappings
- **Bot State**: Application state persistence
- **Processed Sales**: Duplicate sale prevention tracking

### Utility Services
- **Embed Utils** (`utils/embed.js`): Discord embed formatting for NFT sales
- **Storage Utils** (`utils/storage.js`): File-based storage fallback system

## Data Flow

1. **Monitoring Loop**: Cron job runs every 10 seconds to check for new NFT sales
2. **API Fetching**: Retrieves recent sales from SentX and Kabila marketplaces
3. **Data Processing**: 
   - Filters sales to only recent transactions (last 5 minutes)
   - Prevents duplicate notifications using processed sales tracking
   - Enriches data with USD pricing and NFT metadata
4. **Notification Generation**: Creates rich Discord embeds with sale information
5. **Multi-server Distribution**: Posts notifications to all configured Discord servers
6. **State Persistence**: Updates database with processed sales and bot state

## External Dependencies

### APIs and Services
- **Discord API**: Bot interactions and message posting
- **SentX API**: NFT marketplace sales data retrieval
- **Kabila API**: Secondary marketplace monitoring
- **Hedera Mirror Node**: NFT metadata and holder information
- **CoinGecko/CoinMarketCap**: Cryptocurrency exchange rates
- **Neon Database**: Serverless PostgreSQL hosting

### NPM Dependencies
- `discord.js`: Discord bot framework
- `axios`: HTTP client for API requests
- `node-cron`: Scheduled task execution
- `drizzle-orm`: Database ORM
- `@neondatabase/serverless`: Neon database connector
- `dotenv`: Environment variable management
- `express`: Web interface (optional)
- `ws`: WebSocket support for database connections

## Deployment Strategy

### Environment Configuration
- **Replit Deployment**: Configured for Google Compute Engine deployment
- **Environment Variables**: Secure storage of API keys and database credentials
- **Auto-installation**: Automatic dependency installation on deployment
- **Health Monitoring**: Built-in error handling and graceful shutdown

### Scaling Considerations
- **Multi-server Support**: Designed to work across unlimited Discord servers
- **Rate Limiting**: Built-in delays to respect API rate limits
- **Database Connection Pooling**: Efficient database connection management
- **Caching Strategy**: API response caching to reduce external API calls

### Monitoring and Maintenance
- **Error Logging**: Comprehensive error tracking and reporting
- **Bot Statistics**: Usage metrics and performance monitoring
- **Database Migrations**: Version-controlled schema changes with Drizzle Kit
- **Graceful Shutdown**: Proper cleanup on application termination

## Changelog

- June 21, 2025: Initial setup
- June 21, 2025: Fixed image display issue for order fills
  - Modified SentX API filtering to properly capture order fills vs regular sales
  - Added fallback image retrieval from multiple sources (nftImage, imageCDN, etc.)
  - Enhanced sale type detection to distinguish between order fills and direct sales
  - Added transaction ID validation for completed sales
  - Improved debugging logging for sale type and image availability
- June 21, 2025: Enhanced Rooster Cartel image handling
  - Added special debugging for Rooster Cartel collections to identify image field variations
  - Fixed image URL prioritization to use CDN URLs first for better Discord compatibility
  - Enhanced IPFS URL conversion to handle CIDv0, CIDv1, and bare hash formats
  - Added dedicated test command "/test type:Rooster Cartel Order Fill" for debugging
  - Updated slash command registration with new test options
- June 21, 2025: Added SentX collection links to sale notifications
  - Collection names in sale embeds are now clickable links to the SentX marketplace
  - Uses collectionFriendlyurl from API when available, falls back to token ID format
  - Updated both regular sales and all test commands with collection URLs for easy marketplace navigation
- July 9, 2025: Fixed duplicate messages and improved image display
  - Enhanced sale ID generation using transaction IDs for better duplicate prevention
  - Improved image URL detection with comprehensive fallback options (imageCDN, nftImage, imageFile, image)
  - Added automatic cleanup of old processed sales (older than 3 days) on startup
  - Better logging and debugging for sale processing and image detection
  - Enhanced Rooster Cartel image debugging with detailed field logging
- July 9, 2025: Fixed order fill images not showing
  - Changed API filter from 'Sales' to 'All' to capture order fills
  - Modified filter logic to allow order fills with null transaction IDs
  - Enhanced image detection priority to use imageCDN first for order fills
  - Added comprehensive debugging for order fill image field detection
  - Order fills now properly display images with same fallback options as regular sales
- July 10, 2025: Bug fixes and performance improvements
  - Fixed database schema import path in server/db.ts
  - Corrected async/await patterns in bot initialization to prevent race conditions
  - Added JSON parsing error handling in collection migration to prevent crashes
  - Updated configuration validation to reflect multi-server architecture
  - Added duplicate collection prevention logic for better data integrity
  - Enhanced error handling for corrupted migration files
- July 10, 2025: Added NFT listings notification feature
  - Implemented getRecentListings() method in SentX service to fetch marketplace listings
  - Created createListingEmbed() function for rich Discord listing notifications
  - Added database storage methods for tracking processed listings (markListingProcessed, isListingProcessed)
  - Integrated listings monitoring into main bot monitoring loop alongside sales
  - Added processListing() method and removeDuplicateListings() for listing management
  - Split main monitoring into processNewSales() and processNewListings() methods
  - Listings show comprehensive data including price, seller info, rarity, and collection links
- July 10, 2025: Added separate channel configuration for listings vs sales
  - Extended database schema with listingsChannelId field for separate channel support
  - Added /set-listings-channel command to configure separate listing notification channels
  - Updated processListing() method to route notifications to dedicated listings channel when configured
  - Sales notifications continue in main channel while listings go to separate channel if configured
  - Enhanced database storage methods to support listings channel configuration and management
  - Provides channel permission validation and user-friendly setup instructions
- July 10, 2025: Added test listing command functionality
  - Extended /test slash command with new "Latest Listing" option
  - Implemented testLatestListing() method to fetch and display most recent marketplace listing
  - Updated slash command registration to include new test option
  - Test command now supports: Regular Sale, Order Fill, Rooster Cartel Order Fill, and Latest Listing
  - Provides comprehensive testing capabilities for both sales and listings notification systems
- July 10, 2025: Enhanced test listing command and fixed interaction errors
  - Fixed Discord interaction timing errors with proper deferReply handling
  - Enhanced test listing command to filter by server's tracked collections only
  - Added validation to ensure collections are tracked before testing listings
  - Improved error handling for Discord API interaction responses
  - Test listing now shows latest listing from tracked collections specific to the server
  - Cleaned up console output to show only essential tracking information with emojis
- July 10, 2025: Added collection selection option to test listing command
  - Extended /test command with optional "collection" parameter for specific collection testing
  - Users can now specify a token ID to test listings from a specific tracked collection
  - Added validation to ensure specified collection is tracked in the server
  - Displays helpful error messages listing all tracked collections when invalid token ID provided
  - Supports both general listing tests (all collections) and specific collection tests
- July 10, 2025: Fixed database constraint error and improved data validation
  - Fixed null token_id database constraint violations when marking sales/listings as processed
  - Added validation to skip processing items with missing essential data (token_id)
  - Enhanced error handling in database storage with proper validation checks
  - Improved Discord interaction timeout handling for test commands
  - Added fallback values for ID generation to prevent malformed sale/listing IDs
- July 10, 2025: Enhanced test listing command with comprehensive marketplace search
  - Modified getRecentListings() method with allTimeListings parameter for testing purposes
  - Test listing command now searches all available marketplace listings, not just recent 15 minutes
  - Added loading message to prevent Discord interaction timeouts during API calls
  - Improved error messaging for when no listings are found for tracked collections
  - System now fetches 75+ total listings for comprehensive testing vs limited recent data
- July 10, 2025: Added remove all collections command with confirmation system
  - Implemented /remove-all slash command for bulk collection removal
  - Added interactive confirmation system with Discord buttons for safety
  - Shows list of all tracked collections before removal with 30-second timeout
  - Includes proper error handling and user feedback for bulk operations
  - Prevents accidental data loss with clear warning messages and cancellation option
- July 10, 2025: Optimized monitoring to only track database collections
  - Modified checkForNewSales() to filter API results by tracked collections only
  - Eliminated console spam by only processing sales/listings from database collections
  - Reduced unnecessary API processing and improved performance
  - Console now only shows activity for collections actually being tracked
  - System automatically picks up new collections as they're added to database

## User Preferences

Preferred communication style: Simple, everyday language.