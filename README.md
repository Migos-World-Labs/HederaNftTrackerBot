# Discord NFT Sales Bot for Hedera

> Real-time NFT marketplace notifications for Discord servers

## What is this?

A Discord bot that monitors Hedera NFT marketplaces and sends instant notifications when:
- NFTs are sold from your tracked collections
- New NFTs are listed for sale

## Quick Start

1. **[Add to Discord](https://discord.com/api/oauth2/authorize?client_id=1018256324519264265&permissions=19520&scope=bot%20applications.commands)**
2. **Track a collection:** `/add token_id:0.0.6024491 name:Wild Tigers`
3. **Test it:** `/test type:Latest Listing`

## Features

- 🔥 **Real-time sales alerts** with price and buyer info
- 📝 **Listing notifications** when NFTs go up for sale
- 💰 **USD conversion** from HBAR pricing
- 🎯 **Multi-collection tracking** for all your favorite projects
- 🏆 **Rarity information** and collection stats
- 📱 **Separate channels** for sales vs listings
- 🌐 **Multi-server support** across Discord communities

## Popular Collections

Track these trending Hedera NFT collections:

```bash
# Wild Tigers
/add token_id:0.0.6024491 name:Wild Tigers

# Rooster Collections
/add token_id:0.0.855050 name:Gen0
/add token_id:0.0.1363572 name:Super Roosters
/add token_id:0.0.993985 name:Rooster Pfp
/add token_id:0.0.1110608 name:Rooster Hens

# Other Collections
/add token_id:0.0.2124637 name:Salsa Picante
```

## Commands

| Command | Description |
|---------|-------------|
| `/add` | Track new NFT collection |
| `/remove` | Stop tracking collection |
| `/list` | Show all tracked collections |
| `/test` | Test bot notifications |
| `/status` | Check bot status |
| `/set-listings-channel` | Set separate channel for listings |
| `/broadcast-test` | Send test to all servers |

## Documentation

- **[User Guide](USER_GUIDE.md)** - Complete feature documentation
- **[Setup Guide](SETUP_GUIDE.md)** - Quick 5-minute setup
- **[replit.md](replit.md)** - Technical architecture details

## Supported Marketplaces

- ✅ **SentX** - Primary marketplace integration
- 🔄 **More coming soon**

## Requirements

- Discord server with admin permissions
- Text channel for notifications
- Basic slash command permissions

## Bot Permissions

- View Channel
- Send Messages
- Embed Links
- Add Reactions
- Use Slash Commands

## Community

Built for the Hedera NFT community by Migos World Labs Inc.

Perfect for:
- NFT collectors tracking their favorite projects
- Discord communities wanting marketplace updates
- Traders monitoring floor prices and sales
- Artists promoting their collections

---

**[Add to your Discord server now!](https://discord.com/api/oauth2/authorize?client_id=1018256324519264265&permissions=19520&scope=bot%20applications.commands)**