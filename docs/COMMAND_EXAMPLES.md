# Multi-Mint Tracking Command Examples

## Overview
This document provides practical examples of how users will interact with the multi-mint tracking system once implemented.

## Basic Setup Commands

### Setting Up Collection Tracking
```
/mint-tracking setup 0.0.6024491 #mint-alerts
```
**Result**: Wild Tigers mints will be posted to #mint-alerts channel with rich notifications

```
/mint-tracking setup 0.0.1006183 #general theme:minimal
```
**Result**: Hedera Monkeys mints will be posted to #general with minimal text-only notifications

### Advanced Setup with Filters
```
/mint-tracking setup 0.0.6024491 #high-value-mints min_price:500 theme:rich
```
**Result**: Only Wild Tigers mints costing 500+ HBAR will trigger rich notifications

```
/mint-tracking setup 0.0.1234567 #rare-mints max_rarity:100 theme:standard
```
**Result**: Only top 100 rarest mints from collection will trigger standard notifications

## Management Commands

### Viewing Current Configuration
```
/mint-tracking list
```
**Example Output**:
```
📊 **Mint Tracking Configuration**

┌─────────────────┬──────────────────┬─────────┬───────────────────┐
│ Collection      │ Channel          │ Status  │ Filters           │
├─────────────────┼──────────────────┼─────────┼───────────────────┤
│ Wild Tigers     │ #mint-alerts     │ ✅ Active│ 500+ HBAR, Rich   │
│ Hedera Monkeys  │ #general         │ ⏸️ Paused│ Minimal theme     │
│ Cool Cats       │ #nft-drops       │ ✅ Active│ Top 50 rarity    │
└─────────────────┴──────────────────┴─────────┴───────────────────┘

Total: 3 collections tracked
Use /mint-tracking settings <token_id> for detailed configuration
```

### Viewing Detailed Settings
```
/mint-tracking settings 0.0.6024491
```
**Example Output**:
```
⚙️ **Wild Tigers Mint Tracking Settings**

🆔 **Token ID**: 0.0.6024491
📢 **Channel**: #mint-alerts
🎨 **Theme**: Rich (with images & rarity data)
💰 **Price Filter**: 500+ HBAR (no upper limit)
🏆 **Rarity Filter**: All rarities
📅 **Created**: 2025-08-28 by @admin
📊 **Status**: Active

**Recent Activity**: 12 mints detected in last 24h, 8 notifications sent
```

### Toggling Tracking
```
/mint-tracking toggle 0.0.6024491 off
```
**Result**: ⏸️ Wild Tigers mint tracking paused (configuration preserved)

```
/mint-tracking toggle 0.0.6024491 on
```
**Result**: ✅ Wild Tigers mint tracking resumed

### Removing Collection
```
/mint-tracking remove 0.0.1006183
```
**Confirmation Required**:
```
⚠️ **Confirm Removal**
Are you sure you want to remove Hedera Monkeys mint tracking?
This will delete all configuration and cannot be undone.

[✅ Confirm] [❌ Cancel]
```

## Notification Examples

### Rich Theme (Default)
```
🌟 **New Mint Detected**

**Wild Tigers #3456**
💎 Rarity: #234 (15.67% rare)
💰 Price: 600 HBAR ($144.48)
👤 Minter: 0.0.1234567
🔗 [View on SentX](https://sentx.io/nft/...)

[Image: Wild Tigers #3456 thumbnail]
```

### Standard Theme
```
🌟 **New Mint: Hedera Monkeys #789**
💰 Price: 250 HBAR ($60.19)
👤 Minter: 0.0.9876543
🏆 Rarity: #156 (8.9% rare)
```

### Minimal Theme
```
🌟 New Mint: Cool Cats #456 - 150 HBAR
```

## Advanced Use Cases

### High-Value Alert Setup
```
/mint-tracking setup 0.0.6024491 #whale-alerts min_price:2000 theme:rich
```
**Use Case**: Dedicated channel for tracking only expensive mints (whales)

### Rarity Hunter Setup
```
/mint-tracking setup 0.0.1234567 #rare-drops max_rarity:25 theme:rich
```
**Use Case**: Only notify for top 25 rarest mints in collection

### Community General Setup
```
/mint-tracking setup 0.0.6024491 #general theme:minimal max_price:100
```
**Use Case**: Minimal notifications for affordable mints to avoid spam

### Multi-Channel Strategy
```
/mint-tracking setup 0.0.6024491 #all-mints theme:minimal
/mint-tracking setup 0.0.6024491 #rare-mints max_rarity:100 theme:rich
/mint-tracking setup 0.0.6024491 #whale-mints min_price:1000 theme:rich
```
**Use Case**: Different channels for different mint categories

## Error Handling Examples

### Invalid Token ID
```
/mint-tracking setup 0.0.invalid #alerts
```
**Response**: ❌ Invalid token ID format. Please use format: 0.0.123456

### Collection Not Found
```
/mint-tracking setup 0.0.999999999 #alerts
```
**Response**: ⚠️ Collection not found. Verifying token ID... This may take a moment for new collections.

### Permission Denied
```
/mint-tracking setup 0.0.6024491 #alerts
```
**Response** (if not admin): ❌ You need Administrator permissions to configure mint tracking.

### Channel Access Issues
```
/mint-tracking setup 0.0.6024491 #private-channel
```
**Response**: ❌ I don't have permission to post in #private-channel. Please ensure I have Send Messages permission.

## Best Practices

### Recommended Server Setup
1. **Main Collections**: Use dedicated channels with rich theme
2. **Secondary Collections**: Use general channels with standard theme  
3. **High-Value**: Separate channel for whale tracking
4. **Rare Drops**: Dedicated channel for top rarity mints

### Filter Guidelines
- **Price Filters**: Use to separate casual vs. serious mints
- **Rarity Filters**: Focus on genuinely rare pieces to avoid notification fatigue
- **Theme Selection**: Rich for dedicated channels, minimal for general channels

### Performance Tips
- Limit to 5-10 collections per server to avoid rate limiting
- Use minimal theme for high-activity collections
- Set appropriate price/rarity filters to reduce notification volume

## Migration from Forever Mint

### Current Wild Tigers Users
Existing Forever Mint notifications will continue unchanged. New system will add flexibility:

```
# Current: Automatic Wild Tigers notifications
# Future: Manual setup with customization
/mint-tracking setup 0.0.6024491 #mint-alerts theme:rich
```

### Gradual Transition
1. Phase 1: Forever Mint continues alongside new system
2. Phase 2: Users can optionally migrate to custom setup
3. Phase 3: Forever Mint becomes legacy, new system default