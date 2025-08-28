# Multi-Mint Tracking Technical Specification

## System Architecture

### Core Components

#### 1. User Command System
```javascript
// Command handler structure
const mintCommands = {
  'mint-tracking': {
    subcommands: {
      setup: { handler: setupMintTracking, permissions: ['ADMINISTRATOR'] },
      remove: { handler: removeMintTracking, permissions: ['ADMINISTRATOR'] },
      list: { handler: listMintTracking, permissions: ['MANAGE_GUILD'] },
      toggle: { handler: toggleMintTracking, permissions: ['ADMINISTRATOR'] },
      settings: { handler: viewSettings, permissions: ['MANAGE_GUILD'] }
    }
  }
};
```

#### 2. Database Schema Extension
```sql
-- Mint tracking configurations table
CREATE TABLE mint_tracking_configs (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    token_id VARCHAR(20) NOT NULL,
    channel_id VARCHAR(20) NOT NULL,
    collection_name VARCHAR(100),
    enabled BOOLEAN DEFAULT TRUE,
    theme VARCHAR(20) DEFAULT 'rich',
    min_price_hbar DECIMAL(10,2),
    max_price_hbar DECIMAL(10,2),
    min_rarity_rank INTEGER,
    max_rarity_rank INTEGER,
    created_by VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, token_id)
);

-- Enhanced processed mints tracking
ALTER TABLE processed_mints ADD COLUMN config_id INTEGER REFERENCES mint_tracking_configs(id);
ALTER TABLE processed_mints ADD COLUMN notification_sent BOOLEAN DEFAULT FALSE;

-- Mint analytics table for statistics
CREATE TABLE mint_analytics (
    id SERIAL PRIMARY KEY,
    token_id VARCHAR(20) NOT NULL,
    mint_date DATE NOT NULL,
    total_mints INTEGER DEFAULT 0,
    avg_price_hbar DECIMAL(10,2),
    min_price_hbar DECIMAL(10,2),
    max_price_hbar DECIMAL(10,2),
    unique_minters INTEGER DEFAULT 0,
    UNIQUE(token_id, mint_date)
);
```

#### 3. Collection Detection Service
```javascript
class CollectionMintDetector {
  constructor() {
    this.trackingConfigs = new Map();
    this.lastProcessedTimestamps = new Map();
  }

  async detectMints(tokenId) {
    // Primary: SentX launchpad API
    const sentxMints = await this.detectSentXMints(tokenId);
    
    // Fallback: Hedera Mirror Node
    if (!sentxMints.length) {
      return await this.detectMirrorNodeMints(tokenId);
    }
    
    return sentxMints;
  }

  async detectSentXMints(tokenId) {
    // Use existing launchpad API integration
    // Extend to support any token ID, not just Wild Tigers
  }

  async detectMirrorNodeMints(tokenId) {
    // Query Hedera Mirror Node for token transfers
    // Filter for mint transactions (from treasury to users)
  }
}
```

## Command Specifications

### `/mint-tracking setup`
```
Usage: /mint-tracking setup <token_id> <channel> [options]

Parameters:
- token_id: Hedera token ID (e.g., 0.0.6024491)
- channel: Discord channel for notifications

Options:
- theme: minimal|standard|rich (default: rich)
- min_price: Minimum HBAR price filter
- max_price: Maximum HBAR price filter
- min_rarity: Minimum rarity rank filter
- max_rarity: Maximum rarity rank filter

Example:
/mint-tracking setup 0.0.6024491 #mint-alerts theme:rich min_price:100
```

### `/mint-tracking list`
```
Shows all configured mint tracking for the server:

┌─────────────────┬──────────────────┬─────────┬───────────┐
│ Collection      │ Channel          │ Status  │ Filters   │
├─────────────────┼──────────────────┼─────────┼───────────┤
│ Wild Tigers     │ #mint-alerts     │ Active  │ 100+ HBAR │
│ Hedera Monkeys  │ #general         │ Paused  │ Top 500   │
└─────────────────┴──────────────────┴─────────┴───────────┘
```

### `/mint-tracking remove`
```
Usage: /mint-tracking remove <token_id>

Removes mint tracking configuration for specified collection.
Requires confirmation for safety.
```

### `/mint-tracking toggle`
```
Usage: /mint-tracking toggle <token_id> [on|off]

Temporarily enable/disable mint tracking without removing configuration.
```

## Notification Themes

### Minimal Theme
```
🌟 New Mint: Collection Name #123 - 600 HBAR
```

### Standard Theme
```
🌟 **New Mint Detected**
Collection: Wild Tigers #123
Price: 600 HBAR ($144.00)
Minter: 0.0.1234567
```

### Rich Theme (Default)
```
[Embedded Discord message with:]
- NFT image thumbnail
- Collection name and token number
- Rarity rank and score
- Mint price in HBAR and USD
- Minter wallet address
- Collection-specific branding/colors
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
1. Database schema implementation
2. Basic command structure
3. Permission system
4. Configuration storage/retrieval

### Phase 2: Multi-Collection Detection (Week 3-4)
1. Extend SentX API integration
2. Hedera Mirror Node fallback
3. Collection metadata caching
4. Basic notification delivery

### Phase 3: Filtering & Customization (Week 5-6)
1. Price range filtering
2. Rarity filtering
3. Notification themes
4. Batch notifications

### Phase 4: Analytics & Polish (Week 7-8)
1. Mint statistics tracking
2. Performance optimization
3. Error handling improvements
4. User experience enhancements

## API Integration Details

### SentX Launchpad API Extension
```javascript
async function getLaunchpadActivity(tokenId, fromTimestamp) {
  const response = await axios.get(`${SENTX_API_BASE}/v1/public/launchpad/activity`, {
    params: {
      tokenId,
      fromTimestamp,
      limit: 100,
      activityType: 'mint'
    }
  });
  
  return response.data.activities || [];
}
```

### Hedera Mirror Node Integration
```javascript
async function getMirrorNodeMints(tokenId, fromTimestamp) {
  const response = await axios.get(`${MIRROR_NODE_BASE}/api/v1/tokens/${tokenId}/nfts`, {
    params: {
      'timestamp': `gte:${fromTimestamp}`,
      'order': 'desc',
      'limit': 100
    }
  });
  
  // Filter for actual mint transactions (initial transfers)
  return response.data.nfts.filter(nft => 
    nft.created_timestamp >= fromTimestamp
  );
}
```

## Performance Considerations

### Rate Limiting
- SentX API: 100 requests/minute per IP
- Mirror Node: 1000 requests/minute per IP
- Discord API: 50 requests/second per bot

### Optimization Strategies
1. **Batch Processing**: Group multiple collections in single API calls
2. **Intelligent Polling**: Adjust frequency based on collection activity
3. **Caching**: Store collection metadata to reduce API calls
4. **Database Indexing**: Optimize queries for large datasets

### Monitoring
```javascript
const metrics = {
  detectionsPerMinute: 0,
  notificationsSent: 0,
  apiErrors: 0,
  averageProcessingTime: 0
};
```

## Error Handling

### Graceful Degradation
1. SentX API down → Fall back to Mirror Node
2. Mirror Node down → Log error, continue with other collections
3. Discord API errors → Retry with exponential backoff
4. Database errors → Queue notifications for retry

### User Feedback
```javascript
// Command response examples
"✅ Mint tracking enabled for Wild Tigers in #mint-alerts"
"⚠️ Collection not found. Please verify the token ID."
"❌ You need Administrator permissions to configure mint tracking."
"🔄 Processing... This may take a moment for new collections."
```

## Security & Permissions

### Role-Based Access
- **Setup/Remove**: Requires Administrator permission
- **Toggle**: Requires Administrator permission  
- **List/Settings**: Requires Manage Guild permission
- **All commands**: Require bot to have necessary channel permissions

### Input Validation
```javascript
function validateTokenId(tokenId) {
  return /^0\.0\.\d+$/.test(tokenId);
}

function validatePriceRange(min, max) {
  return min >= 0 && max > min && max <= 1000000;
}
```

This specification provides the technical foundation for implementing user-configurable multi-mint tracking while maintaining the robustness and reliability of the current Forever Mint system.