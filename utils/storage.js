/**
 * Simple storage utility for bot state and configuration
 * Uses JSON file storage for simplicity
 */

const fs = require('fs');
const path = require('path');

class StorageService {
    constructor() {
        this.dataDir = path.join(__dirname, '..', 'data');
        this.configFile = path.join(this.dataDir, 'bot-state.json');
        this.data = {
            lastProcessedSale: 0,
            processedSales: new Set(),
            trackedCollections: [],
            botStats: {
                totalSalesProcessed: 0,
                startTime: Date.now(),
                lastError: null
            }
        };
    }

    /**
     * Initialize storage system
     */
    init() {
        // Create data directory if it doesn't exist
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
            console.log('Created data directory');
        }

        // Load existing data if available
        this.loadData();
        
        // Set up periodic saves
        setInterval(() => {
            this.saveData();
        }, 60000); // Save every minute
    }

    /**
     * Load data from file
     */
    loadData() {
        try {
            if (fs.existsSync(this.configFile)) {
                const rawData = fs.readFileSync(this.configFile, 'utf8');
                const parsedData = JSON.parse(rawData);
                
                // Merge with default data structure
                this.data = {
                    ...this.data,
                    ...parsedData,
                    processedSales: new Set(parsedData.processedSales || [])
                };
                
                console.log('Loaded bot state from storage');
            } else {
                console.log('No existing state file found, using defaults');
            }
        } catch (error) {
            console.error('Error loading bot state:', error);
            // Continue with default data
        }
    }

    /**
     * Save data to file
     */
    saveData() {
        try {
            const dataToSave = {
                ...this.data,
                processedSales: Array.from(this.data.processedSales)
            };
            
            fs.writeFileSync(this.configFile, JSON.stringify(dataToSave, null, 2));
        } catch (error) {
            console.error('Error saving bot state:', error);
        }
    }

    /**
     * Get the timestamp of the last processed sale
     * @returns {number} Timestamp in milliseconds
     */
    getLastProcessedSale() {
        return this.data.lastProcessedSale;
    }

    /**
     * Set the timestamp of the last processed sale
     * @param {number} timestamp - Timestamp in milliseconds
     */
    setLastProcessedSale(timestamp) {
        this.data.lastProcessedSale = Math.max(this.data.lastProcessedSale, timestamp);
        this.data.botStats.totalSalesProcessed++;
    }

    /**
     * Check if a sale has been processed
     * @param {string} saleId - Unique sale identifier
     * @returns {boolean} True if already processed
     */
    isSaleProcessed(saleId) {
        return this.data.processedSales.has(saleId);
    }

    /**
     * Mark a sale as processed
     * @param {string} saleId - Unique sale identifier
     */
    markSaleProcessed(saleId) {
        this.data.processedSales.add(saleId);
        
        // Keep only recent processed sales to prevent memory issues
        if (this.data.processedSales.size > 10000) {
            const salesToRemove = Array.from(this.data.processedSales).slice(0, 5000);
            salesToRemove.forEach(id => this.data.processedSales.delete(id));
        }
    }

    /**
     * Get bot statistics
     * @returns {Object} Bot statistics
     */
    getBotStats() {
        const uptime = Date.now() - this.data.botStats.startTime;
        return {
            ...this.data.botStats,
            uptime: uptime,
            uptimeFormatted: this.formatUptime(uptime)
        };
    }

    /**
     * Set last error information
     * @param {Error} error - Error object
     */
    setLastError(error) {
        this.data.botStats.lastError = {
            message: error.message,
            timestamp: Date.now(),
            stack: error.stack
        };
    }

    /**
     * Clear last error
     */
    clearLastError() {
        this.data.botStats.lastError = null;
    }

    /**
     * Store channel configuration
     * @param {string} guildId - Discord guild ID
     * @param {string} channelId - Discord channel ID
     */
    setChannelConfig(guildId, channelId) {
        if (!this.data.channelConfigs) {
            this.data.channelConfigs = {};
        }
        this.data.channelConfigs[guildId] = channelId;
    }

    /**
     * Get channel configuration for a guild
     * @param {string} guildId - Discord guild ID
     * @returns {string|null} Channel ID or null if not configured
     */
    getChannelConfig(guildId) {
        return this.data.channelConfigs?.[guildId] || null;
    }

    /**
     * Format uptime duration
     * @param {number} milliseconds - Duration in milliseconds
     * @returns {string} Formatted duration string
     */
    formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Clean up old data
     */
    cleanup() {
        // Clean up processed sales older than 7 days
        const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        if (this.data.lastProcessedSale < weekAgo) {
            this.data.processedSales.clear();
            console.log('Cleaned up old processed sales data');
        }
    }

    /**
     * Export data for backup
     * @returns {Object} All stored data
     */
    exportData() {
        return {
            ...this.data,
            processedSales: Array.from(this.data.processedSales),
            exportTimestamp: Date.now()
        };
    }

    /**
     * Add a collection to track
     * @param {string} tokenId - Token ID of the collection
     * @param {string} name - Optional name for the collection
     * @returns {boolean} True if added, false if already exists
     */
    addTrackedCollection(tokenId, name = null) {
        if (this.data.trackedCollections.some(c => c.tokenId === tokenId)) {
            return false;
        }
        
        this.data.trackedCollections.push({
            tokenId: tokenId,
            name: name,
            addedDate: Date.now()
        });
        
        this.saveData();
        return true;
    }

    /**
     * Remove a collection from tracking
     * @param {string} tokenId - Token ID of the collection
     * @returns {boolean} True if removed, false if not found
     */
    removeTrackedCollection(tokenId) {
        const initialLength = this.data.trackedCollections.length;
        this.data.trackedCollections = this.data.trackedCollections.filter(c => c.tokenId !== tokenId);
        
        if (this.data.trackedCollections.length < initialLength) {
            this.saveData();
            return true;
        }
        
        return false;
    }

    /**
     * Get all tracked collections
     * @returns {Array} Array of tracked collection objects
     */
    getTrackedCollections() {
        return this.data.trackedCollections || [];
    }

    /**
     * Check if a collection is being tracked
     * @param {string} tokenId - Token ID to check
     * @returns {boolean} True if being tracked
     */
    isCollectionTracked(tokenId) {
        return this.data.trackedCollections.some(c => c.tokenId === tokenId);
    }

    /**
     * Force save data immediately
     */
    forceSave() {
        this.saveData();
    }
}

module.exports = new StorageService();
