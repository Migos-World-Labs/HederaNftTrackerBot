/**
 * Main entry point for the Discord NFT Sales Bot
 * Initializes the bot and starts monitoring SentX and Kabila marketplaces
 */

const NFTSalesBot = require('./bot');
const config = require('./config');
const DatabaseStorage = require('./database-storage');
const sentxService = require('./services/sentx');
const sentxScheduler = require('./services/sentx-scheduler');
const kabilaService = require('./services/kabila');
const currencyService = require('./services/currency');
const embedUtils = require('./utils/embed');

// Initialize services
const storage = new DatabaseStorage();
const bot = new NFTSalesBot(sentxService, kabilaService, embedUtils, currencyService, storage);

async function initializeBot() {
    try {
        await storage.init();
        console.log('Database storage initialized');
        
        // Start the centralized SentX scheduler monitoring
        console.log('🚀 Starting centralized SentX scheduler...');
        sentxScheduler.startMonitoring();
        
        // Start the bot
        await bot.start();
    } catch (error) {
        console.error('Failed to initialize bot:', error);
        console.error('Stack:', error.stack);
        console.log('🔄 Retrying bot initialization in 10 seconds...');
        setTimeout(initializeBot, 10000);
    }
}

// Initialize and start the bot
initializeBot();

// Graceful shutdown handling
process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await bot.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await bot.stop();
    process.exit(0);
});

// Handle uncaught exceptions without stopping the bot
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error.message);
    console.error('Stack:', error.stack);
    console.log('🔄 Bot continuing to run...');
    // Don't exit - let the bot keep running
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    console.log('🔄 Bot continuing to run...');
    // Don't exit - let the bot keep running
});

console.log('Discord NFT Sales Bot starting...');
