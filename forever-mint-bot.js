const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

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
        this.rateLimitBackoff = 60000; // Start with 60 seconds
        this.rateLimitCount = 0;
        this.maxBackoff = 300000; // 5 minutes max
    }

    async initialize() {
        try {
            await this.client.login(process.env.DISCORD_TOKEN);
            console.log('✅ Forever Mint Bot logged in successfully');
            
            // Start monitoring every 15 seconds (rate limit friendly)
            this.startMonitoring();
            
        } catch (error) {
            console.error('❌ Failed to initialize bot:', error.message);
            process.exit(1);
        }
    }

    startMonitoring() {
        console.log('🚀 Starting Forever Mint monitoring...');
        
        // Check every 15 seconds (rate limit friendly)
        cron.schedule('*/15 * * * * *', async () => {
            await this.checkForNewMints();
        });
    }

    async checkForNewMints() {
        try {
            console.log('🔍 Checking for new Forever Mints...');
            
            // Fetch Wild Tigers Forever Mints from SentX Launchpad API
            const response = await axios.get('https://api.sentx.io/v1/public/launchpad/activity', {
                params: {
                    count: 20,
                    offset: 0
                },
                timeout: 10000
            });

            if (response.status === 429) {
                this.handleRateLimit();
                return;
            }

            // Reset rate limit if successful
            if (this.rateLimitCount > 0) {
                console.log('✅ Rate limit recovered - resetting backoff');
                this.rateLimitCount = 0;
                this.rateLimitBackoff = 60000;
            }

            const activities = response.data;
            
            if (!activities || !Array.isArray(activities)) {
                console.log('⚠️ No activities data received');
                return;
            }

            // Filter for Wild Tigers Forever Mints (500 HBAR mints)
            const foreverMints = activities.filter(activity => 
                activity.collectionName === 'Wild Tigers' &&
                activity.saletype === 'Minted' &&
                activity.salePrice === 500 &&
                activity.salePriceSymbol === 'HBAR'
            );

            if (foreverMints.length === 0) {
                console.log('📊 No new Forever Mints found');
                return;
            }

            console.log(`🎯 Found ${foreverMints.length} Forever Mint activities`);

            // Process each mint
            for (const mint of foreverMints) {
                const mintId = `${mint.nftSerialId}-${mint.saleDate}`;
                
                // Skip if already processed
                if (this.processedMints.has(mintId)) {
                    continue;
                }

                console.log(`🌟 NEW FOREVER MINT: ${mint.nftName} - ${mint.salePrice} HBAR`);
                console.log(`   Serial: ${mint.nftSerialId}, Minter: ${mint.buyerAddress}`);

                // Send notifications to all configured servers
                await this.sendMintNotifications(mint);
                
                // Mark as processed
                this.processedMints.add(mintId);
            }

        } catch (error) {
            if (error.response && error.response.status === 429) {
                this.handleRateLimit();
            } else {
                console.error('❌ Error checking for mints:', error.message);
            }
        }
    }

    handleRateLimit() {
        this.rateLimitCount++;
        console.log(`🚫 Rate limit hit (count: ${this.rateLimitCount}) - backing off for ${this.rateLimitBackoff/1000}s`);
        
        // Exponential backoff: 60s → 120s → 240s → 300s (max)
        if (this.rateLimitBackoff < this.maxBackoff) {
            this.rateLimitBackoff = Math.min(this.rateLimitBackoff * 2, this.maxBackoff);
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