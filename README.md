# Discord NFT Sales Bot

A Discord bot that tracks real-time NFT sales from SentX marketplace on Hedera and posts detailed sale notifications to Discord channels. Supports multiple servers with Discord slash commands.

## Features

- Real-time NFT sales monitoring from SentX marketplace
- Beautiful Discord embeds with NFT details, prices, buyer/seller info
- HBAR to USD price conversion
- Collection filtering - track specific NFT collections
- IPFS image support with automatic conversion to HTTP URLs
- Multi-server support with individual configurations
- Discord slash commands for easy management

## Invite the Bot

Use this invite link to add the bot to your Discord server:
```
https://discord.com/api/oauth2/authorize?client_id=1018256324519264265&permissions=19456&scope=bot
```

Required permissions: Send Messages, Embed Links, Use Slash Commands

## Discord Commands

Once the bot is in your server, use these slash commands:

- `/add token_id name` - Add an NFT collection to track
  - Example: `/add 0.0.878200 Dead Pixels Ghost Club`
- `/remove token_id` - Remove a collection from tracking
  - Example: `/remove 0.0.878200`
- `/list` - Show all tracked collections
- `/status` - Display bot status and monitoring information

## Setup for Bot Owners

1. **Discord Bot Setup**
   - Create a Discord application at https://discord.com/developers/applications
   - Create a bot and copy the bot token
   - Enable "Use Slash Commands" permission

2. **SentX API Key**
   - Get your API key from https://sentx.io (account settings)

3. **Environment Variables**
   - `DISCORD_TOKEN` - Your Discord bot token
   - `SENTX_API_KEY` - Your SentX API key

## How to Use

1. **Invite the bot** to your Discord server using the link above
2. **Add collections** using `/add 0.0.123456 Collection Name`
3. **Start receiving notifications** for sales from your tracked collections
4. **Manage collections** with `/list`, `/remove`, and `/status` commands

## Finding Token IDs

To find NFT collection token IDs:
- Visit the collection page on SentX marketplace
- Look for the token address in the URL or collection details
- Format should be 0.0.xxxxxx (like 0.0.878200)
- You can also find them on HashScan.io

## Sale Notification Format

Each sale notification includes:
- NFT name and collection
- Sale price in HBAR and USD
- Buyer and seller addresses
- NFT image (if available)
- Rarity and rank information (if available)
- Link to view on HashScan blockchain explorer
- Marketplace information

## Multi-Server Support

- The bot can be added to multiple Discord servers
- Each server can track the same collections
- Collections are managed globally - adding a collection in one server makes it available in all servers
- Server admins can use slash commands to manage tracking for their server

## Running the Bot

```bash
npm install
node index.js
```

The bot will:
- Connect to Discord and register slash commands
- Start monitoring SentX marketplace every 30 seconds
- Post sale notifications to all configured servers
- Convert IPFS images to viewable HTTP URLs
- Include HBAR and USD prices with current exchange rates

## Troubleshooting

**Bot not responding to slash commands:**
- Ensure bot has "Use Slash Commands" permission
- Try re-inviting the bot with the provided link
- Wait a few minutes for Discord to register the commands

**No sales appearing:**
- Use `/list` to check tracked collections
- Use `/add` to add collections you want to track
- Verify collections have recent sales activity on SentX

**Images not showing:**
- Bot automatically converts IPFS URLs to HTTP gateway URLs
- Some images may take time to load through IPFS gateways