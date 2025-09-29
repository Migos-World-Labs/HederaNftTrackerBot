/**
 * Centralized SentX API Scheduler
 * 
 * This service consolidates ALL SentX API calls to prevent rate limit collisions
 * between multiple bots. It implements persistent checkpoints and replay buffers
 * to ensure zero missed live mints during restarts.
 */

const axios = require('axios');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class SentXScheduler extends EventEmitter {
    constructor() {
        super();
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
        
        // Token bucket for 1 request per second limit
        this.tokenBucket = {
            tokens: 1,
            maxTokens: 3, // Allow small burst of 3 requests
            refillRate: 1, // 1 token per second
            lastRefill: Date.now()
        };
        
        // Request queue and processing
        this.requestQueue = [];
        this.processing = false;
        
        // Checkpoints for persistent state
        this.checkpointsFile = path.join(__dirname, '..', 'data', 'sentx-checkpoints.json');
        this.checkpoints = {
            boredApe: { lastTimestamp: null, lastTransactionId: null },
            wildTigers: { lastTimestamp: null, lastTransactionId: null },
            marketActivity: { lastTimestamp: null, lastTransactionId: null }
        };
        
        // Data cache for subscribers
        this.cache = {
            boredApeMints: [],
            wildTigersMints: [],
            sales: [],
            listings: []
        };
        
        // Subscribers for different data types
        this.subscribers = {
            boredApeMints: new Set(),
            wildTigersMints: new Set(),
            sales: new Set(),
            listings: new Set()
        };
        
        this.initialize();
    }
    
    async initialize() {
        try {
            // Load persistent checkpoints
            await this.loadCheckpoints();
            
            // Start token bucket refill
            this.startTokenBucketRefill();
            
            // Start processing queue
            this.startQueueProcessor();
            
            // Perform startup replay to catch missed mints
            await this.performStartupReplay();
            
            console.log('✅ SentX Scheduler initialized with persistent checkpoints');
            
        } catch (error) {
            console.error('❌ Failed to initialize SentX Scheduler:', error.message);
        }
    }
    
    /**
     * Load checkpoints from persistent storage
     */
    async loadCheckpoints() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.checkpointsFile);
            await fs.mkdir(dataDir, { recursive: true });
            
            // Try to load existing checkpoints
            try {
                const data = await fs.readFile(this.checkpointsFile, 'utf8');
                this.checkpoints = { ...this.checkpoints, ...JSON.parse(data) };
                console.log('📂 Loaded SentX checkpoints:', this.checkpoints);
            } catch (error) {
                console.log('📂 No existing checkpoints found, starting fresh');
            }
        } catch (error) {
            console.error('❌ Error loading checkpoints:', error.message);
        }
    }
    
    /**
     * Save checkpoints to persistent storage
     */
    async saveCheckpoints() {
        try {
            await fs.writeFile(this.checkpointsFile, JSON.stringify(this.checkpoints, null, 2));
        } catch (error) {
            console.error('❌ Error saving checkpoints:', error.message);
        }
    }
    
    /**
     * Token bucket rate limiting implementation
     */
    startTokenBucketRefill() {
        setInterval(() => {
            const now = Date.now();
            const elapsed = (now - this.tokenBucket.lastRefill) / 1000; // seconds
            
            // Add tokens based on elapsed time
            const tokensToAdd = Math.floor(elapsed * this.tokenBucket.refillRate);
            if (tokensToAdd > 0) {
                this.tokenBucket.tokens = Math.min(
                    this.tokenBucket.maxTokens,
                    this.tokenBucket.tokens + tokensToAdd
                );
                this.tokenBucket.lastRefill = now;
            }
        }, 200); // Check every 200ms for smoother rate limiting
    }
    
    /**
     * Get a token from the bucket (returns true if available)
     */
    consumeToken() {
        if (this.tokenBucket.tokens > 0) {
            this.tokenBucket.tokens--;
            return true;
        }
        return false;
    }
    
    /**
     * Queue processor to handle requests sequentially with rate limiting
     */
    async startQueueProcessor() {
        if (this.processing) return;
        
        this.processing = true;
        
        while (true) {
            if (this.requestQueue.length === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
                continue;
            }
            
            // Wait for token availability
            while (!this.consumeToken()) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const request = this.requestQueue.shift();
            try {
                const response = await this.axiosInstance.request(request.config);
                request.resolve(response);
            } catch (error) {
                // Handle rate limiting by re-queuing the request
                if (error.response && error.response.status === 429) {
                    console.log('🚫 Rate limited - re-queuing request');
                    this.requestQueue.unshift(request); // Put back at front
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                } else {
                    request.reject(error);
                }
            }
        }
    }
    
    /**
     * Make a rate-limited request through the queue
     */
    async makeRequest(config) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ config, resolve, reject });
        });
    }
    
    /**
     * Startup replay to catch missed mints during downtime
     */
    async performStartupReplay() {
        console.log('🔄 Performing startup replay to catch missed mints...');
        
        try {
            // Get current time and calculate replay window (last 10 minutes)
            const now = new Date();
            const replayWindowMs = 10 * 60 * 1000; // 10 minutes
            const replayFrom = new Date(now.getTime() - replayWindowMs);
            
            console.log(`🕐 Replay window: ${replayFrom.toISOString()} to ${now.toISOString()}`);
            
            // Fetch recent data for replay
            const [boredApeMints, wildTigersMints] = await Promise.all([
                this.fetchBoredApeMints(50), // Fetch more for replay
                this.fetchWildTigersMints(50)
            ]);
            
            // Filter for mints within replay window
            const recentBoredApe = this.filterMintsInTimeWindow(boredApeMints, replayFrom, now);
            const recentWildTigers = this.filterMintsInTimeWindow(wildTigersMints, replayFrom, now);
            
            console.log(`🎯 Found ${recentBoredApe.length} Bored Ape mints and ${recentWildTigers.length} Wild Tigers mints in replay window`);
            
            // Emit replay events for missed mints (mark them as replay to avoid duplicate processing)
            recentBoredApe.forEach(mint => {
                this.emit('boredApeMint', { ...mint, isReplay: true });
            });
            
            recentWildTigers.forEach(mint => {
                this.emit('wildTigersMint', { ...mint, isReplay: true });
            });
            
        } catch (error) {
            console.error('❌ Error during startup replay:', error.message);
        }
    }
    
    /**
     * Filter mints within a time window
     */
    filterMintsInTimeWindow(mints, fromDate, toDate) {
        return mints.filter(mint => {
            const mintDate = new Date(mint.mint_date);
            return mintDate >= fromDate && mintDate <= toDate;
        });
    }
    
    /**
     * Fetch Bored Ape Forever Mints
     */
    async fetchBoredApeMints(limit = 20) {
        const response = await this.makeRequest({
            method: 'get',
            url: '/v1/public/launchpad/activity',
            params: {
                apikey: process.env.SENTX_API_KEY,
                token: '0.0.9656915', // Bored Ape Hedera Club token address
                limit: limit,
                page: 1
            }
        });
        
        if (!response.data?.success || !response.data?.response) {
            return [];
        }
        
        // Filter and format Bored Ape mints
        const mints = response.data.response
            .filter(activity => activity.saletype === 'Minted')
            .map(mint => ({
                nft_name: mint.nftName,
                serial_number: mint.nftSerialId,
                mint_cost: mint.salePrice,
                mint_cost_symbol: mint.salePriceSymbol,
                mint_date: mint.saleDate,
                minter_address: mint.buyerAddress,
                image_url: mint.nftImage,
                transaction_id: mint.saleTransactionId
            }));
            
        // Update checkpoint only if we have new data that's actually newer
        if (mints.length > 0) {
            const latest = mints[0]; // Most recent mint
            const currentCheckpoint = this.checkpoints.boredApe;
            
            // Only update if this is actually newer than our checkpoint
            if (!currentCheckpoint.lastTimestamp || 
                new Date(latest.mint_date) > new Date(currentCheckpoint.lastTimestamp)) {
                this.checkpoints.boredApe = {
                    lastTimestamp: latest.mint_date,
                    lastTransactionId: latest.transaction_id
                };
                await this.saveCheckpoints();
                console.log(`📂 Updated Bored Ape checkpoint: ${latest.mint_date}`);
            }
        }
        
        return mints;
    }
    
    /**
     * Fetch Wild Tigers Forever Mints
     */
    async fetchWildTigersMints(limit = 20) {
        const response = await this.makeRequest({
            method: 'get',
            url: '/v1/public/launchpad/activity',
            params: {
                apikey: process.env.SENTX_API_KEY,
                token: '0.0.6024491', // Wild Tigers token address
                limit: limit,
                page: 1
            }
        });
        
        if (!response.data?.success || !response.data?.response) {
            return [];
        }
        
        // Filter and format Wild Tigers mints
        const mints = response.data.response
            .filter(activity => activity.saletype === 'Minted' && activity.collectionName === 'Wild Tigers')
            .map(mint => ({
                nft_name: mint.nftName,
                serial_number: mint.nftSerialId,
                mint_cost: mint.salePrice,
                mint_cost_symbol: mint.salePriceSymbol,
                mint_date: mint.saleDate,
                minter_address: mint.buyerAddress,
                image_url: mint.nftImage,
                transaction_id: mint.saleTransactionId
            }));
            
        // Update checkpoint only if we have new data that's actually newer
        if (mints.length > 0) {
            const latest = mints[0]; // Most recent mint
            const currentCheckpoint = this.checkpoints.wildTigers;
            
            // Only update if this is actually newer than our checkpoint
            if (!currentCheckpoint.lastTimestamp || 
                new Date(latest.mint_date) > new Date(currentCheckpoint.lastTimestamp)) {
                this.checkpoints.wildTigers = {
                    lastTimestamp: latest.mint_date,
                    lastTransactionId: latest.transaction_id
                };
                await this.saveCheckpoints();
                console.log(`📂 Updated Wild Tigers checkpoint: ${latest.mint_date}`);
            }
        }
        
        return mints;
    }
    
    /**
     * Fetch sales data through the centralized scheduler
     */
    async fetchSales(limit = 50, includeHTS = false) {
        const response = await this.makeRequest({
            method: 'get',
            url: '/v1/public/market/activity',
            params: {
                apikey: process.env.SENTX_API_KEY,
                activityFilter: 'Sales',
                amount: limit,
                page: 1,
                hbarMarketOnly: includeHTS ? undefined : 1
            }
        });
        
        if (!response.data?.success || !response.data?.marketActivity) {
            return [];
        }
        
        // Filter only actual completed sales
        return response.data.marketActivity.filter(activity => {
            return activity.buyerAddress && 
                   activity.buyerAddress !== null && 
                   activity.buyerAddress !== 'null' && 
                   activity.buyerAddress !== '' &&
                   activity.salePrice && 
                   activity.salePrice > 0;
        });
    }
    
    /**
     * Fetch listings data through the centralized scheduler
     */
    async fetchListings(limit = 50, includeHTS = false) {
        const response = await this.makeRequest({
            method: 'get',
            url: '/v1/public/market/activity',
            params: {
                apikey: process.env.SENTX_API_KEY,
                activityFilter: 'All',
                amount: limit,
                page: 1,
                hbarMarketOnly: includeHTS ? undefined : 1
            }
        });
        
        if (!response.data?.success || !response.data?.marketActivity) {
            return [];
        }
        
        // Filter only actual listings
        return response.data.marketActivity.filter(activity => {
            return activity.salePrice && 
                   activity.salePrice > 0 &&
                   activity.sellerAddress &&
                   activity.sellerAddress !== null &&
                   !activity.buyerAddress &&
                   activity.saletype && 
                   (activity.saletype === 'Listed' || activity.saletype === 'Auction');
        });
    }

    /**
     * Subscribe to specific data type updates
     */
    subscribe(dataType, callback) {
        if (!this.subscribers[dataType]) {
            this.subscribers[dataType] = new Set();
        }
        this.subscribers[dataType].add(callback);
        
        console.log(`📡 New subscriber for ${dataType} data`);
    }
    
    /**
     * Start monitoring for new mints (called by main process)
     */
    startMonitoring() {
        // Monitor Bored Ape mints every 15 seconds
        setInterval(async () => {
            try {
                const mints = await this.fetchBoredApeMints(20);
                const newMints = this.filterNewMints(mints, this.cache.boredApeMints, 'boredApe');
                
                if (newMints.length > 0) {
                    console.log(`🦍 Found ${newMints.length} new Bored Ape mints`);
                    this.cache.boredApeMints = mints;
                    
                    newMints.forEach(mint => {
                        this.emit('boredApeMint', mint);
                    });
                }
            } catch (error) {
                console.error('❌ Error fetching Bored Ape mints:', error.message);
            }
        }, 15000);
        
        // Monitor Wild Tigers mints every 15 seconds
        setInterval(async () => {
            try {
                const mints = await this.fetchWildTigersMints(20);
                const newMints = this.filterNewMints(mints, this.cache.wildTigersMints, 'wildTigers');
                
                if (newMints.length > 0) {
                    console.log(`🐯 Found ${newMints.length} new Wild Tigers mints`);
                    this.cache.wildTigersMints = mints;
                    
                    newMints.forEach(mint => {
                        this.emit('wildTigersMint', mint);
                    });
                }
            } catch (error) {
                console.error('❌ Error fetching Wild Tigers mints:', error.message);
            }
        }, 15000);
        
        console.log('🚀 SentX Scheduler monitoring started');
    }
    
    /**
     * Filter new mints that haven't been processed yet, using persistent checkpoints
     */
    filterNewMints(latestMints, cachedMints, checkpointKey) {
        const cachedTransactionIds = new Set(cachedMints.map(mint => mint.transaction_id));
        const checkpoint = this.checkpoints[checkpointKey];
        
        return latestMints.filter(mint => {
            // Skip if already in cache
            if (cachedTransactionIds.has(mint.transaction_id)) {
                return false;
            }
            
            // Skip if older than checkpoint (prevents historical spam on restart)
            if (checkpoint.lastTimestamp && checkpoint.lastTransactionId) {
                const mintDate = new Date(mint.mint_date);
                const checkpointDate = new Date(checkpoint.lastTimestamp);
                
                // Only include mints newer than checkpoint OR exact match with newer transaction
                if (mintDate <= checkpointDate && mint.transaction_id <= checkpoint.lastTransactionId) {
                    return false;
                }
            }
            
            return true;
        });
    }
}

// Export singleton instance
module.exports = new SentXScheduler();