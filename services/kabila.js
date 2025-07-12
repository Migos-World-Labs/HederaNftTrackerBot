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

            // Kabila API returns a regular JSON array, not JSONEachRow format
            const activities = Array.isArray(response.data) ? response.data : [];

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
                timeRange: allTimeListings ? '365d' : '7d',
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

            // Kabila API returns a regular JSON array, not JSONEachRow format
            const activities = Array.isArray(response.data) ? response.data : [];

            if (activities.length === 0) {
                return [];
            }
            
            // Filter only actual listings (must have seller and price, but no buyer)
            const listingsOnly = activities.filter(activity => {
                const hasListingData = activity.sellerId && 
                    activity.sellerId !== null &&
                    activity.sellerId !== '' &&
                    activity.price && 
                    activity.price > 0 &&
                    (!activity.buyerId || activity.buyerId === '') && // No buyer means it's still listed
                    activity.activityType === 'LISTING';
                
                return hasListingData;
            });
            
            const formattedListings = this.formatListingsData(listingsOnly);
            
            // Filter for recent listings only if not fetching all time listings
            if (allTimeListings) {
                return formattedListings;
            } else {
                // Filter for recent listings (within last 15 minutes for live monitoring)
                const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
                const recentListings = formattedListings.filter(listing => {
                    const listingTimestamp = new Date(listing.timestamp).getTime();
                    return listingTimestamp > fifteenMinutesAgo;
                });

                return recentListings;
            }

        } catch (error) {
            if (error.response) {
                console.error('Kabila API error for listings:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    url: error.config?.url,
                    data: typeof error.response.data === 'string' ? error.response.data.substring(0, 200) : error.response.data
                });
            } else if (error.request) {
                console.error('Kabila API listings request failed - no response received');
            } else {
                console.error('Kabila API listings request setup error:', error.message);
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
        try {
            // Check cache first
            const cacheKey = `floor_${tokenId}`;
            const cached = this.floorPriceCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                console.log(`Using cached floor price for ${tokenId}: ${cached.data.price_hbar} HBAR`);
                return cached.data;
            }
            
            console.log(`Fetching fresh floor price for collection ${tokenId}...`);
            
            // Get recent sales for this collection to determine floor price
            const params = {
                tokenId: tokenId,
                timeRange: '30d',
                skip: 0,
                limit: 100,
                fields: 'tokenId,serialNumber,name,imageCid,imageType,activityType,subactivityType,price,currency,buyerId,sellerId,createdAt,rank'
            };
            
            const response = await this.axiosInstance.get('/activity', {
                params: params
            });

            if (!response.data) {
                console.log('No floor price data returned from Kabila API');
                return null;
            }

            // Kabila API returns a regular JSON array, not JSONEachRow format
            const activities = Array.isArray(response.data) ? response.data : [];

            // Filter for active listings only
            const listings = activities.filter(activity => 
                activity.activityType === 'LISTING' && 
                (!activity.buyerId || activity.buyerId === '') && 
                activity.price > 0
            );

            if (listings.length === 0) {
                console.log('No valid listings found for floor price calculation');
                return null;
            }

            // Find the lowest price
            const prices = listings.map(listing => this.parseHbarAmount(listing.price));
            const floorPriceHbar = Math.min(...prices);
            
            console.log(`Floor price for ${tokenId}: ${floorPriceHbar} HBAR`);
            
            const result = {
                price_hbar: floorPriceHbar,
                listing_count: listings.length,
                last_updated: new Date()
            };
            
            // Cache the result
            this.floorPriceCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            return result;

        } catch (error) {
            console.error(`Error fetching floor price for ${tokenId}:`, error.message);
            return null;
        }
    }

    /**
     * Format raw listings data from API into standardized format
     * @param {Array} rawListings - Raw listings data from API
     * @returns {Array} Formatted listings data
     */
    formatListingsData(rawListings) {
        return rawListings.map(listing => {
            const imageUrl = listing.imageCid ? `https://ipfs.io/ipfs/${listing.imageCid}` : null;
            
            return {
                id: `${listing.tokenId}-${listing.serialNumber}-${listing.createdAt}`,
                nft_name: listing.name || 'Unknown NFT',
                collection_name: listing.name || 'Unknown Collection',
                token_id: listing.tokenId,
                serial_id: listing.serialNumber,
                serial_number: listing.serialNumber,
                price_hbar: this.parseHbarAmount(listing.price),
                seller: this.formatAddress(listing.sellerId),
                timestamp: listing.createdAt,
                image_url: imageUrl,
                imageCDN: imageUrl,
                nftImage: imageUrl,
                imageFile: imageUrl,
                image: imageUrl,
                imageUrl: imageUrl,
                metadata: null,
                data: null,
                collection_image_url: null,
                rarity: null,
                rank: listing.rank || null,
                marketplace: 'Kabila',
                listing_id: `${listing.tokenId}-${listing.serialNumber}`,
                sale_type: 'Listing',
                attributes: [],
                payment_token: { symbol: 'HBAR' },
                listing_url: `https://kabila.app/marketplace/nft/${listing.tokenId}/${listing.serialNumber}`,
                collection_url: `https://kabila.app/marketplace/collection/${listing.tokenId}`,
                floor_price: null,
                days_since_mint: null
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
            const imageUrl = sale.imageCid ? `https://ipfs.io/ipfs/${sale.imageCid}` : null;
            
            return {
                id: `${sale.tokenId}-${sale.serialNumber}-${sale.createdAt}`,
                nft_name: sale.name || 'Unknown NFT',
                collection_name: sale.name || 'Unknown Collection',
                token_id: sale.tokenId,
                serial_id: sale.serialNumber,
                serial_number: sale.serialNumber,
                price_hbar: this.parseHbarAmount(sale.price),
                buyer: this.formatAddress(sale.buyerId),
                seller: this.formatAddress(sale.sellerId),
                timestamp: sale.createdAt,
                image_url: imageUrl,
                imageCDN: imageUrl,
                nftImage: imageUrl,
                imageFile: imageUrl,
                image: imageUrl,
                imageUrl: imageUrl,
                metadata: null,
                data: null,
                collection_image_url: null,
                rarity: null,
                rank: sale.rank || null,
                marketplace: 'Kabila',
                transaction_hash: null,
                saleTransactionId: null,
                transaction_id: null,
                sale_type: 'Sale',
                attributes: [],
                payment_token: { symbol: 'HBAR' },
                listing_url: `https://kabila.app/marketplace/nft/${sale.tokenId}/${sale.serialNumber}`,
                collection_url: `https://kabila.app/marketplace/collection/${sale.tokenId}`,
                previous_price: null
            };
        });
    }

    /**
     * Parse HBAR amount from various possible formats
     * @param {string|number} amount - Amount in various formats
     * @returns {number} Amount in HBAR
     */
    parseHbarAmount(amount) {
        if (!amount) return 0;
        
        // If amount is in tinybars (smallest unit), convert to HBAR
        if (typeof amount === 'string' && amount.includes('tinybar')) {
            const tinybars = parseInt(amount.replace(/[^\d]/g, ''));
            return tinybars / 100000000; // 1 HBAR = 100,000,000 tinybars
        }
        
        // If it's already in HBAR
        const hbarAmount = parseFloat(amount);
        return isNaN(hbarAmount) ? 0 : hbarAmount;
    }

    /**
     * Format Hedera address for display
     * @param {string} address - Raw address
     * @returns {string} Formatted address
     */
    formatAddress(address) {
        if (!address) return 'Unknown';
        
        // If it's a Hedera account ID (0.0.xxxxx format)
        if (address.includes('.')) {
            return address;
        }
        
        // If it's a long hex address, truncate it
        if (address.length > 42) {
            return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        }
        
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
                    timeRange: '1d',
                    skip: 0,
                    limit: 1,
                    fields: 'tokenId'
                }
            });
            return response.status === 200;
        } catch (error) {
            console.error('Kabila health check failed:', error.message);
            return false;
        }
    }
}

module.exports = new KabilaService();