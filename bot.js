/**
 * Discord bot implementation for tracking NFT sales
 */

const { Client, GatewayIntentBits, Events, AttachmentBuilder } = require('discord.js');
const cron = require('node-cron');
const config = require('./config');
const sentxService = require('./services/sentx');
const kabilaService = require('./services/kabila');

const currencyService = require('./services/currency');
const embedUtils = require('./utils/embed');
const DatabaseStorage = require('./database-storage');


class NFTSalesBot {
    constructor(sentxService, kabilaService, embedUtils, currencyService, storage) {
        // Initialize services
        this.sentxService = sentxService;
        this.kabilaService = kabilaService;
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
        
        // Add caching for collections to reduce database calls
        this.cachedCollections = [];
        this.lastCollectionFetch = 0;
        
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.once(Events.ClientReady, async () => {
            console.log(`Bot logged in as ${this.client.user.tag}!`);
            console.log(`Bot is in ${this.client.guilds.cache.size} servers`);
            
            // Debug: List all servers the bot is in
            console.log('📊 Connected Servers:');
            console.log('┌─────────────────────────────────────┬───────────────────────┬─────────────┐');
            console.log('│ Server Name                         │ Server ID             │ Members     │');
            console.log('├─────────────────────────────────────┼───────────────────────┼─────────────┤');
            
            this.client.guilds.cache.forEach(guild => {
                const name = guild.name.padEnd(35).substring(0, 35);
                const id = guild.id.padEnd(21);
                const members = guild.memberCount.toString().padStart(11);
                console.log(`│ ${name} │ ${id} │ ${members} │`);
            });
            
            console.log('└─────────────────────────────────────┴───────────────────────┴─────────────┘');
            console.log('🔗 Invite Link for Other Servers:');
            console.log(this.generateInviteLink());
            console.log('Required Permissions: View Channel, Send Messages, Embed Links, Add Reactions, Use Slash Commands');
            
            try {
                console.log('Initializing database storage...');
                await this.initializeDatabase();
                
                console.log('Checking existing servers for configuration...');
                await this.configureExistingServers();
                
                await this.registerSlashCommands();
                await this.startMonitoring();
                
                console.log('✅ Bot fully initialized and ready!');
            } catch (error) {
                console.error('❌ Critical error during bot initialization:', error);
                console.error('Bot will continue running but some features may not work properly');
            }
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
        
        // Monitor every 3 seconds for new sales with error handling
        this.monitoringTask = cron.schedule('*/3 * * * * *', async () => {
            try {
                await this.checkForNewSales();
            } catch (error) {
                console.error('Error in monitoring task:', error.message);
                // Continue monitoring even if one check fails
            }
        });

        // Don't do initial check to avoid spam - wait for first interval
        console.log('Monitoring initialized - will check for new sales every 3 seconds');
    }

    async initializeLastProcessedTimestamp() {
        try {
            const currentTimestamp = Date.now();
            console.log('Initializing baseline timestamp...');
            
            // Get the most recent sale timestamp from both marketplaces to set as baseline
            const sentxSales = await sentxService.getRecentSales(5);
            const kabilaSales = await kabilaService.getRecentSales(5);
            const recentSales = [...sentxSales, ...kabilaSales];
            
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
            console.log('Timestamp initialization completed');
        } catch (error) {
            console.error('Error initializing timestamp:', error);
            console.log('Using fallback timestamp approach...');
            try {
                // Fallback to current time
                await this.storage.setLastProcessedSale(Date.now());
                console.log('Fallback timestamp set successfully');
            } catch (fallbackError) {
                console.error('Critical error setting fallback timestamp:', fallbackError);
                throw fallbackError;
            }
        }
    }

    async checkForNewSales() {
        try {
            // Get all tracked collections from database first (cache for 30 seconds)
            const cacheKey = 'tracked_collections';
            let allTrackedCollections = this.cachedCollections || [];
            
            if (!this.lastCollectionFetch || Date.now() - this.lastCollectionFetch > 30000) {
                allTrackedCollections = await this.storage.getCollections();
                this.cachedCollections = allTrackedCollections;
                this.lastCollectionFetch = Date.now();
            }
            
            const trackedTokenIds = allTrackedCollections.map(c => c.token_id || c.tokenId);
            
            if (trackedTokenIds.length === 0) {
                // No collections tracked, skip monitoring
                return;
            }

            // Get recent sales from both marketplaces
            const sentxSales = await sentxService.getRecentSales();
            const kabilaSales = await kabilaService.getRecentSales();
            // Get recent listings from both marketplaces  
            const sentxListings = await sentxService.getRecentListings();
            const kabilaListings = await kabilaService.getRecentListings();

            // Combine sales and listings from both marketplaces
            const allSales = [...sentxSales, ...kabilaSales];
            const allListings = [...sentxListings, ...kabilaListings];

            // Filter for only tracked collections
            const trackedSales = allSales.filter(sale => 
                trackedTokenIds.includes(sale.token_id || sale.tokenId)
            );
            const trackedListings = allListings.filter(listing => 
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

    async processNewSales(allSales, hbarRate) {
        try {
            // Get the timestamp of the last processed sale
            const lastProcessedTimestamp = await this.storage.getLastProcessedSale();
            
            // Filter for truly new sales only (sales that happened after our last check)
            let newSales = allSales.filter(sale => {
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

            // Enrich Kabila sales with SentX rarity data
            const kabilaSales = uniqueSales.filter(sale => sale.marketplace === 'Kabila');
            const sentxSales = uniqueSales.filter(sale => sale.marketplace === 'SentX');
            
            let enrichedKabilaSales = kabilaSales;
            if (kabilaSales.length > 0) {
                try {
                    console.log(`🔄 Enriching ${kabilaSales.length} Kabila sales with SentX rarity data...`);
                    enrichedKabilaSales = await this.kabilaService.enrichWithSentXRarity(kabilaSales);
                    const enrichedCount = enrichedKabilaSales.filter(sale => sale.sentx_enriched && (sale.rarity || sale.sentx_rank)).length;
                    if (enrichedCount > 0) {
                        console.log(`✅ Successfully enriched ${enrichedCount}/${kabilaSales.length} Kabila sales with SentX rarity`);
                    } else {
                        console.log(`⚠️ No Kabila sales were enriched with SentX rarity data`);
                    }
                } catch (error) {
                    console.log(`❌ Failed to enrich Kabila sales with SentX rarity: ${error.message}`);
                    enrichedKabilaSales = kabilaSales; // Use original data if enrichment fails
                }
            }
            
            const allEnrichedSales = [...sentxSales, ...enrichedKabilaSales];
            
            // Sort by timestamp to process oldest first
            allEnrichedSales.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            // Process each new sale
            for (const sale of allEnrichedSales) {
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

    async processNewListings(allListings, hbarRate) {
        try {
            // Get the timestamp of the last processed listing
            const lastProcessedTimestamp = await this.storage.getLastProcessedListing();
            
            // Filter for truly new listings only (listings that happened after our last check)
            let newListings = allListings.filter(listing => {
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

            // Enrich Kabila listings with SentX rarity data
            const kabilaListings = uniqueListings.filter(listing => listing.marketplace === 'Kabila');
            const sentxListings = uniqueListings.filter(listing => listing.marketplace === 'SentX');
            
            let enrichedKabilaListings = kabilaListings;
            if (kabilaListings.length > 0) {
                try {
                    console.log(`🔄 Enriching ${kabilaListings.length} Kabila listings with SentX rarity data...`);
                    enrichedKabilaListings = await this.kabilaService.enrichWithSentXRarity(kabilaListings);
                    const enrichedCount = enrichedKabilaListings.filter(listing => listing.sentx_enriched && (listing.rarity || listing.sentx_rank)).length;
                    if (enrichedCount > 0) {
                        console.log(`✅ Successfully enriched ${enrichedCount}/${kabilaListings.length} Kabila listings with SentX rarity`);
                    } else {
                        console.log(`⚠️ No Kabila listings were enriched with SentX rarity data`);
                    }
                } catch (error) {
                    console.log(`❌ Failed to enrich Kabila listings with SentX rarity: ${error.message}`);
                    enrichedKabilaListings = kabilaListings; // Use original data if enrichment fails
                }
            }
            
            const allEnrichedListings = [...sentxListings, ...enrichedKabilaListings];
            
            // Sort by timestamp to process oldest first
            allEnrichedListings.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            // Process each new listing
            for (const listing of allEnrichedListings) {
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
                        // Add marketplace-specific collection URLs
                        if (sale.marketplace === 'Kabila') {
                            // Kabila URL format
                            const tokenNumber = (sale.token_id || sale.tokenId || '').replace('0.0.', '');
                            if (tokenNumber) {
                                sale.collection_url = `https://market.kabila.app/en/collections/${tokenNumber}/items`;
                            }
                        } else {
                            // SentX URL format - use proper collection name mapping
                            if (sale.token_id || sale.tokenId) {
                                sale.collection_url = this.getSentXCollectionUrl(sale.token_id || sale.tokenId);
                            }
                        }
                        
                        // Create Discord embed for the sale with image effects based on server setting
                        const embed = await embedUtils.createSaleEmbed(sale, hbarRate, serverConfig.guildId);
                        
                        // Handle attachment if present
                        const messageOptions = { embeds: [embed] };
                        if (embed.files && embed.files.length > 0) {
                            messageOptions.files = embed.files;
                        }
                        
                        const message = await channel.send(messageOptions);
                        
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
                        // Add marketplace-specific collection URLs
                        if (listing.marketplace === 'Kabila') {
                            // Kabila URL format
                            const tokenNumber = (listing.token_id || listing.tokenId || '').replace('0.0.', '');
                            if (tokenNumber) {
                                listing.collection_url = `https://market.kabila.app/en/collections/${tokenNumber}/items`;
                            }
                        } else {
                            // SentX URL format - use proper collection name mapping
                            if (listing.token_id || listing.tokenId) {
                                listing.collection_url = this.getSentXCollectionUrl(listing.token_id || listing.tokenId);
                            }
                        }
                        
                        // Create Discord embed for the listing with image effects based on server setting
                        const embed = await embedUtils.createListingEmbed(listing, hbarRate, serverConfig.guildId);
                        
                        // Handle attachment if present
                        const messageOptions = { embeds: [embed] };
                        if (embed.files && embed.files.length > 0) {
                            messageOptions.files = embed.files;
                        }
                        
                        const message = await channel.send(messageOptions);
                        
                        // Add appropriate emoji reaction based on listing type
                        try {
                            const isAuction = listing.sale_type === 'Auction';
                            const emoji = isAuction ? '🏆' : '📝';
                            await message.react(emoji);
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
                name: 'support',
                description: 'Get support and help with the bot'
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
                                name: 'Recent SentX Sale',
                                value: 'recent-sentx-sale'
                            },
                            {
                                name: 'Recent SentX Listing',
                                value: 'recent-sentx-listing'
                            },
                            {
                                name: 'Recent Kabila Sale',
                                value: 'recent-kabila-sale'
                            },
                            {
                                name: 'Recent Kabila Listing',
                                value: 'recent-kabila-listing'
                            }
                        ]
                    },
                    {
                        name: 'collection',
                        type: 3, // STRING
                        description: 'Token ID of collection to test (optional - shows tracked collections)',
                        required: false,
                        autocomplete: true
                    }
                ]
            }
        ];

        try {
            console.log('Registering slash commands...');
            console.log(`Registering ${commands.length} commands including: ${commands.map(c => c.name).join(', ')}`);
            
            // Register commands globally (no clearing - keeps existing commands intact)
            await rest.put(
                Routes.applicationCommands(this.client.user.id),
                { body: commands }
            );
            
            console.log(`✅ Successfully registered ${commands.length} slash commands globally:`);
            commands.forEach(cmd => {
                console.log(`   /${cmd.name} - ${cmd.description}`);
            });
            console.log('Command registration completed successfully');
        } catch (error) {
            console.error('Error registering slash commands:', error);
            console.log('Commands may not be available but bot will continue running');
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
                case 'support':
                    await this.handleSupportCommand(interaction);
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
                    },
                    {
                        name: '🏪 Supported Marketplaces',
                        value: '• **SentX**\n• **Kabila**',
                        inline: false
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
            // Check interaction validity immediately
            if (!interaction || interaction.replied || interaction.deferred) {
                return;
            }
            
            const testType = interaction.options?.getString('type') || 'recent-sentx-sale';
            
            // Defer reply immediately as the very first action
            try {
                await interaction.deferReply();
            } catch (deferError) {
                if (deferError.code === 10062) {
                    // Unknown interaction - already expired
                    return;
                }
                console.error('Failed to defer interaction:', deferError.message);
                return;
            }
            
            // Get optional collection parameter
            const specificCollection = interaction.options?.getString('collection');
            
            // Route to appropriate test method
            let embed;
            if (testType === 'recent-sentx-sale') {
                console.log('Testing most recent SentX sale...');
                embed = await this.getTestRecentSentXSaleEmbed(interaction.guildId, specificCollection);
            } else if (testType === 'recent-sentx-listing') {
                console.log('Testing most recent SentX listing...');
                embed = await this.getTestRecentSentXListingEmbed(interaction.guildId, specificCollection);
            } else if (testType === 'recent-kabila-sale') {
                console.log('Testing most recent Kabila sale...');
                embed = await this.getTestRecentKabilaSaleEmbed(interaction.guildId, specificCollection);
            } else if (testType === 'recent-kabila-listing') {
                console.log('Testing most recent Kabila listing...');
                embed = await this.getTestRecentKabilaListingEmbed(interaction.guildId, specificCollection);
            } else {
                // Default: recent-sentx-sale
                console.log('Testing most recent SentX sale...');
                embed = await this.getTestRecentSentXSaleEmbed(interaction.guildId, specificCollection);
            }
            
            // Send the response
            try {
                if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({
                        embeds: [embed]
                    });
                }
            } catch (replyError) {
                if (replyError.code === 10062) {
                    // Unknown interaction - expired, ignore
                    return;
                }
                console.error('Error sending test response:', replyError.message);
            }
            
        } catch (error) {
            // Silently handle interaction expiry errors
            if (error.code === 10062) {
                return; // Unknown interaction - expired
            }
            
            console.error('Error in test command:', error.message);
            
            // Only try to reply if interaction is still valid
            try {
                if (interaction.deferred && !interaction.replied) {
                    const errorEmbed = this.embedUtils.createErrorEmbed(
                        'Test Command Failed',
                        'An error occurred while running the test command.',
                        error.message
                    );
                    
                    await interaction.editReply({
                        embeds: [errorEmbed]
                    });
                }
            } catch (replyError) {
                // Silently ignore reply errors
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

    async handleSupportCommand(interaction) {
        try {
            const supportEmbed = {
                title: '🛟 Get Support & Help',
                description: 'Need help with the NFT Sales Bot? Join our support server!',
                color: 0xffffff,
                thumbnail: {
                    url: 'attachment://migos-logo.png'
                },
                fields: [
                    {
                        name: '🎮 Join Migos World Labs Discord',
                        value: '[Click here to join our Discord support server](https://discord.gg/fkKEgckbYH)\n\nContact **Mauii** or **Wise Whale** for set up help\n\nGet help with:\n• Bot setup and configuration\n• Adding NFT collections\n• Troubleshooting issues\n• Feature requests and feedback',
                        inline: false
                    },
                    {
                        name: '📚 Quick Commands',
                        value: '• `/add` - Add NFT collection to track\n• `/list` - Show tracked collections\n• `/test` - Test bot functionality\n• `/status` - Check bot health',
                        inline: true
                    },
                    {
                        name: '🏪 Supported Marketplaces',
                        value: '• **SentX**\n• **Kabila**',
                        inline: true
                    },
                    {
                        name: '🔧 Need Help?',
                        value: 'Contact **Mauii** or **Wise Whale** in Migos World Labs Discord for:\n• Set up the bot for your server\n• Configure collections and channels\n• Answer questions about features\n• Resolve any technical issues',
                        inline: false
                    }
                ],
                footer: {
                    text: 'Built for the Hedera NFT community by Migos World Labs',
                    icon_url: 'https://sentient-bherbhd8e3cyg4dn.z01.azurefd.net/media/web/hedera-logo-128.png'
                },
                timestamp: new Date().toISOString()
            };

            const attachment = new AttachmentBuilder('./migos-logo.png', { name: 'migos-logo.png' });
            await interaction.reply({
                embeds: [supportEmbed],
                files: [attachment],
                ephemeral: false
            });
        } catch (error) {
            console.error('Error handling support command:', error);
            try {
                await interaction.reply({
                    content: '❌ Error showing support information. Please join our support server directly: https://discord.gg/fkKEgckbYH',
                    ephemeral: true
                });
            } catch (replyError) {
                console.error('Error replying to support command:', replyError);
            }
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

    /**
     * Get proper SentX collection URL based on token ID
     * @param {string} tokenId - Token ID of the collection
     * @returns {string} Proper SentX collection URL
     */
    getSentXCollectionUrl(tokenId) {
        // Map token IDs to their proper SentX collection URLs
        const collectionMapping = {
            '0.0.6024491': 'https://sentx.io/nft-marketplace/wild-tigers',
            '0.0.8308459': 'https://sentx.io/nft-marketplace/the-ape-anthology',
            '0.0.8233324': 'https://sentx.io/nft-marketplace/kekistan',
            '0.0.8233316': 'https://sentx.io/nft-marketplace/heliswap-pool-tokens',
            '0.0.8233302': 'https://sentx.io/nft-marketplace/klaytn-invasion',
            '0.0.5552189': 'https://sentx.io/nft-marketplace/hashinals',
            '0.0.2173899': 'https://sentx.io/nft-marketplace/hashinals',
            '0.0.789064': 'https://sentx.io/nft-marketplace/hashinals',
            '0.0.1097228': 'https://sentx.io/nft-marketplace/hashinals',
            '0.0.8293984': 'https://sentx.io/nft-marketplace/hashinals',
            '0.0.1006183': 'https://sentx.io/nft-marketplace/hedera-monkeys',
            '0.0.878200': 'https://sentx.io/nft-marketplace/rooster-cartel'
        };
        
        return collectionMapping[tokenId] || `https://sentx.io/nft-marketplace/collection/${tokenId}`;
    }

    async getTestListingEmbed(guildId, specificTokenId = null) {
        try {
            console.log('Creating test listing embed...');
            
            // Get tracked collections for this server
            let trackedCollections = await this.storage.getCollections(guildId);
            
            if (!trackedCollections || trackedCollections.length === 0) {
                return this.embedUtils.createErrorEmbed(
                    'No Collections Tracked',
                    'No collections are being tracked in this server. Use `/add` to track collections first.'
                );
            }
            
            // Filter to specific collection if requested
            if (specificTokenId && specificTokenId !== 'none') {
                trackedCollections = trackedCollections.filter(c => 
                    (c.token_id || c.tokenId) === specificTokenId
                );
                
                if (trackedCollections.length === 0) {
                    return this.embedUtils.createErrorEmbed(
                        'Collection Not Found',
                        `Collection ${specificTokenId} is not being tracked in this server.`
                    );
                }
            }
            
            // Use tracked collections (all or filtered)
            const targetTokenIds = trackedCollections.map(c => c.token_id || c.tokenId);
            console.log(`Looking for listings from ${targetTokenIds.length} tracked collections:`, targetTokenIds);
            
            // Get all listings from SentX (without time filter for testing)
            const allListings = await this.sentxService.getRecentListings(100, true);
            
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

    async getTestTrackedSaleEmbed(guildId, specificTokenId = null) {
        try {
            console.log('Creating test sale embed from tracked collections...');
            
            // Get tracked collections for this server
            let trackedCollections = await this.storage.getCollections(guildId);
            
            if (!trackedCollections || trackedCollections.length === 0) {
                return this.embedUtils.createErrorEmbed(
                    'No Collections Tracked',
                    'No collections are being tracked in this server. Use `/add` to track collections first.'
                );
            }
            
            // Filter to specific collection if requested
            if (specificTokenId && specificTokenId !== 'none') {
                trackedCollections = trackedCollections.filter(c => 
                    (c.token_id || c.tokenId) === specificTokenId
                );
                
                if (trackedCollections.length === 0) {
                    return this.embedUtils.createErrorEmbed(
                        'Collection Not Found',
                        `Collection ${specificTokenId} is not being tracked in this server.`
                    );
                }
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
            const recentSales = await this.sentxService.getRecentSales(50);
            
            if (!recentSales || recentSales.length === 0) {
                return this.embedUtils.createErrorEmbed(
                    'No Recent Sales',
                    'No recent sales found on SentX marketplace'
                );
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
            return await embedUtils.createSaleEmbed(testSale, hbarRate);
            
        } catch (error) {
            console.error('Error testing most recent sale:', error);
            return this.embedUtils.createErrorEmbed(
                'Test Failed',
                'Error testing most recent sale',
                error.message
            );
        }
    }
    
    async getTestRecentListingEmbed() {
        try {
            console.log('Testing most recent listing from marketplace...');
            
            // Get recent listings from SentX
            const recentListings = await this.sentxService.getRecentListings(50, true);
            
            if (!recentListings || recentListings.length === 0) {
                return this.embedUtils.createErrorEmbed(
                    'No Recent Listings',
                    'No recent listings found on SentX marketplace'
                );
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
            return await embedUtils.createListingEmbed(testListing, hbarRate);
            
        } catch (error) {
            console.error('Error testing most recent listing:', error);
            return this.embedUtils.createErrorEmbed(
                'Test Failed',
                'Error testing most recent listing',
                error.message
            );
        }
    }

    async handleAutocomplete(interaction) {
        try {
            // Check if interaction is still valid (not expired)
            if (!interaction || !interaction.responded && !interaction.deferred) {
                const focusedOption = interaction.options.getFocused(true);
                
                if (focusedOption.name === 'collection') {
                    // Get tracked collections for this server quickly
                    const guildId = interaction.guildId;
                    const trackedCollections = await this.storage.getCollections(guildId);
                    
                    if (!trackedCollections || trackedCollections.length === 0) {
                        await interaction.respond([{
                            name: 'No collections tracked - Use /add to track collections first',
                            value: 'none'
                        }]);
                        return;
                    }
                    
                    // Quick filter without logging to prevent delays
                    const searchValue = (focusedOption.value || '').toLowerCase();
                    const filtered = trackedCollections.filter(collection => {
                        const tokenId = collection.tokenId || collection.token_id;
                        const name = collection.name || '';
                        
                        if (!tokenId || tokenId === 'undefined' || tokenId === 'null') {
                            return false;
                        }
                        
                        return name.toLowerCase().includes(searchValue) || 
                               tokenId.includes(searchValue);
                    }).slice(0, 25); // Discord limit is 25 choices
                    
                    const choices = filtered.map(collection => {
                        const tokenId = collection.tokenId || collection.token_id;
                        const name = collection.name || 'Unknown Collection';
                        return {
                            name: `${name} (${tokenId})`,
                            value: tokenId
                        };
                    });
                    
                    if (choices.length === 0) {
                        await interaction.respond([{
                            name: 'No valid collections found - Check /list to see tracked collections',
                            value: 'none'
                        }]);
                    } else {
                        await interaction.respond(choices);
                    }
                } else {
                    await interaction.respond([{
                        name: 'Unknown option',
                        value: 'unknown'
                    }]);
                }
            }
        } catch (error) {
            // Silently handle autocomplete errors to prevent spam
            if (error.code === 10062) {
                // Unknown interaction - already expired, ignore
                return;
            }
            console.error('Autocomplete error:', error.message);
        }
    }



    async getTestRecentSentXSaleEmbed(guildId, specificCollection = null) {
        try {
            console.log('Creating test SentX sale embed...');
            
            // Get recent sales from SentX only
            const recentSales = await this.sentxService.getRecentSales(50);
            
            if (!recentSales || recentSales.length === 0) {
                return this.embedUtils.createErrorEmbed(
                    'No SentX Sales Found',
                    'No recent sales found from SentX marketplace'
                );
            }
            
            // Get tracked collections for this server
            const trackedCollections = await this.storage.getCollections(guildId);
            const trackedTokenIds = trackedCollections.map(c => c.token_id || c.tokenId);
            
            // Filter sales to only show those from tracked collections
            let trackedSales = recentSales.filter(sale => 
                trackedTokenIds.includes(sale.token_id || sale.tokenId)
            );
            
            // If specific collection requested, filter further
            if (specificCollection) {
                trackedSales = trackedSales.filter(sale => 
                    (sale.token_id || sale.tokenId) === specificCollection
                );
                
                if (trackedSales.length === 0) {
                    return this.embedUtils.createErrorEmbed(
                        'No SentX Sales Found',
                        `No recent SentX sales found for collection ${specificCollection}.\n\nTry testing without specifying a collection.`
                    );
                }
            }
            
            if (trackedSales.length === 0) {
                return this.embedUtils.createErrorEmbed(
                    'No Tracked SentX Sales Found',
                    `No recent SentX sales found from your tracked collections.\n\nTracked collections: ${trackedCollections.map(c => c.name || c.token_id).join(', ')}`
                );
            }
            
            // Get sale - specific collection gets first result, random for general test
            const testSale = specificCollection ? trackedSales[0] : trackedSales[Math.floor(Math.random() * Math.min(5, trackedSales.length))];
            console.log(`🎯 Selected ${specificCollection ? 'specific' : 'random'} sale: ${testSale.nft_name}`);
            console.log(`Using SentX sale: ${testSale.nft_name} for ${testSale.price_hbar} HBAR`);
            
            // Get HBAR rate
            const hbarRate = await this.currencyService.getHbarToUsdRate();
            
            // Create and return the embed
            return await this.embedUtils.createSaleEmbed(testSale, hbarRate);
            
        } catch (error) {
            console.error('Error creating test SentX sale embed:', error);
            return this.embedUtils.createErrorEmbed(
                'Test Failed',
                'Failed to create test SentX sale embed',
                error.message
            );
        }
    }

    async getTestRecentSentXListingEmbed(guildId, specificCollection = null) {
        try {
            console.log('Creating test SentX listing embed...');
            
            // Get recent listings from SentX only
            const recentListings = await this.sentxService.getRecentListings(50, true);
            
            if (!recentListings || recentListings.length === 0) {
                return this.embedUtils.createErrorEmbed(
                    'No SentX Listings Found',
                    'No recent listings found from SentX marketplace'
                );
            }
            
            // Get tracked collections for this server
            const trackedCollections = await this.storage.getCollections(guildId);
            const trackedTokenIds = trackedCollections.map(c => c.token_id || c.tokenId);
            
            // Filter listings to only show those from tracked collections
            let trackedListings = recentListings.filter(listing => 
                trackedTokenIds.includes(listing.token_id || listing.tokenId)
            );
            
            // If specific collection requested, filter further
            if (specificCollection) {
                trackedListings = trackedListings.filter(listing => 
                    (listing.token_id || listing.tokenId) === specificCollection
                );
                
                if (trackedListings.length === 0) {
                    return this.embedUtils.createErrorEmbed(
                        'No SentX Listings Found',
                        `No recent SentX listings found for collection ${specificCollection}.\n\nTry testing without specifying a collection.`
                    );
                }
            }
            
            if (trackedListings.length === 0) {
                return this.embedUtils.createErrorEmbed(
                    'No Tracked SentX Listings Found',
                    `No recent SentX listings found from your tracked collections.\n\nTracked collections: ${trackedCollections.map(c => c.name || c.token_id).join(', ')}`
                );
            }
            
            // Get listing - specific collection gets first result, random for general test
            const testListing = specificCollection ? trackedListings[0] : trackedListings[Math.floor(Math.random() * Math.min(5, trackedListings.length))];
            console.log(`🎯 Selected ${specificCollection ? 'specific' : 'random'} listing: ${testListing.nft_name}`);
            console.log(`Using SentX listing: ${testListing.nft_name} for ${testListing.price_hbar} HBAR`);
            
            // Get HBAR rate
            const hbarRate = await this.currencyService.getHbarToUsdRate();
            
            // Create and return the embed
            return await this.embedUtils.createListingEmbed(testListing, hbarRate);
            
        } catch (error) {
            console.error('Error creating test SentX listing embed:', error);
            return this.embedUtils.createErrorEmbed(
                'Test Failed',
                'Failed to create test SentX listing embed',
                error.message
            );
        }
    }

    async getTestRecentKabilaSaleEmbed(guildId, specificCollection = null) {
        try {
            console.log('🔍 Creating test Kabila sale embed...');
            console.log('🔍 Calling this.kabilaService.getRecentSales(50)...');
            
            // Get recent sales from Kabila only
            const recentSales = await this.kabilaService.getRecentSales(50);
            
            console.log(`🔍 Kabila API returned ${recentSales ? recentSales.length : 0} sales`);
            
            if (!recentSales || recentSales.length === 0) {
                return this.embedUtils.createErrorEmbed(
                    'No Kabila Sales Found',
                    'No recent sales found from Kabila marketplace'
                );
            }
            
            // Get tracked collections for this server
            const trackedCollections = await this.storage.getCollections(guildId);
            const trackedTokenIds = trackedCollections.map(c => c.token_id || c.tokenId);
            
            // Filter sales to only show those from tracked collections
            let trackedSales = recentSales.filter(sale => 
                trackedTokenIds.includes(sale.token_id || sale.tokenId)
            );
            
            // If specific collection requested, filter further
            if (specificCollection) {
                trackedSales = trackedSales.filter(sale => 
                    (sale.token_id || sale.tokenId) === specificCollection
                );
                
                if (trackedSales.length === 0) {
                    return this.embedUtils.createErrorEmbed(
                        'No Kabila Sales Found',
                        `No recent Kabila sales found for collection ${specificCollection}.\n\nTry testing without specifying a collection.`
                    );
                }
            }
            
            if (trackedSales.length === 0) {
                return this.embedUtils.createErrorEmbed(
                    'No Tracked Kabila Sales Found',
                    `No recent Kabila sales found from your tracked collections.\n\nTracked collections: ${trackedCollections.map(c => c.name || c.token_id).join(', ')}`
                );
            }
            
            // Get sale - specific collection gets first result, random for general test
            let testSale = specificCollection ? trackedSales[0] : trackedSales[Math.floor(Math.random() * Math.min(5, trackedSales.length))];
            console.log(`🎯 Selected ${specificCollection ? 'specific' : 'random'} sale: ${testSale.nft_name}`);
            console.log(`🔍 Using Kabila sale data:`, {
                nft_name: testSale.nft_name,
                price_hbar: testSale.price_hbar,
                marketplace: testSale.marketplace || 'Unknown',
                token_id: testSale.token_id,
                collection_name: testSale.collection_name
            });
            
            // Enrich Kabila sale with SentX rarity data
            try {
                console.log(`🔄 Enriching Kabila sale with SentX rarity data...`);
                const enrichedSales = await this.kabilaService.enrichWithSentXRarity([testSale]);
                if (enrichedSales && enrichedSales.length > 0) {
                    testSale = enrichedSales[0];
                    if (testSale.rarity || testSale.sentx_rank) {
                        console.log(`✅ Successfully enriched sale: Rank ${testSale.sentx_rank || testSale.rank}, Rarity ${testSale.rarity}`);
                    } else {
                        console.log(`⚠️ No rarity data found for this sale`);
                    }
                }
            } catch (error) {
                console.log(`❌ Failed to enrich Kabila sale with SentX rarity: ${error.message}`);
                // Continue with original data if enrichment fails
            }
            
            // Get HBAR rate
            const hbarRate = await this.currencyService.getHbarToUsdRate();
            
            // Create and return the embed
            return await this.embedUtils.createSaleEmbed(testSale, hbarRate);
            
        } catch (error) {
            console.error('Error creating test Kabila sale embed:', error);
            return this.embedUtils.createErrorEmbed(
                'Test Failed',
                'Failed to create test Kabila sale embed',
                error.message
            );
        }
    }

    async getTestRecentKabilaListingEmbed(guildId, specificCollection = null) {
        try {
            console.log('🔍 Creating test Kabila listing embed...');
            console.log('🔍 Calling this.kabilaService.getRecentListings(50, true)...');
            
            // Get recent listings from Kabila only
            const recentListings = await this.kabilaService.getRecentListings(50, true);
            
            console.log(`🔍 Kabila API returned ${recentListings ? recentListings.length : 0} listings`);
            
            if (!recentListings || recentListings.length === 0) {
                return this.embedUtils.createErrorEmbed(
                    'No Kabila Listings Found',
                    'No recent listings found from Kabila marketplace'
                );
            }
            
            // Get tracked collections for this server
            const trackedCollections = await this.storage.getCollections(guildId);
            const trackedTokenIds = trackedCollections.map(c => c.token_id || c.tokenId);
            
            // Filter listings to only show those from tracked collections
            let trackedListings = recentListings.filter(listing => 
                trackedTokenIds.includes(listing.token_id || listing.tokenId)
            );
            
            // If specific collection requested, filter further
            if (specificCollection) {
                trackedListings = trackedListings.filter(listing => 
                    (listing.token_id || listing.tokenId) === specificCollection
                );
                
                if (trackedListings.length === 0) {
                    return this.embedUtils.createErrorEmbed(
                        'No Kabila Listings Found',
                        `No recent Kabila listings found for collection ${specificCollection}.\n\nTry testing without specifying a collection.`
                    );
                }
            }
            
            if (trackedListings.length === 0) {
                return this.embedUtils.createErrorEmbed(
                    'No Tracked Kabila Listings Found',
                    `No recent Kabila listings found from your tracked collections.\n\nTracked collections: ${trackedCollections.map(c => c.name || c.token_id).join(', ')}`
                );
            }
            
            // Get listing - specific collection gets first result, random for general test
            let testListing = specificCollection ? trackedListings[0] : trackedListings[Math.floor(Math.random() * Math.min(5, trackedListings.length))];
            console.log(`🎯 Selected ${specificCollection ? 'specific' : 'random'} listing: ${testListing.nft_name}`);
            console.log(`🔍 Using Kabila listing data:`, {
                nft_name: testListing.nft_name,
                price_hbar: testListing.price_hbar,
                marketplace: testListing.marketplace || 'Unknown',
                token_id: testListing.token_id,
                collection_name: testListing.collection_name
            });
            
            // Enrich Kabila listing with SentX rarity data
            try {
                console.log(`🔄 Enriching Kabila listing with SentX rarity data...`);
                const enrichedListings = await this.kabilaService.enrichWithSentXRarity([testListing]);
                if (enrichedListings && enrichedListings.length > 0) {
                    testListing = enrichedListings[0];
                    if (testListing.rarity || testListing.sentx_rank) {
                        console.log(`✅ Successfully enriched listing: Rank ${testListing.sentx_rank || testListing.rank}, Rarity ${testListing.rarity}`);
                    } else {
                        console.log(`⚠️ No rarity data found for this listing`);
                    }
                }
            } catch (error) {
                console.log(`❌ Failed to enrich Kabila listing with SentX rarity: ${error.message}`);
                // Continue with original data if enrichment fails
            }
            
            // Get HBAR rate
            const hbarRate = await this.currencyService.getHbarToUsdRate();
            
            // Create and return the embed
            return await this.embedUtils.createListingEmbed(testListing, hbarRate);
            
        } catch (error) {
            console.error('Error creating test Kabila listing embed:', error);
            return this.embedUtils.createErrorEmbed(
                'Test Failed',
                'Failed to create test Kabila listing embed',
                error.message
            );
        }
    }

    async testLastSale() {
        try {
            console.log('Testing by posting last Wild Tigers sale...');
            
            // Get recent sales from SentX
            const recentSales = await this.sentxService.getRecentSales(100); // Get more sales to find Wild Tigers
            
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
