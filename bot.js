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

        // Commands disabled temporarily due to Discord permissions
        // Will implement slash commands or provide web interface for collection management
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
            let newSales = recentSales.filter(sale => {
                const saleTimestamp = new Date(sale.timestamp).getTime();
                return saleTimestamp > lastProcessedTimestamp;
            });

            // Load collections from config file and filter sales
            try {
                const fs = require('fs');
                const path = require('path');
                const collectionsPath = path.join(__dirname, 'collections.json');
                
                if (fs.existsSync(collectionsPath)) {
                    const collectionsData = JSON.parse(fs.readFileSync(collectionsPath, 'utf8'));
                    const enabledCollections = collectionsData.collections.filter(c => c.enabled);
                    
                    if (enabledCollections.length > 0) {
                        const trackedTokenIds = enabledCollections.map(c => c.tokenId);
                        newSales = newSales.filter(sale => {
                            return trackedTokenIds.includes(sale.token_id);
                        });
                        
                        console.log(`Tracking ${enabledCollections.length} collections: ${enabledCollections.map(c => c.name).join(', ')}`);
                        if (newSales.length > 0) {
                            console.log(`Found ${newSales.length} sales from tracked collections`);
                        }
                    }
                }
            } catch (error) {
                console.log('No collection filter applied - tracking all sales');
            }

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

    async handleStatusCommand(message) {
        const embed = embedUtils.createStatusEmbed(this.isMonitoring);
        const trackedCollections = storage.getTrackedCollections();
        
        if (trackedCollections.length > 0) {
            embed.addFields({
                name: '🔍 Tracked Collections',
                value: trackedCollections.map(c => `• ${c.name || 'Unknown'} (\`${c.tokenId}\`)`).join('\n') || 'None',
                inline: false
            });
        }
        
        await message.reply({ embeds: [embed] });
    }

    async handleAddCollectionCommand(message, args) {
        if (args.length < 1) {
            await message.reply('Please provide a token ID. Example: `!nft add 0.0.878200`');
            return;
        }

        const tokenId = args[0];
        const collectionName = args.slice(1).join(' ') || null;

        // Validate token ID format
        if (!tokenId.match(/^0\.0\.\d+$/)) {
            await message.reply('Invalid token ID format. Use format: `0.0.123456`');
            return;
        }

        const success = storage.addTrackedCollection(tokenId, collectionName);
        
        if (success) {
            await message.reply(`✅ Added collection **${collectionName || tokenId}** to tracking list.`);
        } else {
            await message.reply(`❌ Collection **${tokenId}** is already being tracked.`);
        }
    }

    async handleRemoveCollectionCommand(message, args) {
        if (args.length < 1) {
            await message.reply('Please provide a token ID. Example: `!nft remove 0.0.878200`');
            return;
        }

        const tokenId = args[0];
        const success = storage.removeTrackedCollection(tokenId);
        
        if (success) {
            await message.reply(`✅ Removed collection **${tokenId}** from tracking list.`);
        } else {
            await message.reply(`❌ Collection **${tokenId}** was not found in tracking list.`);
        }
    }

    async handleListCollectionsCommand(message) {
        const trackedCollections = storage.getTrackedCollections();
        
        if (trackedCollections.length === 0) {
            await message.reply('No collections are currently being tracked. Use `!nft add <token_id>` to add one.');
            return;
        }

        const embed = embedUtils.createCollectionsListEmbed(trackedCollections);
        await message.reply({ embeds: [embed] });
    }

    async handleHelpCommand(message) {
        const embed = embedUtils.createHelpEmbed();
        await message.reply({ embeds: [embed] });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new NFTSalesBot();
