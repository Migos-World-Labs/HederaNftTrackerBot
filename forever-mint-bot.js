const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const sentxService = require('./services/sentx');

class ForeverMintBot {
    constructor() {
        this.client = new Client({
            intents: [GatewayIntentBits.Guilds]
        });
        
        // Configuration - Update these for your Discord servers
        this.servers = [
            {
                guildId: '910963230317355008', // Migos World
                channelId: '910963234209673231', // Main chat channel
                name: 'Migos World'
            },
            {
                guildId: '1248509900154343504', // Wild Tigers
                channelId: '1267962616455921706', // Forever mints channel
                name: 'Wild Tigers'
            }
        ];
        
        this.processedMints = new Set(); // Track processed mints to prevent duplicates
        this.monitoringTask = null; // Monitoring task reference
        this.isFirstRun = true; // Track if this is the first check after startup
    }

    async initialize() {
        try {
            await this.client.login(process.env.DISCORD_TOKEN);
            console.log('✅ Forever Mint Bot logged in successfully');
            
            // Start monitoring for Wild Tigers mints
            this.startMonitoring();
            
        } catch (error) {
            console.error('❌ Failed to initialize bot:', error.message);
            process.exit(1);
        }
    }

    /**
     * Start monitoring for new Wild Tigers mints every 15 seconds
     */
    startMonitoring() {
        console.log('🚀 Starting Wild Tigers Forever Mint monitoring...');
        
        this.monitoringTask = setInterval(async () => {
            try {
                await this.checkForNewMints();
            } catch (error) {
                console.error('❌ Error checking for Wild Tigers mints:', error.message);
            }
        }, 15000); // Check every 15 seconds
    }

    /**
     * Check for new Wild Tigers mints
     */
    async checkForNewMints() {
        try {
            // On first run, only fetch 1 mint to establish baseline and avoid rate limits
            const fetchLimit = this.isFirstRun ? 1 : 5;
            
            // Fetch recent Wild Tigers mints from SentX
            const recentMints = await sentxService.getRecentForeverMints(fetchLimit);
            
            if (!recentMints || recentMints.length === 0) {
                if (this.isFirstRun) {
                    console.log('📍 Wild Tigers baseline established - no recent mints found');
                    this.isFirstRun = false;
                }
                return;
            }
            
            // Process each mint
            for (const mint of recentMints) {
                const mintId = `${mint.nftSerialId}-${mint.saleDate}`;
                
                // Skip if already processed
                if (this.processedMints.has(mintId)) {
                    continue;
                }
                
                // On first run, just mark as processed without notifications to establish baseline
                if (this.isFirstRun) {
                    this.processedMints.add(mintId);
                    console.log(`📍 Baseline: Found existing Wild Tigers mint ${mint.nftName} #${mint.nftSerialId} (not notifying)`);
                    continue;
                }
                
                console.log(`🌟 NEW WILD TIGERS FOREVER MINT: ${mint.nftName} - ${mint.salePrice} ${mint.salePriceSymbol}`);
                console.log(`   Serial: ${mint.nftSerialId}, Minter: ${mint.buyerAddress}`);
                
                // Send notifications
                await this.sendMintNotifications(mint);
                
                // Mark as processed
                this.processedMints.add(mintId);
            }
            
            // Mark first run as complete
            if (this.isFirstRun) {
                this.isFirstRun = false;
                console.log('✅ Wild Tigers baseline established - monitoring for new mints only');
            }
            
        } catch (error) {
            console.error('❌ Error fetching Wild Tigers mints:', error.message);
        }
    }

    async sendMintNotifications(mint) {
        for (const server of this.servers) {
            try {
                const guild = this.client.guilds.cache.get(server.guildId);
                if (!guild) {
                    console.log(`❌ Guild not found: ${server.name}`);
                    continue;
                }

                const channel = guild.channels.cache.get(server.channelId);
                if (!channel) {
                    console.log(`❌ Channel not found in ${server.name}`);
                    continue;
                }

                // Create embed with iPhone-compatible image
                const embed = await this.createMintEmbed(mint);
                
                // Load Forever Mint sticker
                const stickerPath = path.join(__dirname, 'attached_assets', 'Forever Mint Sticker_1756349371753.png');
                let stickerAttachment = null;
                
                if (fs.existsSync(stickerPath)) {
                    stickerAttachment = new AttachmentBuilder(stickerPath, { name: 'forever-mint-sticker.png' });
                }

                const messageOptions = { 
                    content: `🎉 **FOREVER MINT ALERT!** ${mint.nftName}`,
                    embeds: [embed] 
                };
                
                if (stickerAttachment) {
                    messageOptions.files = [stickerAttachment];
                }

                await channel.send(messageOptions);
                console.log(`✅ Forever Mint notification sent to ${server.name}`);

            } catch (error) {
                console.error(`❌ Failed to send notification to ${server.name}:`, error.message);
            }
        }
    }

    async createMintEmbed(mint) {
        // Convert IPFS to iPhone-compatible Hashpack CDN
        const optimizedImageUrl = this.convertIpfsToHttp(mint.nftImage);
        
        const embed = new EmbedBuilder()
            .setTitle(`✨ FOREVER MINT! ${mint.nftName} ✨`)
            .setDescription(`🎉 **Forever Mint Successful!** A new Wild Tigers has been minted for exactly 500 HBAR!`)
            .addFields([
                { name: '💰 Mint Cost', value: `${mint.salePrice} HBAR`, inline: true },
                { name: '🔢 Serial Number', value: `#${mint.nftSerialId}`, inline: true },
                { name: '👤 Minted By', value: mint.buyerAddress, inline: true },
                { name: '🎲 Forever Mint', value: '**500 HBAR** - Lucky mint!', inline: true },
                { name: '📅 Mint Date', value: new Date(mint.saleDate).toLocaleDateString(), inline: true },
                { name: '🌐 Marketplace', value: 'SentX Launchpad', inline: true }
            ])
            .setColor('#FFD700')
            .setTimestamp(new Date(mint.saleDate));

        // Add iPhone-compatible image
        if (optimizedImageUrl) {
            embed.setImage(optimizedImageUrl);
        }

        // Add Forever Mint sticker as thumbnail
        embed.setThumbnail('attachment://forever-mint-sticker.png');

        return embed;
    }

    convertIpfsToHttp(ipfsUrl) {
        if (!ipfsUrl) return null;
        
        if (ipfsUrl.startsWith('ipfs://')) {
            const hash = ipfsUrl.replace('ipfs://', '');
            return `https://hashpack.b-cdn.net/ipfs/${hash}?optimizer=image&width=1500`;
        }
        
        return ipfsUrl;
    }
}

// Start the bot
const foreverMintBot = new ForeverMintBot();
foreverMintBot.initialize().catch(console.error);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down Forever Mint Bot...');
    foreverMintBot.client.destroy();
    process.exit(0);
});