/**
 * Configuration file for the Discord NFT Sales Bot
 * Handles environment variables and default settings
 */

require('dotenv').config();

const config = {
    // Discord Bot Configuration
    DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
    DISCORD_CHANNEL_ID: process.env.DISCORD_CHANNEL_ID || '',
    
    // SentX API Configuration
    SENTX_API_KEY: process.env.SENTX_API_KEY || '',
    SENTX_BASE_URL: process.env.SENTX_BASE_URL || 'https://api.sentx.io/v1',
    


    
    // Currency API Configuration
    COINMARKETCAP_API_KEY: process.env.COINMARKETCAP_API_KEY || '',
    COINGECKO_API_KEY: process.env.COINGECKO_API_KEY || '', // Optional, CoinGecko has free tier
    
    // Bot Settings
    MONITORING_INTERVAL: parseInt(process.env.MONITORING_INTERVAL || '30'), // seconds
    MAX_SALES_PER_CHECK: parseInt(process.env.MAX_SALES_PER_CHECK || '50'),
    RATE_LIMIT_DELAY: parseInt(process.env.RATE_LIMIT_DELAY || '1000'), // milliseconds
    
    // Network Configuration
    HEDERA_NETWORK: process.env.HEDERA_NETWORK || 'mainnet',
    
    // Feature Flags
    ENABLE_RARITY_INFO: process.env.ENABLE_RARITY_INFO !== 'false',
    ENABLE_TRANSACTION_LINKS: process.env.ENABLE_TRANSACTION_LINKS !== 'false',
    ENABLE_USD_CONVERSION: process.env.ENABLE_USD_CONVERSION !== 'false',
    
    // Logging Configuration
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    ENABLE_DEBUG_LOGS: process.env.ENABLE_DEBUG_LOGS === 'true',
    
    // Error Handling
    MAX_RETRY_ATTEMPTS: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3'),
    RETRY_DELAY: parseInt(process.env.RETRY_DELAY || '5000'), // milliseconds
    
    // Cache Settings
    CURRENCY_CACHE_DURATION: parseInt(process.env.CURRENCY_CACHE_DURATION || '300'), // seconds
    NFT_DATA_CACHE_DURATION: parseInt(process.env.NFT_DATA_CACHE_DURATION || '600'), // seconds
    
    // Discord Embed Customization
    EMBED_COLOR: process.env.EMBED_COLOR || '#00ff00',
    EMBED_FOOTER_TEXT: process.env.EMBED_FOOTER_TEXT || 'SentX NFT Sales Bot',
    
    // Filtering Options
    MIN_SALE_PRICE_HBAR: parseFloat(process.env.MIN_SALE_PRICE_HBAR || '0'),
    EXCLUDED_COLLECTIONS: process.env.EXCLUDED_COLLECTIONS 
        ? process.env.EXCLUDED_COLLECTIONS.split(',').map(s => s.trim())
        : [],
    INCLUDED_COLLECTIONS: process.env.INCLUDED_COLLECTIONS
        ? process.env.INCLUDED_COLLECTIONS.split(',').map(s => s.trim())
        : [],
    
    // Advanced Settings
    ENABLE_WEBHOOKS: process.env.ENABLE_WEBHOOKS === 'true',
    WEBHOOK_PORT: parseInt(process.env.WEBHOOK_PORT || '3000'),
    WEBHOOK_PATH: process.env.WEBHOOK_PATH || '/webhook/sentx',
    
    // Performance Settings
    CONCURRENT_API_REQUESTS: parseInt(process.env.CONCURRENT_API_REQUESTS || '5'),
    REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT || '10000'), // milliseconds
};

// Validation function
function validateConfig() {
    const errors = [];
    
    if (!config.DISCORD_TOKEN) {
        errors.push('DISCORD_TOKEN is required');
    }
    
    // DISCORD_CHANNEL_ID is now optional as bot auto-configures channels per server
    // if (!config.DISCORD_CHANNEL_ID) {
    //     errors.push('DISCORD_CHANNEL_ID is required');
    // }
    
    if (config.MONITORING_INTERVAL < 10) {
        errors.push('MONITORING_INTERVAL must be at least 10 seconds to avoid rate limiting');
    }
    
    if (config.MAX_SALES_PER_CHECK > 100) {
        errors.push('MAX_SALES_PER_CHECK should not exceed 100 to avoid Discord rate limits');
    }
    
    return errors;
}

// Validate configuration on load
const configErrors = validateConfig();
if (configErrors.length > 0) {
    console.error('Configuration errors:');
    configErrors.forEach(error => console.error(`  - ${error}`));
    
    if (!config.DISCORD_TOKEN) {
        console.error('Critical configuration missing. Bot cannot start.');
        process.exit(1);
    }
}

// Log configuration (without sensitive data)
if (config.ENABLE_DEBUG_LOGS) {
    console.log('Bot Configuration:');
    console.log(`  - Monitoring Interval: ${config.MONITORING_INTERVAL}s`);
    console.log(`  - Max Sales Per Check: ${config.MAX_SALES_PER_CHECK}`);
    console.log(`  - Hedera Network: ${config.HEDERA_NETWORK}`);
    console.log(`  - Min Sale Price: ${config.MIN_SALE_PRICE_HBAR} HBAR`);
    console.log(`  - USD Conversion: ${config.ENABLE_USD_CONVERSION ? 'Enabled' : 'Disabled'}`);
    console.log(`  - Rarity Info: ${config.ENABLE_RARITY_INFO ? 'Enabled' : 'Disabled'}`);
    
    if (config.EXCLUDED_COLLECTIONS.length > 0) {
        console.log(`  - Excluded Collections: ${config.EXCLUDED_COLLECTIONS.join(', ')}`);
    }
    
    if (config.INCLUDED_COLLECTIONS.length > 0) {
        console.log(`  - Included Collections: ${config.INCLUDED_COLLECTIONS.join(', ')}`);
    }
}

module.exports = config;
