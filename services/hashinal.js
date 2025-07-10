/**
 * Hashinal service for handling HCS-5 standard NFTs on Hedera
 * Provides specialized metadata and image handling for Hashinals
 */

const axios = require('axios');

class HashinalService {
    constructor() {
        this.mirrorNodeUrl = process.env.HEDERA_MIRROR_NODE || 'https://mainnet-public.mirrornode.hedera.com';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
    }

    /**
     * Check if an NFT is a Hashinal based on token ID or collection name
     * @param {Object} nft - NFT object with token_id and collection_name
     * @returns {boolean} True if this appears to be a Hashinal
     */
    isHashinal(nft) {
        const knownHashinalTokens = ['0.0.5552189', '0.0.2173899', '0.0.789064', '0.0.1097228'];
        
        return nft.collection_name && (
            nft.collection_name.toLowerCase().includes('hashinal') ||
            nft.collection_name.toLowerCase().includes('hcs-') ||
            nft.nft_name?.toLowerCase().includes('hashinal') ||
            knownHashinalTokens.includes(nft.token_id) ||
            (nft.metadata && nft.metadata.p === 'hcs-5') ||
            this.isHRLFormat(nft.image_url)
        );
    }

    /**
     * Check if a URL is in HRL (Hedera Resource Locator) format
     * @param {string} url - URL to check
     * @returns {boolean} True if URL is HRL format
     */
    isHRLFormat(url) {
        if (!url) return false;
        return url.startsWith('hcs://');
    }

    /**
     * Attempt to resolve Hashinal image from various sources
     * @param {Object} nft - NFT object with various image fields
     * @returns {Promise<string|null>} Resolved image URL or null
     */
    async resolveHashinalImage(nft) {
        try {
            console.log(`🔍 [HASHINAL] Resolving image for ${nft.nft_name} (${nft.token_id})`);
            
            // Check all possible image fields
            const imageFields = [
                nft.imageCDN,
                nft.nftImage,
                nft.image_url,
                nft.image,
                nft.imageFile,
                nft.imageUrl,
                nft.metadata?.image,
                nft.metadata?.image_data,
                nft.data?.image
            ];

            // Look for direct HTTP/HTTPS URLs first
            for (const field of imageFields) {
                if (field && (field.startsWith('http://') || field.startsWith('https://'))) {
                    console.log(`✅ [HASHINAL] Found direct HTTP image: ${field}`);
                    return field;
                }
            }

            // Check for data URIs (base64 images)
            for (const field of imageFields) {
                if (field && field.startsWith('data:image/')) {
                    console.log(`✅ [HASHINAL] Found data URI image`);
                    return field;
                }
            }

            // Handle HRL format (hcs://) - for future implementation
            for (const field of imageFields) {
                if (field && this.isHRLFormat(field)) {
                    console.log(`⚠️ [HASHINAL] HRL format detected: ${field} - fetching from HCS not yet implemented`);
                    // For now, we'll try to find alternative image sources
                    continue;
                }
            }

            // Check if metadata has files array with image
            if (nft.metadata && nft.metadata.files && Array.isArray(nft.metadata.files)) {
                for (const file of nft.metadata.files) {
                    if (file.uri && (file.uri.startsWith('http') || file.uri.startsWith('https'))) {
                        console.log(`✅ [HASHINAL] Found image in metadata.files: ${file.uri}`);
                        return file.uri;
                    }
                }
            }

            // Try to fetch additional metadata from Hedera Mirror Node
            const enhancedMetadata = await this.fetchTokenMetadata(nft.token_id, nft.serial_id);
            if (enhancedMetadata && enhancedMetadata.image) {
                console.log(`✅ [HASHINAL] Found image in enhanced metadata: ${enhancedMetadata.image}`);
                return enhancedMetadata.image;
            }

            console.log(`❌ [HASHINAL] No suitable image found for ${nft.nft_name}`);
            return null;

        } catch (error) {
            console.error(`Error resolving Hashinal image for ${nft.token_id}:`, error.message);
            return null;
        }
    }

    /**
     * Fetch token metadata from Hedera Mirror Node
     * @param {string} tokenId - Token ID
     * @param {string} serialId - Serial ID
     * @returns {Promise<Object|null>} Token metadata or null
     */
    async fetchTokenMetadata(tokenId, serialId) {
        try {
            const cacheKey = `${tokenId}-${serialId}`;
            const cached = this.cache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                return cached.data;
            }

            const url = `${this.mirrorNodeUrl}/api/v1/tokens/${tokenId}/nfts/${serialId}`;
            const response = await axios.get(url, { timeout: 5000 });

            if (response.data && response.data.metadata) {
                // Try to parse base64 metadata
                const metadataBase64 = response.data.metadata;
                const metadataString = Buffer.from(metadataBase64, 'base64').toString('utf8');
                const metadata = JSON.parse(metadataString);
                
                // Cache the result
                this.cache.set(cacheKey, {
                    data: metadata,
                    timestamp: Date.now()
                });

                console.log(`📥 [HASHINAL] Fetched metadata from Mirror Node for ${tokenId}/${serialId}`);
                return metadata;
            }

            return null;
        } catch (error) {
            console.error(`Error fetching metadata from Mirror Node for ${tokenId}/${serialId}:`, error.message);
            return null;
        }
    }

    /**
     * Convert HRL to HTTP URL (placeholder for future implementation)
     * @param {string} hrlUrl - HRL URL (hcs://1/topicId)
     * @returns {Promise<string|null>} HTTP URL or null
     */
    async convertHRLToHttp(hrlUrl) {
        // Future implementation: fetch data from Hedera Consensus Service
        console.log(`⚠️ [HASHINAL] HRL conversion not yet implemented: ${hrlUrl}`);
        return null;
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
}

module.exports = HashinalService;