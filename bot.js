/**
 * Discord bot implementation for tracking NFT sales
 */

const { Client, GatewayIntentBits, Events } = require('discord.js');
const cron = require('node-cron');
const config = require('./config');
const sentxService = require('./services/sentx');
const currencyService = require('./services/currency');
const embedUtils = require('./utils/embed');
const storage = require('./utils/storage');

class NFTSalesBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds
            ]
        });
        
        this.isMonitoring = false;
        this.monitoringTask = null;
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.once(Events.ClientReady, () => {
            console.log(`Bot logged in as ${this.client.user.tag}!`);
            this.startMonitoring();
        });

        this.client.on(Events.Error, (error) => {
            console.error('Discord client error:', error);
        });

        // Remove message handling since we don't need MessageContent intent
        // The bot will only post sale notifications, not respond to commands
    }

    async start() {
        try {
            await this.client.login(config.DISCORD_TOKEN);
        } catch (error) {
            console.error('Failed to login to Discord:', error);
            throw error;
        }
    }

    async stop() {
        if (this.monitoringTask) {
            this.monitoringTask.stop();
        }
        this.isMonitoring = false;
        await this.client.destroy();
        console.log('Bot stopped successfully');
    }

    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        console.log('Starting NFT sales monitoring...');
        
        // Monitor every 30 seconds for new sales
        this.monitoringTask = cron.schedule('*/30 * * * * *', async () => {
            await this.checkForNewSales();
        });

        // Also do an initial check
        this.checkForNewSales();
    }

    async checkForNewSales() {
        try {
            console.log('Checking for new NFT sales...');
            
            // Get recent sales from SentX
            const recentSales = await sentxService.getRecentSales();
            
            if (!recentSales || recentSales.length === 0) {
                console.log('No recent sales found');
                return;
            }

            // Get the timestamp of the last processed sale
            const lastProcessedTimestamp = storage.getLastProcessedSale();
            
            // Filter for new sales only
            const newSales = recentSales.filter(sale => {
                const saleTimestamp = new Date(sale.timestamp).getTime();
                return saleTimestamp > lastProcessedTimestamp;
            });

            if (newSales.length === 0) {
                console.log('No new sales to process');
                return;
            }

            console.log(`Found ${newSales.length} new sales`);

            // Get current HBAR to USD rate
            const hbarRate = await currencyService.getHbarToUsdRate();

            // Process each new sale
            for (const sale of newSales) {
                await this.processSale(sale, hbarRate);
                
                // Update last processed timestamp
                const saleTimestamp = new Date(sale.timestamp).getTime();
                storage.setLastProcessedSale(saleTimestamp);
                
                // Small delay between messages to avoid rate limiting
                await this.delay(1000);
            }

        } catch (error) {
            console.error('Error checking for new sales:', error);
        }
    }

    async processSale(sale, hbarRate) {
        try {
            // Create Discord embed for the sale
            const embed = embedUtils.createSaleEmbed(sale, hbarRate);
            
            // Get the channel to post to
            const channel = this.client.channels.cache.get(config.DISCORD_CHANNEL_ID);
            
            if (!channel) {
                console.error(`Channel with ID ${config.DISCORD_CHANNEL_ID} not found`);
                return;
            }

            // Send the embed to the channel
            await channel.send({ embeds: [embed] });
            
            console.log(`✅ Posted sale notification: ${sale.nft_name} sold for ${sale.price_hbar} HBAR`);

        } catch (error) {
            if (error.code === 50013) {
                console.error(`❌ Missing permissions to send messages in channel ${config.DISCORD_CHANNEL_ID}`);
                console.error('Please ensure the bot has "Send Messages" and "Embed Links" permissions in the Discord channel.');
            } else {
                console.error('Error processing sale:', error.message);
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new NFTSalesBot();
