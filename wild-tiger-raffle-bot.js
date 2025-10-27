const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sentxService = require('./services/sentx');

class WildTigerRaffleBot {
    constructor() {
        this.client = new Client({
            intents: [GatewayIntentBits.Guilds]
        });
        
        // Configuration - Migos World Discord only
        this.servers = [
            {
                guildId: '910963230317355008', // Migos World
                channelId: '1432509660937719839', // Wild Tiger Raffle channel
                name: 'Migos World - Raffle Channel'
            }
        ];
        
        this.processedMints = new Set(); // Track processed mints to prevent duplicates
        this.monitoringTask = null; // Monitoring task reference
        this.isFirstRun = true; // Track if this is the first check after startup
        this.tokenId = '0.0.10053295'; // Wild Tiger Raffle NFT Ticket token ID
        
        // Cache for collection info (updated every 30 seconds)
        this.collectionInfo = null;
        this.lastCollectionFetch = 0;
        this.collectionCacheDuration = 30000; // 30 seconds
    }

    async initialize() {
        try {
            await this.client.login(process.env.DISCORD_TOKEN);
            console.log('✅ Wild Tiger Raffle Bot logged in successfully');
            
            // Start monitoring for raffle ticket mints
            this.startMonitoring();
            
        } catch (error) {
            console.error('❌ Failed to initialize Wild Tiger Raffle Bot:', error.message);
            process.exit(1);
        }
    }

    /**
     * Start monitoring for new raffle ticket mints every 15 seconds
     */
    startMonitoring() {
        console.log('🚀 Starting Wild Tiger Raffle Ticket monitoring...');
        console.log(`🎟️ Monitoring token: ${this.tokenId}`);
        console.log(`📢 Posting to channel: ${this.servers[0].channelId}`);
        
        this.monitoringTask = setInterval(async () => {
            try {
                await this.checkForNewMints();
            } catch (error) {
                console.error('❌ Error checking for raffle ticket mints:', error.message);
            }
        }, 15000); // Check every 15 seconds
    }

    /**
     * Check for new raffle ticket mints
     */
    async checkForNewMints() {
        try {
            // On first run, only fetch 1 mint to establish baseline and avoid rate limits
            const fetchLimit = this.isFirstRun ? 1 : 5;
            
            // Fetch recent raffle ticket mints from SentX
            const recentMints = await sentxService.getRecentRaffleTicketMints(fetchLimit);
            
            if (!recentMints || recentMints.length === 0) {
                if (this.isFirstRun) {
                    console.log('📍 Raffle baseline established - no recent mints found');
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
                    console.log(`📍 Baseline: Found existing raffle ticket ${mint.nft_name} #${mint.serial_number} (not notifying)`);
                    continue;
                }
                
                console.log(`🎟️ NEW WILD TIGER RAFFLE TICKET MINTED: ${mint.nft_name} - ${mint.mint_cost} ${mint.mint_cost_symbol}`);
                console.log(`   Serial: ${mint.serial_number}, Minter: ${mint.minter_address}`);
                
                // Send notifications
                await this.sendMintNotifications(mint);
                
                // Mark as processed
                this.processedMints.add(mintId);
            }
            
            // Mark first run as complete
            if (this.isFirstRun) {
                this.isFirstRun = false;
                console.log('✅ Raffle baseline established - monitoring for new ticket mints only');
            }
            
        } catch (error) {
            console.error('❌ Error fetching raffle ticket mints:', error.message);
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

                // Create embed for raffle ticket
                const embed = await this.createRaffleTicketEmbed(mint);

                const messageOptions = { 
                    embeds: [embed] 
                };

                await channel.send(messageOptions);
                console.log(`✅ Raffle ticket notification sent to ${server.name}`);

            } catch (error) {
                console.error(`❌ Failed to send raffle notification to ${server.name}:`, error.message);
            }
        }
    }

    /**
     * Fetch collection info from Hedera Mirror Node API
     * Note: All 2000 tickets are pre-minted. This fetches the treasury balance to calculate sold count.
     */
    async getCollectionInfo() {
        try {
            const now = Date.now();
            
            // Return cached data if still valid
            if (this.collectionInfo && (now - this.lastCollectionFetch) < this.collectionCacheDuration) {
                return this.collectionInfo;
            }
            
            // Fetch treasury balance to calculate sold tickets
            const treasuryAccount = '0.0.6024410'; // Wild Tigers treasury
            const balanceUrl = `https://mainnet-public.mirrornode.hedera.com/api/v1/tokens/${this.tokenId}/balances?limit=100&order=desc`;
            const response = await axios.get(balanceUrl, { timeout: 5000 });
            
            if (response.data && response.data.balances) {
                const totalSupply = 2000; // All tickets are pre-minted
                
                // Find treasury balance
                console.log(`🔍 Searching for treasury account ${treasuryAccount} in ${response.data.balances.length} balance entries`);
                const treasuryBalance = response.data.balances.find(b => b.account === treasuryAccount);
                const stockRemaining = treasuryBalance ? treasuryBalance.balance : 0;
                const soldCount = totalSupply - stockRemaining;
                console.log(`💰 Treasury balance: ${stockRemaining}, Sold: ${soldCount}`);
                
                this.collectionInfo = {
                    maxSupply: totalSupply,
                    soldCount: soldCount,
                    stockRemaining: stockRemaining,
                    supplyType: 'FINITE',
                    name: 'Wild Tigers Raffle Ticket'
                };
                this.lastCollectionFetch = now;
                
                console.log(`📊 Collection Info: ${soldCount}/${totalSupply} sold (${stockRemaining} remaining)`);
                return this.collectionInfo;
            }
            
            return null;
        } catch (error) {
            console.error('❌ Error fetching collection info from Hedera Mirror Node:', error.message);
            return this.collectionInfo; // Return cached data if available
        }
    }

    async createRaffleTicketEmbed(mint) {
        // Convert IPFS to iPhone-compatible Hashpack CDN
        const optimizedImageUrl = this.convertIpfsToHttp(mint.image_url);
        
        // Fetch collection info to show minted count and remaining
        const collectionInfo = await this.getCollectionInfo();
        
        // Calculate supply info
        let supplyText = '';
        if (collectionInfo) {
            const sold = collectionInfo.soldCount;
            const stock = collectionInfo.stockRemaining;
            const total = collectionInfo.maxSupply;
            
            supplyText = `\nStock: **${stock.toLocaleString()} / ${total.toLocaleString()}** • Sold: **${sold.toLocaleString()}**`;
        }
        
        // Create raffle-themed embed
        const embed = new EmbedBuilder()
            .setTitle(`🎟️ ${mint.nft_name || 'Wild Tiger Raffle Ticket'}`)
            .setDescription(`**New Raffle Ticket Minted!**\n\nMint Cost: **${mint.mint_cost} ${mint.mint_cost_symbol}**${supplyText}`)
            .addFields([
                { name: 'Serial Number', value: `#${mint.serial_number}`, inline: true },
                { name: 'Minted By', value: mint.minter_address ? `\`${mint.minter_address.substring(0, 10)}...\`` : 'Unknown', inline: true }
            ])
            .setColor('#FF6B35') // Orange/red color for raffle theme
            .setThumbnail('https://hashpack.b-cdn.net/ipfs/bafybeifr3suqg4qb35kjfhma6zzmlq4v3z57af7ky45ppaacggvcweoa2q/looped-ticket.gif')
            .setFooter({ text: 'Wild Tiger Raffle • Good Luck! 🍀' })
            .setTimestamp(new Date(mint.mint_date));

        // Add supply breakdown progress bar
        if (collectionInfo) {
            embed.addFields([
                { 
                    name: 'Raffle Sales Progress', 
                    value: `\`\`\`${this.createProgressBar(collectionInfo.soldCount, collectionInfo.maxSupply)}\`\`\``, 
                    inline: false 
                }
            ]);
        }

        // Add main raffle image
        embed.setImage('https://hashpack.b-cdn.net/ipfs/bafybeifr3suqg4qb35kjfhma6zzmlq4v3z57af7ky45ppaacggvcweoa2q/PawsLuckyDraw.png?optimizer=image&width=1500');

        // Add SentX launchpad link
        embed.addFields([
            { name: 'Get Your Tickets', value: `[View Raffle on SentX](https://sentx.io/launchpad/wildtigers-raffle-ticket-public)`, inline: false }
        ]);

        return embed;
    }

    /**
     * Create a visual progress bar for raffle ticket sales
     */
    createProgressBar(current, max, length = 20) {
        const percentage = Math.min(100, Math.round((current / max) * 100));
        const filledLength = Math.round((percentage / 100) * length);
        const emptyLength = length - filledLength;
        
        const filled = '█'.repeat(filledLength);
        const empty = '░'.repeat(emptyLength);
        
        return `${filled}${empty} ${percentage}% (${current.toLocaleString()}/${max.toLocaleString()})`;
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
const raffleBotInstance = new WildTigerRaffleBot();
raffleBotInstance.initialize().catch(console.error);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down Wild Tiger Raffle Bot...');
    raffleBotInstance.client.destroy();
    process.exit(0);
});

module.exports = WildTigerRaffleBot;
