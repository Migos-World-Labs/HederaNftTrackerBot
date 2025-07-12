# Quick Start Guide - NFT Sales Bot

## Step 1: Add Bot to Your Discord

**Click this link:** [Add NFT Sales Bot](https://discord.com/api/oauth2/authorize?client_id=1018256324519264265&permissions=19520&scope=bot%20applications.commands)

1. Select your Discord server
2. Click "Authorize"
3. The bot will join and send a welcome message

## Step 2: Start Tracking Collections

Use the `/add` command to track any NFT collection:

```
/add token_id:YOUR_TOKEN_ID name:Collection Name
```

**How to find token IDs:**
- Visit [SentX Marketplace](https://sentx.io/nft-marketplace)
- Browse collections and copy the token ID from the URL
- Or ask your community which collections they want to track

## Step 3: Test Your Setup

Check if everything works:

```
/test type:Latest Listing
```

## Step 4: View Your Collections

See what you're tracking:

```
/list
```

## Optional: Separate Channels

Set different channels for sales vs listings:

```
/set-listings-channel channel:#your-listings-channel
```

## That's It!

Your bot is now monitoring NFT activity. You'll get notifications when:
- NFTs are sold from tracked collections
- New NFTs are listed for sale

## Common Commands

- `/add` - Track new collection
- `/remove` - Stop tracking collection  
- `/list` - Show tracked collections
- `/status` - Check bot health
- `/test` - Test notifications

## Need Help?

- Type `/status` to check if bot is working
- Use `/test` to verify notifications work
- The bot works automatically once collections are added

---

*Start tracking your favorite Hedera NFT collections now!*