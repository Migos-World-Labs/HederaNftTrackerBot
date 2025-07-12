/**
 * Kabila marketplace API service for fetching NFT sales data
 */

const axios = require('axios');

class KabilaService {
    constructor() {
        this.baseURL = 'https://labs.kabila.app/api/marketplace/analytics';
        this.axiosInstance = axios.create({
            baseURL: this.baseURL,
            timeout: 15000,
            headers: {
                'User-Agent': 'Discord-NFT-Bot/1.0',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        // Cache for floor prices (5 minute TTL)
        this.floorPriceCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get recent NFT sales from Kabila marketplace
     * @param {number} limit - Number of sales to fetch
     * @returns {Array} Array of sale objects
     */
    async getRecentSales(limit = 50) {
        try {
            const params = {
                timeRange: '7d',
                skip: 0,
                limit: limit,
                fields: 'tokenId,serialNumber,name,imageCid,imageType,activityType,subactivityType,price,currency,buyerId,sellerId,createdAt,rank'
            };
            
            const response = await this.axiosInstance.get('/activity', {
                params: params
            });

            if (!response.data) {
                return [];
            }

            // Kabila API returns ClickHouse format with meta and data fields
            const activities = response.data.data || [];

            if (activities.length === 0) {
                return [];
            }
            
            // Filter only actual completed sales (must have buyer and price)
            const salesOnly = activities.filter(activity => {
                const hasCompletedSale = activity.buyerId && 
                    activity.buyerId !== null && 
                    activity.buyerId !== '' &&
                    activity.price && 
                    activity.price > 0 &&
                    (activity.activityType === 'SALE' || activity.activityType === 'LAUNCHPAD_SALE');
                
                return hasCompletedSale;
            });
            
            return this.formatSalesData(salesOnly);

        } catch (error) {
            if (error.response) {
                console.error('Kabila API error:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    url: error.config?.url,
                    data: typeof error.response.data === 'string' ? error.response.data.substring(0, 200) : error.response.data
                });
            } else if (error.request) {
                console.error('Kabila API request failed - no response received');
            } else {
                console.error('Kabila API request setup error:', error.message);
            }
            
            // Return empty array on error to prevent bot from crashing
            return [];
        }
    }

    /**
     * Get recent NFT listings from Kabila marketplace
     * @param {number} limit - Number of listings to fetch
     * @param {boolean} allTimeListings - If true, fetch all listings without time filter (for testing)
     * @returns {Array} Array of listing objects
     */
    async getRecentListings(limit = 50, allTimeListings = false) {
        try {
            const params = {
                timeRange: allTimeListings ? '30d' : '1h', // Use longer timeframe for testing
                skip: 0,
                limit: limit,
                fields: 'tokenId,serialNumber,name,imageCid,imageType,activityType,subactivityType,price,currency,buyerId,sellerId,createdAt,rank'
            };
            
            const response = await this.axiosInstance.get('/activity', {
                params: params
            });

            if (!response.data) {
                return [];
            }

            // Kabila API returns ClickHouse format with meta and data fields
            const activities = response.data.data || [];

            if (activities.length === 0) {
                return [];
            }
            
            // Filter only active listings (no buyer, has price)
            const listingsOnly = activities.filter(activity => {
                const isActiveListing = (!activity.buyerId || activity.buyerId === '') && 
                    activity.price && 
                    activity.price > 0 &&
                    activity.activityType === 'LISTING';
                
                return isActiveListing;
            });
            
            return this.formatListingsData(listingsOnly);

        } catch (error) {
            if (error.response) {
                console.error('Kabila API error:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    url: error.config?.url,
                    data: typeof error.response.data === 'string' ? error.response.data.substring(0, 200) : error.response.data
                });
            } else if (error.request) {
                console.error('Kabila API request failed - no response received');
            } else {
                console.error('Kabila API request setup error:', error.message);
            }
            
            // Return empty array on error to prevent bot from crashing
            return [];
        }
    }

    /**
     * Get collection floor price from Kabila marketplace
     * @param {string} tokenId - Token ID of the collection
     * @returns {Object} Floor price information
     */
    async getCollectionFloorPrice(tokenId) {
        const cacheKey = `floor_${tokenId}`;
        
        // Check cache first
        if (this.floorPriceCache.has(cacheKey)) {
            const cached = this.floorPriceCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const params = {
                tokenId: tokenId,
                timeRange: '1d',
                skip: 0,
                limit: 100,
                fields: 'tokenId,serialNumber,name,price,currency,activityType'
            };
            
            const response = await this.axiosInstance.get('/activity', {
                params: params
            });

            if (!response.data || !response.data.data || response.data.data.length === 0) {
                return { floor_price: null, currency: 'HBAR' };
            }

            const activities = response.data.data;
            
            // Find active listings for this token
            const listings = activities.filter(activity => 
                activity.activityType === 'LISTING' && 
                activity.price && 
                activity.price > 0
            );

            if (listings.length === 0) {
                return { floor_price: null, currency: 'HBAR' };
            }

            // Find minimum price
            const floorPrice = Math.min(...listings.map(listing => this.parseHbarAmount(listing.price)));
            
            const result = {
                floor_price: floorPrice,
                currency: 'HBAR'
            };

            // Cache the result
            this.floorPriceCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;

        } catch (error) {
            console.error('Error fetching Kabila floor price:', error.message);
            return { floor_price: null, currency: 'HBAR' };
        }
    }

    /**
     * Format raw listings data from API into standardized format
     * @param {Array} rawListings - Raw listings data from API
     * @returns {Array} Formatted listings data
     */
    formatListingsData(rawListings) {
        return rawListings.map(listing => {
            return {
                // Use consistent field names with SentX service
                token_id: listing.tokenId,
                serial_id: listing.serialNumber,
                nft_name: listing.name || `NFT #${listing.serialNumber}`,
                collection_name: listing.name || 'Unknown Collection',
                price_hbar: this.parseHbarAmount(listing.price),
                seller: this.formatAddress(listing.sellerId),
                listing_id: `kabila_${listing.tokenId}_${listing.serialNumber}_${listing.createdAt}`,
                created_at: listing.createdAt,
                timestamp: listing.createdAt, // Add timestamp field for embed compatibility
                marketplace: 'Kabila',
                
                // Image handling
                imageUrl: this.formatImageUrl(listing),
                image: this.formatImageUrl(listing),
                nftImage: this.formatImageUrl(listing),
                imageCDN: this.formatImageUrl(listing),
                
                // Collection URL for Kabila marketplace
                collection_url: `https://kabila.app/collection/${listing.tokenId}`,
                
                // Additional Kabila-specific data
                rank: listing.rank || null,
                currency: listing.currency || '0.0.1062664', // Default to HBAR
                activityType: listing.activityType
            };
        });
    }

    /**
     * Format raw sales data from API into standardized format
     * @param {Array} rawSales - Raw sales data from API
     * @returns {Array} Formatted sales data
     */
    formatSalesData(rawSales) {
        return rawSales.map(sale => {
            return {
                // Use consistent field names with SentX service
                token_id: sale.tokenId,
                serial_id: sale.serialNumber,
                nft_name: sale.name || `NFT #${sale.serialNumber}`,
                collection_name: sale.name || 'Unknown Collection',
                price_hbar: this.parseHbarAmount(sale.price),
                buyer: this.formatAddress(sale.buyerId),
                seller: this.formatAddress(sale.sellerId),
                sale_id: `kabila_${sale.tokenId}_${sale.serialNumber}_${sale.createdAt}`,
                transaction_id: `kabila_${sale.tokenId}_${sale.serialNumber}_${sale.createdAt}`,
                created_at: sale.createdAt,
                timestamp: sale.createdAt, // Add timestamp field for embed compatibility
                marketplace: 'Kabila',
                
                // Image handling
                imageUrl: this.formatImageUrl(sale),
                image: this.formatImageUrl(sale),
                nftImage: this.formatImageUrl(sale),
                imageCDN: this.formatImageUrl(sale),
                
                // Collection URL for Kabila marketplace
                collection_url: `https://kabila.app/collection/${sale.tokenId}`,
                
                // Additional Kabila-specific data
                rank: sale.rank || null,
                currency: sale.currency || '0.0.1062664', // Default to HBAR
                activityType: sale.activityType,
                subactivityType: sale.subactivityType
            };
        });
    }

    /**
     * Format image URL from various possible sources
     * @param {Object} nft - NFT object with image data
     * @returns {string|null} Formatted image URL
     */
    formatImageUrl(nft) {
        if (!nft) return null;
        
        // Handle IPFS CIDs
        if (nft.imageCid) {
            if (nft.imageCid.startsWith('ipfs://')) {
                // Convert IPFS URL to HTTP gateway
                const cid = nft.imageCid.replace('ipfs://', '');
                return `https://ipfs.io/ipfs/${cid}`;
            } else if (nft.imageCid.startsWith('hcs://')) {
                // Handle HCS (Hedera Consensus Service) URLs
                const topicId = nft.imageCid.replace('hcs://1/', '');
                return `https://hashinals.sentx.io/${topicId}?optimizer=image&width=640`;
            } else {
                // Assume it's a bare CID
                return `https://ipfs.io/ipfs/${nft.imageCid}`;
            }
        }
        
        return null;
    }

    /**
     * Parse HBAR amount from various possible formats
     * @param {string|number} amount - Amount in various formats
     * @returns {number} Amount in HBAR
     */
    parseHbarAmount(amount) {
        if (!amount) return 0;
        
        // If it's already a number, return as-is
        if (typeof amount === 'number') {
            return amount;
        }
        
        // Convert string to number
        const parsed = parseFloat(amount);
        return isNaN(parsed) ? 0 : parsed;
    }

    /**
     * Format Hedera address for display
     * @param {string} address - Raw address
     * @returns {string} Formatted address
     */
    formatAddress(address) {
        if (!address) return 'Unknown';
        
        // If it's already in 0.0.X format, return as-is
        if (address.startsWith('0.0.')) {
            return address;
        }
        
        // Otherwise return as-is (might be account ID format)
        return address;
    }

    /**
     * Health check for Kabila API
     * @returns {boolean} True if API is responsive
     */
    async healthCheck() {
        try {
            const response = await this.axiosInstance.get('/activity', {
                params: {
                    timeRange: '1h',
                    skip: 0,
                    limit: 1,
                    fields: 'tokenId'
                },
                timeout: 5000
            });
            
            return response.status === 200 && response.data;
        } catch (error) {
            console.error('Kabila API health check failed:', error.message);
            return false;
        }
    }
}

module.exports = new KabilaService();