/**
 * Discord bot implementation for tracking NFT sales
 */

const { Client, GatewayIntentBits, Events } = require('discord.js');
const cron = require('node-cron');
const config = require('./config');
const sentxService = require('./services/sentx');
const kabilaService = require('./services/kabila');
const currencyService = require('./services/currency');
const embedUtils = require('./utils/embed');
const DatabaseStorage = require('./database-storage');

class NFTSalesBot {
    constructor() {
        this.storage = new DatabaseStorage();
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
            this.startMonitoring();
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

        // Handle slash commands
        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            await this.handleSlashCommand(interaction);
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

    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        console.log('Starting NFT sales monitoring...');
        
        // Set initial timestamp to now to avoid posting old sales
        this.initializeLastProcessedTimestamp();
        
        // Monitor every 10 seconds for new sales
        this.monitoringTask = cron.schedule('*/10 * * * * *', async () => {
            await this.checkForNewSales();
        });

        // Don't do initial check to avoid spam - wait for first interval
        console.log('Monitoring initialized - will check for new sales every 10 seconds');
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
            console.log('Checking for new NFT sales...');
            
            // Get recent sales from both marketplaces simultaneously
            const [sentxSales, kabilaSales] = await Promise.allSettled([
                sentxService.getRecentSales(),
                kabilaService.getRecentSales()
            ]);

            let allSales = [];

            // Process SentX sales
            if (sentxSales.status === 'fulfilled' && sentxSales.value) {
                console.log(`Found ${sentxSales.value.length} sales from SentX`);
                allSales.push(...sentxSales.value);
            } else {
                console.log('SentX sales fetch failed:', sentxSales.reason?.message || 'Unknown error');
            }

            // Process Kabila sales
            if (kabilaSales.status === 'fulfilled' && kabilaSales.value) {
                console.log(`Found ${kabilaSales.value.length} sales from Kabila`);
                allSales.push(...kabilaSales.value);
            } else {
                console.log('Kabila sales fetch failed:', kabilaSales.reason?.message || 'Unknown error');
            }
            
            if (allSales.length === 0) {
                console.log('No recent sales found from any marketplace');
                return;
            }

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

            console.log(`Found ${newSales.length} new live sales to process from all marketplaces`);

            if (newSales.length === 0) {
                console.log('No new live sales to process');
                return;
            }

            // Remove duplicates based on token_id, serial_number, and timestamp
            const uniqueSales = this.removeDuplicateSales(newSales);
            console.log(`After removing duplicates: ${uniqueSales.length} unique sales`);

            // Sort by timestamp to process oldest first
            uniqueSales.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            // Get current HBAR to USD rate
            const hbarRate = await currencyService.getHbarToUsdRate();

            // Process each new sale
            for (const sale of uniqueSales) {
                // Create unique sale ID to prevent duplicates
                const saleId = `${sale.tokenId || sale.token_id}_${sale.serialNumber || sale.serial_number}_${sale.timestamp}_${sale.marketplace}`;
                
                // Check if we've already processed this sale
                const alreadyProcessed = await this.storage.isSaleProcessed(saleId);
                if (alreadyProcessed) {
                    console.log(`Skipping duplicate sale: ${sale.nftName || sale.nft_name} from ${sale.marketplace}`);
                    continue;
                }
                
                await this.processSale(sale, hbarRate);
                
                // Mark sale as processed to prevent duplicates
                await this.storage.markSaleProcessed(saleId, sale.tokenId || sale.token_id);
                
                // Update last processed timestamp
                const saleTimestamp = new Date(sale.timestamp).getTime();
                await this.storage.setLastProcessedSale(saleTimestamp);
                
                // Small delay between messages to avoid rate limiting
                await this.delay(1000);
            }

        } catch (error) {
            console.error('Error checking for new sales:', error);
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

    async processSale(sale, hbarRate) {
        try {
            // Get all configured servers and channels
            const serverConfigs = await this.storage.getAllServerConfigs();
            let successCount = 0;
            
            if (serverConfigs.length === 0) {
                console.log('No servers configured for notifications');
                return;
            }

            // Check each server to see if they track this collection
            for (const serverConfig of serverConfigs) {
                try {
                    if (!serverConfig.enabled) continue;
                    
                    // For Kabila sales, post to all servers since we can't track specific collections yet
                    // For SentX sales, check if this server tracks the collection
                    let shouldPost = false;
                    
                    if (sale.marketplace === 'Kabila') {
                        // Post all Kabila sales to all configured servers
                        shouldPost = true;
                    } else {
                        // For SentX sales, check collection tracking
                        const isTracked = await this.storage.isCollectionTracked(sale.token_id || sale.tokenId, serverConfig.guildId);
                        shouldPost = isTracked;
                    }
                    
                    if (!shouldPost) {
                        continue; // Skip this server
                    }
                    
                    const channel = this.client.channels.cache.get(serverConfig.channelId);
                    if (channel) {
                        // Create Discord embed for the sale
                        const embed = await embedUtils.createSaleEmbed(sale, hbarRate);
                        await channel.send({ embeds: [embed] });
                        successCount++;
                    }
                } catch (error) {
                    console.error(`Failed to post to server ${serverConfig.guildId}:`, error.message);
                }
            }
            
            if (successCount > 0) {
                console.log(`✅ Posted sale notification to ${successCount} server(s): ${sale.nft_name} sold for ${sale.price_hbar} HBAR`);
            }

        } catch (error) {
            console.error('Error processing sale:', error.message);
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
            
            const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${this.client.user.id}&permissions=19456&scope=bot`;
            console.log('\n🔗 Invite Link for Other Servers:');
            console.log(inviteLink);
            console.log('\nRequired Permissions: Send Messages, Embed Links, View Channel\n');
            
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
                name: 'list',
                description: 'List all tracked NFT collections'
            },
            {
                name: 'status',
                description: 'Show bot status and monitoring information'
            }
        ];

        try {
            console.log('Registering slash commands...');
            await rest.put(
                Routes.applicationCommands(this.client.user.id),
                { body: commands }
            );
            console.log('Successfully registered slash commands');
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
                case 'list':
                    await this.handleListCommand(interaction);
                    break;
                case 'status':
                    await this.handleStatusSlashCommand(interaction);
                    break;
                default:
                    await interaction.reply('Unknown command');
            }
        } catch (error) {
            console.error('Error handling slash command:', error);
            if (!interaction.replied) {
                await interaction.reply('An error occurred while processing the command.');
            }
        }
    }

    async handleAddCommand(interaction, options) {
        const tokenId = options.getString('token_id');
        const name = options.getString('name') || 'Unknown Collection';
        const guildId = interaction.guildId;

        // Validate token ID format
        if (!tokenId.match(/^0\.0\.\d+$/)) {
            await interaction.reply({
                content: '❌ Invalid token ID format. Please use format: 0.0.123456',
                ephemeral: true
            });
            return;
        }

        try {
            const result = await this.storage.addCollection(guildId, tokenId, name, true);
            
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
            await interaction.reply({
                content: '❌ Error adding collection. Please try again.',
                ephemeral: true
            });
        }
    }

    async handleRemoveCommand(interaction, options) {
        const tokenId = options.getString('token_id');
        const guildId = interaction.guildId;

        try {
            const success = await this.storage.removeCollection(guildId, tokenId);
            
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
            await interaction.reply({
                content: '❌ Error removing collection. Please try again.',
                ephemeral: true
            });
        }
    }

    async handleListCommand(interaction) {
        try {
            const guildId = interaction.guildId;
            const collections = await this.storage.getCollections(guildId);

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
            await interaction.reply({
                content: '❌ Error loading collections. Please try again.',
                ephemeral: true
            });
        }
    }

    async handleStatusSlashCommand(interaction) {
        const serverConfigs = await this.storage.getAllServerConfigs();
        const hbarRate = await currencyService.getHbarToUsdRate();

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
    }

    async initializeDatabase() {
        try {
            console.log('Initializing database storage...');
            await this.storage.init();
            console.log('Database storage ready');
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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

module.exports = new NFTSalesBot();
