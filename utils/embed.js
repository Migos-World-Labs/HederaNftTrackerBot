/**
 * Discord embed utilities for formatting NFT sale messages
 */

const { EmbedBuilder } = require('discord.js');
const currencyService = require('../services/currency');
const sentxService = require('../services/sentx');
const hederaService = require('../services/hedera');

class EmbedUtils {
    /**
     * Create a Discord embed for an NFT sale
     * @param {Object} sale - Sale data object
     * @param {number} hbarRate - Current HBAR to USD rate
     * @returns {EmbedBuilder} Discord embed object
     */
    async createSaleEmbed(sale, hbarRate) {
        const usdValue = sale.price_hbar * hbarRate;
        const marketplace = sale.marketplace || 'SentX';
        
        // Create a more friendly title and description
        const nftName = sale.nft_name || `NFT #${sale.serial_number || 'Unknown'}`;
        const collectionName = sale.collection_name && sale.collection_name !== 'Unknown Collection' 
            ? sale.collection_name 
            : 'NFT Collection';
        
        // Determine if this was an order fill or direct sale
        const saleType = sale.sale_type || 'Sale';
        const isOrderFill = saleType === 'Order' || saleType === 'OrderFill';
        const saleTypeText = isOrderFill ? 'order was filled' : 'just sold';
        const emoji = isOrderFill ? '📋' : '🎉';
        
        const embed = new EmbedBuilder()
            .setTitle(`${emoji} ${nftName} ${saleTypeText}!`)
            .setDescription(`A new ${isOrderFill ? 'order fill' : 'sale'} happened on ${marketplace} for **$${usdValue.toFixed(2)} USD** (${sale.price_hbar} HBAR)`)
            .setColor('#FFFFFF')
            .setTimestamp(new Date(sale.timestamp));

        // Add collection info prominently with floor price
        if (sale.collection_name && sale.collection_name !== 'Unknown Collection') {
            // Fetch floor price for the collection
            const floorPriceData = await sentxService.getCollectionFloorPrice(sale.token_id);
            let collectionTitle = `${collectionName} Collection`;
            
            if (floorPriceData && floorPriceData.price_hbar) {
                const floorUsdValue = floorPriceData.price_hbar * hbarRate;
                collectionTitle += ` • Floor: ${floorPriceData.price_hbar} HBAR ($${floorUsdValue.toFixed(2)})`;
            }
            
            embed.setAuthor({
                name: collectionTitle,
                iconURL: null
            });
        }

        // Add NFT image with multiple fallback options
        let imageUrl = sale.image_url || sale.imageUrl || sale.nftImage || sale.imageCDN;
        
        // If no image is available, try to fetch NFT details to get metadata
        if (!imageUrl && sale.token_id && sale.serial_id) {
            try {
                console.log(`Fetching NFT details for missing image: ${sale.token_id}/${sale.serial_id}`);
                const nftDetails = await sentxService.getNFTDetails(sale.token_id, sale.serial_id);
                if (nftDetails && nftDetails.image) {
                    imageUrl = nftDetails.image;
                    console.log(`Found image from NFT details: ${imageUrl}`);
                }
            } catch (error) {
                console.log(`Failed to fetch NFT details for image: ${error.message}`);
            }
        }
        
        if (imageUrl) {
            const convertedImageUrl = this.convertIpfsToHttp(imageUrl);
            if (convertedImageUrl) {
                embed.setImage(convertedImageUrl);
            }
        } else {
            console.log(`No image found for NFT: ${sale.nft_name} (${sale.token_id}/${sale.serial_id})`);
        }

        // Get collector information for context
        const buyerHoldings = await hederaService.getAccountNFTHoldings(sale.buyer, sale.token_id);
        const sellerHoldings = await hederaService.getAccountNFTHoldings(sale.seller, sale.token_id);

        const buyerTier = buyerHoldings ? hederaService.getCollectorTier(buyerHoldings.nft_count) : null;
        const sellerTier = sellerHoldings ? hederaService.getCollectorTier(sellerHoldings.nft_count) : null;

        // Main sale information section
        const saleInfo = [
            `💰 **Sale Price:** ${sale.price_hbar} HBAR ≈ $${usdValue.toFixed(2)} USD`,
            `🏪 **Marketplace:** ${marketplace}`,
        ];

        if (sale.serial_number) {
            saleInfo.push(`🔢 **NFT #:** ${sale.serial_number}`);
        }

        embed.addFields({
            name: '📊 Sale Details',
            value: saleInfo.join('\n'),
            inline: false
        });

        // Rarity information (if available)
        if (sale.rarity || sale.rank) {
            let rarityInfo = [];
            if (sale.rank) {
                rarityInfo.push(`🏆 **Rank:** #${sale.rank} in collection`);
            }
            if (sale.rarity) {
                const rarityPercentage = parseFloat((sale.rarity * 100).toFixed(1));
                const rarityTier = this.getRarityTier(sale.rarity);
                rarityInfo.push(`✨ **Rarity:** ${rarityTier} (${rarityPercentage}%)`);
            }
            
            embed.addFields({
                name: '🌟 Rarity Info',
                value: rarityInfo.join('\n'),
                inline: false
            });
        }

        // Buyer and seller information in a more friendly format
        const traderInfo = [];
        
        // Buyer info
        const buyerLabel = buyerTier 
            ? `${buyerTier.emoji} ${buyerTier.name} Collector`
            : '🛒 New Buyer';
        const buyerCount = buyerHoldings ? ` (owns ${hederaService.formatNFTCount(buyerHoldings.nft_count)})` : '';
        traderInfo.push(`**Bought by:** ${buyerLabel}${buyerCount}`);
        traderInfo.push(`*Account:* \`${this.formatAccountId(sale.buyer)}\``);
        
        traderInfo.push(''); // Empty line for separation
        
        // Seller info
        const sellerLabel = sellerTier 
            ? `${sellerTier.emoji} ${sellerTier.name} Collector`
            : '🏪 Seller';
        const sellerCount = sellerHoldings ? ` (owns ${hederaService.formatNFTCount(sellerHoldings.nft_count)})` : '';
        traderInfo.push(`**Sold by:** ${sellerLabel}${sellerCount}`);
        traderInfo.push(`*Account:* \`${this.formatAccountId(sale.seller)}\``);

        embed.addFields({
            name: '👥 Trading Parties',
            value: traderInfo.join('\n'),
            inline: false
        });

        // Technical details section (collapsible-like format)
        const technicalDetails = [
            `🆔 **Collection ID:** \`${sale.token_id}\``,
        ];

        if (sale.transaction_hash) {
            technicalDetails.push(`🔗 **Transaction:** [View on HashScan](https://hashscan.io/mainnet/transaction/${sale.transaction_hash})`);
        }

        embed.addFields({
            name: '🔧 Technical Details',
            value: technicalDetails.join('\n'),
            inline: false
        });

        // Footer with timestamp and branding
        embed.setFooter({
            text: `Built for Hedera by Mauii - Migos World Labs Inc • ${new Date(sale.timestamp).toLocaleString()}`
        });

        return embed;
    }

    /**
     * Create a status embed for the bot
     * @param {boolean} isMonitoring - Whether the bot is currently monitoring
     * @returns {EmbedBuilder} Status embed
     */
    createStatusEmbed(isMonitoring) {
        const embed = new EmbedBuilder()
            .setTitle('🤖 NFT Sales Bot Status')
            .setColor(isMonitoring ? '#00ff00' : '#ff0000')
            .setTimestamp();

        embed.addFields({
            name: '🔍 Monitoring Status',
            value: isMonitoring ? '✅ Active - Tracking SentX sales' : '❌ Inactive',
            inline: false
        });

        embed.addFields({
            name: '⚙️ Configuration',
            value: `**Marketplace:** SentX\n**Network:** Hedera\n**Check Interval:** 30 seconds`,
            inline: false
        });

        return embed;
    }

    /**
     * Create an error embed
     * @param {string} title - Error title
     * @param {string} description - Error description
     * @param {string} details - Additional error details
     * @returns {EmbedBuilder} Error embed
     */
    createErrorEmbed(title, description, details = null) {
        const embed = new EmbedBuilder()
            .setTitle(`❌ ${title}`)
            .setDescription(description)
            .setColor('#ff0000')
            .setTimestamp();

        if (details) {
            embed.addFields({
                name: 'Details',
                value: `\`\`\`${details}\`\`\``,
                inline: false
            });
        }

        return embed;
    }

    /**
     * Create a collection stats embed
     * @param {Object} stats - Collection statistics
     * @returns {EmbedBuilder} Stats embed
     */
    createStatsEmbed(stats) {
        const embed = new EmbedBuilder()
            .setTitle('📊 NFT Sales Statistics')
            .setColor('#0099ff')
            .setTimestamp();

        if (stats.totalSales) {
            embed.addFields({
                name: '📈 Total Sales (24h)',
                value: stats.totalSales.toString(),
                inline: true
            });
        }

        if (stats.totalVolume) {
            embed.addFields({
                name: '💎 Total Volume (24h)',
                value: currencyService.formatCurrency(stats.totalVolume, 'HBAR'),
                inline: true
            });
        }

        if (stats.averagePrice) {
            embed.addFields({
                name: '📊 Average Price',
                value: currencyService.formatCurrency(stats.averagePrice, 'HBAR'),
                inline: true
            });
        }

        return embed;
    }

    /**
     * Format account ID for display in a more user-friendly way
     * @param {string} accountId - Raw account ID
     * @returns {string} Formatted account ID
     */
    formatAccountId(accountId) {
        if (!accountId) return 'Unknown';
        
        // If it's a long account ID, show first 6 and last 4 characters
        if (accountId.length > 15) {
            return `${accountId.substring(0, 6)}...${accountId.substring(accountId.length - 4)}`;
        }
        
        return accountId;
    }

    /**
     * Truncate text to fit Discord limits
     * @param {string} text - Text to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string} Truncated text
     */
    truncateText(text, maxLength = 1024) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    /**
     * Convert IPFS URL to HTTP URL for Discord compatibility
     * @param {string} ipfsUrl - IPFS URL
     * @returns {string|null} HTTP URL or null if invalid
     */
    convertIpfsToHttp(ipfsUrl) {
        if (!ipfsUrl) return null;
        
        // If already HTTP/HTTPS, return as is
        if (ipfsUrl.startsWith('http://') || ipfsUrl.startsWith('https://')) {
            return ipfsUrl;
        }
        
        // Convert IPFS URLs to HTTP gateway URLs
        if (ipfsUrl.startsWith('ipfs://')) {
            const hash = ipfsUrl.replace('ipfs://', '');
            return `https://ipfs.io/ipfs/${hash}`;
        }
        
        return null;
    }

    /**
     * Create a collections list embed
     * @param {Array} collections - Array of tracked collections
     * @returns {EmbedBuilder} Collections list embed
     */
    createCollectionsListEmbed(collections) {
        const embed = new EmbedBuilder()
            .setTitle('📋 Tracked NFT Collections')
            .setColor('#0099ff')
            .setTimestamp();

        if (collections.length === 0) {
            embed.setDescription('No collections are currently being tracked.');
        } else {
            const collectionList = collections.map((collection, index) => {
                const name = collection.name || 'Unknown Collection';
                const addedDate = new Date(collection.addedDate).toLocaleDateString();
                return `${index + 1}. **${name}**\n   Token ID: \`${collection.tokenId}\`\n   Added: ${addedDate}`;
            }).join('\n\n');

            embed.setDescription(collectionList);
            embed.setFooter({ text: `Total: ${collections.length} collection(s)` });
        }

        return embed;
    }

    /**
     * Create a help embed with available commands
     * @returns {EmbedBuilder} Help embed
     */
    createHelpEmbed() {
        const embed = new EmbedBuilder()
            .setTitle('🤖 NFT Sales Bot Commands')
            .setColor('#5865f2')
            .setTimestamp();

        embed.addFields([
            {
                name: '📊 Status Commands',
                value: '`!nft status` - Show bot status and tracked collections\n`!nft list` - List all tracked collections',
                inline: false
            },
            {
                name: '➕ Collection Management',
                value: '`!nft add <token_id> [name]` - Add collection to track\n`!nft remove <token_id>` - Remove collection from tracking',
                inline: false
            },
            {
                name: '📖 Examples',
                value: '`!nft add 0.0.878200 Dead Pixels Ghost Club`\n`!nft remove 0.0.878200`\n`!nft status`',
                inline: false
            },
            {
                name: 'ℹ️ Notes',
                value: '• Token IDs must be in format: `0.0.123456`\n• Collection names are optional but recommended\n• Bot will only track sales from added collections',
                inline: false
            }
        ]);

        return embed;
    }

    /**
     * Format attributes for display
     * @param {Array} attributes - NFT attributes
     * @returns {string} Formatted attributes string
     */
    formatAttributes(attributes) {
        if (!attributes || attributes.length === 0) return 'None';
        
        return attributes
            .slice(0, 5) // Limit to first 5 attributes
            .map(attr => `**${attr.trait_type}:** ${attr.value}`)
            .join('\n');
    }

    /**
     * Get rarity tier based on rarity percentage
     * @param {number} rarityPct - Rarity percentage (0-1)
     * @returns {string} Rarity tier name
     */
    getRarityTier(rarityPct) {
        const percentage = rarityPct * 100;
        
        if (percentage <= 1) return '🔥 Legendary';
        if (percentage <= 5) return '💎 Epic';
        if (percentage <= 20) return '🟣 Rare';
        if (percentage <= 40) return '🔵 Uncommon';
        return '⚪ Common';
    }

    /**
     * Create a welcome embed for new servers
     * @param {string} serverName - Name of the Discord server
     * @returns {EmbedBuilder} Welcome embed
     */
    createWelcomeEmbed(serverName) {
        const embed = new EmbedBuilder()
            .setTitle('🤖 NFT Sales Bot Added!')
            .setDescription(`Thank you for adding the NFT Sales Bot to **${serverName}**!`)
            .setColor('#00ff00')
            .addFields(
                {
                    name: '📈 What I Do',
                    value: 'I track real-time NFT sales from SentX marketplace on Hedera and post detailed notifications here.',
                    inline: false
                },
                {
                    name: '⚙️ Setup Instructions',
                    value: '1. Make sure I have **Send Messages** and **Embed Links** permissions\n2. Use the web interface to add NFT collections to track\n3. I\'ll automatically post sales from your tracked collections!',
                    inline: false
                },
                {
                    name: '🔗 Collection Manager',
                    value: 'Visit the web interface to add/remove NFT collections to track. The link will be provided by the bot owner.',
                    inline: false
                },
                {
                    name: '💰 Features',
                    value: '• Real-time sale notifications\n• HBAR to USD conversion\n• NFT images and details\n• Buyer/seller information\n• Collection filtering',
                    inline: false
                }
            )
            .setTimestamp()
            .setFooter({ text: 'Ready to track your favorite NFT collections!' });

        return embed;
    }
}

module.exports = new EmbedUtils();
