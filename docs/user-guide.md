# Complete User Guide - Hedera NFT Sales Bot

## 🎯 Getting Started

### Bot Invitation
Add the bot to your Discord server using this link:
```
https://discord.com/api/oauth2/authorize?client_id=1018256324519264265&permissions=19520&scope=bot%20applications.commands
```

### First-Time Setup
1. **Automatic Configuration**: The bot auto-configures when joining your server
2. **Welcome Message**: Receives a welcome message explaining basic usage
3. **Permission Check**: Ensures all required permissions are granted
4. **Channel Setup**: Uses the channel where invited as the default notification channel

## 📋 Complete Command Reference

### Collection Management Commands

#### `/add` - Add NFT Collection
**Purpose**: Track a new NFT collection for sales and listing notifications

**Parameters**:
- `token_id` (required): The Hedera token ID (e.g., `0.0.6024491`)
- `collection_name` (required): Display name for the collection (e.g., `Wild Tigers`)

**Example**:
```
/add token_id:0.0.6024491 collection_name:Wild Tigers
```

**Notes**:
- Each server can track different collections independently
- Duplicate collections are automatically prevented
- Collection starts monitoring immediately after addition

#### `/remove` - Remove Specific Collection
**Purpose**: Stop tracking a specific NFT collection

**Parameters**:
- `token_id` (required): The token ID of the collection to remove

**Example**:
```
/remove token_id:0.0.6024491
```

**Notes**:
- Only removes the collection from the current server
- Other servers tracking the same collection are unaffected
- Notifications stop immediately after removal

#### `/remove-all` - Remove All Collections
**Purpose**: Remove ALL tracked collections from the current server

**Interactive Confirmation**:
- Shows list of all tracked collections
- Requires clicking "Yes, Remove All" button to confirm
- 30-second timeout for safety
- Can be cancelled with "Cancel" button

**Example**:
```
/remove-all
```

**Warning**: This action removes ALL collections and cannot be undone.

#### `/list` - Show Tracked Collections
**Purpose**: Display all NFT collections currently tracked in this server

**Output includes**:
- Token ID
- Collection name
- Status (enabled/disabled)
- Number of total tracked collections

**Example**:
```
/list
```

### Configuration Commands

#### `/set-listings-channel` - Configure Listings Channel
**Purpose**: Set a separate channel specifically for NFT listing notifications

**Parameters**:
- `channel` (required): The Discord channel for listing notifications

**Example**:
```
/set-listings-channel channel:#nft-listings
```

**How it works**:
- **Sales notifications**: Continue in the main/original channel
- **Listing notifications**: Go to the configured listings channel
- If no listings channel is set, both sales and listings go to the main channel

**Benefits**:
- Separate high-volume listings from important sales
- Better organization for active trading communities
- Customizable notification flow per server

#### `/status` - Bot Status Information
**Purpose**: Display comprehensive bot status and server information

**Information shown**:
- **Bot Health**: Online status, uptime, monitoring status
- **Server Stats**: Number of tracked collections, notification channels
- **API Status**: SentX, Kabila, and Hedera Mirror Node connectivity
- **Monitoring Info**: Last check times, processed sales/listings count
- **Performance**: Response times, error rates

**Example**:
```
/status
```

### Testing Commands

#### `/test` - Test Bot Functionality
**Purpose**: Verify bot functionality with real marketplace data

**Test Options**:

1. **Latest Sale from Tracked Collections**
   - Shows most recent sale from your server's tracked collections
   - Uses real marketplace data
   - Tests the complete notification pipeline

2. **Latest Listing from Tracked Collections**
   - Shows most recent listing from your server's tracked collections
   - Tests listing notification format
   - Includes rarity enrichment

3. **Recent SentX Sale**
   - Shows recent sale from SentX marketplace (any collection)
   - Tests SentX API integration
   - Good for general functionality testing

4. **Recent SentX Listing**
   - Shows recent listing from SentX marketplace
   - Tests SentX listings endpoint
   - Includes image and metadata display

5. **Recent Kabila Sale**
   - Shows recent sale from Kabila marketplace
   - Tests Kabila API integration
   - Demonstrates cross-marketplace functionality

6. **Recent Kabila Listing**
   - Shows recent listing from Kabila marketplace
   - Tests Kabila listings with SentX rarity enrichment
   - Shows dual marketplace data integration

**Optional Parameters**:
- `collection` (optional): Token ID to test specific collection (e.g., `0.0.6024491`)

**Examples**:
```
/test type:Latest Sale from Tracked Collections
/test type:Recent SentX Sale collection:0.0.6024491
```

## 🔔 Understanding Notifications

### Sales Notifications

**Content Includes**:
- **NFT Information**: Name, image, collection link
- **Transaction Details**: Sale price in HBAR and USD
- **Participant Info**: Buyer and seller addresses
- **Rarity Data**: Rank, rarity percentage, tier classification
- **Collector Tiers**: Whale status for buyer/seller
- **Marketplace Links**: Direct links to view the NFT
- **Timing**: Transaction timestamp and "time ago" format

**Rarity Tiers**:
- 🔥 **Legendary** (Top 1%)
- 💎 **Epic** (Top 5%)
- ⭐ **Rare** (Top 10%)
- 🟢 **Uncommon** (Top 25%)
- ⚪ **Common** (25%+)

**Collector Tiers**:
- 🐋 **Whale** (50+ NFTs)
- 🦈 **Shark** (20-49 NFTs)
- 🐬 **Dolphin** (10-19 NFTs)
- 🐟 **Fish** (5-9 NFTs)
- 🦐 **Shrimp** (1-4 NFTs)

### Listing Notifications

**Content Includes**:
- **NFT Information**: Name, image, collection details
- **Listing Details**: Asking price in HBAR and USD
- **Seller Information**: Address and collection holdings
- **Rarity Data**: SentX rank and rarity classification
- **Direct Links**: "View Listing" button for immediate access
- **Market Context**: Comparison to collection floor price

## 🏪 Supported Marketplaces

### SentX (Primary Marketplace)
- **Comprehensive Integration**: Full API access with sales, listings, and collection data
- **Authoritative Rarity**: Source of truth for all rarity and rank information
- **Rich Metadata**: Complete NFT metadata, images, and trait information
- **Collection Analytics**: Floor prices, volume data, and market statistics
- **Direct Links**: Links formatted as `https://sentx.io/nft-marketplace/{collection-name}`

### Kabila (Secondary Marketplace)
- **Extended Coverage**: Additional marketplace for broader activity monitoring
- **Activity Types**: Sales, listings, and launchpad sales
- **Rarity Enrichment**: Cross-enriched with authoritative SentX rarity data
- **Marketplace Links**: Links formatted as `https://market.kabila.app/en/collections/{token-number}/items`
- **Data Integration**: Combines Kabila transaction data with SentX metadata

### Cross-Marketplace Features
- **Unified Notifications**: Same format regardless of source marketplace
- **Rarity Consistency**: All NFTs show SentX rarity data when available
- **Dual Coverage**: Monitors both marketplaces simultaneously
- **Smart Deduplication**: Prevents duplicate notifications across marketplaces

## 🖼️ Image Support & Special Collections

### Hashinals (HCS-5 Standard)
**Special handling for on-chain stored NFTs**:
- **Known Collections**: The Ape Anthology, various Hashinal collections
- **CDN Sources**: SentX Hashinals service and HashPack CDN
- **Format Support**: Direct HCS topic message parsing
- **URL Formats**: 
  - `https://hashinals.sentx.io/{topicId}?optimizer=image&width=640`
  - `https://hashpack-hashinal.b-cdn.net/api/inscription-cdn/{tokenId}/{serialId}?network=mainnet`

### IPFS Collections
**Comprehensive IPFS support**:
- **CID Formats**: Both CIDv0 and CIDv1 support
- **Gateway Fallbacks**: Multiple IPFS gateway options
- **Metadata Parsing**: Automatic JSON metadata image extraction
- **URL Conversion**: Converts various IPFS formats to accessible URLs

### Image Fallback System
When primary image sources fail:
1. **Primary Source**: Original NFT image URL
2. **CDN Sources**: imageCDN, nftImage fields
3. **Metadata Images**: Parsed from JSON metadata
4. **IPFS Conversion**: Convert IPFS hashes to gateway URLs
5. **Hashinal Detection**: Special processing for HCS collections
6. **Collection Defaults**: Fallback to collection-level images

## 🎛️ Advanced Configuration

### Server-Specific Features
- **Independent Tracking**: Each Discord server has its own collection list
- **Channel Configuration**: Separate sales and listings channels per server
- **Permission Management**: Server admins control bot configuration
- **Custom Settings**: Each server can have different notification preferences

### Notification Customization
- **Channel Routing**: Sales vs listings channel separation
- **Collection Filtering**: Only notifications from tracked collections
- **Real-time Updates**: 3-second monitoring intervals
- **Smart Deduplication**: Prevents repeat notifications

### Performance Features
- **Rate Limiting**: Respects Discord and marketplace API limits
- **Connection Pooling**: Efficient database resource management
- **Caching**: Exchange rates and API responses cached appropriately
- **Error Recovery**: Graceful handling of API failures and Discord issues

## 🔧 Troubleshooting

### Common Issues & Solutions

#### "No notifications appearing"
**Possible causes**:
- Collection not added to server
- Insufficient bot permissions
- No recent activity for tracked collections

**Solutions**:
1. Use `/list` to verify collections are tracked
2. Check bot has "Send Messages" and "Embed Links" permissions
3. Use `/test` to verify bot functionality
4. Use `/status` to check bot health

#### "Images not displaying"
**This is normal for some NFTs**:
- Some NFTs have incomplete metadata
- IPFS images may load slowly
- Hashinals require special processing

**The bot tries multiple image sources automatically**

#### "Rarity data missing"
**Expected behavior**:
- Some NFTs may not have traded recently on SentX
- Kabila-only NFTs may not have rarity data available
- System shows no rarity rather than inaccurate data

#### "Bot not responding to commands"
**Check these items**:
1. Bot is online (check status indicator)
2. Commands typed correctly with `/` prefix
3. Bot has "Use Slash Commands" permission
4. Try `/status` to test basic functionality

#### "Duplicate notifications"
**Rare but possible**:
- Usually indicates API issues or network problems
- Bot has built-in deduplication that typically prevents this
- Should resolve automatically

### Getting Help

1. **Use `/status`** - Check if bot is functioning properly
2. **Try `/test`** - Verify core functionality works
3. **Check Permissions** - Ensure bot has all required Discord permissions
4. **Review Configuration** - Use `/list` to verify tracked collections

## 📊 Understanding the Data

### Data Sources
- **SentX**: Primary source for rarity, metadata, and sales data
- **Kabila**: Secondary marketplace for additional trading activity
- **Hedera Mirror Node**: NFT holder information and account data
- **CoinGecko**: Real-time HBAR to USD exchange rates

### Data Accuracy
- **Rarity Information**: Authoritative data from SentX marketplace
- **Pricing**: Real-time HBAR prices converted to USD
- **Holder Data**: Live blockchain data from Hedera Mirror Node
- **Cross-Marketplace**: Kabila data enriched with SentX rarity when available

### Data Freshness
- **Sales/Listings**: Checked every 3 seconds
- **Exchange Rates**: Updated every 5 minutes
- **Holder Information**: Real-time queries
- **Collection Data**: Cached appropriately to balance freshness and performance

## 🚀 Best Practices

### For Active Communities
1. **Use separate channels** for sales and listings if you have high activity
2. **Track popular collections** that have regular trading activity
3. **Monitor `/status`** periodically to ensure bot health
4. **Test regularly** with `/test` to verify functionality

### For Collection Owners
1. **Add your collection** to get immediate sale notifications
2. **Share the bot** with your community using the invite link
3. **Use rarity data** to understand your collection's trading patterns
4. **Monitor floor prices** through marketplace links in notifications

### For Traders
1. **Track multiple collections** you're interested in
2. **Use whale tier information** to identify significant holders
3. **Monitor both marketplaces** for complete trading picture
4. **Set up separate channels** to organize different types of activity

---

*This user guide covers all bot functionality. For quick setup, see the Quick Start Guide. For technical details, refer to the Setup Guide.*