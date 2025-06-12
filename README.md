# Discord NFT Sales Bot

A Discord bot that tracks real-time NFT sales from SentX marketplace on Hedera and posts detailed sale notifications to Discord channels.

## Features

- Real-time NFT sales monitoring from SentX marketplace
- Beautiful Discord embeds with NFT details, prices, buyer/seller info
- HBAR to USD price conversion
- Collection filtering - track specific NFT collections
- IPFS image support with automatic conversion to HTTP URLs
- Configurable monitoring intervals

## Setup

1. **Discord Bot Setup**
   - Create a Discord application at https://discord.com/developers/applications
   - Create a bot and copy the bot token
   - Invite the bot to your server with "Send Messages" and "Embed Links" permissions

2. **SentX API Key**
   - Get your API key from https://sentx.io (account settings)

3. **Environment Variables**
   - `DISCORD_TOKEN` - Your Discord bot token
   - `DISCORD_CHANNEL_ID` - Channel ID where sales will be posted
   - `SENTX_API_KEY` - Your SentX API key

## Collection Management

Edit the `collections.json` file to specify which NFT collections to track:

```json
{
  "collections": [
    {
      "tokenId": "0.0.878200",
      "name": "Dead Pixels Ghost Club",
      "enabled": true
    },
    {
      "tokenId": "0.0.2173899", 
      "name": "HashAxis",
      "enabled": true
    }
  ]
}
```

**To add a new collection:**
1. Find the token ID from SentX marketplace URL or Hedera explorer
2. Add a new entry to the collections array
3. Set `enabled: true` to start tracking
4. Restart the bot to apply changes

**To disable a collection:**
- Set `enabled: false` for that collection

## Running the Bot

```bash
npm install
node index.js
```

The bot will:
- Connect to Discord
- Start monitoring SentX marketplace every 30 seconds
- Post sale notifications for tracked collections
- Convert IPFS images to viewable HTTP URLs
- Include HBAR and USD prices with current exchange rates

## Sale Notification Format

Each sale notification includes:
- NFT name and collection
- Sale price in HBAR and USD
- Buyer and seller addresses
- NFT image (if available)
- Rarity and rank information (if available)
- Link to view on HashScan blockchain explorer
- Marketplace information

## Configuration

The bot automatically handles:
- Duplicate sale prevention
- Rate limiting to avoid Discord API limits
- Error recovery and reconnection
- HBAR price updates from CoinGecko
- Image URL conversion for Discord compatibility

## Troubleshooting

**Bot not posting messages:**
- Ensure bot has "Send Messages" and "Embed Links" permissions in the Discord channel
- Verify the channel ID is correct

**No sales appearing:**
- Check that collections in `collections.json` have correct token IDs
- Verify SentX API key is valid
- Ensure collections have recent sales activity

**Images not showing:**
- Bot automatically converts IPFS URLs to HTTP gateway URLs
- Some images may take time to load through IPFS gateways