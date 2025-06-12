/**
 * Discord bot implementation for tracking NFT sales
 */

const { Client, GatewayIntentBits, Events } = require('discord.js');
const cron = require('node-cron');
const config = require('./config');
const sentxService = require('./services/sentx');
const currencyService = require('./services/currency');
const embedUtils = require('./utils/embed');
const storage = require('./database-storage');

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
        this.client.once(Events.ClientReady, async () => {
            console.log(`Bot logged in as ${this.client.user.tag}!`);
            console.log(`Bot is in ${this.client.guilds.cache.size} servers`);
            this.generateInviteLink();
            await this.initializeDatabase();
            await this.registerSlashCommands();
            this.startMonitoring();
        });

        this.client.on(Events.Error, (error) => {
            console.error('Discord client error:', error);
        });

        // Handle when bot joins a new server
        this.client.on(Events.GuildCreate, (guild) => {
            console.log(`✅ Bot added to new server: ${guild.name} (${guild.id})`);
            this.handleNewGuild(guild);
        });

        // Handle when bot leaves a server
        this.client.on(Events.GuildDelete, (guild) => {
            console.log(`❌ Bot removed from server: ${guild.name} (${guild.id})`);
            storage.removeServerConfig(guild.id);
        });

        // Handle slash commands
        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            await this.handleSlashCommand(interaction);
        });
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
            
            // Get all configured servers and channels
            const serverConfigs = storage.getAllServerConfigs();
            let successCount = 0;
            
            if (serverConfigs.length === 0) {
                // Fallback to original single channel config for backwards compatibility
                const channel = this.client.channels.cache.get(config.DISCORD_CHANNEL_ID);
                if (channel) {
                    await channel.send({ embeds: [embed] });
                    console.log(`✅ Posted sale notification: ${sale.nft_name} sold for ${sale.price_hbar} HBAR`);
                } else {
                    console.error(`Channel with ID ${config.DISCORD_CHANNEL_ID} not found`);
                }
                return;
            }

            // Post to all configured servers
            for (const serverConfig of serverConfigs) {
                try {
                    const channel = this.client.channels.cache.get(serverConfig.channelId);
                    if (channel && serverConfig.enabled) {
                        await channel.send({ embeds: [embed] });
                        successCount++;
                    }
                } catch (error) {
                    console.error(`Failed to post to server ${serverConfig.guildId}:`, error.message);
                }
            }
            
            if (successCount > 0) {
                console.log(`✅ Posted sale notification to ${successCount} servers: ${sale.nft_name} sold for ${sale.price_hbar} HBAR`);
            }

        } catch (error) {
            console.error('Error processing sale:', error.message);
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

    async handleNewGuild(guild) {
        try {
            // Find the first text channel where the bot can send messages
            const textChannels = guild.channels.cache.filter(channel => 
                channel.type === 0 && // Text channel
                channel.permissionsFor(guild.members.me).has(['SendMessages', 'EmbedLinks'])
            );

            if (textChannels.size > 0) {
                const firstChannel = textChannels.first();
                
                // Save server configuration
                storage.setServerConfig(guild.id, firstChannel.id, guild.name, true);
                
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
                    footer: { text: 'Ready to track your favorite NFT collections!' }
                };
                await firstChannel.send({ embeds: [welcomeEmbed] });
                
                console.log(`Configured server ${guild.name} with channel #${firstChannel.name}`);
            } else {
                console.log(`No suitable channel found in server ${guild.name} - bot needs Send Messages permission`);
            }
        } catch (error) {
            console.error(`Error setting up new guild ${guild.name}:`, error);
        }
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

        // Validate token ID format
        if (!tokenId.match(/^0\.0\.\d+$/)) {
            await interaction.reply({
                content: '❌ Invalid token ID format. Please use format: 0.0.123456',
                ephemeral: true
            });
            return;
        }

        try {
            const fs = require('fs');
            const path = require('path');
            const collectionsPath = path.join(__dirname, 'collections.json');
            
            let collectionsData = { collections: [] };
            if (fs.existsSync(collectionsPath)) {
                collectionsData = JSON.parse(fs.readFileSync(collectionsPath, 'utf8'));
            }

            // Check if collection already exists
            if (collectionsData.collections.some(c => c.tokenId === tokenId)) {
                await interaction.reply({
                    content: '❌ This collection is already being tracked.',
                    ephemeral: true
                });
                return;
            }

            // Add collection
            collectionsData.collections.push({
                tokenId,
                name,
                enabled: true,
                addedDate: new Date().toISOString()
            });

            fs.writeFileSync(collectionsPath, JSON.stringify(collectionsData, null, 2));

            await interaction.reply({
                content: `✅ Added **${name}** (${tokenId}) to tracking list!`,
                ephemeral: false
            });

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

        try {
            const fs = require('fs');
            const path = require('path');
            const collectionsPath = path.join(__dirname, 'collections.json');
            
            if (!fs.existsSync(collectionsPath)) {
                await interaction.reply({
                    content: '❌ No collections are currently being tracked.',
                    ephemeral: true
                });
                return;
            }

            const collectionsData = JSON.parse(fs.readFileSync(collectionsPath, 'utf8'));
            const initialLength = collectionsData.collections.length;
            
            collectionsData.collections = collectionsData.collections.filter(c => c.tokenId !== tokenId);

            if (collectionsData.collections.length < initialLength) {
                fs.writeFileSync(collectionsPath, JSON.stringify(collectionsData, null, 2));
                await interaction.reply({
                    content: `✅ Removed collection **${tokenId}** from tracking list.`,
                    ephemeral: false
                });
            } else {
                await interaction.reply({
                    content: `❌ Collection **${tokenId}** was not found in tracking list.`,
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
            const fs = require('fs');
            const path = require('path');
            const collectionsPath = path.join(__dirname, 'collections.json');
            
            let collectionsData = { collections: [] };
            if (fs.existsSync(collectionsPath)) {
                collectionsData = JSON.parse(fs.readFileSync(collectionsPath, 'utf8'));
            }

            if (collectionsData.collections.length === 0) {
                await interaction.reply({
                    content: 'No collections are currently being tracked. Use `/add` to add one.',
                    ephemeral: true
                });
                return;
            }

            const embed = {
                title: '📋 Tracked NFT Collections',
                color: 0x0099ff,
                fields: [],
                footer: { text: `Total: ${collectionsData.collections.length} collection(s)` },
                timestamp: new Date().toISOString()
            };

            collectionsData.collections.forEach((collection, index) => {
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
        const serverConfigs = storage.getAllServerConfigs();
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

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new NFTSalesBot();
