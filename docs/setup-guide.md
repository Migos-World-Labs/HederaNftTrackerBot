# Complete Setup Guide - Hedera NFT Sales Bot

## 🏗️ System Requirements

### Development Environment
- **Node.js**: Version 20 or higher
- **Database**: PostgreSQL (local or cloud)
- **Memory**: Minimum 512MB RAM
- **Storage**: 1GB free space

### Production Environment
- **Cloud Platform**: Replit, Heroku, DigitalOcean, or similar
- **Database**: Neon, Supabase, or PostgreSQL cloud service
- **Uptime**: 24/7 hosting recommended for continuous monitoring

## 🔑 Required API Keys & Tokens

### 1. Discord Bot Token
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Navigate to "Bot" section
4. Click "Add Bot"
5. Copy the bot token (keep this secret!)
6. Enable "Message Content Intent" if needed

### 2. SentX API Key
1. Visit [SentX.io](https://sentx.io)
2. Create an account or log in
3. Go to your settings/profile panel
4. Generate an API key
5. Copy the API key for configuration

### 3. Database Connection
**Option A: Neon (Recommended)**
1. Sign up at [Neon.tech](https://neon.tech)
2. Create a new database
3. Copy the connection string

**Option B: Local PostgreSQL**
1. Install PostgreSQL locally
2. Create a new database
3. Format: `postgresql://username:password@localhost:5432/dbname`

## 🚀 Installation Steps

### Step 1: Clone or Download
```bash
# If using Git
git clone <repository-url>
cd discord-nft-bot

# Or download and extract the project files
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Environment Configuration
Create a `.env` file in the project root:

```bash
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token_here

# SentX API Configuration  
SENTX_API_KEY=your_sentx_api_key_here

# Database Configuration
DATABASE_URL=your_postgresql_connection_string

# Optional: Currency API (for better rate limiting)
COINMARKETCAP_API_KEY=your_cmc_api_key_here
```

### Step 4: Database Setup
```bash
# Initialize database schema
npm run db:push

# Or manually run migrations if needed
npx drizzle-kit push:pg
```

### Step 5: Bot Permissions
Configure your Discord bot with these permissions:
- **View Channels** (1024)
- **Send Messages** (2048) 
- **Embed Links** (16384)
- **Add Reactions** (64)
- **Use Slash Commands** (2147483648)

**Combined Permission Integer**: `19520`

### Step 6: Invite Bot to Server
Use this URL format (replace CLIENT_ID with your bot's client ID):
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=19520&scope=bot%20applications.commands
```

### Step 7: Start the Bot
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 🔧 Configuration Options

### config.js Settings
```javascript
module.exports = {
    // Monitoring intervals
    MONITORING_INTERVAL: 3000, // 3 seconds
    
    // API Rate limits
    SENTX_RATE_LIMIT: 100, // requests per minute
    KABILA_RATE_LIMIT: 60,
    
    // Cache settings
    HBAR_RATE_CACHE_TTL: 300000, // 5 minutes
    
    // Database cleanup
    CLEANUP_INTERVAL: 86400000, // 24 hours
    OLD_RECORD_THRESHOLD: 259200000, // 3 days
    
    // Discord settings
    MAX_EMBED_FIELDS: 25,
    INTERACTION_TIMEOUT: 15000 // 15 seconds
};
```

### Database Schema
The bot automatically creates these tables:
- **collections**: Tracked NFT collections per server
- **server_configs**: Discord server configuration
- **bot_state**: Application state and timestamps
- **processed_sales**: Duplicate prevention tracking
- **processed_listings**: Listing duplicate prevention

## 🌐 Deployment Options

### Replit (Recommended for Beginners)
1. Import project to Replit
2. Add environment variables in Secrets tab
3. Configure "Always On" for 24/7 operation
4. Bot will start automatically

### Heroku
1. Create new Heroku app
2. Connect to GitHub repository
3. Add environment variables in Config Vars
4. Deploy from main branch

### DigitalOcean App Platform
1. Create new app from repository
2. Configure environment variables
3. Set auto-deploy from main branch
4. Choose appropriate instance size

### VPS/Dedicated Server
1. Install Node.js and PostgreSQL
2. Clone repository to server
3. Configure environment variables
4. Use PM2 for process management:
```bash
npm install -g pm2
pm2 start index.js --name "nft-bot"
pm2 startup
pm2 save
```

## 🔍 Verification & Testing

### 1. Check Bot Status
```bash
# View logs for any errors
npm run logs

# Or check specific components
node -e "console.log(require('./config.js'))"
```

### 2. Database Connection Test
```bash
# Test database connectivity
npm run db:test
```

### 3. Discord Integration Test
1. Invite bot to a test server
2. Use `/status` command
3. Try `/add` with a test collection
4. Use `/test` to verify functionality

### 4. API Integration Test
Check that all APIs are responding:
- SentX API calls return valid data
- Kabila API is accessible
- Currency conversion is working
- Hedera Mirror Node responds

## 🛠️ Troubleshooting

### Common Issues

**Bot Not Responding**
- Check Discord token is valid
- Verify bot has proper permissions
- Ensure bot is online in Discord

**Database Errors**
- Verify DATABASE_URL is correct
- Check database is accessible
- Run `npm run db:push` to update schema

**API Errors**
- Validate SentX API key
- Check rate limiting settings
- Verify network connectivity

**Missing Notifications**
- Confirm collections are added with `/list`
- Check channel permissions
- Verify monitoring is active with `/status`

### Debug Mode
Enable detailed logging:
```bash
# Set debug environment
DEBUG=* npm start

# Or specific modules
DEBUG=bot:*,sentx:*,kabila:* npm start
```

### Health Monitoring
The bot includes built-in health checks:
- API endpoint availability
- Database connection status
- Discord gateway connection
- Memory and performance metrics

## 📊 Performance Optimization

### Database Optimization
- Regular cleanup of old records (automated)
- Connection pooling for efficiency
- Indexed queries for fast lookups

### API Rate Management
- Built-in rate limiting for all external APIs
- Cached responses where appropriate
- Retry logic with exponential backoff

### Memory Management
- Automatic garbage collection
- Efficient data structures
- Cleanup of temporary files

## 🔄 Maintenance

### Regular Tasks
- Monitor bot uptime and performance
- Review error logs for issues
- Update dependencies monthly
- Backup database regularly

### Updates
```bash
# Update dependencies
npm update

# Apply database migrations
npm run db:push

# Restart bot
npm restart
```

## 🚨 Security Considerations

### Environment Variables
- Never commit `.env` files to version control
- Use secure secret management in production
- Rotate API keys regularly

### Database Security
- Use SSL connections for cloud databases
- Implement proper access controls
- Regular security updates

### Discord Security
- Limit bot permissions to minimum required
- Monitor for unauthorized usage
- Use 2FA on Discord developer account

---

*For additional support or questions, refer to the troubleshooting section or check the project documentation.*