const { eq, desc, and, sql } = require('drizzle-orm');
const { db } = require('./db');
const { collections, serverConfigs, botState, processedSales, processedMints } = require('./schema');

class DatabaseStorage {
    constructor() {
        this.isInitialized = false;
    }

    async init() {
        try {
            // Test database connection
            await db.select().from(collections).limit(1);
            this.isInitialized = true;
            console.log('Database storage initialized successfully');
            
            // Migrate existing collections.json data if it exists
            await this.migrateExistingData();
        } catch (error) {
            console.error('Failed to initialize database storage:', error);
            throw error;
        }
    }

    async migrateExistingData() {
        try {
            const fs = require('fs');
            const path = require('path');
            const collectionsPath = path.join(__dirname, 'collections.json');
            
            if (fs.existsSync(collectionsPath)) {
                let collectionsData;
                try {
                    collectionsData = JSON.parse(fs.readFileSync(collectionsPath, 'utf8'));
                } catch (parseError) {
                    console.error('Failed to parse collections.json:', parseError);
                    return; // Skip migration if file is corrupt
                }
                
                for (const collection of collectionsData.collections) {
                    // Check if collection already exists in database
                    const existing = await db.select()
                        .from(collections)
                        .where(eq(collections.tokenId, collection.tokenId))
                        .limit(1);
                    
                    if (existing.length === 0) {
                        await db.insert(collections).values({
                            tokenId: collection.tokenId,
                            name: collection.name,
                            enabled: collection.enabled || true,
                            addedDate: collection.addedDate ? new Date(collection.addedDate) : new Date()
                        });
                        console.log(`Migrated collection: ${collection.name}`);
                    }
                }
                
                // Rename the file to indicate it's been migrated
                fs.renameSync(collectionsPath, collectionsPath + '.migrated');
                console.log('Collection migration completed');
            }
        } catch (error) {
            console.error('Error migrating existing data:', error);
        }
    }

    // Collection management
    async addCollection(guildId, tokenId, name, enabled = true) {
        try {
            // Check if collection already exists for this guild
            const existing = await db.select()
                .from(collections)
                .where(and(
                    eq(collections.guildId, guildId),
                    eq(collections.tokenId, tokenId)
                ))
                .limit(1);
            
            if (existing.length > 0) {
                console.log(`Collection ${tokenId} already exists for guild ${guildId}`);
                return existing[0];
            }
            
            const result = await db.insert(collections)
                .values({
                    guildId,
                    tokenId,
                    name,
                    enabled
                })
                .returning();
            return result[0];
        } catch (error) {
            console.error('Error adding collection:', error);
            return null;
        }
    }

    async removeCollection(guildId, tokenId) {
        try {
            const result = await db.delete(collections)
                .where(and(
                    eq(collections.guildId, guildId),
                    eq(collections.tokenId, tokenId)
                ))
                .returning();
            return result.length > 0;
        } catch (error) {
            console.error('Error removing collection:', error);
            return false;
        }
    }

    async getCollections(guildId = null, enabledOnly = false) {
        try {
            let query = db.select().from(collections);
            const conditions = [];
            
            if (guildId) {
                conditions.push(eq(collections.guildId, guildId));
            }
            if (enabledOnly) {
                conditions.push(eq(collections.enabled, true));
            }
            
            if (conditions.length > 0) {
                query = query.where(and(...conditions));
            }
            
            return await query.orderBy(collections.addedDate);
        } catch (error) {
            console.error('Error getting collections:', error);
            return [];
        }
    }

    async toggleCollection(tokenId) {
        try {
            const collection = await db.select()
                .from(collections)
                .where(eq(collections.tokenId, tokenId))
                .limit(1);
            
            if (collection.length === 0) {
                return null;
            }

            const newEnabledState = !collection[0].enabled;
            await db.update(collections)
                .set({ 
                    enabled: newEnabledState,
                    lastUpdated: new Date()
                })
                .where(eq(collections.tokenId, tokenId));
            
            return newEnabledState;
        } catch (error) {
            console.error('Error toggling collection:', error);
            return null;
        }
    }

    // Server configuration management
    async setServerConfig(guildId, channelId, guildName, enabled = true, listingsChannelId = null) {
        try {
            const existing = await db.select()
                .from(serverConfigs)
                .where(eq(serverConfigs.guildId, guildId))
                .limit(1);

            if (existing.length > 0) {
                await db.update(serverConfigs)
                    .set({
                        channelId,
                        listingsChannelId,
                        guildName,
                        enabled,
                        lastUpdated: new Date()
                    })
                    .where(eq(serverConfigs.guildId, guildId));
            } else {
                await db.insert(serverConfigs)
                    .values({
                        guildId,
                        channelId,
                        listingsChannelId,
                        guildName,
                        enabled
                    });
            }
            return true;
        } catch (error) {
            console.error('Error setting server config:', error);
            return false;
        }
    }

    async setListingsChannel(guildId, listingsChannelId) {
        try {
            const existing = await db.select()
                .from(serverConfigs)
                .where(eq(serverConfigs.guildId, guildId))
                .limit(1);

            if (existing.length > 0) {
                await db.update(serverConfigs)
                    .set({
                        listingsChannelId,
                        lastUpdated: new Date()
                    })
                    .where(eq(serverConfigs.guildId, guildId));
                return true;
            } else {
                console.log('No server config found to update listings channel');
                return false;
            }
        } catch (error) {
            console.error('Error setting listings channel:', error);
            return false;
        }
    }

    async setMintChannel(guildId, mintChannelId) {
        try {
            const existing = await db.select()
                .from(serverConfigs)
                .where(eq(serverConfigs.guildId, guildId))
                .limit(1);

            if (existing.length > 0) {
                await db.update(serverConfigs)
                    .set({
                        mintChannelId,
                        lastUpdated: new Date()
                    })
                    .where(eq(serverConfigs.guildId, guildId));
                return true;
            } else {
                console.log('No server config found to update mint channel');
                return false;
            }
        } catch (error) {
            console.error('Error setting mint channel:', error);
            return false;
        }
    }

    async getAllServerConfigs() {
        try {
            return await db.select()
                .from(serverConfigs)
                .orderBy(serverConfigs.addedDate);
        } catch (error) {
            console.error('Error getting server configs:', error);
            return [];
        }
    }

    async getServerConfig(guildId) {
        try {
            const result = await db.select()
                .from(serverConfigs)
                .where(eq(serverConfigs.guildId, guildId))
                .limit(1);
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error('Error getting server config:', error);
            return null;
        }
    }

    async removeServerConfig(guildId) {
        try {
            const result = await db.delete(serverConfigs)
                .where(eq(serverConfigs.guildId, guildId))
                .returning();
            return result.length > 0;
        } catch (error) {
            console.error('Error removing server config:', error);
            return false;
        }
    }

    async toggleServerNotifications(guildId) {
        try {
            const config = await this.getServerConfig(guildId);
            if (!config) {
                return null;
            }

            const newEnabledState = !config.enabled;
            await db.update(serverConfigs)
                .set({ 
                    enabled: newEnabledState,
                    lastUpdated: new Date()
                })
                .where(eq(serverConfigs.guildId, guildId));
            
            return newEnabledState;
        } catch (error) {
            console.error('Error toggling server notifications:', error);
            return null;
        }
    }

    // Bot state management
    async setBotState(key, value) {
        try {
            const existing = await db.select()
                .from(botState)
                .where(eq(botState.key, key))
                .limit(1);

            if (existing.length > 0) {
                await db.update(botState)
                    .set({
                        value,
                        lastUpdated: new Date()
                    })
                    .where(eq(botState.key, key));
            } else {
                await db.insert(botState)
                    .values({
                        key,
                        value
                    });
            }
            return true;
        } catch (error) {
            console.error('Error setting bot state:', error);
            return false;
        }
    }

    async getBotState(key, defaultValue = null) {
        try {
            const result = await db.select()
                .from(botState)
                .where(eq(botState.key, key))
                .limit(1);
            return result.length > 0 ? result[0].value : defaultValue;
        } catch (error) {
            console.error('Error getting bot state:', error);
            return defaultValue;
        }
    }

    // Processed sales management
    async markSaleProcessed(saleId, tokenId) {
        try {
            // Validate that we have required data
            if (!saleId || !tokenId) {
                console.error('Cannot mark sale as processed - missing required data:', { saleId, tokenId });
                return false;
            }
            
            // Use INSERT with onConflictDoNothing for atomic operation
            const result = await db.insert(processedSales)
                .values({
                    saleId,
                    tokenId
                })
                .onConflictDoNothing()
                .returning();
            
            // Return true if a new record was inserted, false if it already existed
            return result.length > 0;
        } catch (error) {
            console.error('Error marking sale as processed:', error);
            return false;
        }
    }

    async isSaleProcessed(saleId) {
        try {
            const result = await db.select()
                .from(processedSales)
                .where(eq(processedSales.saleId, saleId))
                .limit(1);
            return result.length > 0;
        } catch (error) {
            console.error('Error checking if sale is processed:', error);
            return false;
        }
    }

    async getLastProcessedSale() {
        try {
            const lastProcessed = await this.getBotState('lastProcessedSale', 0);
            return typeof lastProcessed === 'number' ? lastProcessed : 0;
        } catch (error) {
            console.error('Error getting last processed sale:', error);
            return 0;
        }
    }

    async setLastProcessedSale(timestamp) {
        try {
            await this.setBotState('lastProcessedSale', timestamp);
            return true;
        } catch (error) {
            console.error('Error setting last processed sale:', error);
            return false;
        }
    }

    // Processed listings management
    async markListingProcessed(listingId, tokenId) {
        try {
            // Validate that we have required data
            if (!listingId || !tokenId) {
                console.error('Cannot mark listing as processed - missing required data:', { listingId, tokenId });
                return false;
            }
            
            // Use INSERT with onConflictDoNothing for atomic operation
            const result = await db.insert(processedSales)
                .values({
                    saleId: `listing_${listingId}`,
                    tokenId
                })
                .onConflictDoNothing()
                .returning();
            
            // Return true if a new record was inserted, false if it already existed
            return result.length > 0;
        } catch (error) {
            console.error('Error marking listing as processed:', error);
            return false;
        }
    }

    async isListingProcessed(listingId) {
        try {
            const result = await db.select()
                .from(processedSales)
                .where(eq(processedSales.saleId, `listing_${listingId}`))
                .limit(1);
            return result.length > 0;
        } catch (error) {
            console.error('Error checking if listing is processed:', error);
            return false;
        }
    }

    async getLastProcessedListing() {
        try {
            const lastProcessed = await this.getBotState('lastProcessedListing', 0);
            return typeof lastProcessed === 'number' ? lastProcessed : 0;
        } catch (error) {
            console.error('Error getting last processed listing:', error);
            return 0;
        }
    }

    async setLastProcessedListing(timestamp) {
        try {
            await this.setBotState('lastProcessedListing', timestamp);
            return true;
        } catch (error) {
            console.error('Error setting last processed listing:', error);
            return false;
        }
    }

    // Cleanup old processed sales (older than 3 days)
    async cleanupOldProcessedSales() {
        try {
            const threeDaysAgo = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000));
            const result = await db.delete(processedSales)
                .where(sql`processed_at < ${threeDaysAgo}`);
            console.log(`Cleaned up ${result.rowCount || 0} old processed sales (older than 3 days)`);
        } catch (error) {
            console.error('Error cleaning up old processed sales:', error);
        }
    }

    // Forever Mint management
    async getLastProcessedMint() {
        try {
            const result = await this.getBotState('lastProcessedMint', 0);
            return typeof result === 'number' ? result : 0;
        } catch (error) {
            console.error('Error getting last processed mint timestamp:', error);
            return 0;
        }
    }

    async setLastProcessedMint(timestamp) {
        try {
            await this.setBotState('lastProcessedMint', timestamp);
            return true;
        } catch (error) {
            console.error('Error setting last processed mint timestamp:', error);
            return false;
        }
    }

    async isMintProcessed(mintId) {
        try {
            const result = await db.select()
                .from(processedMints)
                .where(eq(processedMints.mintId, mintId))
                .limit(1);
            
            return result.length > 0;
        } catch (error) {
            console.error('Error checking if mint is processed:', error);
            return false;
        }
    }

    async markMintProcessed(mintId, tokenId) {
        try {
            await db.insert(processedMints).values({
                mintId: mintId,
                tokenId: tokenId
            });
            return true;
        } catch (error) {
            if (error.code === '23505') { // Unique constraint violation
                console.log(`Mint ${mintId} already processed, skipping`);
                return false;
            }
            console.error('Error marking mint as processed:', error);
            return false;
        }
    }

    async cleanupOldMints() {
        try {
            // Remove processed mints older than 3 days
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            
            const result = await db.delete(processedMints)
                .where(sql`${processedMints.processedAt} < ${threeDaysAgo}`);
            
            const deletedCount = result.rowCount || 0;
            if (deletedCount > 0) {
                console.log(`Cleaned up ${deletedCount} old processed mints (older than 3 days)`);
            }
            return deletedCount;
        } catch (error) {
            console.error('Error cleaning up old processed mints:', error);
            return 0;
        }
    }

    // Legacy compatibility methods - now guild-aware
    getTrackedCollections(guildId = null) {
        return this.getCollections(guildId, true);
    }

    async isCollectionTracked(tokenId, guildId = null) {
        const collections = await this.getCollections(guildId, true);
        return collections.some(c => c.tokenId === tokenId);
    }

    addTrackedCollection(guildId, tokenId, name) {
        return this.addCollection(guildId, tokenId, name, true).then(result => !!result);
    }

    removeTrackedCollection(guildId, tokenId) {
        return this.removeCollection(guildId, tokenId);
    }
}

module.exports = DatabaseStorage;