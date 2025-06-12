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
                'Accept': 'application/json',
                'X-API-KEY': process.env.SENTX_API_KEY || ''
            }
        });
    }

    /**
     * Get recent NFT sales from SentX marketplace
     * @param {number} limit - Number of sales to fetch
     * @returns {Array} Array of sale objects
     */
    async getRecentSales(limit = 50) {
        try {
            console.log('Fetching recent sales from SentX...');
            
            // Try different possible endpoints for SentX API
            const endpoints = [
                '/v1/nft/sales',
                '/v1/sales',
                '/api/v1/sales',
                '/nft/sales',
                '/sales'
            ];
            
            for (const endpoint of endpoints) {
                try {
                    console.log(`Trying endpoint: ${endpoint}`);
                    const response = await this.axiosInstance.get(endpoint, {
                        params: {
                            limit: limit,
                            network: 'hedera',
                            sort: 'created_at',
                            order: 'desc'
                        }
                    });

                    if (response.data) {
                        console.log(`Success with endpoint: ${endpoint}`);
                        console.log('Response structure:', Object.keys(response.data));
                        
                        // Handle different possible response structures
                        let salesData = [];
                        if (response.data.sales) {
                            salesData = response.data.sales;
                        } else if (response.data.data) {
                            salesData = response.data.data;
                        } else if (Array.isArray(response.data)) {
                            salesData = response.data;
                        } else {
                            console.log('Unknown response structure:', response.data);
                            continue;
                        }

                        if (salesData && salesData.length > 0) {
                            return this.formatSalesData(salesData);
                        }
                    }
                } catch (endpointError) {
                    console.log(`Endpoint ${endpoint} failed:`, endpointError.response?.status || endpointError.message);
                    continue;
                }
            }
            
            console.log('All endpoints failed, trying direct marketplace query...');
            
            // Try a more general marketplace query
            const marketplaceResponse = await this.axiosInstance.get('/v1/marketplace/activity', {
                params: {
                    limit: limit,
                    type: 'sale',
                    network: 'hedera'
                }
            });
            
            if (marketplaceResponse.data) {
                console.log('Marketplace endpoint response:', Object.keys(marketplaceResponse.data));
                const salesData = marketplaceResponse.data.activities || marketplaceResponse.data.data || marketplaceResponse.data;
                if (salesData && salesData.length > 0) {
                    return this.formatSalesData(salesData);
                }
            }

            console.log('No sales data received from any SentX API endpoint');
            return [];

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
     * Get detailed NFT information
     * @param {string} tokenId - Token ID of the NFT
     * @returns {Object} NFT details object
     */
    async getNFTDetails(tokenId) {
        try {
            const response = await this.axiosInstance.get(`/nft/${tokenId}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching NFT details for ${tokenId}:`, error.message);
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
            return {
                id: sale.id,
                nft_name: sale.nft?.name || 'Unknown NFT',
                collection_name: sale.nft?.collection?.name || 'Unknown Collection',
                token_id: sale.nft?.token_id || sale.token_id,
                price_hbar: this.parseHbarAmount(sale.price),
                buyer: this.formatAddress(sale.buyer),
                seller: this.formatAddress(sale.seller),
                timestamp: sale.created_at || sale.timestamp,
                image_url: sale.nft?.image_url || sale.nft?.image || null,
                rarity: sale.nft?.rarity || null,
                rank: sale.nft?.rank || null,
                marketplace: 'SentX',
                transaction_hash: sale.transaction_hash,
                attributes: sale.nft?.attributes || []
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
