# Discord NFT Sales Bot - User Guide

## Overview
This Discord bot provides real-time NFT marketplace notifications for the Hedera blockchain. Get instant alerts when NFTs from your favorite collections are bought or listed for sale on popular marketplaces like SentX.

## Key Features
- **Real-time Sales Notifications** - Instant alerts when NFTs are sold
- **Listing Notifications** - Get notified when new NFTs are listed for sale
- **Separate Channels** - Configure different channels for sales vs listings
- **Multi-Collection Support** - Track multiple NFT collections simultaneously
- **Rich Information** - See price, rarity, buyer/seller info, and collection links
- **USD Conversion** - Automatic HBAR to USD pricing
- **Multi-Server Support** - Works across multiple Discord servers

## Getting Started

### Step 1: Add Bot to Your Server
Click this link to add the bot to your Discord server:
[**Add NFT Sales Bot**](https://discord.com/api/oauth2/authorize?client_id=1018256324519264265&permissions=19520&scope=bot%20applications.commands)

**Required Permissions:**
- View Channel
- Send Messages
- Embed Links
- Add Reactions
- Use Slash Commands

### Step 2: Initial Setup
The bot will automatically:
1. Create a welcome message in your server
2. Set up the first available text channel for notifications
3. Register all slash commands

### Step 3: Start Tracking Collections
Use the `/add` command to track your first NFT collection:
```
/add token_id:0.0.6024491 name:Wild Tigers
```

## Commands Guide

### Core Commands
- `/add` - Add NFT collection to track
- `/remove` - Remove specific collection
- `/list` - Show all tracked collections
- `/status` - Check bot status and statistics

### Advanced Commands
- `/remove-all` - Remove all tracked collections (with confirmation)
- `/set-listings-channel` - Set separate channel for listing notifications
- `/test` - Test bot functionality with sample data
- `/broadcast-test` - Send test notifications to all servers

### Test Commands
The `/test` command supports different types:
- **Regular Sale** - Test with recent marketplace sale
- **Order Fill** - Test with order fulfillment
- **Latest Listing** - Test with marketplace listing
- **Rooster Cartel Order Fill** - Specialized test for Rooster collections

## Channel Configuration

### Single Channel Setup (Default)
By default, both sales and listings go to the same channel where you first use the bot.

### Separate Channels Setup
For better organization, set up separate channels:

1. **Sales Channel** - The main channel (set automatically)
2. **Listings Channel** - Use `/set-listings-channel` to configure

Example:
```
/set-listings-channel channel:#nft-listings
```

## Popular NFT Collections

Here are some popular Hedera NFT collections you can track:

### Wild Tigers
```
/add token_id:0.0.6024491 name:Wild Tigers
```

### Rooster Collections
```
/add token_id:0.0.855050 name:Gen0
/add token_id:0.0.1363572 name:Super Roosters
/add token_id:0.0.993985 name:Rooster Pfp
/add token_id:0.0.1110608 name:Rooster Hens
```

### Other Collections
```
/add token_id:0.0.2124637 name:Salsa Picante
```

## Notification Examples

### Sales Notification
When an NFT is sold, you'll see:
- NFT name and collection
- Sale price in HBAR and USD
- Buyer and seller information
- Collector tier badges
- Collection floor price comparison
- Direct link to marketplace

### Listing Notification
When an NFT is listed for sale, you'll see:
- NFT name and collection
- Asking price in HBAR and USD
- Seller information
- Rarity information
- Direct link to marketplace listing

## Troubleshooting

### Bot Not Responding
- Check if bot has required permissions
- Ensure bot is online (green status)
- Try `/status` command to verify functionality

### No Notifications
- Verify collections are added with `/list`
- Check if collections have recent marketplace activity
- Use `/test` to verify notifications are working

### Missing Images
- Images are automatically fetched from marketplace APIs
- Some older NFTs may not have images available
- The bot tries multiple image sources for best results

### Permission Issues
The bot needs these permissions to function:
- **View Channel** - To see where to post
- **Send Messages** - To post notifications
- **Embed Links** - To display rich notifications
- **Add Reactions** - To add emoji reactions
- **Use Slash Commands** - To register commands

## Advanced Features

### Broadcast Testing
Server administrators can use `/broadcast-test` to send test notifications to all servers where the bot is installed. This is useful for:
- Testing notification systems
- Demonstrating bot functionality
- Verifying channel configurations

### Collection Management
- Use `/remove-all` to clear all tracked collections
- The bot includes a confirmation system to prevent accidental deletion
- You can track the same collection across multiple servers

### Data Privacy
- The bot only stores collection preferences and server configurations
- No personal data or transaction information is stored
- All notifications are real-time from marketplace APIs

## Support

If you encounter any issues:
1. Check this guide first
2. Use `/status` to verify bot functionality
3. Try `/test` to check if notifications work
4. Contact the bot administrator if problems persist

## Technical Details

- **Monitoring Frequency:** Every 3 seconds
- **Supported Marketplaces:** SentX (more coming soon)
- **Price Updates:** Real-time HBAR to USD conversion
- **Data Sources:** Official marketplace APIs
- **Blockchain:** Hedera Hashgraph

---

*Built for the Hedera community by Migos World Labs Inc*