/**
 * Kabila marketplace API service for fetching NFT sales data
 */

const axios = require('axios');

class KabilaService {
    constructor() {
        this.baseURLs = [
            'https://api.kabila.app/marketplace/analytics',
            'https://labs.kabila.app/api/marketplace/analytics',
            'https://api.kabila.app',
            'https://labs.kabila.app/api'
        ];
        this.currentBaseURL = this.baseURLs[0];
        this.axiosInstance = axios.create({
            timeout: 15000,
            headers: {
                'User-Agent': 'Discord-NFT-Bot/1.0',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
    }

    /**
     * Get recent NFT sales from Kabila marketplace
     * @param {number} limit - Number of sales to fetch
     * @returns {Array} Array of sale objects
     */
    async getRecentSales(limit = 50) {
        try {
            console.log('Fetching recent sales from Kabila...');
            
            // Use the correct Kabila Market Analytics API endpoint
            const baseURL = 'https://labs.kabila.app';
            const endpoint = '/api/marketplace/analytics/activity';
            
            const headers = {
                'User-Agent': 'Discord-NFT-Bot/1.0',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            // Set up parameters according to Kabila API specification
            const params = {
                limit: limit,
                activityType: 'SALE', // Filter for sales only (must be uppercase)
                timeRange: '1w', // Get sales from last week
                format: 'JSON'
            };

            console.log(`Fetching from Kabila API: ${baseURL}${endpoint}`);
            
            let response;
            try {
                response = await axios.get(`${baseURL}${endpoint}`, {
                    params,
                    headers,
                    timeout: 15000
                });
                
                console.log(`Successfully connected to Kabila Market Analytics API`);
            } catch (error) {
                const status = error.response?.status;
                const message = error.response?.data?.message || error.message;
                console.log(`Kabila API request failed: ${status} - ${message}`);
                
                if (status === 401 || status === 403) {
                    console.log('Kabila API requires valid authentication. Please check your API key.');
                }
                
                return [];
            }

            const responseData = response.data;
            
            // Handle Kabila API response format: {meta: [...], data: [...], rows: number}
            if (!responseData.data || !Array.isArray(responseData.data)) {
                console.log('Unexpected Kabila API response format:', Object.keys(responseData));
                return [];
            }

            const rawSales = responseData.data;
            console.log(`Found ${rawSales.length} sales from Kabila`);
            
            // All data returned is already filtered to SALE activity type
            // Transform the raw sales data into our standard format
            const sales = rawSales.map((sale, index) => ({
                id: `kabila_${sale.createdAt}_${index}`,
                timestamp: sale.createdAt,
                price: sale.price,
                marketplace: 'Kabila',
                // Add default values for missing fields that will be populated by formatSalesData
                tokenId: sale.tokenId || 'unknown',
                serialNumber: sale.serialNumber || index,
                seller: sale.seller || 'unknown',
                buyer: sale.buyer || 'unknown',
                nftName: sale.nftName || `NFT #${index}`,
                collectionName: sale.collectionName || 'Unknown Collection'
            }));
            
            console.log(`Processed ${sales.length} sales from Kabila`);

            // Format the sales data
            const formattedSales = this.formatSalesData(sales);
            console.log(`Formatted ${formattedSales.length} Kabila sales`);

            return formattedSales;

        } catch (error) {
            console.error('Error fetching Kabila sales:', error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Get detailed NFT information from Kabila
     * @param {string} tokenId - Token ID of the NFT
     * @returns {Object} NFT details object
     */
    async getNFTDetails(tokenId) {
        try {
            const endpoints = [
                `/nft/${tokenId}`,
                `/token/${tokenId}`,
                `/nfts/${tokenId}`,
                `/tokens/${tokenId}`
            ];

            for (const endpoint of endpoints) {
                try {
                    const response = await this.axiosInstance.get(endpoint);
                    return response.data;
                } catch (error) {
                    continue;
                }
            }

            return null;
        } catch (error) {
            console.error('Error fetching Kabila NFT details:', error.message);
            return null;
        }
    }

    /**
     * Format raw sales data from API into standardized format
     * @param {Array} rawSales - Raw sales data from API
     * @returns {Array} Formatted sales data
     */
    formatSalesData(rawSales) {
        if (!Array.isArray(rawSales)) {
            return [];
        }

        return rawSales.map(sale => {
            try {
                // Handle different field naming conventions
                const saleId = sale.id || sale.sale_id || sale.transaction_id || sale.tx_id;
                const timestamp = sale.timestamp || sale.created_at || sale.date || sale.block_timestamp;
                const tokenId = sale.token_id || sale.tokenId || sale.collection_id || sale.contract_address;
                const serialNumber = sale.serial_number || sale.serialNumber || sale.token_serial || sale.nft_id;
                const price = sale.price || sale.amount || sale.sale_price;
                const seller = sale.seller || sale.from || sale.seller_address;
                const buyer = sale.buyer || sale.to || sale.buyer_address;
                const nftName = sale.nft_name || sale.token_name || sale.name || sale.title;
                const collectionName = sale.collection_name || sale.collection || sale.project_name;
                const imageUrl = sale.image || sale.image_url || sale.metadata?.image;

                // Parse price to HBAR
                const priceInHbar = this.parseHbarAmount(price);

                // Create standardized sale object
                const formattedSale = {
                    id: saleId,
                    timestamp: new Date(timestamp).getTime(),
                    tokenId: this.formatTokenId(tokenId),
                    serialNumber: serialNumber,
                    price: priceInHbar,
                    seller: this.formatAddress(seller),
                    buyer: this.formatAddress(buyer),
                    nftName: nftName || `NFT #${serialNumber}`,
                    collectionName: collectionName || 'Unknown Collection',
                    imageUrl: imageUrl,
                    marketplace: 'Kabila',
                    marketplaceUrl: this.generateMarketplaceUrl(tokenId, serialNumber),
                    explorerUrl: this.generateExplorerUrl(saleId),
                    // Additional metadata
                    metadata: {
                        rarity: sale.rarity || sale.rarity_rank,
                        rank: sale.rank || sale.rarity_rank,
                        attributes: sale.attributes || sale.traits,
                        ...sale.metadata
                    }
                };

                return formattedSale;
            } catch (error) {
                console.error('Error formatting Kabila sale:', error);
                return null;
            }
        }).filter(sale => sale !== null);
    }

    /**
     * Parse HBAR amount from various possible formats
     * @param {string|number} amount - Amount in various formats
     * @returns {number} Amount in HBAR
     */
    parseHbarAmount(amount) {
        if (!amount) return 0;

        // Convert to string for parsing
        const amountStr = String(amount);

        // If it's already in HBAR format (decimal)
        if (amountStr.includes('.')) {
            return parseFloat(amountStr);
        }

        // If it's in tinybars (8 decimal places)
        if (amountStr.length > 8) {
            return parseFloat(amountStr) / 100000000;
        }

        // Default to treating as HBAR
        return parseFloat(amountStr) || 0;
    }

    /**
     * Format token ID to standard Hedera format
     * @param {string} tokenId - Raw token ID
     * @returns {string} Formatted token ID
     */
    formatTokenId(tokenId) {
        if (!tokenId) return '';
        
        // If already in 0.0.xxxxx format
        if (tokenId.includes('0.0.')) {
            return tokenId;
        }

        // If it's just numbers, add 0.0. prefix
        if (/^\d+$/.test(tokenId)) {
            return `0.0.${tokenId}`;
        }

        return tokenId;
    }

    /**
     * Format Hedera address for display
     * @param {string} address - Raw address
     * @returns {string} Formatted address
     */
    formatAddress(address) {
        if (!address) return 'Unknown';
        
        // If it's a Hedera account ID format
        if (address.includes('0.0.')) {
            return address;
        }

        // If it's a long hex address, truncate it
        if (address.length > 20) {
            return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        }

        return address;
    }

    /**
     * Generate marketplace URL for an NFT
     * @param {string} tokenId - Token ID
     * @param {string} serialNumber - Serial number
     * @returns {string} Marketplace URL
     */
    generateMarketplaceUrl(tokenId, serialNumber) {
        if (!tokenId) return null;
        
        const cleanTokenId = tokenId.replace('0.0.', '');
        return `https://kabila.app/nft/${cleanTokenId}/${serialNumber || ''}`;
    }

    /**
     * Generate explorer URL for a transaction
     * @param {string} transactionId - Transaction ID
     * @returns {string} Explorer URL
     */
    generateExplorerUrl(transactionId) {
        if (!transactionId) return null;
        return `https://hashscan.io/mainnet/transaction/${transactionId}`;
    }

    /**
     * Health check for Kabila API
     * @returns {boolean} True if API is responsive
     */
    async healthCheck() {
        try {
            // Try a simple endpoint to check if API is available
            const response = await this.axiosInstance.get('/health', { timeout: 5000 });
            return response.status === 200;
        } catch (error) {
            // Try alternative health check endpoints
            const healthEndpoints = ['/', '/status', '/ping'];
            
            for (const endpoint of healthEndpoints) {
                try {
                    await this.axiosInstance.get(endpoint, { timeout: 3000 });
                    return true;
                } catch (e) {
                    continue;
                }
            }
            
            console.log('Kabila API health check failed');
            return false;
        }
    }
}

module.exports = new KabilaService();