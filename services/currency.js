/**
 * Currency conversion service for HBAR to USD rates
 */

const axios = require('axios');

class CurrencyService {
    constructor() {
        this.cachedRate = null;
        this.lastFetch = 0;
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
        
        this.axiosInstance = axios.create({
            timeout: 5000,
            headers: {
                'User-Agent': 'Discord-NFT-Bot/1.0'
            }
        });
    }

    /**
     * Get current HBAR to USD exchange rate
     * @returns {number} Current HBAR/USD rate
     */
    async getHbarToUsdRate() {
        const now = Date.now();
        
        // Return cached rate if still valid
        if (this.cachedRate && (now - this.lastFetch) < this.cacheTimeout) {
            return this.cachedRate;
        }

        try {
            // Try CoinGecko API first
            const rate = await this.fetchFromCoinGecko();
            if (rate) {
                this.cachedRate = rate;
                this.lastFetch = now;
                return rate;
            }
        } catch (error) {
            console.error('CoinGecko API failed:', error.message);
        }

        try {
            // Fallback to CoinMarketCap
            const rate = await this.fetchFromCoinMarketCap();
            if (rate) {
                this.cachedRate = rate;
                this.lastFetch = now;
                return rate;
            }
        } catch (error) {
            console.error('CoinMarketCap API failed:', error.message);
        }

        // If all APIs fail, return cached rate or default
        if (this.cachedRate) {
            console.warn('Using cached HBAR rate due to API failures');
            return this.cachedRate;
        }

        console.warn('All currency APIs failed, using default rate');
        return 0.05; // Default fallback rate
    }

    /**
     * Fetch HBAR rate from CoinGecko
     * @returns {number|null} HBAR/USD rate or null if failed
     */
    async fetchFromCoinGecko() {
        try {
            const response = await this.axiosInstance.get(
                'https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd'
            );

            if (response.data && response.data['hedera-hashgraph'] && response.data['hedera-hashgraph'].usd) {
                const rate = parseFloat(response.data['hedera-hashgraph'].usd);
                console.log(`Fetched HBAR rate from CoinGecko: $${rate}`);
                return rate;
            }

            return null;
        } catch (error) {
            throw new Error(`CoinGecko API error: ${error.message}`);
        }
    }

    /**
     * Fetch HBAR rate from CoinMarketCap (requires API key)
     * @returns {number|null} HBAR/USD rate or null if failed
     */
    async fetchFromCoinMarketCap() {
        const apiKey = process.env.COINMARKETCAP_API_KEY;
        
        if (!apiKey) {
            throw new Error('CoinMarketCap API key not provided');
        }

        try {
            const response = await this.axiosInstance.get(
                'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest',
                {
                    params: {
                        symbol: 'HBAR',
                        convert: 'USD'
                    },
                    headers: {
                        'X-CMC_PRO_API_KEY': apiKey
                    }
                }
            );

            if (response.data && response.data.data && response.data.data.HBAR) {
                const rate = parseFloat(response.data.data.HBAR.quote.USD.price);
                console.log(`Fetched HBAR rate from CoinMarketCap: $${rate}`);
                return rate;
            }

            return null;
        } catch (error) {
            throw new Error(`CoinMarketCap API error: ${error.message}`);
        }
    }

    /**
     * Convert HBAR amount to USD
     * @param {number} hbarAmount - Amount in HBAR
     * @param {number} rate - HBAR/USD rate (optional, will fetch if not provided)
     * @returns {number} Amount in USD
     */
    async convertHbarToUsd(hbarAmount, rate = null) {
        if (!rate) {
            rate = await this.getHbarToUsdRate();
        }
        
        return hbarAmount * rate;
    }

    /**
     * Format currency amount for display
     * @param {number} amount - Amount to format
     * @param {string} currency - Currency code (USD, HBAR)
     * @returns {string} Formatted currency string
     */
    formatCurrency(amount, currency = 'USD') {
        if (currency === 'USD') {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        } else if (currency === 'HBAR') {
            return `${amount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6
            })} ℏ`;
        }
        
        return amount.toString();
    }

    /**
     * Get cached rate info for debugging
     * @returns {Object} Cache information
     */
    getCacheInfo() {
        return {
            cachedRate: this.cachedRate,
            lastFetch: new Date(this.lastFetch),
            cacheAge: Date.now() - this.lastFetch,
            cacheValid: (Date.now() - this.lastFetch) < this.cacheTimeout
        };
    }
}

module.exports = new CurrencyService();
