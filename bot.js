/**
 * Discord bot implementation for tracking NFT sales
 */

const { Client, GatewayIntentBits, Events } = require('discord.js');
const cron = require('node-cron');
const config = require('./config');
const sentxService = require('./services/sentx');

const currencyService = require('./services/currency');
const embedUtils = require('./utils/embed');
const DatabaseStorage = require('./database-storage');

class NFTSalesBot {
    constructor(sentxService, embedUtils, currencyService, storage) {
        // Initialize services
        this.sentxService = sentxService;
        this.embedUtils = embedUtils; 
        this.currencyService = currencyService;
        this.storage = storage || new DatabaseStorage();
        
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
        this.client.once(Events.ClientReady, async () => {
            console.log(`Bot logged in as ${this.client.user.tag}!`);
            console.log(`Bot is in ${this.client.guilds.cache.size} servers`);
            
            // Debug: List all servers the bot is in
            console.log('\n📊 Connected Servers:');
            console.log('┌─────────────────────────────────────┬───────────────────────┬─────────────┐');
            console.log('│ Server Name                         │ Server ID             │ Members     │');
            console.log('├─────────────────────────────────────┼───────────────────────┼─────────────┤');
            
            this.client.guilds.cache.forEach(guild => {
                const name = guild.name.padEnd(35).substring(0, 35);
                const id = guild.id.padEnd(21);
                const members = guild.memberCount.toString().padStart(11);
                console.log(`│ ${name} │ ${id} │ ${members} │`);
            });
            
            console.log('└─────────────────────────────────────┴───────────────────────┴─────────────┘\n');
            this.generateInviteLink();
            await this.initializeDatabase();
            await this.configureExistingServers();
            await this.registerSlashCommands();
            await this.startMonitoring();
        });

        this.client.on(Events.Error, (error) => {
            console.error('Discord client error:', error);
        });

        // Handle when bot joins a new server
        this.client.on(Events.GuildCreate, async (guild) => {
            console.log(`✅ Bot added to new server: ${guild.name} (${guild.id})`);
            await this.handleNewGuild(guild);
        });

        // Handle when bot leaves a server
        this.client.on(Events.GuildDelete, async (guild) => {
            console.log(`❌ Bot removed from server: ${guild.name} (${guild.id})`);
            try {
                // Remove server configuration
                await this.storage.removeServerConfig(guild.id);
                
                // Remove all collections tracked by this server
                const serverCollections = await this.storage.getCollections(guild.id);
                for (const collection of serverCollections) {
                    await this.storage.removeCollection(guild.id, collection.token_id || collection.tokenId);
                }
                
                console.log(`🧹 Cleaned up all data for server: ${guild.name}`);
            } catch (error) {
                console.error(`Error cleaning up server data for ${guild.name}:`, error);
            }
        });

        // Handle slash commands and autocomplete
        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (interaction.isChatInputCommand()) {
                await this.handleSlashCommand(interaction);
            } else if (interaction.isAutocomplete()) {
                await this.handleAutocomplete(interaction);
            }
        });
    }

    async start() {
        try {
            // Initialize database storage first
            await this.storage.init();
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

    async startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        console.log('Starting NFT sales monitoring...');
        
        // Set initial timestamp to now to avoid posting old sales
        await this.initializeLastProcessedTimestamp();
        
        // Monitor every 3 seconds for new sales
        this.monitoringTask = cron.schedule('*/3 * * * * *', async () => {
            await this.checkForNewSales();
        });

        // Don't do initial check to avoid spam - wait for first interval
        console.log('Monitoring initialized - will check for new sales every 3 seconds');
    }

    async initializeLastProcessedTimestamp() {
        try {
            const currentTimestamp = Date.now();
            
            // Get the most recent sale timestamp from SentX to set as baseline
            const recentSales = await sentxService.getRecentSales(5);
            
            if (recentSales && recentSales.length > 0) {
                // Use the most recent sale timestamp as baseline
                const mostRecentSale = recentSales[0];
                const baselineTimestamp = new Date(mostRecentSale.timestamp).getTime();
                await this.storage.setLastProcessedSale(baselineTimestamp);
                console.log(`Set baseline timestamp to most recent sale: ${new Date(baselineTimestamp).toISOString()}`);
            } else {
                // Fallback to current time
                await this.storage.setLastProcessedSale(currentTimestamp);
                console.log(`Set baseline timestamp to current time: ${new Date(currentTimestamp).toISOString()}`);
            }
        } catch (error) {
            console.error('Error initializing timestamp:', error);
            // Fallback to current time
            await this.storage.setLastProcessedSale(Date.now());
        }
    }

    async checkForNewSales() {
        try {
            // Get all tracked collections from database first
            const allTrackedCollections = await this.storage.getCollections();
            const trackedTokenIds = allTrackedCollections.map(c => c.token_id || c.tokenId);
            
            if (trackedTokenIds.length === 0) {
                // No collections tracked, skip monitoring
                return;
            }

            // Get recent sales from SentX marketplace
            const sentxSales = await sentxService.getRecentSales();
            // Get recent listings from SentX marketplace  
            const sentxListings = await sentxService.getRecentListings();

            // Filter for only tracked collections
            const trackedSales = sentxSales.filter(sale => 
                trackedTokenIds.includes(sale.token_id || sale.tokenId)
            );
            const trackedListings = sentxListings.filter(listing => 
                trackedTokenIds.includes(listing.token_id || listing.tokenId)
            );
            
            // Only log when we actually have new data to process
            const hasNewSales = trackedSales && trackedSales.length > 0;
            const hasNewListings = trackedListings && trackedListings.length > 0;

            // Get current HBAR to USD rate
            const hbarRate = await currencyService.getHbarToUsdRate();

            // Process sales (only for tracked collections)
            if (hasNewSales) {
                await this.processNewSales(trackedSales, hbarRate);
            }

            // Process listings (only for tracked collections)  
            if (hasNewListings) {
                await this.processNewListings(trackedListings, hbarRate);
            }

        } catch (error) {
            console.error('Error checking for new sales and listings:', error);
        }
    }

    async processNewSales(sentxSales, hbarRate) {
        try {
            // Get the timestamp of the last processed sale
            const lastProcessedTimestamp = await this.storage.getLastProcessedSale();
            
            // Filter for truly new sales only (sales that happened after our last check)
            let newSales = sentxSales.filter(sale => {
                const saleTimestamp = new Date(sale.timestamp).getTime();
                const isNewer = saleTimestamp > lastProcessedTimestamp;
                
                // Additional check: sale must be within last 5 minutes to be considered "live"
                const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
                const isRecent = saleTimestamp > fiveMinutesAgo;
                
                return isNewer && isRecent;
            });

            if (newSales.length === 0) {
                return;
            }

            // Remove duplicates based on token_id, serial_number, and timestamp
            const uniqueSales = this.removeDuplicateSales(newSales);

            // Sort by timestamp to process oldest first
            uniqueSales.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            // Process each new sale
            for (const sale of uniqueSales) {
                // Create more specific unique sale ID to prevent duplicates
                const tokenId = sale.tokenId || sale.token_id || 'unknown';
                const serialNumber = sale.serialNumber || sale.serial_number || 'unknown';
                const saleTsMs = new Date(sale.timestamp).getTime();
                const transactionId = sale.saleTransactionId || sale.transaction_id || '';
                const saleId = `${tokenId}_${serialNumber}_${saleTsMs}_${transactionId}`;
                
                // Skip processing if essential data is missing
                if (!sale.tokenId && !sale.token_id) {
                    console.log(`Skipping sale due to missing token_id: ${sale.collection_name || sale.nft_name}`);
                    continue;
                }
                
                // Check if we've already processed this sale
                const alreadyProcessed = await this.storage.isSaleProcessed(saleId);
                if (alreadyProcessed) {
                    continue;
                }
                
                console.log(`🔥 NEW SALE: ${sale.collection_name || sale.nft_name} - ${sale.price_hbar} HBAR`);
                
                await this.processSale(sale, hbarRate);
                
                // Mark sale as processed to prevent duplicates - use the actual token_id from sale
                const actualTokenId = sale.tokenId || sale.token_id;
                await this.storage.markSaleProcessed(saleId, actualTokenId);
                
                // Update last processed timestamp
                const processedTsMs = new Date(sale.timestamp).getTime();
                await this.storage.setLastProcessedSale(processedTsMs);
                
                // Small delay between messages to avoid rate limiting
                await this.delay(1000);
            }
        } catch (error) {
            console.error('Error processing new sales:', error);
        }
    }

    async processNewListings(sentxListings, hbarRate) {
        try {
            // Get the timestamp of the last processed listing
            const lastProcessedTimestamp = await this.storage.getLastProcessedListing();
            
            // Filter for truly new listings only (listings that happened after our last check)
            let newListings = sentxListings.filter(listing => {
                const listingTimestamp = new Date(listing.timestamp).getTime();
                const isNewer = listingTimestamp > lastProcessedTimestamp;
                
                // Additional check: listing must be within last 15 minutes to be considered "live"
                const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
                const isRecent = listingTimestamp > fifteenMinutesAgo;
                
                return isNewer && isRecent;
            });

            if (newListings.length === 0) {
                return;
            }

            // Remove duplicates based on token_id, serial_number, and timestamp
            const uniqueListings = this.removeDuplicateListings(newListings);

            // Sort by timestamp to process oldest first
            uniqueListings.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            // Process each new listing
            for (const listing of uniqueListings) {
                // Create more specific unique listing ID to prevent duplicates
                const tokenId = listing.tokenId || listing.token_id || 'unknown';
                const serialNumber = listing.serialNumber || listing.serial_number || 'unknown';
                const listingTsMs = new Date(listing.timestamp).getTime();
                const listingId = listing.listing_id || `${tokenId}_${serialNumber}_${listingTsMs}`;
                
                // Skip processing if essential data is missing
                if (!listing.tokenId && !listing.token_id) {
                    console.log(`Skipping listing due to missing token_id: ${listing.collection_name || listing.nft_name}`);
                    continue;
                }
                
                // Check if we've already processed this listing
                const alreadyProcessed = await this.storage.isListingProcessed(listingId);
                if (alreadyProcessed) {
                    continue;
                }
                
                console.log(`📋 NEW LISTING: ${listing.collection_name || listing.nft_name} - ${listing.price_hbar} HBAR`);
                
                await this.processListing(listing, hbarRate);
                
                // Mark listing as processed to prevent duplicates - use the actual token_id from listing
                const actualTokenId = listing.tokenId || listing.token_id;
                await this.storage.markListingProcessed(listingId, actualTokenId);
                
                // Update last processed timestamp
                const processedTsMs = new Date(listing.timestamp).getTime();
                await this.storage.setLastProcessedListing(processedTsMs);
                
                // Small delay between messages to avoid rate limiting
                await this.delay(1000);
            }
        } catch (error) {
            console.error('Error processing new listings:', error);
        }
    }

    /**
     * Remove duplicate sales that might appear across multiple marketplaces
     * @param {Array} sales - Array of sales from all marketplaces
     * @returns {Array} Deduplicated sales array
     */
    removeDuplicateSales(sales) {
        const seen = new Set();
        return sales.filter(sale => {
            // Create a unique key based on token, serial, and timestamp
            const tokenId = sale.tokenId || sale.token_id;
            const serialNumber = sale.serialNumber || sale.serial_number;
            const timestamp = new Date(sale.timestamp).getTime();
            
            // Round timestamp to nearest minute to catch sales that might have slightly different timestamps
            const roundedTimestamp = Math.floor(timestamp / 60000) * 60000;
            const key = `${tokenId}_${serialNumber}_${roundedTimestamp}`;
            
            if (seen.has(key)) {
                console.log(`Removing duplicate sale: ${sale.nftName || sale.nft_name} from ${sale.marketplace}`);
                return false;
            }
            
            seen.add(key);
            return true;
        });
    }

    /**
     * Remove duplicate listings that might appear in multiple requests
     * @param {Array} listings - Array of listings
     * @returns {Array} Deduplicated listings array
     */
    removeDuplicateListings(listings) {
        const seen = new Set();
        return listings.filter(listing => {
            // Create a unique key based on token, serial, and timestamp
            const tokenId = listing.tokenId || listing.token_id;
            const serialNumber = listing.serialNumber || listing.serial_number;
            const timestamp = new Date(listing.timestamp).getTime();
            
            // Round timestamp to nearest minute to catch listings that might have slightly different timestamps
            const roundedTimestamp = Math.floor(timestamp / 60000) * 60000;
            const key = `listing_${tokenId}_${serialNumber}_${roundedTimestamp}`;
            
            if (seen.has(key)) {
                console.log(`Removing duplicate listing: ${listing.nftName || listing.nft_name} from ${listing.marketplace}`);
                return false;
            }
            
            seen.add(key);
            return true;
        });
    }

    async processSale(sale, hbarRate) {
        try {
            // Get all configured servers and channels
            const serverConfigs = await this.storage.getAllServerConfigs();
            let successCount = 0;
            let eligibleServers = 0;
            
            if (serverConfigs.length === 0) {
                console.log('❌ No servers configured for notifications');
                return;
            }
            
            console.log(`🔍 Checking ${serverConfigs.length} server(s) for collection tracking: ${sale.token_id || sale.tokenId}`);

            // Check each server to see if they track this collection
            for (const serverConfig of serverConfigs) {
                try {
                    if (!serverConfig.enabled) {
                        console.log(`  ⏸️ ${serverConfig.guildName || serverConfig.guildId}: notifications disabled`);
                        continue;
                    }
                    
                    // Check if this server tracks the collection
                    const isTracked = await this.storage.isCollectionTracked(sale.token_id || sale.tokenId, serverConfig.guildId);
                    
                    if (!isTracked) {
                        console.log(`  ⏭️ ${serverConfig.guildName || serverConfig.guildId}: collection not tracked`);
                        continue; // Skip this server if collection not tracked
                    }
                    
                    eligibleServers++;
                    console.log(`  ✅ ${serverConfig.guildName || serverConfig.guildId}: collection tracked, posting notification...`);
                    
                    const channel = this.client.channels.cache.get(serverConfig.channelId);
                    if (channel) {
                        // Add collection URL for SentX marketplace
                        if (sale.token_id) {
                            const collectionFriendlyUrl = sale.collectionFriendlyurl || sale.collection_friendly_url;
                            
                            if (collectionFriendlyUrl) {
                                sale.collection_url = `https://sentx.io/nft-marketplace/${collectionFriendlyUrl}`;
                            } else {
                                sale.collection_url = `https://sentx.io/nft-marketplace/collection/${sale.token_id}`;
                            }
                        }
                        
                        // Create Discord embed for the sale
                        const embed = await embedUtils.createSaleEmbed(sale, hbarRate);
                        const message = await channel.send({ embeds: [embed] });
                        
                        // Add fire emoji reaction
                        try {
                            await message.react('🔥');
                        } catch (error) {
                            console.log('Could not add reaction:', error.message);
                        }
                        
                        successCount++;
                        console.log(`    📤 Posted to #${channel.name}`);
                    } else {
                        console.log(`    ❌ Channel not found: ${serverConfig.channelId}`);
                    }
                } catch (error) {
                    console.error(`    ❌ Failed to post to server ${serverConfig.guildName || serverConfig.guildId}:`, error.message);
                }
            }
            
            if (successCount > 0) {
                console.log(`🔥 Posted sale notification to ${successCount}/${eligibleServers} eligible server(s): ${sale.nft_name} sold for ${sale.price_hbar} HBAR`);
            } else if (eligibleServers > 0) {
                console.log(`⚠️ Failed to post to any of ${eligibleServers} eligible server(s)`);
            }

        } catch (error) {
            console.error('Error processing sale:', error.message);
        }
    }

    async processListing(listing, hbarRate) {
        try {
            // Get all configured servers and channels
            const serverConfigs = await this.storage.getAllServerConfigs();
            let successCount = 0;
            let eligibleServers = 0;
            
            if (serverConfigs.length === 0) {
                console.log('❌ No servers configured for listing notifications');
                return;
            }
            
            console.log(`🔍 Checking ${serverConfigs.length} server(s) for collection tracking: ${listing.token_id || listing.tokenId}`);

            // Check each server to see if they track this collection
            for (const serverConfig of serverConfigs) {
                try {
                    if (!serverConfig.enabled) {
                        console.log(`  ⏸️ ${serverConfig.guildName || serverConfig.guildId}: notifications disabled`);
                        continue;
                    }
                    
                    // Check if this server tracks the collection
                    const isTracked = await this.storage.isCollectionTracked(listing.token_id || listing.tokenId, serverConfig.guildId);
                    
                    if (!isTracked) {
                        console.log(`  ⏭️ ${serverConfig.guildName || serverConfig.guildId}: collection not tracked`);
                        continue; // Skip this server if collection not tracked
                    }
                    
                    eligibleServers++;
                    console.log(`  ✅ ${serverConfig.guildName || serverConfig.guildId}: collection tracked, posting listing...`);
                    
                    // Use separate listings channel if configured, otherwise use main channel
                    const channelId = serverConfig.listingsChannelId || serverConfig.channelId;
                    const channel = this.client.channels.cache.get(channelId);
                    const channelType = serverConfig.listingsChannelId ? 'listings' : 'main';
                    
                    if (channel) {
                        // Add collection URL for SentX marketplace (collection page, not specific NFT)
                        if (listing.token_id) {
                            const collectionFriendlyUrl = listing.collectionFriendlyurl || listing.collection_friendly_url;
                            
                            if (collectionFriendlyUrl) {
                                listing.collection_url = `https://sentx.io/nft-marketplace/${collectionFriendlyUrl}`;
                            } else {
                                listing.collection_url = `https://sentx.io/nft-marketplace/collection/${listing.token_id}`;
                            }
                        }
                        
                        // Create Discord embed for the listing
                        const embed = await embedUtils.createListingEmbed(listing, hbarRate);
                        const message = await channel.send({ embeds: [embed] });
                        
                        // Add listing emoji reaction
                        try {
                            await message.react('📝');
                        } catch (error) {
                            console.log('Could not add reaction:', error.message);
                        }
                        
                        successCount++;
                        console.log(`    📝 Posted to #${channel.name} (${channelType} channel)`);
                    } else {
                        console.log(`    ❌ Channel not found: ${channelId} (${channelType})`);
                    }
                } catch (error) {
                    console.error(`    ❌ Failed to post listing to server ${serverConfig.guildName || serverConfig.guildId}:`, error.message);
                }
            }
            
            if (successCount > 0) {
                console.log(`📝 Posted listing notification to ${successCount}/${eligibleServers} eligible server(s): ${listing.nft_name} listed for ${listing.price_hbar} HBAR`);
            } else if (eligibleServers > 0) {
                console.log(`⚠️ Failed to post listing to any of ${eligibleServers} eligible server(s)`);
            }

        } catch (error) {
            console.error('Error processing listing:', error.message);
        }
    }

    async handleStatusCommand(message) {
        const embed = embedUtils.createStatusEmbed(this.isMonitoring);
        const trackedCollections = await this.storage.getTrackedCollections();
        
        if (trackedCollections.length > 0) {
            embed.addFields({
                name: '🔍 Tracked Collections',
                value: trackedCollections.map(c => `• ${c.name || 'Unknown'} (\`${c.token_id || c.tokenId}\`)`).join('\n') || 'None',
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

        const success = await this.storage.addTrackedCollection(message.guild.id, tokenId, collectionName);
        
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
        const success = await this.storage.removeTrackedCollection(message.guild.id, tokenId);
        
        if (success) {
            await message.reply(`✅ Removed collection **${tokenId}** from tracking list.`);
        } else {
            await message.reply(`❌ Collection **${tokenId}** was not found in tracking list.`);
        }
    }

    async handleListCollectionsCommand(message) {
        const trackedCollections = await this.storage.getTrackedCollections(message.guild.id);
        
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

    generateInviteLink() {
        try {
            // Generate invite link with necessary permissions
            const permissions = [
                'SendMessages',
                'EmbedLinks',
                'ViewChannel'
            ];
            
            const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${this.client.user.id}&permissions=19520&scope=bot%20applications.commands`;
            console.log('\n🔗 Invite Link for Other Servers:');
            console.log(inviteLink);
            console.log('\nRequired Permissions: View Channel, Send Messages, Embed Links, Add Reactions, Use Slash Commands\n');
            
            return inviteLink;
        } catch (error) {
            console.error('Error generating invite link:', error);
        }
    }

    async configureExistingServers() {
        try {
            console.log('Checking existing servers for configuration...');
            const guilds = this.client.guilds.cache;
            
            for (const [guildId, guild] of guilds) {
                // Check if server is already configured
                const existingConfig = await this.storage.getServerConfig(guildId);
                
                if (!existingConfig) {
                    console.log(`Configuring server: ${guild.name}`);
                    await this.setupServerConfig(guild, false); // Don't send welcome message for existing servers
                }
            }
        } catch (error) {
            console.error('Error configuring existing servers:', error);
        }
    }

    async setupServerConfig(guild, sendWelcome = true) {
        try {
            // Find the first text channel where the bot can send messages
            const textChannels = guild.channels.cache.filter(channel => 
                channel.type === 0 && // Text channel
                channel.permissionsFor(guild.members.me).has(['SendMessages', 'EmbedLinks'])
            );

            if (textChannels.size > 0) {
                const firstChannel = textChannels.first();
                
                // Save server configuration
                await this.storage.setServerConfig(guild.id, firstChannel.id, guild.name, true);
                
                if (sendWelcome) {
                    // Send welcome message
                    const welcomeEmbed = {
                        title: '🤖 NFT Sales Bot Added!',
                        description: `Thank you for adding the NFT Sales Bot to **${guild.name}**!`,
                        color: 0x00ff00,
                        fields: [
                            {
                                name: '📈 What I Do',
                                value: 'I track real-time NFT sales from SentX marketplace on Hedera and post detailed notifications here.',
                                inline: false
                            },
                            {
                                name: '⚙️ Setup Instructions',
                                value: '1. Use `/add` to add NFT collections to track\n2. Use `/list` to see tracked collections\n3. Use `/remove` to stop tracking collections\n4. Use `/status` to check bot status',
                                inline: false
                            },
                            {
                                name: '💰 Features',
                                value: '• Real-time sale notifications\n• HBAR to USD conversion\n• NFT images and details\n• Buyer/seller information\n• Collection filtering',
                                inline: false
                            }
                        ],
                        timestamp: new Date().toISOString(),
                        footer: { text: 'Built for Hedera by Mauii - Migos World Labs Inc' }
                    };
                    await firstChannel.send({ embeds: [welcomeEmbed] });
                }
                
                console.log(`Configured server ${guild.name} with channel #${firstChannel.name}`);
            } else {
                console.log(`No suitable channel found in server ${guild.name} - bot needs Send Messages permission`);
            }
        } catch (error) {
            console.error(`Error setting up guild ${guild.name}:`, error);
        }
    }

    async handleNewGuild(guild) {
        console.log(`✅ Bot added to new server: ${guild.name} (${guild.id})`);
        await this.setupServerConfig(guild, true);
    }

    async registerSlashCommands() {
        const { REST, Routes } = require('discord.js');
        const rest = new REST().setToken(config.DISCORD_TOKEN);

        const commands = [
            {
                name: 'add',
                description: 'Add an NFT collection to track',
                options: [
                    {
                        name: 'token_id',
                        type: 3, // STRING
                        description: 'Token ID of the collection (e.g., 0.0.878200)',
                        required: true
                    },
                    {
                        name: 'name',
                        type: 3, // STRING
                        description: 'Name of the collection',
                        required: false
                    }
                ]
            },
            {
                name: 'remove',
                description: 'Remove an NFT collection from tracking',
                options: [
                    {
                        name: 'token_id',
                        type: 3, // STRING
                        description: 'Token ID of the collection to remove',
                        required: true
                    }
                ]
            },
            {
                name: 'remove-all',
                description: 'Remove ALL tracked collections from this server (requires confirmation)'
            },
            {
                name: 'list',
                description: 'List all tracked NFT collections'
            },
            {
                name: 'status',
                description: 'Show bot status and monitoring information'
            },
            {
                name: 'set-listings-channel',
                description: 'Set a separate channel for NFT listing notifications',
                options: [
                    {
                        name: 'channel',
                        type: 7, // CHANNEL
                        description: 'The channel where listing notifications should be sent',
                        required: true
                    }
                ]
            },
            {
                name: 'test',
                description: 'Test the bot functionality',
                options: [
                    {
                        name: 'type',
                        type: 3, // STRING
                        description: 'Type of test to run',
                        required: false,
                        choices: [
                            {
                                name: 'Latest Sale from Tracked Collections',
                                value: 'tracked-sale'
                            },
                            {
                                name: 'Latest Listing from Tracked Collections',
                                value: 'tracked-listing'
                            },
                            {
                                name: 'Recent Marketplace Sale',
                                value: 'recent-sale'
                            },
                            {
                                name: 'Recent Marketplace Listing',
                                value: 'recent-listing'
                            }
                        ]
                    },
                    {
                        name: 'collection',
                        type: 3, // STRING
                        description: 'Token ID of collection to test (for listing tests)',
                        required: false
                    }
                ]
            },
            {
                name: 'analytics',
                description: 'View comprehensive NFT analytics and market insights',
                options: [
                    {
                        name: 'type',
                        type: 3, // STRING
                        description: 'Type of analytics to display',
                        required: true,
                        choices: [
                            {
                                name: '📋 View All Analytics - Complete comprehensive analysis',
                                value: 'view-all'
                            },
                            {
                                name: '📊 Core Statistics - All-time volume, sales, prices',
                                value: 'core-stats'
                            },
                            {
                                name: '🔬 Advanced Metrics - Historical velocity, volatility, whale activity',
                                value: 'advanced-metrics'
                            },
                            {
                                name: '💹 Price Distribution - All-time price range breakdown',
                                value: 'price-distribution'
                            },
                            {
                                name: '📈 Market Health - Historical trends, momentum, liquidity',
                                value: 'market-health'
                            },
                            {
                                name: '💡 Quick Buy Recommendations - AI-powered all-time analysis',
                                value: 'recommendations'
                            },
                            {
                                name: '🌐 Market Overview - Complete marketplace summary',
                                value: 'market-overview'
                            }
                        ]
                    },
                    {
                        name: 'collection',
                        type: 3, // STRING
                        description: 'Select a specific collection (leave empty for all tracked)',
                        required: false,
                        autocomplete: true
                    }
                ]
            }
        ];

        try {
            console.log('Cleaning up and registering slash commands...');
            
            // First, clear all existing guild commands to remove duplicates
            for (const guild of this.client.guilds.cache.values()) {
                try {
                    await rest.put(
                        Routes.applicationGuildCommands(this.client.user.id, guild.id),
                        { body: [] }
                    );
                    console.log(`Cleared guild commands for: ${guild.name}`);
                } catch (guildError) {
                    console.error(`Error clearing guild commands for ${guild.name}:`, guildError);
                }
            }
            
            // Register commands globally only (avoids duplicates)
            await rest.put(
                Routes.applicationCommands(this.client.user.id),
                { body: commands }
            );
            
            console.log('Successfully registered slash commands globally');
        } catch (error) {
            console.error('Error registering slash commands:', error);
        }
    }

    async handleSlashCommand(interaction) {
        try {
            const { commandName, options } = interaction;

            switch (commandName) {
                case 'add':
                    await this.handleAddCommand(interaction, options);
                    break;
                case 'remove':
                    await this.handleRemoveCommand(interaction, options);
                    break;
                case 'remove-all':
                    await this.handleRemoveAllCommand(interaction);
                    break;
                case 'list':
                    await this.handleListCommand(interaction);
                    break;
                case 'status':
                    await this.handleStatusSlashCommand(interaction);
                    break;
                case 'test':
                    await this.handleTestCommand(interaction);
                    break;
                case 'set-listings-channel':
                    await this.handleSetListingsChannelCommand(interaction, options);
                    break;
                case 'analytics':
                    await this.handleAnalyticsCommand(interaction, options);
                    break;
                default:
                    await interaction.reply('Unknown command');
            }
        } catch (error) {
            console.error('Error handling slash command:', error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: 'An error occurred while processing the command.',
                        ephemeral: true
                    });
                } else if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply('An error occurred while processing the command.');
                }
            } catch (responseError) {
                console.error('Error responding to interaction:', responseError);
            }
        }
    }

    async handleAddCommand(interaction, options) {
        try {
            // Check if interaction has expired
            if (!interaction.isRepliable()) {
                console.log('Interaction expired before handling add command');
                return;
            }

            const tokenId = options.getString('token_id');
            const name = options.getString('name') || 'Unknown Collection';
            const guildId = interaction.guildId;

            // Validate token ID format
            if (!tokenId.match(/^0\.0\.\d+$/)) {
                if (interaction.isRepliable()) {
                    await interaction.reply({
                        content: '❌ Invalid token ID format. Please use format: 0.0.123456',
                        ephemeral: true
                    });
                }
                return;
            }

            const result = await this.storage.addCollection(guildId, tokenId, name, true);
            
            if (!interaction.isRepliable()) {
                console.log('Interaction expired while processing add command');
                return;
            }
            
            if (result) {
                await interaction.reply({
                    content: `✅ Added **${name}** (${tokenId}) to this server's tracking list!`,
                    ephemeral: false
                });
            } else {
                await interaction.reply({
                    content: '❌ This collection is already being tracked in this server.',
                    ephemeral: true
                });
            }

        } catch (error) {
            console.error('Error adding collection:', error);
            try {
                if (interaction.isRepliable()) {
                    await interaction.reply({
                        content: '❌ Error adding collection. Please try again.',
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                console.error('Failed to reply to add command error:', replyError.message);
            }
        }
    }

    async handleRemoveCommand(interaction, options) {
        try {
            if (!interaction.isRepliable()) {
                console.log('Interaction expired before handling remove command');
                return;
            }

            const tokenId = options.getString('token_id');
            const guildId = interaction.guildId;

            const success = await this.storage.removeCollection(guildId, tokenId);
            
            if (!interaction.isRepliable()) {
                console.log('Interaction expired while processing remove command');
                return;
            }
            
            if (success) {
                await interaction.reply({
                    content: `✅ Removed collection **${tokenId}** from this server's tracking list.`,
                    ephemeral: false
                });
            } else {
                await interaction.reply({
                    content: `❌ Collection **${tokenId}** was not found in this server's tracking list.`,
                    ephemeral: true
                });
            }

        } catch (error) {
            console.error('Error removing collection:', error);
            try {
                if (interaction.isRepliable()) {
                    await interaction.reply({
                        content: '❌ Error removing collection. Please try again.',
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                console.error('Failed to reply to remove command error:', replyError.message);
            }
        }
    }

    async handleRemoveAllCommand(interaction) {
        const guildId = interaction.guildId;

        try {
            // Get current tracked collections
            const trackedCollections = await this.storage.getCollections(guildId);
            
            if (!trackedCollections || trackedCollections.length === 0) {
                await interaction.reply({
                    content: '❌ No collections are currently being tracked in this server.',
                    ephemeral: true
                });
                return;
            }

            // Create confirmation embed with current collections
            const collectionList = trackedCollections.map((collection, index) => 
                `${index + 1}. **${collection.name}** (${collection.token_id || collection.tokenId})`
            ).join('\n');

            const confirmEmbed = {
                title: '⚠️ Remove All Collections - Confirmation Required',
                description: `Are you sure you want to remove ALL tracked collections from this server?\n\n**Currently tracked collections:**\n${collectionList}\n\n**This action cannot be undone.**`,
                color: 0xff6600, // Orange warning color
                footer: { text: 'Use the buttons below to confirm or cancel' }
            };

            // Create confirmation buttons
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            
            const confirmButton = new ButtonBuilder()
                .setCustomId('remove_all_confirm')
                .setLabel('Yes, Remove All')
                .setStyle(ButtonStyle.Danger);

            const cancelButton = new ButtonBuilder()
                .setCustomId('remove_all_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder()
                .addComponents(confirmButton, cancelButton);

            await interaction.reply({
                embeds: [confirmEmbed],
                components: [row],
                ephemeral: false
            });

            // Wait for button interaction
            const filter = (buttonInteraction) => {
                return ['remove_all_confirm', 'remove_all_cancel'].includes(buttonInteraction.customId) && 
                       buttonInteraction.user.id === interaction.user.id;
            };

            try {
                const buttonInteraction = await interaction.awaitMessageComponent({ 
                    filter, 
                    time: 30000 // 30 seconds timeout
                });

                if (buttonInteraction.customId === 'remove_all_confirm') {
                    // Remove all collections
                    let removedCount = 0;
                    for (const collection of trackedCollections) {
                        const tokenId = collection.token_id || collection.tokenId;
                        const removed = await this.storage.removeCollection(guildId, tokenId);
                        if (removed) removedCount++;
                    }

                    const successEmbed = {
                        title: '✅ All Collections Removed',
                        description: `Successfully removed **${removedCount}** collections from tracking in this server.`,
                        color: 0x00ff00, // Green success color
                        timestamp: new Date().toISOString()
                    };

                    await buttonInteraction.update({
                        embeds: [successEmbed],
                        components: [] // Remove buttons
                    });

                } else if (buttonInteraction.customId === 'remove_all_cancel') {
                    const cancelEmbed = {
                        title: '❌ Action Cancelled',
                        description: 'Remove all collections operation was cancelled. All collections remain tracked.',
                        color: 0x888888, // Gray color
                        timestamp: new Date().toISOString()
                    };

                    await buttonInteraction.update({
                        embeds: [cancelEmbed],
                        components: [] // Remove buttons
                    });
                }

            } catch (timeoutError) {
                // Handle timeout
                const timeoutEmbed = {
                    title: '⏰ Confirmation Timeout',
                    description: 'Remove all collections confirmation timed out. No changes were made.',
                    color: 0x888888, // Gray color
                    timestamp: new Date().toISOString()
                };

                await interaction.editReply({
                    embeds: [timeoutEmbed],
                    components: [] // Remove buttons
                });
            }

        } catch (error) {
            console.error('Error in remove all command:', error);
            await interaction.reply({
                content: '❌ Error processing remove all command. Please try again.',
                ephemeral: true
            });
        }
    }

    async handleListCommand(interaction) {
        try {
            if (!interaction.isRepliable()) {
                console.log('Interaction expired before handling list command');
                return;
            }

            const guildId = interaction.guildId;
            const collections = await this.storage.getCollections(guildId);

            if (!interaction.isRepliable()) {
                console.log('Interaction expired while processing list command');
                return;
            }

            if (collections.length === 0) {
                await interaction.reply({
                    content: 'No collections are currently being tracked in this server. Use `/add` to add one.',
                    ephemeral: true
                });
                return;
            }

            const embed = {
                title: '📋 Tracked NFT Collections (This Server)',
                color: 0x0099ff,
                fields: [],
                footer: { text: `Total: ${collections.length} collection(s)` },
                timestamp: new Date().toISOString()
            };

            collections.forEach((collection, index) => {
                const status = collection.enabled ? '✅ Enabled' : '❌ Disabled';
                embed.fields.push({
                    name: `${index + 1}. ${collection.name}`,
                    value: `Token ID: \`${collection.tokenId}\`\nStatus: ${status}`,
                    inline: true
                });
            });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error listing collections:', error);
            try {
                if (interaction.isRepliable()) {
                    await interaction.reply({
                        content: '❌ Error loading collections. Please try again.',
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                console.error('Failed to reply to list command error:', replyError.message);
            }
        }
    }

    async handleStatusSlashCommand(interaction) {
        try {
            if (!interaction.isRepliable()) {
                console.log('Interaction expired before handling status command');
                return;
            }

            const serverConfigs = await this.storage.getAllServerConfigs();
            const hbarRate = await currencyService.getHbarToUsdRate();

            if (!interaction.isRepliable()) {
                console.log('Interaction expired while processing status command');
                return;
            }

            const embed = {
                title: '🤖 Bot Status',
                color: this.isMonitoring ? 0x00ff00 : 0xff0000,
                fields: [
                    {
                        name: '📊 Monitoring Status',
                        value: this.isMonitoring ? '✅ Active' : '❌ Inactive',
                        inline: true
                    },
                    {
                        name: '🏦 HBAR Rate',
                        value: `$${hbarRate.toFixed(4)} USD`,
                        inline: true
                    },
                    {
                        name: '🌐 Connected Servers',
                        value: `${serverConfigs.length} servers`,
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: { text: 'NFT Sales Bot' }
            };

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error handling status command:', error);
            try {
                if (interaction.isRepliable()) {
                    await interaction.reply({
                        content: '❌ Error loading status. Please try again.',
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                console.error('Failed to reply to status command error:', replyError.message);
            }
        }
    }

    async handleTestCommand(interaction) {
        try {
            const testType = interaction.options?.getString('type') || 'tracked-sale';
            console.log(`Test command triggered with type: ${testType}`);
            
            // Check if interaction is still valid and defer immediately
            if (!interaction.isRepliable()) {
                console.log('Interaction expired before test command could start');
                return;
            }
            
            // Defer reply immediately to prevent timeout
            try {
                await interaction.deferReply();
            } catch (deferError) {
                console.log('Failed to defer interaction:', deferError.message);
                if (deferError.code === 10062 || deferError.code === 40060) {
                    console.log('Interaction already expired or acknowledged');
                    return;
                }
                throw deferError;
            }
            
            // Route to appropriate test method
            let embed;
            if (testType === 'tracked-listing') {
                console.log('Executing tracked collection listing test...');
                embed = await this.getTestListingEmbed(interaction.guildId);
            } else if (testType === 'recent-sale') {
                console.log('Testing most recent marketplace sale...');
                embed = await this.getTestRecentSaleEmbed();
            } else if (testType === 'recent-listing') {
                console.log('Testing most recent marketplace listing...');
                embed = await this.getTestRecentListingEmbed();
            } else {
                // Default: tracked-sale
                console.log('Testing latest sale from tracked collections...');
                embed = await this.getTestTrackedSaleEmbed(interaction.guildId);
            }
            
            // Send the response with timeout protection
            if (interaction.isRepliable()) {
                try {
                    await interaction.editReply({
                        embeds: [embed]
                    });
                } catch (replyError) {
                    if (replyError.code === 10062 || replyError.code === 40060) {
                        console.log('Interaction expired while sending test result');
                    } else {
                        throw replyError;
                    }
                }
            } else {
                console.log('Interaction no longer repliable, skipping response');
            }
            
        } catch (error) {
            console.error('Error in test command:', error);
            
            // Only try to reply if interaction is still valid
            if (interaction.isRepliable() && error.code !== 10062 && error.code !== 40060) {
                try {
                    const errorEmbed = this.embedUtils.createErrorEmbed(
                        'Test Command Failed',
                        'An error occurred while running the test command.',
                        error.message
                    );
                    
                    await interaction.editReply({
                        embeds: [errorEmbed]
                    });
                } catch (replyError) {
                    console.error('Failed to send error reply:', replyError);
                }
            } else {
                console.log('Interaction expired, unable to send error message');
            }
        }
    }



    async handleSetListingsChannelCommand(interaction, options) {
        try {
            const channel = options.getChannel('channel');
            const guildId = interaction.guildId;

            // Validate channel type (must be text channel)
            if (channel.type !== 0) {
                await interaction.reply({
                    content: '❌ Please select a text channel for listing notifications.',
                    ephemeral: true
                });
                return;
            }

            // Check if bot has permissions in the channel
            const botMember = interaction.guild.members.me;
            const permissions = channel.permissionsFor(botMember);
            
            if (!permissions.has(['SendMessages', 'EmbedLinks'])) {
                await interaction.reply({
                    content: '❌ I need "Send Messages" and "Embed Links" permissions in that channel.',
                    ephemeral: true
                });
                return;
            }

            // Update the server config with listings channel
            const success = await this.storage.setListingsChannel(guildId, channel.id);
            
            if (success) {
                await interaction.reply({
                    content: `✅ Listings channel set to ${channel}!\n\n📝 **New listings** will now be posted in ${channel}\n🔥 **Sales notifications** will continue in your main channel\n\nUse the same command again to change the listings channel.`,
                    ephemeral: false
                });
            } else {
                await interaction.reply({
                    content: '❌ Failed to set listings channel. Make sure the bot is properly configured in this server.',
                    ephemeral: true
                });
            }

        } catch (error) {
            console.error('Error setting listings channel:', error);
            await interaction.reply({
                content: '❌ An error occurred while setting the listings channel. Please try again.',
                ephemeral: true
            });
        }
    }

    async initializeDatabase() {
        try {
            console.log('Initializing database storage...');
            await this.storage.init();
            
            // Clean up old processed sales on startup (older than 3 days)
            console.log('Cleaning up old processed sales...');
            await this.storage.cleanupOldProcessedSales();
            
            console.log('Database storage ready');
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getTestListingEmbed(guildId) {
        try {
            console.log('Creating test listing embed...');
            
            // Get tracked collections for this server
            const trackedCollections = await this.storage.getCollections(guildId);
            
            if (!trackedCollections || trackedCollections.length === 0) {
                return this.embedUtils.createErrorEmbed(
                    'No Collections Tracked',
                    'No collections are being tracked in this server. Use `/add` to track collections first.'
                );
            }
            
            // Use all tracked collections
            const targetTokenIds = trackedCollections.map(c => c.token_id || c.tokenId);
            console.log(`Looking for listings from ${targetTokenIds.length} tracked collections:`, targetTokenIds);
            
            // Get all listings from SentX (without time filter for testing)
            const allListings = await sentxService.getRecentListings(100, true);
            
            if (!allListings || allListings.length === 0) {
                return this.embedUtils.createErrorEmbed(
                    'No Listings Found',
                    'No listings found from SentX marketplace'
                );
            }
            
            // Filter for listings from target collections
            const targetListings = allListings.filter(listing => 
                targetTokenIds.includes(listing.token_id || listing.tokenId)
            );
            
            if (targetListings.length === 0) {
                const collectionNames = trackedCollections.map(c => c.name).join(', ');
                return this.embedUtils.createErrorEmbed(
                    'No Listings From Tracked Collections',
                    `No listings found for your tracked collections: ${collectionNames}\n\nThese collections may not have any active listings currently.`
                );
            }
            
            // Get the most recent listing
            const testListing = targetListings[0];
            const collectionName = trackedCollections.find(c => 
                (c.token_id || c.tokenId) === (testListing.token_id || testListing.tokenId)
            )?.name || testListing.collection_name;
            
            console.log(`Using listing for testing: ${testListing.nft_name} from ${collectionName}`);
            
            // Get HBAR rate
            const hbarRate = await currencyService.getHbarToUsdRate();
            
            // Ensure collection URL points to collection, not specific NFT
            if (!testListing.collection_url || testListing.collection_url.includes('undefined')) {
                testListing.collection_url = testListing.collectionFriendlyurl 
                    ? `https://sentx.io/nft-marketplace/${testListing.collectionFriendlyurl}`
                    : `https://sentx.io/nft-marketplace/collection/${testListing.token_id}`;
            }
            
            // Create a listing embed to test the formatting
            return await embedUtils.createListingEmbed(testListing, hbarRate);
            
        } catch (error) {
            console.error('Error creating test listing embed:', error);
            return this.embedUtils.createErrorEmbed(
                'Test Failed',
                'Error occurred while testing listing functionality',
                error.message
            );
        }
    }

    async getTestTrackedSaleEmbed(guildId) {
        try {
            console.log('Creating test sale embed from tracked collections...');
            
            // Get tracked collections for this server
            const trackedCollections = await this.storage.getCollections(guildId);
            
            if (!trackedCollections || trackedCollections.length === 0) {
                return this.embedUtils.createErrorEmbed(
                    'No Collections Tracked',
                    'No collections are being tracked in this server. Use `/add` to track collections first.'
                );
            }
            
            // Get recent sales from SentX
            const recentSales = await sentxService.getRecentSales(100);
            
            if (!recentSales || recentSales.length === 0) {
                return this.embedUtils.createErrorEmbed(
                    'No Recent Sales',
                    'No recent sales found on SentX marketplace'
                );
            }
            
            // Find sales from tracked collections
            const trackedTokenIds = trackedCollections.map(c => c.token_id || c.tokenId);
            const trackedSales = recentSales.filter(sale => trackedTokenIds.includes(sale.token_id));
            
            if (trackedSales.length === 0) {
                const collectionNames = trackedCollections.map(c => c.name).join(', ');
                return this.embedUtils.createErrorEmbed(
                    'No Sales From Tracked Collections',
                    `No recent sales found for your tracked collections: ${collectionNames}\n\nThese collections may not have had any sales recently.`
                );
            }
            
            // Use the most recent sale from tracked collections
            const testSale = trackedSales[0];
            const collectionName = trackedCollections.find(c => 
                (c.token_id || c.tokenId) === testSale.token_id
            )?.name || testSale.collection_name;
            
            // Ensure collection URL is set
            if (!testSale.collection_url) {
                testSale.collection_url = testSale.collectionFriendlyurl 
                    ? `https://sentx.io/nft-marketplace/${testSale.collectionFriendlyurl}`
                    : `https://sentx.io/nft-marketplace/collection/${testSale.token_id}`;
            }
            
            console.log(`Using sale for testing: ${testSale.nft_name} from ${collectionName}`);
            
            // Get HBAR rate
            const hbarRate = await currencyService.getHbarToUsdRate();
            
            // Create sale embed
            return await embedUtils.createSaleEmbed(testSale, hbarRate);
            
        } catch (error) {
            console.error('Error creating test sale embed:', error);
            return this.embedUtils.createErrorEmbed(
                'Test Failed',
                'Error testing tracked collection sale',
                error.message
            );
        }
    }

    async getTestRecentSaleEmbed() {
        try {
            console.log('Testing most recent sale from marketplace...');
            
            // Get recent sales from SentX
            const recentSales = await sentxService.getRecentSales(50);
            
            if (!recentSales || recentSales.length === 0) {
                await interaction.editReply('❌ No recent sales found on SentX marketplace');
                return;
            }
            
            // Use the most recent sale
            const testSale = recentSales[0];
            
            // Ensure collection URL is set
            if (!testSale.collection_url) {
                testSale.collection_url = testSale.collectionFriendlyurl 
                    ? `https://sentx.io/nft-marketplace/${testSale.collectionFriendlyurl}`
                    : `https://sentx.io/nft-marketplace/collection/${testSale.token_id}`;
            }
            
            console.log(`Using most recent sale for testing: ${testSale.nft_name} from ${testSale.collection_name}`);
            
            // Get HBAR rate
            const hbarRate = await currencyService.getHbarToUsdRate();
            
            // Create sale embed
            const embed = await embedUtils.createSaleEmbed(testSale, hbarRate);
            
            await interaction.editReply({
                content: `📈 **Most Recent Sale on SentX:**\n*Showing the latest NFT sale from the marketplace*`,
                embeds: [embed]
            });
            
            console.log('Most recent sale test completed successfully!');
            
        } catch (error) {
            console.error('Error testing most recent sale:', error);
            try {
                if (error.code === 10062 || error.code === 40060) {
                    console.log('Interaction expired during recent sale test');
                } else {
                    await interaction.editReply(`❌ Error testing most recent sale: ${error.message}`);
                }
            } catch (responseError) {
                console.error('Could not respond to recent sale test interaction:', responseError.message);
            }
        }
    }
    
    async getTestRecentListingEmbed() {
        try {
            console.log('Testing most recent listing from marketplace...');
            
            // Get recent listings from SentX
            const recentListings = await sentxService.getRecentListings(50, true);
            
            if (!recentListings || recentListings.length === 0) {
                await interaction.editReply('❌ No recent listings found on SentX marketplace');
                return;
            }
            
            // Use the most recent listing
            const testListing = recentListings[0];
            
            // Ensure collection URL points to collection, not specific NFT
            if (!testListing.collection_url || testListing.collection_url.includes('undefined')) {
                testListing.collection_url = testListing.collectionFriendlyurl 
                    ? `https://sentx.io/nft-marketplace/${testListing.collectionFriendlyurl}`
                    : `https://sentx.io/nft-marketplace/collection/${testListing.token_id}`;
            }
            
            console.log(`Using most recent listing for testing: ${testListing.nft_name} from ${testListing.collection_name}`);
            
            // Get HBAR rate
            const hbarRate = await currencyService.getHbarToUsdRate();
            
            // Create listing embed
            const embed = await embedUtils.createListingEmbed(testListing, hbarRate);
            
            await interaction.editReply({
                content: `📝 **Most Recent Listing on SentX:**\n*Showing the latest NFT listing from the marketplace*`,
                embeds: [embed]
            });
            
            console.log('Most recent listing test completed successfully!');
            
        } catch (error) {
            console.error('Error testing most recent listing:', error);
            try {
                if (error.code === 10062 || error.code === 40060) {
                    console.log('Interaction expired during recent listing test');
                } else {
                    await interaction.editReply(`❌ Error testing most recent listing: ${error.message}`);
                }
            } catch (responseError) {
                console.error('Could not respond to recent listing test interaction:', responseError.message);
            }
        }
    }

    async handleAutocomplete(interaction) {
        try {
            if (interaction.commandName === 'analytics' && interaction.options.getFocused(true).name === 'collection') {
                const guildId = interaction.guildId;
                const focusedValue = interaction.options.getFocused().toLowerCase();
                
                // Get tracked collections for this server
                const trackedCollections = await this.storage.getCollections(guildId, true);
                
                // Debug log
                console.log(`Autocomplete: Found ${trackedCollections.length} collections for guild ${guildId}`);
                
                let choices = [];
                
                // Always include "All Collections" option first
                if (!focusedValue || focusedValue === '' || 'all collections'.toLowerCase().includes(focusedValue)) {
                    choices.push({
                        name: '📊 All Tracked Collections',
                        value: 'all'
                    });
                }
                
                // Add individual collections
                const collectionChoices = trackedCollections
                    .filter(col => {
                        // Check for tokenId field (Drizzle ORM field name)
                        const tokenId = col.tokenId || col.token_id; // Support both field names
                        if (!tokenId) {
                            console.log(`Skipping collection with missing tokenId:`, col);
                            return false;
                        }
                        
                        const name = (col.name || '').toLowerCase();
                        const tokenIdLower = tokenId.toLowerCase();
                        return name.includes(focusedValue) || tokenIdLower.includes(focusedValue);
                    })
                    .slice(0, 23) // Leave room for "All Collections"
                    .map(col => {
                        const tokenId = col.tokenId || col.token_id; // Support both field names
                        const choice = {
                            name: `${col.name || 'Unknown'} (${tokenId})`.substring(0, 100),
                            value: tokenId
                        };
                        console.log(`Adding collection choice:`, choice);
                        return choice;
                    });
                
                choices = choices.concat(collectionChoices);
                
                console.log(`Responding with ${choices.length} choices`);
                await interaction.respond(choices);
            }
        } catch (error) {
            console.error('Error handling autocomplete:', error);
            try {
                await interaction.respond([{
                    name: '❌ Error loading collections',
                    value: 'error'
                }]);
            } catch (responseError) {
                console.error('Failed to respond to autocomplete:', responseError);
            }
        }
    }

    async handleAnalyticsCommand(interaction, options) {
        try {
            // Check if interaction is still valid before starting
            if (!interaction.isRepliable()) {
                console.log('Analytics interaction expired before processing');
                return;
            }
            
            // Defer immediately to prevent timeout
            try {
                await interaction.deferReply();
            } catch (deferError) {
                if (deferError.code === 10062 || deferError.code === 40060) {
                    console.log('Analytics interaction expired during defer:', deferError.code);
                    return;
                }
                throw deferError;
            }

            const analyticsType = options.getString('type');
            const collectionTokenId = options.getString('collection');
            const days = 365; // All-time data (1 year)
            const guildId = interaction.guildId;

            let tokenIds = [];
            let collectionNames = [];

            // If specific collection is requested, use that; otherwise use tracked collections
            if (collectionTokenId && collectionTokenId !== 'all') {
                // Validate that the collection is tracked in this server
                const trackedCollections = await this.storage.getCollections(guildId, true);
                const isTracked = trackedCollections.some(col => (col.tokenId || col.token_id) === collectionTokenId);
                
                if (!isTracked) {
                    const availableCollections = trackedCollections.map(col => {
                        const tokenId = col.tokenId || col.token_id;
                        return `• ${col.name || 'Unknown'} (${tokenId})`;
                    }).join('\n');
                    await interaction.editReply({
                        content: `❌ Collection ${collectionTokenId} is not tracked in this server.\n\n**Available Collections:**\n${availableCollections || 'None - use `/add` to add collections first'}`,
                    });
                    return;
                }
                
                tokenIds = [collectionTokenId];
                const collection = trackedCollections.find(col => (col.tokenId || col.token_id) === collectionTokenId);
                collectionNames = [collection.name || collectionTokenId];
            } else {
                // Use all tracked collections for this server
                const trackedCollections = await this.storage.getCollections(guildId, true);
                
                if (trackedCollections.length === 0) {
                    await interaction.editReply({
                        content: '❌ No collections are currently tracked in this server. Use `/add` to add collections first.',
                    });
                    return;
                }
                
                tokenIds = trackedCollections.map(col => col.tokenId || col.token_id);
                collectionNames = trackedCollections.map(col => col.name || (col.tokenId || col.token_id));
            }

            // Check interaction is still valid before API call
            if (!interaction.isRepliable()) {
                console.log('Analytics interaction expired before API call');
                return;
            }
            
            // Get analytics data from SentX
            const analytics = await this.sentxService.getCollectionAnalytics(tokenIds, days);
            
            // Check interaction is still valid after API call
            if (!interaction.isRepliable()) {
                console.log('Analytics interaction expired after API call');
                return;
            }
            
            if (!analytics) {
                await interaction.editReply({
                    content: '❌ Failed to fetch analytics data. Please try again later.',
                });
                return;
            }

            let embed;
            let content;
            
            switch (analyticsType) {
                case 'view-all':
                    // Create multiple text sections for comprehensive view
                    let fullText = '';
                    
                    // Core Stats
                    fullText += this.embedUtils.createCoreStatsEmbed(analytics, collectionNames) + '\n\n';
                    
                    // Advanced Metrics
                    fullText += this.embedUtils.createAdvancedMetricsEmbed(analytics, collectionNames) + '\n\n';
                    
                    // Price Distribution
                    fullText += this.embedUtils.createPriceDistributionEmbed(analytics, collectionNames) + '\n\n';
                    
                    // Market Health
                    fullText += this.embedUtils.createMarketHealthEmbed(analytics, collectionNames) + '\n\n';
                    
                    // Quick Buy Recommendations
                    fullText += this.embedUtils.createQuickBuyRecommendationsEmbed(analytics, collectionNames);
                    
                    await interaction.editReply({ content: fullText });
                    return;
                    
                case 'core-stats':
                    content = this.embedUtils.createCoreStatsEmbed(analytics, collectionNames);
                    break;
                case 'advanced-metrics':
                    content = this.embedUtils.createAdvancedMetricsEmbed(analytics, collectionNames);
                    break;
                case 'price-distribution':
                    content = this.embedUtils.createPriceDistributionEmbed(analytics, collectionNames);
                    break;
                case 'market-health':
                    content = this.embedUtils.createMarketHealthEmbed(analytics, collectionNames);
                    break;
                case 'recommendations':
                    content = this.embedUtils.createQuickBuyRecommendationsEmbed(analytics, collectionNames);
                    break;
                case 'market-overview':
                    const overview = await this.sentxService.getMarketOverview();
                    if (!overview) {
                        await interaction.editReply({
                            content: '❌ Failed to fetch market overview data. Please try again later.',
                        });
                        return;
                    }
                    const hbarRate = await this.currencyService.getHbarToUsdRate();
                    embed = this.embedUtils.createMarketOverviewEmbed(overview, hbarRate);
                    break;
                default:
                    await interaction.editReply({
                        content: '❌ Unknown analytics type.',
                    });
                    return;
            }

            if (!interaction.isRepliable()) {
                console.log('Interaction expired while generating analytics');
                return;
            }

            // Send as content for text or embed for market overview
            if (content) {
                await interaction.editReply({ content: content });
            } else {
                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error handling analytics command:', error);
            try {
                if (interaction.isRepliable()) {
                    if (interaction.deferred) {
                        await interaction.editReply({
                            content: '❌ Error generating analytics. Please try again later.',
                        });
                    } else {
                        await interaction.reply({
                            content: '❌ Error generating analytics. Please try again later.',
                            ephemeral: true
                        });
                    }
                }
            } catch (replyError) {
                console.error('Failed to reply to analytics command error:', replyError.message);
            }
        }
    }

    async testLastSale() {
        try {
            console.log('Testing by posting last Wild Tigers sale...');
            
            // Get recent sales from SentX
            const recentSales = await sentxService.getRecentSales(100); // Get more sales to find Wild Tigers
            
            if (!recentSales || recentSales.length === 0) {
                console.log('No recent sales found for testing');
                return;
            }
            
            // Find the most recent Wild Tigers sale
            const wildTigersSale = recentSales.find(sale => sale.token_id === '0.0.6024491');
            
            if (!wildTigersSale) {
                console.log('No Wild Tigers sales found in recent data');
                // Try any tracked collection sale for testing
                const trackedCollections = await this.storage.getCollections();
                const trackedTokenIds = trackedCollections.map(c => c.token_id);
                const anyTrackedSale = recentSales.find(sale => trackedTokenIds.includes(sale.token_id));
                
                if (anyTrackedSale) {
                    console.log(`Using ${anyTrackedSale.nft_name} sale for testing instead`);
                    const hbarRate = await currencyService.getHbarToUsdRate();
                    await this.processSale(anyTrackedSale, hbarRate);
                    console.log('Test sale posted successfully!');
                } else {
                    console.log('No tracked collection sales found for testing');
                }
                return;
            }
            
            console.log('Found Wild Tigers sale for testing:', wildTigersSale.nft_name);
            
            // Get HBAR rate
            const hbarRate = await currencyService.getHbarToUsdRate();
            
            // Process this sale (force post it)
            await this.processSale(wildTigersSale, hbarRate);
            
            console.log('Test sale posted successfully!');
            
        } catch (error) {
            console.error('Error testing last sale:', error);
        }
    }
}

module.exports = NFTSalesBot;
