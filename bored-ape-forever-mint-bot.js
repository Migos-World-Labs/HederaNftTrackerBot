const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const sentxService = require('./services/sentx');

class BoredApeForeverMintBot {
    constructor() {
        this.client = new Client({
            intents: [GatewayIntentBits.Guilds]
        });
        
        // Configuration for Bored Ape Hedera Club
        this.servers = [
            {
                guildId: '1403386825669873744', // Bored Ape Hedera Club server
                channelId: '1403391275570434218', // Bored Ape Hedera Club channel
                name: 'Bored Ape Hedera Club'
            }
        ];
        
        // Bored Ape Hedera Club specific configuration
        this.tokenId = '0.0.9656915'; // Bored Ape Hedera Club token ID
        this.collectionName = 'Bored Ape Hedera Club';
        
        this.processedMints = new Set(); // Track processed mints to prevent duplicates
        this.monitoringTask = null; // Monitoring task reference
        this.isFirstRun = true; // Track if this is the first check after startup
    }

    async initialize() {
        try {
            await this.client.login(process.env.DISCORD_TOKEN);
            console.log('✅ Bored Ape Forever Mint Bot logged in successfully');
            
            // Auto-detect guild ID from channel
            await this.autoDetectGuildId();
            
            // Start monitoring for mints
            this.startMonitoring();
            
        } catch (error) {
            console.error('❌ Failed to initialize Bored Ape bot:', error.message);
            process.exit(1);
        }
    }

    async autoDetectGuildId() {
        try {
            // Find the guild that contains our target channel
            for (const guild of this.client.guilds.cache.values()) {
                const channel = guild.channels.cache.get('1403391275570434218');
                if (channel) {
                    this.servers[0].guildId = guild.id;
                    console.log(`✅ Auto-detected guild: ${guild.name} (${guild.id})`);
                    break;
                }
            }
        } catch (error) {
            console.error('⚠️ Could not auto-detect guild ID:', error.message);
        }
    }

    /**
     * Start monitoring for new mints every 15 seconds
     */
    startMonitoring() {
        console.log('🚀 Starting Bored Ape Forever Mint monitoring...');
        
        this.monitoringTask = setInterval(async () => {
            try {
                await this.checkForNewMints();
            } catch (error) {
                console.error('❌ Error checking for Bored Ape mints:', error.message);
            }
        }, 15000); // Check every 15 seconds
    }

    /**
     * Check for new Bored Ape mints
     */
    async checkForNewMints() {
        try {
            // On first run, only fetch 1 mint to establish baseline and avoid rate limits
            const fetchLimit = this.isFirstRun ? 1 : 5;
            
            // Fetch recent Bored Ape mints from SentX
            const recentMints = await sentxService.getRecentBoredApeForeverMints(fetchLimit);
            
            if (!recentMints || recentMints.length === 0) {
                if (this.isFirstRun) {
                    console.log('📍 Bored Ape baseline established - no recent mints found');
                    this.isFirstRun = false;
                }
                return;
            }
            
            // Process each mint
            for (const mint of recentMints) {
                const mintId = `${mint.serial_number}-${mint.mint_date}`;
                
                // Skip if already processed
                if (this.processedMints.has(mintId)) {
                    continue;
                }
                
                // On first run, just mark as processed without notifications to establish baseline
                if (this.isFirstRun) {
                    this.processedMints.add(mintId);
                    console.log(`📍 Baseline: Found existing Bored Ape mint ${mint.nft_name} #${mint.serial_number} (not notifying)`);
                    continue;
                }
                
                console.log(`🦍 NEW BORED APE FOREVER MINT: ${mint.nft_name} - ${mint.mint_cost} ${mint.mint_cost_symbol}`);
                console.log(`   Serial: ${mint.serial_number}, Minter: ${mint.minter_address}`);
                
                // Send notifications
                await this.sendMintNotifications(mint);
                
                // Mark as processed
                this.processedMints.add(mintId);
            }
            
            // Mark first run as complete
            if (this.isFirstRun) {
                this.isFirstRun = false;
                console.log('✅ Bored Ape baseline established - monitoring for new mints only');
            }
            
        } catch (error) {
            console.error('❌ Error fetching Bored Ape mints:', error.message);
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

                // Create embed for Bored Ape Hedera Club
                const embed = await this.createMintEmbed(mint);
                
                // Load Bored Ape Forever Mint pack thumbnail
                const thumbnailPath = path.join(__dirname, 'attached_assets', 'BAHC_Forever_Mint_Pack_1759104228478.webp');
                let thumbnailAttachment = null;
                
                if (fs.existsSync(thumbnailPath)) {
                    thumbnailAttachment = new AttachmentBuilder(thumbnailPath, { name: 'bahc-forever-mint-pack.webp' });
                }
                
                const messageOptions = { 
                    content: `🦍 **BORED APE FOREVER MINT ALERT!** ${mint.nft_name}`,
                    embeds: [embed] 
                };
                
                if (thumbnailAttachment) {
                    messageOptions.files = [thumbnailAttachment];
                }

                await channel.send(messageOptions);
                console.log(`✅ Bored Ape Forever Mint notification sent to ${server.name}`);

            } catch (error) {
                console.error(`❌ Failed to send notification to ${server.name}:`, error.message);
            }
        }
    }

    async createMintEmbed(mint) {
        // Convert IPFS to iPhone-compatible Hashpack CDN
        const optimizedImageUrl = this.convertIpfsToHttp(mint.image_url);
        
        const embed = new EmbedBuilder()
            .setTitle(`🦍 BORED APE FOREVER MINT! 🦍`)
            .addFields([
                { name: '🔢 Serial Number', value: `#${mint.serial_number}`, inline: true },
                { name: '💰 Price', value: `${mint.mint_cost || 'Free'} ${mint.mint_cost_symbol || 'HBAR'}`, inline: true }
            ])
            .setColor('#8B4513'); // Brown color for apes

        // Add iPhone-compatible image
        if (optimizedImageUrl) {
            embed.setImage(optimizedImageUrl);
        }

        // Add Bored Ape pack as thumbnail
        embed.setThumbnail('attachment://bahc-forever-mint-pack.webp');

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
const boredApeForeverMintBot = new BoredApeForeverMintBot();
boredApeForeverMintBot.initialize().catch(console.error);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down Bored Ape Forever Mint Bot...');
    boredApeForeverMintBot.client.destroy();
    process.exit(0);
});