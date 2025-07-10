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
            const apiKey = process.env.SENTX_API_KEY;
            
            const params = {
                apikey: apiKey,
                activityFilter: 'All', // Get all activity types to capture order fills
                amount: limit,
                page: 1,
                hbarMarketOnly: 1 // Focus on HBAR market
            };
            
            const response = await this.axiosInstance.get('/v1/public/market/activity', {
                params: params
            });

            if (!response.data || !response.data.success) {
                return [];
            }

            if (!response.data.marketActivity || response.data.marketActivity.length === 0) {
                return [];
            }
            
            // Filter only actual completed sales (must have buyer address and completed transaction)
            const salesOnly = response.data.marketActivity.filter(activity => {
                const hasCompletedSale = activity.buyerAddress && 
                    activity.buyerAddress !== null && 
                    activity.salePrice && 
                    activity.salePrice > 0 &&
                    // Order fills may not have transaction ID but are still valid completed sales
                    (activity.saleTransactionId !== null || activity.saletype === 'Order');
                
                return hasCompletedSale;
            });
            
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
     * Get recent NFT listings from SentX marketplace
     * @param {number} limit - Number of listings to fetch
     * @param {boolean} allTimeListings - If true, fetch all listings without time filter (for testing)
     * @returns {Array} Array of listing objects
     */
    async getRecentListings(limit = 50, allTimeListings = false) {
        try {
            const apiKey = process.env.SENTX_API_KEY;
            
            const params = {
                apikey: apiKey,
                activityFilter: 'All', // Get all activities to debug what's available
                amount: limit,
                page: 1,
                hbarMarketOnly: 1 // Focus on HBAR market
            };
            
            const response = await this.axiosInstance.get('/v1/public/market/activity', {
                params: params
            });

            if (!response.data || !response.data.success) {
                return [];
            }

            if (!response.data.marketActivity || response.data.marketActivity.length === 0) {
                return [];
            }
            
            // Filter only actual listings (look for any listing-related activity)
            const listingsOnly = response.data.marketActivity.filter(activity => {
                const hasListingData = activity.salePrice && 
                    activity.salePrice > 0 &&
                    activity.sellerAddress &&
                    activity.sellerAddress !== null &&
                    !activity.buyerAddress; // No buyer means it's still listed, not sold
                
                // Accept various listing-related sale types
                const isListingType = activity.saletype && activity.saletype === 'Listed';
                
                const isValidListing = hasListingData && isListingType;
                
                return isValidListing;
            });
            
            const formattedListings = this.formatListingsData(listingsOnly);
            
            // Filter for recent listings only if not fetching all time listings
            if (allTimeListings) {
                // Only log if listings found for testing
                if (formattedListings.length > 0) {
                    console.log(`📋 Found ${formattedListings.length} total listings from SentX API (all time)`);
                }
                return formattedListings;
            } else {
                // Filter for recent listings (within last 15 minutes for live monitoring)
                const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
                const recentListings = formattedListings.filter(listing => {
                    const listingTimestamp = new Date(listing.timestamp).getTime();
                    return listingTimestamp > fifteenMinutesAgo;
                });

                // Only log if listings found - reduces console spam
                if (recentListings.length > 0) {
                    console.log(`📋 Found ${recentListings.length} recent listings from SentX API`);
                }
                return recentListings;
            }

        } catch (error) {
            if (error.response) {
                console.error('SentX API error for listings:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    url: error.config?.url,
                    data: typeof error.response.data === 'string' ? error.response.data.substring(0, 200) : error.response.data
                });
            } else if (error.request) {
                console.error('SentX API listings request failed - no response received');
            } else {
                console.error('SentX API listings request setup error:', error.message);
            }
            
            // Return empty array on error to prevent bot from crashing
            return [];
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
     * Format raw listings data from API into standardized format
     * @param {Array} rawListings - Raw listings data from API
     * @returns {Array} Formatted listings data
     */
    formatListingsData(rawListings) {
        return rawListings.map(listing => {
            return {
                id: `${listing.nftTokenAddress}-${listing.nftSerialId}-${listing.saleDate}`,
                nft_name: listing.nftName || 'Unknown NFT',
                collection_name: listing.collectionName || 'Unknown Collection',
                token_id: listing.nftTokenAddress,
                serial_id: listing.nftSerialId,
                serial_number: listing.nftSerialId,
                price_hbar: this.parseHbarAmount(listing.salePrice),
                seller: this.formatAddress(listing.sellerAddress),
                timestamp: listing.saleDate,
                image_url: listing.imageCDN || listing.nftImage || listing.nftImageUrl || listing.image || listing.imageFile || listing.imageUrl || null,
                imageCDN: listing.imageCDN,
                nftImage: listing.nftImage,
                imageFile: listing.imageFile,
                image: listing.image,
                imageUrl: listing.imageUrl,
                collection_image_url: listing.collectionImage || listing.collectionIcon || null,
                rarity: listing.rarityPct || null,
                rank: listing.rarityRank || null,
                marketplace: 'SentX',
                listing_id: listing.listingId || listing.id || null,
                sale_type: 'Listing',
                attributes: listing.attributes || [],
                payment_token: listing.paymentToken || { symbol: 'HBAR' },
                listing_url: listing.listingUrl ? `https://sentx.io${listing.listingUrl}` : 
                    (listing.collectionFriendlyurl && listing.nftSerialId ? 
                        `https://sentx.io/nft-marketplace/${listing.collectionFriendlyurl}/${listing.nftSerialId}` : 
                        (listing.nftTokenAddress && listing.nftSerialId ? 
                            `https://sentx.io/nft-marketplace/collection/${listing.nftTokenAddress}/${listing.nftSerialId}` : null)),
                collection_url: listing.collectionFriendlyurl ? `https://sentx.io/nft-marketplace/${listing.collectionFriendlyurl}` : `https://sentx.io/nft-marketplace/collection/${listing.nftTokenAddress}`,
                floor_price: listing.floorPrice || null,
                days_since_mint: listing.daysSinceMint || null
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
                id: `${sale.nftTokenAddress}-${sale.nftSerialId}-${sale.saleDate}`,
                nft_name: sale.nftName || 'Unknown NFT',
                collection_name: sale.collectionName || 'Unknown Collection',
                token_id: sale.nftTokenAddress,
                serial_id: sale.nftSerialId,
                serial_number: sale.nftSerialId,
                price_hbar: this.parseHbarAmount(sale.salePrice),
                buyer: this.formatAddress(sale.buyerAddress),
                seller: this.formatAddress(sale.sellerAddress),
                timestamp: sale.saleDate,
                image_url: sale.imageCDN || sale.nftImage || sale.nftImageUrl || sale.image || sale.imageFile || sale.imageUrl || null,
                imageCDN: sale.imageCDN,
                nftImage: sale.nftImage,
                imageFile: sale.imageFile,
                image: sale.image,
                imageUrl: sale.imageUrl,
                collection_image_url: sale.collectionImage || sale.collectionIcon || null,
                rarity: sale.rarityPct || null,
                rank: sale.rarityRank || null,
                marketplace: 'SentX',
                transaction_hash: sale.transactionHash || sale.saleTransactionId || null,
                saleTransactionId: sale.saleTransactionId,
                transaction_id: sale.saleTransactionId,
                sale_type: sale.saletype || 'Sale',
                attributes: sale.attributes || [],
                payment_token: sale.paymentToken || { symbol: 'HBAR' },
                listing_url: sale.listingUrl ? `https://sentx.io${sale.listingUrl}` : 
                    (sale.collectionFriendlyurl && sale.nftSerialId ? 
                        `https://sentx.io/nft-marketplace/${sale.collectionFriendlyurl}/${sale.nftSerialId}` : 
                        (sale.nftTokenAddress && sale.nftSerialId ? 
                            `https://sentx.io/nft-marketplace/collection/${sale.nftTokenAddress}/${sale.nftSerialId}` : null)),
                collection_url: sale.collectionFriendlyurl ? `https://sentx.io/nft-marketplace/${sale.collectionFriendlyurl}` : `https://sentx.io/nft-marketplace/collection/${sale.nftTokenAddress}`,
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
