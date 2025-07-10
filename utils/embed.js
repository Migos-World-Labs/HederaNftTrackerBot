/**
 * Discord embed utilities for formatting NFT sale messages
 */

const { EmbedBuilder } = require('discord.js');
const currencyService = require('../services/currency');
const sentxService = require('../services/sentx');
const hederaService = require('../services/hedera');
const HashinalService = require('../services/hashinal');

class EmbedUtils {
    constructor() {
        this.hashinalService = new HashinalService();
    }
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

        // Add NFT image with comprehensive fallback options
        // Priority: imageCDN > nftImage > image_url > imageUrl > imageFile > image > metadata.image > media.image
        let imageUrl = sale.imageCDN || 
                       sale.nftImage || 
                       sale.image_url || 
                       sale.imageUrl || 
                       sale.imageFile ||
                       sale.image ||
                       sale.nft_image ||
                       sale.imageData ||
                       (sale.metadata && sale.metadata.image) ||
                       (sale.media && sale.media.image) ||
                       (sale.data && sale.data.image);
        
        // Special debugging for Hashinals and problematic collections
        const knownHashinalTokens = ['0.0.5552189', '0.0.2173899', '0.0.789064', '0.0.1097228'];
        const isHashinal = sale.collection_name && (
            sale.collection_name.toLowerCase().includes('hashinal') ||
            sale.collection_name.toLowerCase().includes('hcs-') ||
            sale.nft_name?.toLowerCase().includes('hashinal') ||
            knownHashinalTokens.includes(sale.token_id) ||
            (sale.metadata && sale.metadata.p === 'hcs-5') // HCS-5 standard marker
        );
        
        // Enhanced debugging for image detection issues
        if (isHashinal || (sale.collection_name && sale.collection_name.includes('Rooster Cartel')) || !imageUrl) {
            const debugType = isHashinal ? 'HASHINAL' : (sale.collection_name?.includes('Rooster Cartel') ? 'ROOSTER CARTEL' : 'NO IMAGE');
            console.log(`🖼️ [${debugType}] Processing image for ${sale.nft_name}`);
            console.log(`  Selected imageUrl: ${imageUrl}`);
            console.log(`  imageCDN: ${sale.imageCDN}`);
            console.log(`  nftImage: ${sale.nftImage}`);
            console.log(`  image_url: ${sale.image_url}`);
            console.log(`  image: ${sale.image}`);
            console.log(`  imageFile: ${sale.imageFile}`);
            console.log(`  metadata.image: ${sale.metadata?.image}`);
            console.log(`  data.image: ${sale.data?.image}`);
            
            // Check for Hashinal-specific image fields
            if (sale.metadata) {
                console.log(`  metadata.files: ${JSON.stringify(sale.metadata.files)}`);
                console.log(`  metadata.uri: ${sale.metadata.uri}`);
                console.log(`  metadata.image_data: ${sale.metadata.image_data}`);
            }
            
            // Log all available fields to identify potential image sources
            if (isHashinal) {
                console.log(`  [HASHINAL DEBUG] All sale fields:`, Object.keys(sale));
            }
        }

        // Use Hashinal service for enhanced image resolution
        if (isHashinal && !imageUrl) {
            console.log(`🔧 [HASHINAL] Attempting enhanced image resolution...`);
            try {
                imageUrl = await this.hashinalService.resolveHashinalImage(sale);
                if (imageUrl) {
                    console.log(`✅ [HASHINAL] Enhanced resolution found image: ${imageUrl}`);
                }
            } catch (error) {
                console.error(`❌ [HASHINAL] Enhanced resolution failed:`, error.message);
            }
        }
        
        // If no image is available, try to fetch NFT details to get metadata
        if (!imageUrl && sale.token_id && (sale.serial_id || sale.serial_number)) {
            try {
                const serialId = sale.serial_id || sale.serial_number;
                console.log(`Fetching NFT details for missing image: ${sale.token_id}/${serialId}`);
                const SentXService = require('../services/sentx.js');
                const sentxService = new SentXService();
                const nftDetails = await sentxService.getNFTDetails(sale.token_id, serialId);
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
                if (sale.collection_name && sale.collection_name.includes('Rooster Cartel')) {
                    console.log(`ROOSTER CARTEL - Successfully set image: ${convertedImageUrl}`);
                }
            } else {
                console.log(`Failed to convert image URL: ${imageUrl}`);
                if (sale.collection_name && sale.collection_name.includes('Rooster Cartel')) {
                    console.log(`ROOSTER CARTEL - Failed to convert URL: ${imageUrl}`);
                }
            }
        } else {
            console.log(`No image found for NFT: ${sale.nft_name} (${sale.token_id}/${sale.serial_id || sale.serial_number})`);
            if (sale.collection_name && sale.collection_name.includes('Rooster Cartel')) {
                console.log(`ROOSTER CARTEL - NO IMAGE FOUND for ${sale.nft_name}`);
            }
        }

        // Get collector information for context
        const buyerHoldings = await hederaService.getAccountNFTHoldings(sale.buyer, sale.token_id);
        const sellerHoldings = await hederaService.getAccountNFTHoldings(sale.seller, sale.token_id);

        const buyerTier = buyerHoldings ? hederaService.getCollectorTier(buyerHoldings.nft_count) : null;
        const sellerTier = sellerHoldings ? hederaService.getCollectorTier(sellerHoldings.nft_count) : null;

        // Main sale information section with collection link
        const collectionLink = sale.collection_url 
            ? `📦 **Collection:** [${sale.collection_name}](${sale.collection_url})`
            : `📦 **Collection:** ${sale.collection_name}`;
            
        const saleInfo = [
            `💰 **Sale Price:** ${sale.price_hbar} HBAR ≈ $${usdValue.toFixed(2)} USD`,
            `🏪 **Marketplace:** ${marketplace}`,
            collectionLink
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
     * Create a Discord embed for an NFT listing
     * @param {Object} listing - Listing data object
     * @param {number} hbarRate - Current HBAR to USD rate
     * @returns {EmbedBuilder} Discord embed object
     */
    async createListingEmbed(listing, hbarRate) {
        const usdValue = listing.price_hbar * hbarRate;
        const marketplace = listing.marketplace || 'SentX';
        
        // Create a more friendly title and description
        const nftName = listing.nft_name || `NFT #${listing.serial_number || 'Unknown'}`;
        const collectionName = listing.collection_name && listing.collection_name !== 'Unknown Collection' 
            ? listing.collection_name 
            : 'NFT Collection';
        
        const embed = new EmbedBuilder()
            .setTitle(`📝 ${nftName} listed for sale!`)
            .setDescription(`A new listing appeared on ${marketplace} for **$${usdValue.toFixed(2)} USD** (${listing.price_hbar} HBAR)`)
            .setColor('#00ff41')
            .setTimestamp(new Date(listing.timestamp));

        // Add collection info prominently with floor price
        if (listing.collection_name && listing.collection_name !== 'Unknown Collection') {
            let collectionTitle = `${collectionName} Collection`;
            
            // Use pre-fetched floor price data if available
            if (listing.floor_price && listing.floor_price > 0) {
                const floorUsdValue = listing.floor_price * hbarRate;
                const priceVsFloor = ((listing.price_hbar / listing.floor_price - 1) * 100).toFixed(1);
                const floorCompare = priceVsFloor > 0 ? `+${priceVsFloor}%` : `${priceVsFloor}%`;
                collectionTitle += ` • Floor: ${listing.floor_price} HBAR ($${floorUsdValue.toFixed(2)}) • ${floorCompare}`;
            }
            
            embed.setAuthor({
                name: collectionTitle,
                iconURL: null
            });
        }

        // Add NFT image with comprehensive fallback options for listings
        let imageUrl = listing.imageCDN || 
                       listing.nftImage || 
                       listing.image_url || 
                       listing.imageUrl || 
                       listing.imageFile ||
                       listing.image ||
                       listing.nft_image ||
                       listing.imageData ||
                       (listing.metadata && listing.metadata.image) ||
                       (listing.media && listing.media.image) ||
                       (listing.data && listing.data.image);
        
        // Additional checks for image URLs in nested data
        if (!imageUrl && listing.nft_data) {
            imageUrl = listing.nft_data.imageCDN || 
                      listing.nft_data.image_url || 
                      listing.nft_data.image ||
                      (listing.nft_data.metadata && listing.nft_data.metadata.image);
        }
        
        // Special debugging for Hashinals and other problematic collections
        const knownHashinalTokens = ['0.0.5552189', '0.0.2173899', '0.0.789064', '0.0.1097228'];
        const isHashinal = listing.collection_name && (
            listing.collection_name.toLowerCase().includes('hashinal') ||
            listing.collection_name.toLowerCase().includes('hcs-') ||
            listing.nft_name?.toLowerCase().includes('hashinal') ||
            knownHashinalTokens.includes(listing.token_id) ||
            (listing.metadata && listing.metadata.p === 'hcs-5') // HCS-5 standard marker
        );
        
        if (isHashinal || !imageUrl) {
            const debugType = isHashinal ? 'HASHINAL LISTING' : 'NO IMAGE LISTING';
            console.log(`🖼️ [${debugType}] Processing image for ${listing.nft_name}`);
            console.log(`  Selected imageUrl: ${imageUrl}`);
            console.log(`  imageCDN: ${listing.imageCDN}`);
            console.log(`  nftImage: ${listing.nftImage}`);
            console.log(`  image_url: ${listing.image_url}`);
            console.log(`  image: ${listing.image}`);
            console.log(`  imageFile: ${listing.imageFile}`);
            console.log(`  metadata.image: ${listing.metadata?.image}`);
            console.log(`  data.image: ${listing.data?.image}`);
            
            // Check for Hashinal-specific image fields
            if (listing.metadata) {
                console.log(`  metadata.files: ${JSON.stringify(listing.metadata.files)}`);
                console.log(`  metadata.uri: ${listing.metadata.uri}`);
                console.log(`  metadata.image_data: ${listing.metadata.image_data}`);
            }
            
            // Log all available fields for Hashinals
            if (isHashinal) {
                console.log(`  [HASHINAL DEBUG] All listing fields:`, Object.keys(listing));
            }
        }

        // Use Hashinal service for enhanced image resolution
        if (isHashinal && !imageUrl) {
            console.log(`🔧 [HASHINAL] Attempting enhanced listing image resolution...`);
            try {
                imageUrl = await this.hashinalService.resolveHashinalImage(listing);
                if (imageUrl) {
                    console.log(`✅ [HASHINAL] Enhanced resolution found listing image: ${imageUrl}`);
                }
            } catch (error) {
                console.error(`❌ [HASHINAL] Enhanced listing resolution failed:`, error.message);
            }
        }
        
        if (imageUrl) {
            const convertedImageUrl = this.convertIpfsToHttp(imageUrl);
            if (convertedImageUrl) {
                embed.setImage(convertedImageUrl);
            } else {
                console.log(`Failed to convert listing image URL: ${imageUrl}`);
            }
        } else {
            // Only log missing images if we have all the data we expect
            if (listing.token_id && listing.serial_number) {
                console.log(`No image found for listing: ${listing.nft_name} (${listing.token_id}/${listing.serial_id || listing.serial_number})`);
            }
        }

        // Note: Seller holdings would require service injection, using basic seller info for now
        const sellerHoldings = null;
        const sellerTier = null;

        // Main listing information section with collection link
        const collectionLink = listing.collection_url 
            ? `📦 **Collection:** [${listing.collection_name}](${listing.collection_url})`
            : `📦 **Collection:** ${listing.collection_name}`;
            
        const listingInfo = [
            `💰 **Asking Price:** ${listing.price_hbar} HBAR ≈ $${usdValue.toFixed(2)} USD`,
            `🏪 **Marketplace:** ${marketplace}`,
            collectionLink
        ];

        if (listing.serial_number) {
            listingInfo.push(`🔢 **NFT #:** ${listing.serial_number}`);
        }

        embed.addFields({
            name: '📊 Listing Details',
            value: listingInfo.join('\n'),
            inline: false
        });

        // Rarity information (if available)
        if (listing.rarity || listing.rank) {
            let rarityInfo = [];
            if (listing.rank) {
                rarityInfo.push(`🏆 **Rank:** #${listing.rank} in collection`);
            }
            if (listing.rarity) {
                const rarityPercentage = parseFloat((listing.rarity * 100).toFixed(1));
                const rarityTier = this.getRarityTier(listing.rarity);
                rarityInfo.push(`✨ **Rarity:** ${rarityTier} (${rarityPercentage}%)`);
            }
            
            embed.addFields({
                name: '🌟 Rarity Info',
                value: rarityInfo.join('\n'),
                inline: false
            });
        }

        // Seller information
        const sellerInfo = [];
        const sellerLabel = '🏪 Seller';
        sellerInfo.push(`**Listed by:** ${sellerLabel}`);
        sellerInfo.push(`*Account:* \`${this.formatAccountId(listing.seller)}\``);

        embed.addFields({
            name: '👤 Seller Info',
            value: sellerInfo.join('\n'),
            inline: false
        });

        // Technical details section
        const technicalDetails = [
            `🆔 **Collection ID:** \`${listing.token_id}\``,
        ];

        if (listing.listing_url) {
            technicalDetails.push(`🔗 **View Listing:** [Open on SentX](${listing.listing_url})`);
        }

        embed.addFields({
            name: '🔧 Technical Details',
            value: technicalDetails.join('\n'),
            inline: false
        });

        // Footer with timestamp and branding
        embed.setFooter({
            text: `Built for Hedera by Mauii - Migos World Labs Inc • ${new Date(listing.timestamp).toLocaleString()}`
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
     * @param {string} ipfsUrl - IPFS URL or other image URL formats
     * @returns {string|null} HTTP URL or null if invalid
     */
    convertIpfsToHttp(ipfsUrl) {
        if (!ipfsUrl) return null;
        
        // If already HTTP/HTTPS, return as is
        if (ipfsUrl.startsWith('http://') || ipfsUrl.startsWith('https://')) {
            return ipfsUrl;
        }
        
        // Handle Hashinals HRL format (hcs://1/topicId)
        if (ipfsUrl.startsWith('hcs://')) {
            // For Hashinals, we need to convert HRL to actual image URL
            // This might require fetching metadata from Hedera Consensus Service
            console.log(`Hashinal HRL detected: ${ipfsUrl} - conversion not yet implemented`);
            return null; // For now, return null until we implement HCS metadata fetching
        }
        
        // Handle various IPFS URL formats
        if (ipfsUrl.startsWith('ipfs://')) {
            const hash = ipfsUrl.replace('ipfs://', '');
            
            // Check if hash contains path (for traditional NFTs and some collections)
            if (hash.includes('/')) {
                return `https://ipfs.io/ipfs/${hash}`;
            }
            
            // For CIDv0 and CIDv1 hashes
            if (hash.startsWith('Qm') || hash.startsWith('baf')) {
                return `https://ipfs.io/ipfs/${hash}`;
            }
            
            // Fallback for other hash formats
            return `https://ipfs.io/ipfs/${hash}`;
        }
        
        // Handle bare IPFS hashes (common in some NFT collections)
        if (ipfsUrl.match(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]+)$/)) {
            return `https://ipfs.io/ipfs/${ipfsUrl}`;
        }
        
        // Handle data URIs (base64 encoded images)
        if (ipfsUrl.startsWith('data:')) {
            // Data URIs are already valid for Discord
            return ipfsUrl;
        }
        
        // Handle Arweave URLs
        if (ipfsUrl.startsWith('ar://')) {
            const hash = ipfsUrl.replace('ar://', '');
            return `https://arweave.net/${hash}`;
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
