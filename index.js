/**
 * Main entry point for the Discord NFT Sales Bot
 * Initializes the bot and starts monitoring SentX marketplace
 */

const bot = require('./bot');
const config = require('./config');
const DatabaseStorage = require('./database-storage');

// Initialize database storage
const storage = new DatabaseStorage();

async function initializeBot() {
    try {
        await storage.init();
        console.log('Database storage initialized');
        
        // Start the bot
        await bot.start();
    } catch (error) {
        console.error('Failed to initialize bot:', error);
        process.exit(1);
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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

console.log('Discord NFT Sales Bot starting...');
