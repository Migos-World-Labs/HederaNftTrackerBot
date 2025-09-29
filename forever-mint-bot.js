const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const sentxScheduler = require('./services/sentx-scheduler');

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
        this.sentxScheduler = sentxScheduler;
    }

    async initialize() {
        try {
            await this.client.login(process.env.DISCORD_TOKEN);
            console.log('✅ Forever Mint Bot logged in successfully');
            
            // Subscribe to Wild Tigers mint events from centralized scheduler
            this.subscribeToMintEvents();
            
        } catch (error) {
            console.error('❌ Failed to initialize bot:', error.message);
            process.exit(1);
        }
    }

    /**
     * Subscribe to Wild Tigers mint events from the centralized scheduler
     */
    subscribeToMintEvents() {
        console.log('🚀 Subscribing to Wild Tigers Forever Mint events...');
        
        this.sentxScheduler.on('wildTigersMint', async (mint) => {
            await this.handleNewMint(mint);
        });
    }

    async handleNewMint(mint) {
        try {
            const mintId = `${mint.serial_number}-${mint.mint_date}`;
            
            // Skip if already processed
            if (this.processedMints.has(mintId)) {
                return;
            }

            // Handle both live mints and replay mints
            if (mint.isReplay) {
                console.log(`🔄 REPLAY: Processing missed Wild Tigers mint: ${mint.nft_name} #${mint.serial_number}`);
            } else {
                console.log(`🌟 NEW WILD TIGERS FOREVER MINT: ${mint.nft_name} - ${mint.mint_cost} ${mint.mint_cost_symbol}`);
                console.log(`   Serial: ${mint.serial_number}, Minter: ${mint.minter_address}`);
            }

            // Convert mint data format to match what sendMintNotifications expects
            const formattedMint = {
                nftName: mint.nft_name,
                nftSerialId: mint.serial_number,
                salePrice: mint.mint_cost,
                salePriceSymbol: mint.mint_cost_symbol,
                saleDate: mint.mint_date,
                buyerAddress: mint.minter_address,
                nftImage: mint.image_url
            };

            // Send notifications to all configured servers
            await this.sendMintNotifications(formattedMint);
            
            // Mark as processed
            this.processedMints.add(mintId);

        } catch (error) {
            console.error('❌ Error handling Wild Tigers mint:', error.message);
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