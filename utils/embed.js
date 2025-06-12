/**
 * Discord embed utilities for formatting NFT sale messages
 */

const { EmbedBuilder } = require('discord.js');
const currencyService = require('../services/currency');

class EmbedUtils {
    /**
     * Create a Discord embed for an NFT sale
     * @param {Object} sale - Sale data object
     * @param {number} hbarRate - Current HBAR to USD rate
     * @returns {EmbedBuilder} Discord embed object
     */
    createSaleEmbed(sale, hbarRate) {
        const usdValue = sale.price_hbar * hbarRate;
        
        const embed = new EmbedBuilder()
            .setTitle(`🔥 NFT Sale: ${sale.nft_name}`)
            .setColor('#00ff00') // Green for sales
            .setTimestamp(new Date(sale.timestamp));

        // Add collection info if available
        if (sale.collection_name && sale.collection_name !== 'Unknown Collection') {
            embed.setAuthor({
                name: sale.collection_name,
                iconURL: null // Could add collection icon if available
            });
        }

        // Add NFT image if available (convert IPFS to HTTP URL)
        if (sale.image_url) {
            const imageUrl = this.convertIpfsToHttp(sale.image_url);
            if (imageUrl) {
                embed.setThumbnail(imageUrl);
            }
        }

        // Price information (most important, so it goes first)
        embed.addFields({
            name: '💰 Sale Price',
            value: `${currencyService.formatCurrency(sale.price_hbar, 'HBAR')}\n${currencyService.formatCurrency(usdValue, 'USD')}`,
            inline: true
        });

        // Buyer and Seller
        embed.addFields(
            {
                name: '👤 Buyer',
                value: `\`${sale.buyer}\``,
                inline: true
            },
            {
                name: '👤 Seller',
                value: `\`${sale.seller}\``,
                inline: true
            }
        );

        // Rarity and Rank if available
        if (sale.rarity || sale.rank) {
            let rarityText = '';
            if (sale.rarity) rarityText += `**Rarity:** ${sale.rarity}`;
            if (sale.rank) {
                if (rarityText) rarityText += '\n';
                rarityText += `**Rank:** #${sale.rank}`;
            }
            
            embed.addFields({
                name: '🏆 Rarity Info',
                value: rarityText,
                inline: true
            });
        }

        // Token ID and Marketplace
        embed.addFields(
            {
                name: '🔗 Token ID',
                value: `\`${sale.token_id}\``,
                inline: true
            },
            {
                name: '🏪 Marketplace',
                value: sale.marketplace,
                inline: true
            }
        );

        // Transaction hash if available
        if (sale.transaction_hash) {
            embed.addFields({
                name: '📝 Transaction',
                value: `[View on HashScan](https://hashscan.io/mainnet/transaction/${sale.transaction_hash})`,
                inline: false
            });
        }

        // Add footer with additional info
        embed.setFooter({
            text: `SentX • HBAR Rate: ${currencyService.formatCurrency(hbarRate, 'USD')}/ℏ`
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
}

module.exports = new EmbedUtils();
