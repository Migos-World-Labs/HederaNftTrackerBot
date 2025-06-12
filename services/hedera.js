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
     * Get account balance and information
     * @param {string} accountId - Hedera account ID (e.g., "0.0.123456")
     * @returns {Object} Account information including balance
     */
    async getAccountInfo(accountId) {
        try {
            // Check cache first
            const cacheKey = `account_${accountId}`;
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }

            console.log(`Fetching account info for ${accountId}`);
            
            const response = await axios.get(`${this.baseUrl}/accounts/${accountId}`, {
                timeout: 10000,
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.data) {
                const accountData = {
                    account_id: response.data.account,
                    balance: this.parseHbarBalance(response.data.balance?.balance),
                    created_timestamp: response.data.created_timestamp,
                    auto_renew_period: response.data.auto_renew_period,
                    key: response.data.key,
                    memo: response.data.memo
                };

                // Cache the result
                this.cache.set(cacheKey, {
                    data: accountData,
                    timestamp: Date.now()
                });

                return accountData;
            }

            return null;
        } catch (error) {
            console.error(`Error fetching account info for ${accountId}:`, error.message);
            return null;
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
     * Get whale tier based on HBAR holdings
     * @param {number} hbarBalance - Account balance in HBAR
     * @returns {Object} Tier information with emoji and name
     */
    getWhaleTier(hbarBalance) {
        if (hbarBalance >= 1000000) return { emoji: '🐋', name: 'Blue Whale', color: '#1E90FF' };
        if (hbarBalance >= 500000) return { emoji: '🐳', name: 'Whale', color: '#4169E1' };
        if (hbarBalance >= 100000) return { emoji: '🦈', name: 'Shark', color: '#2E8B57' };
        if (hbarBalance >= 50000) return { emoji: '🐬', name: 'Dolphin', color: '#20B2AA' };
        if (hbarBalance >= 10000) return { emoji: '🐟', name: 'Fish', color: '#FFD700' };
        if (hbarBalance >= 1000) return { emoji: '🦐', name: 'Shrimp', color: '#FF6347' };
        return { emoji: '🦠', name: 'Plankton', color: '#808080' };
    }

    /**
     * Format HBAR balance for display
     * @param {number} balance - Balance in HBAR
     * @returns {string} Formatted balance string
     */
    formatHbarBalance(balance) {
        if (balance >= 1000000) {
            return `${(balance / 1000000).toFixed(1)}M ℏ`;
        }
        if (balance >= 1000) {
            return `${(balance / 1000).toFixed(1)}K ℏ`;
        }
        return `${balance.toFixed(0)} ℏ`;
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