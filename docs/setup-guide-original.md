# Quick Setup Guide - Discord NFT Sales Bot

## 1. Add Bot to Discord Server

**Click this link:** [Add NFT Sales Bot](https://discord.com/api/oauth2/authorize?client_id=1018256324519264265&permissions=19520&scope=bot%20applications.commands)

**Select your server** and click "Authorize"

## 2. Bot Auto-Configuration

The bot will automatically:
- ✅ Send welcome message
- ✅ Set up notification channel
- ✅ Register slash commands

## 3. Add Your First Collection

Choose one of these popular collections:

### Wild Tigers
```
/add token_id:0.0.6024491 name:Wild Tigers
```

### Rooster Gen0
```
/add token_id:0.0.855050 name:Gen0
```

### Super Roosters
```
/add token_id:0.0.1363572 name:Super Roosters
```

## 4. Test the Bot

```
/test type:Latest Listing
```

## 5. Optional: Set Separate Channels

For better organization:
```
/set-listings-channel channel:#nft-listings
```

## Quick Commands Reference

| Command | Purpose |
|---------|---------|
| `/add` | Track new collection |
| `/list` | Show tracked collections |
| `/test` | Test notifications |
| `/status` | Check bot status |
| `/remove` | Remove collection |

## That's it!

Your bot is now monitoring NFT sales and listings. You'll receive notifications whenever:
- NFTs are sold from your tracked collections
- New NFTs are listed for sale

## Need Help?

- Use `/status` to check if bot is working
- Use `/test` to verify notifications
- See USER_GUIDE.md for detailed instructions

---

*Ready to track your favorite Hedera NFTs!*