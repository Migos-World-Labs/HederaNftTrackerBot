/**
 * SentX marketplace API service for fetching NFT sales data
 */

const axios = require('axios');
const config = require('../config');

class SentXService {
    constructor() {
        this.baseURL = 'https://api.sentx.io';
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
     * Get recent NFT sales from SentX marketplace
     * @param {number} limit - Number of sales to fetch
     * @returns {Array} Array of sale objects
     */
    async getRecentSales(limit = 50) {
        try {
            console.log('Fetching recent sales from SentX...');
            
            const apiKey = process.env.SENTX_API_KEY;
            console.log('API Key available:', apiKey ? 'Yes' : 'No');
            console.log('API Key length:', apiKey ? apiKey.length : 0);
            
            const params = {
                apikey: apiKey,
                activityFilter: 'Sales', // Focus on sales but we'll also check separately for order fills
                amount: limit,
                page: 1,
                hbarMarketOnly: 1 // Focus on HBAR market
            };
            
            console.log('Request params:', JSON.stringify(params, null, 2));
            
            const response = await this.axiosInstance.get('/v1/public/market/activity', {
                params: params
            });

            if (!response.data || !response.data.success) {
                console.log('No successful response from SentX API');
                return [];
            }

            if (!response.data.marketActivity || response.data.marketActivity.length === 0) {
                console.log('No market activity found');
                return [];
            }

            console.log(`Found ${response.data.marketActivity.length} market activities`);
            
            // Log all sale types to debug order fills
            const saleTypes = [...new Set(response.data.marketActivity.map(a => a.saletype))];
            console.log('Available sale types:', saleTypes);
            
            // Log sample activities for debugging
            if (response.data.marketActivity.length > 0) {
                console.log('Sample activity structure:');
                console.log(JSON.stringify(response.data.marketActivity[0], null, 2));
            }
            
            // Filter only actual completed sales (must have buyer address and completed transaction)
            const salesOnly = response.data.marketActivity.filter(activity => {
                const hasCompletedSale = activity.buyerAddress && 
                    activity.buyerAddress !== null && 
                    activity.salePrice && 
                    activity.salePrice > 0 &&
                    activity.saleTransactionId !== null; // Must have transaction ID for completed sales
                
                if (hasCompletedSale) {
                    console.log(`Including completed sale ${activity.saletype}: ${activity.nftName} - Image: ${activity.nftImage ? 'Yes' : 'No'}`);
                }
                
                return hasCompletedSale;
            });

            console.log(`Filtered to ${salesOnly.length} actual sales`);
            
            return this.formatSalesData(salesOnly);

        } catch (error) {
            if (error.response) {
                console.error('SentX API error:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    url: error.config?.url,
                    data: typeof error.response.data === 'string' ? error.response.data.substring(0, 200) : error.response.data
                });
            } else if (error.request) {
                console.error('SentX API request failed - no response received');
            } else {
                console.error('SentX API request setup error:', error.message);
            }
            
            // Return empty array on error to prevent bot from crashing
            return [];
        }
    }

    /**
     * Get detailed NFT information including metadata
     * @param {string} tokenId - Token ID of the NFT
     * @param {string} serialId - Serial ID of the NFT
     * @returns {Object} NFT details object
     */
    async getNFTDetails(tokenId, serialId = null) {
        try {
            const apiKey = process.env.SENTX_API_KEY;
            
            const params = {
                apikey: apiKey,
                token: tokenId
            };
            
            if (serialId) {
                params.serial = serialId;
            }
            
            const response = await this.axiosInstance.get('/v1/public/nft/details', {
                params: params
            });
            
            if (response.data && response.data.success && response.data.nft) {
                return response.data.nft;
            }
            
            return null;
        } catch (error) {
            console.error(`Error fetching NFT details for ${tokenId}/${serialId}:`, error.message);
            return null;
        }
    }

    /**
     * Get collection floor price from SentX marketplace
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
            
            const apiKey = process.env.SENTX_API_KEY;
            
            // Use the correct floor price endpoint
            const params = {
                apikey: apiKey,
                token: tokenId
            };
            
            const response = await this.axiosInstance.get('/v1/public/market/floor', {
                params: params
            });

            if (!response.data || !response.data.success) {
                console.log('No floor price data returned from SentX API');
                return null;
            }

            if (!response.data.floor || response.data.floor <= 0) {
                console.log('No valid floor price found');
                return null;
            }
            
            const floorPriceHbar = this.parseHbarAmount(response.data.floor);
            
            console.log(`Floor price for ${tokenId}: ${floorPriceHbar} HBAR`);
            
            const result = {
                price_hbar: floorPriceHbar,
                listing_count: null, // Floor endpoint doesn't provide listing count
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
     * Format raw sales data from API into standardized format
     * @param {Array} rawSales - Raw sales data from API
     * @returns {Array} Formatted sales data
     */
    formatSalesData(rawSales) {
        return rawSales.map(sale => {
            // Debug log each sale to identify missing images
            console.log(`Processing ${sale.saletype}: ${sale.nftName}, Image: ${sale.nftImage ? 'Present' : 'Missing'}`);
            
            return {
                id: `${sale.nftTokenAddress}-${sale.nftSerialId}-${sale.saleDate}`,
                nft_name: sale.nftName || 'Unknown NFT',
                collection_name: sale.collectionName || 'Unknown Collection',
                token_id: sale.nftTokenAddress,
                serial_id: sale.nftSerialId,
                price_hbar: this.parseHbarAmount(sale.salePrice),
                buyer: this.formatAddress(sale.buyerAddress),
                seller: this.formatAddress(sale.sellerAddress),
                timestamp: sale.saleDate,
                image_url: sale.nftImage || sale.imageCDN || sale.nftImageUrl || sale.image || null,
                collection_image_url: sale.collectionImage || sale.collectionIcon || null,
                rarity: sale.rarityPct || null,
                rank: sale.rarityRank || null,
                marketplace: 'SentX',
                transaction_hash: sale.transactionHash || sale.saleTransactionId || null,
                sale_type: sale.saletype || 'Sale',
                attributes: sale.attributes || [],
                payment_token: sale.paymentToken || { symbol: 'HBAR' },
                listing_url: sale.listingUrl ? `https://sentx.io${sale.listingUrl}` : null,
                previous_price: sale.previousPrice || null
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
     * Health check for SentX API
     * @returns {boolean} True if API is responsive
     */
    async healthCheck() {
        try {
            const response = await this.axiosInstance.get('/health');
            return response.status === 200;
        } catch (error) {
            console.error('SentX API health check failed:', error.message);
            return false;
        }
    }
}

module.exports = new SentXService();
