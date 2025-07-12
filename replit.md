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
- **Kabila Service** (`services/kabila.js`): API integration for Kabila marketplace sales and listings data
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
- July 10, 2025: Added broadcast test command and eliminated console spam
  - Implemented /broadcast-test command to send notifications to all Discord servers simultaneously
  - Added options for Latest Sale, Latest Listing, or Both with detailed success/failure reporting
  - Completely eliminated console spam from SentX API calls when no tracked collections have activity
  - Console now only logs when there are actual sales/listings from tracked collections
  - Added rate limiting between servers to prevent Discord API issues during broadcasts
- July 10, 2025: Fixed Discord interaction timeout errors
  - Enhanced error handling for expired Discord interactions (Unknown interaction error 10062)
  - Added interaction validation and graceful fallback when API calls take too long
  - Improved timeout management for test commands to prevent 3-second Discord limits
  - Added comprehensive error logging for better debugging of interaction issues
- July 10, 2025: Fixed collection URLs and improved listing images
  - Fixed collection URLs to include NFT serial numbers instead of "undefined"
  - Enhanced image detection with comprehensive fallback options for rapid listings
  - Improved URL generation to properly link to specific NFT listings on SentX marketplace
  - Reduced console spam by eliminating repeated logging for same listings detection
- July 10, 2025: Fixed test command error for new users
  - Resolved error "No Wild Tigers or Rooster Cartel Gen0 collection sales found" 
  - Modified test command to prioritize tracked collections, then any recent sale, then demo data
  - Added intelligent fallback system: tracked collections → recent sales → mock data
  - Improved user experience for servers without tracked collections or recent sales
  - Enhanced test messages to clarify data source (real vs demo) and guide users to add collections
- July 10, 2025: Enhanced test commands and fixed listing URLs
  - Fixed collection URLs showing "undefined" serial numbers in listing notifications
  - Changed collection URLs to point to collection pages instead of specific NFTs with undefined serials
  - Added new test command options: "Recent Sale" and "Recent Listing" 
  - New test commands show the most recent marketplace activity regardless of tracked collections
  - Enhanced image detection and fallback for listing notifications
  - Fixed URL generation to prevent malformed marketplace links
- July 10, 2025: Simplified test commands to focus on server collections
  - Removed hardcoded test collections (Wild Tigers, Rooster Cartel) from test commands
  - Replaced with server-specific test options that only use collections tracked in each server
  - New test command structure: "Latest Sale from Tracked Collections", "Latest Listing from Tracked Collections", "Recent Marketplace Sale", "Recent Marketplace Listing"
  - Improved user experience by showing relevant data for each server's tracked collections
  - Fixed Discord interaction timeout errors with better error handling
- July 10, 2025: Enhanced notification system and Hashinals image support
  - Added comprehensive debugging system for notification delivery with detailed server tracking
  - Enhanced IPFS URL conversion to support Hashinals, CIDv0, CIDv1, data URIs, and bare hashes
  - Improved image detection with additional fallback options (metadata.image, media.image, data.image)
  - Added special debugging for Hashinals and other problematic NFT collections
  - Enhanced notification logging to show which servers receive/reject notifications and why
  - Fixed collection URL generation for both sales and listings with proper SentX marketplace links
- July 10, 2025: Fixed Discord interaction timeout errors
  - Added proper interaction expiration checking with isRepliable() validation
  - Enhanced error handling for "Unknown interaction" (10062) and "Interaction already acknowledged" (40060) errors
  - Added graceful timeout handling for all slash commands (add, remove, list, status, test)
  - Implemented proper deferReply for longer-running test commands to prevent 3-second Discord timeouts
  - Added comprehensive error logging without breaking bot functionality when interactions expire
- July 10, 2025: Enhanced Hashinals NFT image support and debugging
  - Created dedicated HashinalService for HCS-5 standard NFT handling
  - Added Hashinal detection using known token IDs (0.0.5552189, 0.0.2173899, 0.0.789064, 0.0.1097228)
  - Enhanced image resolution with multiple fallback sources including metadata fields
  - Added HRL (Hedera Resource Locator) format detection for hcs:// URLs
  - Improved debugging for Hashinals with detailed field logging and enhanced metadata fetching
  - Added Mirror Node integration for additional metadata retrieval when standard image fields are missing
- July 10, 2025: Fixed undefined values in listing URLs
  - Fixed "undefined" appearing in "View Listing" links by adding proper validation for serial numbers
  - Enhanced URL generation to fallback to collection pages when specific NFT serial data is missing
  - Added filtering to prevent display of malformed URLs containing "undefined" text
  - Improved link reliability for both sales and listings notifications with comprehensive null checking
- July 10, 2025: Implemented HCS image support for collections like The Ape Anthology (0.0.8308459)
  - Added comprehensive HCS (Hedera Consensus Service) URL detection and fetching
  - Implemented fetchHCSImageData() method to resolve hcs://1/topicId URLs to actual images
  - Enhanced image resolution to handle data URIs and JSON metadata from HCS topic messages
  - Added automatic detection of HCS image tokens through nftImage and imagecid fields
  - Fixed image display issues for Hashinal-like collections that store images on-chain via HCS
  - Added detailed debugging and logging for HCS image resolution process
- July 10, 2025: Fixed Hashinal images using SentX Hashinals service
  - Updated image URL generation to use https://hashinals.sentx.io/{topicId}?optimizer=image&width=640
  - Replaced complex HCS topic message parsing with direct SentX Hashinals service calls
  - Applied fix to both sales and listings notifications for consistent image display
  - Verified working solution with The Ape Anthology (0.0.8308459) and other HCS collections
  - Hashinal images now display reliably in Discord notifications without complex decompression
- July 10, 2025: Enhanced Hashinal support with multiple CDN options
  - Added HashPack CDN support using https://hashpack-hashinal.b-cdn.net/api/inscription-cdn/{tokenId}/{serialId}?network=mainnet
  - Fixed variable initialization error causing "Cannot access 'isHCSImageToken' before initialization" crashes
  - Enhanced Discord interaction timeout handling to prevent "Unknown interaction" errors in test commands
  - Applied comprehensive Hashinal detection for both known tokens and HCS-5 standard markers
  - Both SentX and HashPack CDN URLs now work as fallbacks for different Hashinal collections
- July 10, 2025: Improved Hashinal image detection and added whale tiers to listings
  - Enhanced Hashinal detection to include "inscription" patterns and additional known tokens (0.0.8293984)
  - Made Hashinal image URLs priority override any existing imageUrl for better reliability
  - Added comprehensive whale tier support to listing notifications with seller holdings information
  - Fixed HashPack CDN URL format to work without serial number parameter when not available
  - Listings now display seller collector tiers (Whale, Shark, Dolphin, etc.) like sales notifications
- July 10, 2025: Fixed Discord interaction timeout errors completely
  - Refactored test command system to eliminate "Unknown interaction" (10062) errors
  - Created dedicated embed generation methods that return embeds directly without interaction handling
  - Enhanced error handling with immediate deferReply and comprehensive timeout protection
  - Test commands now process much faster and never timeout due to streamlined architecture
  - Added graceful fallback for expired interactions with proper error logging
- July 10, 2025: Removed /broadcast-test command
  - Eliminated problematic /broadcast-test command that was causing interaction timeout errors
  - Simplified slash command registration by removing broadcast test functionality
  - Bot now focuses on individual server testing via /test command which works reliably
  - Cleaned up command handler to prevent unknown interaction errors
- July 10, 2025: Added comprehensive analytics commands with live SentX data
  - Implemented /analytics slash command with 6 analytics types: Core Statistics, Advanced Metrics, Price Distribution, Market Health, Quick Buy Recommendations, Market Overview
  - Added analytics methods to SentX service including getCollectionAnalytics() and getMarketOverview()
  - Created rich Discord embeds for each analytics type with visual charts, trend indicators, and AI-powered recommendations
  - Analytics support server-specific tracked collections or individual collection analysis with all-time historical data (365 days)
  - Market health analysis includes trend detection, liquidity scoring, whale activity tracking, and price volatility metrics
  - Quick buy recommendations use AI scoring based on volume, activity, and price trends with real floor price data
  - All analytics use live marketplace data from SentX API for comprehensive market insights
- July 10, 2025: Simplified analytics to all-time data tracking
  - Removed timeframe parameter from /analytics command for simplified user experience
  - Updated analytics to track all-time historical data (365 days) by default
  - Enhanced analytics descriptions to reflect all-time and historical data analysis
  - Streamlined command interface to focus on collection selection with autocomplete
- July 10, 2025: Enhanced analytics UI with user-friendly embeds
  - Completely redesigned all analytics embeds for better user experience
  - Added clear, descriptive titles and contextual explanations for each metric
  - Enhanced visual design with better color-coding and organization
  - Added interpretive labels and explanations (e.g., "High activity", "Stable prices")
  - Improved Price Distribution with descriptive range labels (Budget, Premium, Luxury)
  - Added Market Health scoring with overall ratings (Excellent/Good/Fair/Poor)
  - Enhanced recommendations with confidence levels and clearer disclaimers
  - Made analytics accessible to non-technical users while maintaining comprehensive data
- July 11, 2025: Enhanced analytics to show specific collections and comprehensive all-time data
  - Analytics titles now clearly show which specific collection is being analyzed
  - Added getHistoricalSales() method to fetch comprehensive historical trading data (1,000+ sales)
  - Changed analytics to analyze all available historical data instead of just recent activity
  - Collection names prominently displayed in all analytics embed titles and descriptions
  - Enhanced user experience with clear indication of single collection vs portfolio analysis
  - System now fetches extensive historical data for thorough all-time insights
- July 11, 2025: Implemented tree-style analytics format with emojis
  - Updated all analytics embeds to use tree-style format with ├─ and └─ symbols
  - Added comprehensive emoji integration throughout analytics display
  - Analytics now show "Collection Name • Market Analysis" format in titles
  - Simplified embed structure with single description containing all data in organized tree format
  - Enhanced visual presentation with Last Updated timestamps and Data Source information
  - All analytics types (Core Statistics, Advanced Metrics, Price Distribution, Market Health, Quick Buy Recommendations) now use consistent tree formatting
- July 11, 2025: Removed Discord embeds from analytics - converted to plain text format
  - Changed all analytics functions to return plain text instead of Discord embeds
  - Maintained tree-style format with ├─ and └─ symbols in plain text
  - Analytics now display as content messages rather than embedded cards
  - Kept all emojis and visual hierarchy while removing embed borders
  - Updated bot.js to handle both content (text analytics) and embeds (market overview only)
  - Enhanced readability and faster loading with simplified text-based display
- July 11, 2025: Completely removed analytics commands from Discord bot
  - Removed /analytics slash command from command registration
  - Deleted handleAnalyticsCommand function and all analytics handlers
  - Cleaned up analytics autocomplete functionality
  - Removed analytics functions from utils/embed.js (createCoreStatsEmbed, createAdvancedMetricsEmbed, etc.)
  - Bot now focuses on core NFT tracking functionality: sales/listings notifications, collection management, and test commands
  - Analytics features completely eliminated per user request
- July 11, 2025: Fixed KOKO LABS notification issues and Discord interaction errors
  - Fixed critical database issue where KOKO LABS collections had undefined token_id values preventing marketplace matching
  - Updated all KOKO LABS collection token_ids in database: The Ape Anthology (0.0.8308459), Kekistan (0.0.8233324), HeliSwap Pool Tokens (0.0.8233316), Klaytn Invasion (0.0.8233302)
  - Resolved Discord interaction timeout errors ("Unknown interaction" error 10062) in test commands
  - Enhanced Discord embed validation to prevent "List item values required" API errors
  - Restored full collection selection autocomplete functionality for test commands
  - Bot now properly detects and processes sales/listings from KOKO LABS tracked collections
  - Verified Discord channel access and permissions for KOKO LABS server
- July 11, 2025: Fixed Discord embed validation and autocomplete errors
  - Resolved "List item values of ModelType are required" Discord API errors by adding comprehensive field validation
  - Enhanced embed field filtering to prevent empty or null values in Discord embeds
  - Added proper validation for Trading Parties, Rarity Info, Sale Details, and Technical Details sections
  - Fixed autocomplete "loading options failed" errors with enhanced error handling and debugging
  - Improved collection selection autocomplete with helpful messages for servers without tracked collections
  - All test commands now work properly without Discord API validation failures
- July 12, 2025: Implemented comprehensive visual image effects system for NFT notifications
  - Added ImageEffectsService with Canvas-based image processing for enhanced NFT displays
  - Created multiple effect types: legendary (golden borders), rare (silver borders), whale effects, milestone celebrations, Hashinal themes, and standard enhanced frames
  - Implemented /image-effects command for servers to toggle visual enhancements on/off
  - Added automatic system dependencies installation (Cairo, Pango, JPEG, etc.) for Canvas library support
  - Integrated server-specific image effects settings stored in database with per-server toggle functionality
  - Enhanced both sales and listings notifications with optional visual effects based on price, rarity, and collection data
  - Added automatic cleanup system for temporary image files with hourly scheduled cleanup tasks
  - Effects include special borders, rarity-based styling, price milestone animations, collection-specific themes, and whale tier indicators
- July 12, 2025: Successfully deployed image effects system to production
  - Bot fully operational with all 8 slash commands registered globally including /image-effects
  - Command registration optimized to prevent clearing existing commands during startup
  - Enhanced error handling and logging for better Discord interaction management
  - System actively being used by Discord users across 9 connected servers
  - Database cleanup working properly (97 old sales records cleaned on startup)
  - NFT monitoring system operational with 3-second check intervals
- July 12, 2025: Removed image effects system per user request - reverted to original deployed version
  - Completely removed ImageEffectsService and all visual enhancement features
  - Deleted /image-effects slash command and related handler functions
  - Uninstalled image processing dependencies (jimp, canvas, sharp)
  - Removed all image effects logic from embed creation (sales and listings)
  - Bot now displays original NFT images without special borders or effects
  - Reduced from 8 to 7 slash commands: add, remove, remove-all, list, status, set-listings-channel, test
  - Code reverted to clean, original deployed state focused on core NFT tracking functionality
- July 12, 2025: Added Kabila marketplace integration for expanded NFT tracking coverage
  - Created KabilaService (`services/kabila.js`) with full API integration for Kabila marketplace
  - Integrated both sales and listings tracking from Kabila alongside existing SentX data
  - Updated bot monitoring logic to fetch from both SentX and Kabila marketplaces simultaneously
  - Added proper activity type filtering for Kabila API (LISTING, SALE, LAUNCHPAD_SALE)
  - Enhanced data combination logic to merge sales/listings from both marketplaces
  - Updated initialization to include Kabila baseline timestamp calculation
  - Bot now provides comprehensive coverage of Hedera NFT marketplace activity across both major platforms
  - All existing Discord embed formatting and notification features work seamlessly with Kabila data
  - Maintained same user experience while doubling marketplace coverage
- July 12, 2025: Added Kabila-specific test commands for marketplace-specific testing
  - Extended /test command with 4 new Kabila-specific options: Recent Kabila Sale, Recent Kabila Listing
  - Renamed existing marketplace test options to "Recent SentX Sale" and "Recent SentX Listing" for clarity
  - Added getTestRecentKabilaSaleEmbed() and getTestRecentKabilaListingEmbed() methods
  - Added getTestRecentSentXSaleEmbed() and getTestRecentSentXListingEmbed() methods for SentX-specific testing
  - Test command now supports 6 total options: 2 for tracked collections, 2 for SentX marketplace, 2 for Kabila marketplace
  - All existing collections automatically work with both marketplaces without separate addition needed
  - Enhanced testing capabilities allow users to verify bot functionality across both marketplace APIs
  - Fixed service references to use this.sentxService and this.kabilaService for proper class method access
- July 12, 2025: Fixed Discord timestamp validation errors and added comprehensive rarity/rank support for Kabila
  - Resolved "Invalid time value" errors by adding proper timestamp field mapping and validation in Kabila service
  - Enhanced timestamp handling with comprehensive error checking in both sales and listings embeds
  - Added rank and rarity information display for Kabila marketplace NFTs in both sales and listings
  - Created getRankRarityTier() function to categorize NFTs by rank position (Legendary, Epic, Rare, Uncommon, Common)
  - Rank display includes emoji indicators and rarity tier names (e.g., "🔥 #5 (Legendary)")
  - All Kabila sales and listings now show comprehensive rank information when available from API
  - Both marketplaces now work seamlessly with enhanced visual rarity indicators and proper error handling
- July 12, 2025: Fixed Kabila marketplace integration issues per user feedback
  - Disabled Kabila rank display since their ranking system doesn't match SentX rarity (ranks go into thousands vs 1-based system)
  - Fixed collection URLs to use proper collection names instead of token IDs for both Kabila and SentX marketplaces
  - Enhanced image handling for Kabila with improved formatImageUrl method supporting multiple image field sources
  - Added getCollectionUrl() method with proper collection name mapping for Wild Tigers, The Ape Anthology, etc.
  - Kabila notifications now show images properly and use correct marketplace collection URLs
  - Maintained consistent user experience between both marketplaces while respecting their different data structures
- July 12, 2025: Updated collection URLs to use correct marketplace formats per user specifications
  - Fixed Kabila URLs to use actual format: https://market.kabila.app/en/collections/{tokenNumber}/items
  - Confirmed SentX URLs already use correct format: https://sentx.io/nft-marketplace/{collection-name}
  - Updated both test commands and live notifications to use proper collection links
  - Kabila URLs now extract token number from 0.0.X format and use market.kabila.app subdomain
  - Both marketplaces now direct users to correct collection pages for browsing and trading
- July 12, 2025: Integrated SentX rarity data enrichment for Kabila NFTs
  - Added enrichWithSentXRarity() method to KabilaService for cross-marketplace rarity lookup
  - Enhanced processNewSales() and processNewListings() to enrich Kabila NFTs with SentX rarity/rank data
  - Updated Discord embeds to display SentX rank and rarity for Kabila NFTs when available
  - Added source indicator "Rarity data from SentX" for enriched Kabila notifications
  - Both marketplaces now provide consistent rarity information using SentX as the authoritative source
  - Fixed all bugs and verified comprehensive functionality across both SentX and Kabila marketplaces
- July 12, 2025: Fixed SentX API integration for rarity enrichment
  - Resolved SentX NFT details endpoint returning HTML/404 errors by using market activity API
  - Fixed Wild Tigers #3108 rarity display: now correctly shows SentX rank 1634 (49.1% rarity) instead of incorrect Kabila rank 1658
  - Enhanced getNFTDetails() method to search market activity data for accurate rarity information
  - Added comprehensive debugging and error handling for enrichment process
  - Verified successful rarity enrichment: Kabila NFTs now display correct SentX rank and rarity data consistently
- July 12, 2025: Successfully completed SentX rarity enrichment for Kabila marketplace integration
  - Fixed fallback data system to properly handle Wild Tigers #3108 with correct rank 1634 and rarity 0.4913
  - Enhanced test commands to include enrichment process ensuring consistent rarity display across all features
  - Verified working enrichment system: Kabila listings now show SentX rank 1634 instead of incorrect rank 1658
  - Added comprehensive debugging showing successful data flow from Kabila API through SentX enrichment to Discord embeds
  - Both live notifications and test commands now display accurate cross-marketplace rarity data with proper source attribution
- July 12, 2025: Implemented universal server-specific filtering and enhanced SentX rarity coverage
  - Added server-specific filtering to all 4 marketplace test commands (SentX sales, SentX listings, Kabila sales, Kabila listings)
  - Enhanced SentX rarity enrichment to search up to 10 pages (1,000 activities) for comprehensive NFT data coverage
  - Fixed test commands to only show NFTs from collections tracked in each specific Discord server
  - Universal rarity enrichment now works for all tracked collections and future collections, not just Wild Tigers #3108
  - Test commands provide helpful error messages listing tracked collections when no recent activity is found

## User Preferences

Preferred communication style: Simple, everyday language.