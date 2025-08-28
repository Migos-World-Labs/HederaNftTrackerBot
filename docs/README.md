# Discord NFT Bot Documentation

## Overview
This Discord bot provides real-time NFT marketplace analytics and mint tracking for the Hedera blockchain, with specialized support for Forever Mint notifications and future multi-collection tracking capabilities.

## Current Features (August 2025)

### ✅ Dual Forever Mint Notifications
- **Active Collections**: Wild Tigers (0.0.6024491)
- **Target Servers**: Migos World Discord + Wild Tigers Discord
- **Notification Style**: Rich golden-themed embeds with NFT images and rarity data
- **Detection Source**: SentX launchpad API with real-time monitoring
- **Image Optimization**: Hashpack CDN for fast Discord image loading

### ✅ NFT Sales & Listings Tracking
- **Marketplaces**: SentX and Kabila integration
- **Payment Support**: HBAR and HTS tokens (PAWS, SAUCE, KARATE)
- **Collections**: The Ape Anthology, Bored Ape Hedera Club, and more
- **Features**: Rich embeds, rarity data, cross-marketplace analytics

### ✅ Discord Commands
- `/add-server` - Configure server for notifications
- `/remove-server` - Remove server configuration
- `/collections` - View tracked collections
- `/announce` - Admin broadcasting (dev-only)
- And more user-friendly commands for server management

## Future Development

### 🚧 Multi-Mint Tracking System (Planned)
A comprehensive user-configurable mint tracking system allowing Discord server administrators to set up custom mint notifications for any Hedera NFT collection.

#### Key Features (Planned)
- **User Commands**: `/mint-tracking setup/remove/list/toggle/settings`
- **Multi-Collection Support**: Track any Hedera NFT collection beyond Wild Tigers
- **Advanced Filtering**: Price ranges, rarity filters, notification themes
- **Customizable Themes**: Minimal, Standard, Rich notification styles
- **Analytics**: Real-time mint statistics and trend analysis
- **Community Features**: Mint leaderboards, milestones, cross-server sharing

#### Implementation Timeline
- **Phase 1** (Weeks 1-2): Core infrastructure and command framework
- **Phase 2** (Weeks 3-4): Multi-collection detection and basic notifications
- **Phase 3** (Weeks 5-6): Filtering, customization, and notification themes
- **Phase 4** (Weeks 7-8): Analytics, optimization, and community features

## Documentation Structure

### Core Documentation
- **`replit.md`** - Main project overview and architecture
- **`ROADMAP.md`** - Detailed development roadmap for multi-mint tracking
- **`MULTI_MINT_SPEC.md`** - Technical specifications and implementation details
- **`COMMAND_EXAMPLES.md`** - Practical examples of future user commands

### Technical Details
- **Database**: PostgreSQL with Drizzle ORM
- **Framework**: Node.js 20 with Discord.js v14
- **Monitoring**: Cron-based system (5-second intervals)
- **APIs**: SentX, Kabila, Hedera Mirror Node integration
- **Image Optimization**: Hashpack CDN for fast loading

## Getting Started

### For Users
1. Invite the bot to your Discord server
2. Use `/add-server` to configure notifications
3. Select channels for sales and mint notifications
4. Forever Mint notifications (Wild Tigers) work automatically

### For Developers
1. Review `replit.md` for system architecture
2. Check `ROADMAP.md` for planned features
3. Reference `MULTI_MINT_SPEC.md` for implementation details
4. Follow `COMMAND_EXAMPLES.md` for user experience guidelines

## Current Status
- **Forever Mint System**: ✅ Active and operational
- **Dual Discord Notifications**: ✅ Confirmed working
- **Multi-Collection Tracking**: 🚧 In planning phase
- **User Commands**: 🚧 Specification complete, implementation pending

## Support
- **Live System**: Actively monitoring Wild Tigers Forever Mints
- **Notification Delivery**: Dual Discord server support (Migos World + Wild Tigers)
- **Performance**: Real-time detection with 5-second monitoring cycles
- **Reliability**: Database-backed duplicate prevention and error handling

## Migration Path
Current Forever Mint users will experience seamless operation while new multi-collection features are developed. The existing system will continue unchanged, with new capabilities added alongside rather than replacing current functionality.