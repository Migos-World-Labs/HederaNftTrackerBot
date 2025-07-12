# Quick Start Guide - Hedera NFT Sales Bot

## 🚀 Get Started in 3 Steps

### Step 1: Invite the Bot
Click this link to add the bot to your Discord server:
```
https://discord.com/api/oauth2/authorize?client_id=1018256324519264265&permissions=19520&scope=bot%20applications.commands
```

### Step 2: Add Your First Collection
Use the `/add` command:
- **Token ID**: `0.0.6024491` (for Wild Tigers)
- **Collection Name**: `Wild Tigers`

### Step 3: Test It Works
Use `/test` and select "Latest Sale from Tracked Collections"

**That's it! You're now tracking Wild Tigers NFT sales and listings.**

---

## 📖 Essential Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `/add` | Track a new NFT collection | `/add 0.0.6024491 Wild Tigers` |
| `/list` | See all tracked collections | `/list` |
| `/test` | Test bot functionality | `/test` |
| `/status` | Check bot health | `/status` |

---

## 🎯 Popular NFT Collections

### Wild Tigers
- **Token ID**: `0.0.6024491`
- **Marketplace**: SentX, Kabila

### The Ape Anthology  
- **Token ID**: `0.0.8308459`
- **Marketplace**: SentX, Kabila

### Hashinals
- **Token ID**: `0.0.5552189`
- **Marketplace**: SentX

### Hedera Monkeys
- **Token ID**: `0.0.2173899`
- **Marketplace**: SentX

---

## 🔧 Advanced Setup

### Separate Channels for Listings
1. Use `/set-listings-channel`
2. Select a channel for listing notifications
3. Sales will stay in the main channel

### Test Different Marketplaces
Use `/test` with these options:
- **Recent SentX Sale** - Test SentX marketplace data
- **Recent Kabila Listing** - Test Kabila marketplace data

---

## 📊 What You'll See

### Sale Notifications Include:
- 💰 Price in HBAR and USD
- 🏆 NFT rarity rank and tier
- 🐋 Buyer's collector level (Whale, Shark, etc.)
- 🖼️ NFT image
- 🔗 Direct marketplace links

### Listing Notifications Include:
- 💸 Listing price
- 📈 Seller's collection holdings
- 🎯 Rarity information
- 🔗 Direct "View Listing" link

---

## ❓ Need Help?

### Common Issues:
- **No notifications?** → Check `/list` to see tracked collections
- **Missing images?** → Normal for some NFTs, the bot tries multiple sources
- **Bot not responding?** → Check `/status` for bot health

### Get Support:
1. Use `/status` to check if the bot is working
2. Try `/test` to validate functionality
3. Make sure the bot has proper permissions in your server

---

*Ready to dive deeper? Check out the full User Guide for advanced features and configuration options.*