/**
 * Main entry point for the Discord NFT Sales Bot
 * Initializes the bot and starts monitoring SentX marketplace
 */

const bot = require('./bot');
const config = require('./config');
const storage = require('./utils/storage');

// Initialize storage
storage.init();

// Start the bot
bot.start().catch(error => {
    console.error('Failed to start bot:', error);
    process.exit(1);
});

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
