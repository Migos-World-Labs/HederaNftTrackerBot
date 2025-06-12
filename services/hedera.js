/**
 * Hedera network service for fetching account information
 */

const axios = require('axios');

class HederaService {
    constructor() {
        this.baseUrl = 'https://mainnet-public.mirrornode.hedera.com/api/v1';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
    }

    /**
     * Get account NFT holdings for a specific token
     * @param {string} accountId - Hedera account ID (e.g., "0.0.123456")
     * @param {string} tokenId - Token ID to check holdings for
     * @returns {Object} Account NFT holdings information
     */
    async getAccountNFTHoldings(accountId, tokenId) {
        try {
            // Check cache first
            const cacheKey = `nft_holdings_${accountId}_${tokenId}`;
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }

            console.log(`Fetching NFT holdings for ${accountId} in token ${tokenId}`);
            
            const response = await axios.get(`${this.baseUrl}/accounts/${accountId}/nfts`, {
                timeout: 10000,
                headers: {
                    'Accept': 'application/json'
                },
                params: {
                    'token.id': tokenId,
                    limit: 100 // Get up to 100 NFTs to count
                }
            });

            if (response.data && response.data.nfts) {
                const nftCount = response.data.nfts.length;
                const accountData = {
                    account_id: accountId,
                    token_id: tokenId,
                    nft_count: nftCount,
                    nfts: response.data.nfts
                };

                // Cache the result
                this.cache.set(cacheKey, {
                    data: accountData,
                    timestamp: Date.now()
                });

                return accountData;
            }

            return { account_id: accountId, token_id: tokenId, nft_count: 0, nfts: [] };
        } catch (error) {
            console.error(`Error fetching NFT holdings for ${accountId}:`, error.message);
            return { account_id: accountId, token_id: tokenId, nft_count: 0, nfts: [] };
        }
    }

    /**
     * Parse HBAR balance from tinybars
     * @param {string|number} tinybars - Balance in tinybars
     * @returns {number} Balance in HBAR
     */
    parseHbarBalance(tinybars) {
        if (!tinybars) return 0;
        return parseFloat(tinybars) / 100000000; // Convert tinybars to HBAR
    }

    /**
     * Get whale tier based on NFT holdings count
     * @param {number} nftCount - Number of NFTs owned from the collection
     * @returns {Object} Tier information with emoji and name
     */
    getCollectorTier(nftCount) {
        if (nftCount >= 50) return { emoji: '🐋', name: 'Whale', color: '#1E90FF' };
        if (nftCount >= 20) return { emoji: '🐬', name: 'Dolphin', color: '#20B2AA' };
        if (nftCount >= 10) return { emoji: '🐟', name: 'Fish', color: '#FFD700' };
        if (nftCount >= 5) return { emoji: '🦐', name: 'Shrimp', color: '#FF6347' };
        if (nftCount >= 2) return { emoji: '🦠', name: 'Plankton', color: '#808080' };
        if (nftCount === 1) return { emoji: '🪙', name: 'Holder', color: '#C0C0C0' };
        return null; // No NFTs
    }

    /**
     * Format NFT count for display
     * @param {number} count - Number of NFTs owned
     * @returns {string} Formatted NFT count string
     */
    formatNFTCount(count) {
        if (count === 0) return '0 NFTs';
        if (count === 1) return '1 NFT';
        return `${count} NFTs`;
    }

    /**
     * Clean up old cache entries
     */
    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Health check for Hedera Mirror Node API
     * @returns {boolean} True if API is responsive
     */
    async healthCheck() {
        try {
            const response = await axios.get(`${this.baseUrl}/network/nodes`, {
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            console.error('Hedera Mirror Node health check failed:', error.message);
            return false;
        }
    }
}

module.exports = new HederaService();