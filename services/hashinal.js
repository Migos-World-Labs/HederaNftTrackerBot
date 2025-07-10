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
     * Check if an NFT has known image display issues
     * @param {Object} nft - NFT object with token_id and collection_name
     * @returns {boolean} True if this token has reported image issues
     */
    isProblemImageToken(nft) {
        const problemImageTokens = ['0.0.8308459']; // The Ape Anthology - reported image issues
        return problemImageTokens.includes(nft.token_id);
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
            
            // Check all possible image fields including HCS URLs
            const imageFields = [
                nft.imageCDN,
                nft.nftImage,
                nft.image_url,
                nft.image,
                nft.imageFile,
                nft.imageUrl,
                nft.imagecid, // Additional field found in SentX API
                nft.metadata?.image,
                nft.metadata?.image_data,
                nft.data?.image
            ];

            console.log(`🔍 [HASHINAL] Checking ${imageFields.length} image fields...`);

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

            // Handle HCS URLs - use SentX Hashinals service for direct resolution
            for (const field of imageFields) {
                if (field && this.isHRLFormat(field)) {
                    console.log(`🔧 [HASHINAL] Converting HCS URL to Hashinals service: ${field}`);
                    const topicMatch = field.match(/hcs:\/\/1\/(.+)/);
                    if (topicMatch) {
                        const topicId = topicMatch[1];
                        const hashinalUrl = `https://hashinals.sentx.io/${topicId}?optimizer=image&width=640`;
                        console.log(`✅ [HASHINAL] Using Hashinals service URL: ${hashinalUrl}`);
                        return hashinalUrl;
                    }
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
            if (enhancedMetadata) {
                // Check for image in enhanced metadata
                if (enhancedMetadata.image) {
                    if (enhancedMetadata.image.startsWith('http')) {
                        console.log(`✅ [HASHINAL] Found HTTP image in enhanced metadata: ${enhancedMetadata.image}`);
                        return enhancedMetadata.image;
                    } else if (this.isHRLFormat(enhancedMetadata.image)) {
                        console.log(`🔧 [HASHINAL] Found HCS image in enhanced metadata: ${enhancedMetadata.image}`);
                        const resolvedUrl = await this.fetchHCSImageData(enhancedMetadata.image);
                        if (resolvedUrl) {
                            console.log(`✅ [HASHINAL] Successfully resolved enhanced HCS image: ${resolvedUrl}`);
                            return resolvedUrl;
                        }
                    }
                }
                
                // Check for files array in enhanced metadata
                if (enhancedMetadata.files && Array.isArray(enhancedMetadata.files)) {
                    for (const file of enhancedMetadata.files) {
                        if (file.uri && file.uri.startsWith('http')) {
                            console.log(`✅ [HASHINAL] Found HTTP image in enhanced metadata files: ${file.uri}`);
                            return file.uri;
                        }
                    }
                }
            }

            console.log(`❌ [HASHINAL] No suitable image found for ${nft.nft_name}`);
            return null;

        } catch (error) {
            console.error(`❌ [HASHINAL] Error resolving image for ${nft.token_id}:`, error.message);
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
            console.log(`🔍 [MIRROR NODE] Fetching metadata for ${tokenId}/${serialId}`);
            const response = await axios.get(url, { timeout: 10000 });

            if (response.data && response.data.metadata) {
                try {
                    // Try to parse base64 metadata
                    const metadataBase64 = response.data.metadata;
                    const metadataString = Buffer.from(metadataBase64, 'base64').toString('utf8');
                    const metadata = JSON.parse(metadataString);
                    
                    console.log(`📥 [MIRROR NODE] Successfully parsed metadata for ${tokenId}/${serialId}`);
                    console.log(`📝 [MIRROR NODE] Metadata keys:`, Object.keys(metadata));
                    
                    // Log image-related fields for debugging
                    if (metadata.image || metadata.image_url || metadata.files) {
                        console.log(`🖼️ [MIRROR NODE] Image fields found:`);
                        console.log(`   image: ${metadata.image}`);
                        console.log(`   image_url: ${metadata.image_url}`);
                        console.log(`   files: ${JSON.stringify(metadata.files)}`);
                    }
                    
                    // Cache the result
                    this.cache.set(cacheKey, {
                        data: metadata,
                        timestamp: Date.now()
                    });

                    return metadata;
                } catch (parseError) {
                    console.error(`❌ [MIRROR NODE] Failed to parse metadata for ${tokenId}/${serialId}:`, parseError.message);
                    console.log(`📄 [MIRROR NODE] Raw metadata (first 200 chars):`, response.data.metadata.substring(0, 200));
                }
            } else {
                console.log(`⚠️ [MIRROR NODE] No metadata found for ${tokenId}/${serialId}`);
            }

            return null;
        } catch (error) {
            console.error(`❌ [MIRROR NODE] Error fetching metadata for ${tokenId}/${serialId}:`, error.message);
            if (error.response) {
                console.log(`HTTP Status: ${error.response.status}`);
            }
            return null;
        }
    }

    /**
     * Fetch image data from HCS URL
     * @param {string} hcsUrl - HCS URL (hcs://1/topicId)
     * @returns {Promise<string|null>} Image URL or data URI
     */
    async fetchHCSImageData(hcsUrl) {
        try {
            console.log(`🔍 [HCS] Attempting to fetch data from: ${hcsUrl}`);
            
            // Extract topic ID from HCS URL
            const topicMatch = hcsUrl.match(/hcs:\/\/1\/(.+)/);
            if (!topicMatch) {
                console.log(`❌ [HCS] Invalid HCS URL format: ${hcsUrl}`);
                return null;
            }
            
            const topicId = topicMatch[1];
            console.log(`📋 [HCS] Topic ID extracted: ${topicId}`);
            
            // Try to fetch HCS topic data from Mirror Node
            const url = `${this.mirrorNodeUrl}/api/v1/topics/${topicId}/messages`;
            console.log(`🔍 [HCS] Fetching topic messages from: ${url}`);
            
            const response = await axios.get(url, { 
                timeout: 15000,
                params: {
                    limit: 10, // Get more messages to find image data
                    order: 'desc'
                }
            });

            if (response.data && response.data.messages && response.data.messages.length > 0) {
                console.log(`📥 [HCS] Found ${response.data.messages.length} topic messages`);
                
                // Look through messages for image data
                for (const message of response.data.messages) {
                    if (message.message) {
                        try {
                            // Decode the base64 message
                            const messageData = Buffer.from(message.message, 'base64').toString('utf8');
                            console.log(`📝 [HCS] Message content (first 100 chars): ${messageData.substring(0, 100)}`);
                            
                            // Check if it's image data (data URI format)
                            if (messageData.startsWith('data:image/')) {
                                console.log(`✅ [HCS] Found data URI image in topic ${topicId}`);
                                return messageData;
                            }
                            
                            // Check if it's binary image data that needs to be converted to data URI
                            if (messageData.length > 100 && !messageData.includes('http') && !messageData.includes('{')) {
                                console.log(`🔧 [HCS] Message appears to be binary image data, trying to convert...`);
                                try {
                                    // Try to convert binary data to data URI
                                    const binaryData = Buffer.from(message.message, 'base64');
                                    
                                    // Check for common image headers
                                    const header = binaryData.toString('hex', 0, 10);
                                    let mimeType = null;
                                    
                                    if (header.startsWith('89504e47')) { // PNG
                                        mimeType = 'image/png';
                                    } else if (header.startsWith('ffd8ff')) { // JPEG
                                        mimeType = 'image/jpeg';
                                    } else if (header.startsWith('47494638')) { // GIF
                                        mimeType = 'image/gif';
                                    } else if (header.startsWith('424d')) { // BMP
                                        mimeType = 'image/bmp';
                                    } else if (header.startsWith('52494646')) { // WebP
                                        mimeType = 'image/webp';
                                    }
                                    
                                    if (mimeType) {
                                        const dataUri = `data:${mimeType};base64,${message.message}`;
                                        console.log(`✅ [HCS] Converted binary data to ${mimeType} data URI`);
                                        return dataUri;
                                    }
                                } catch (conversionError) {
                                    console.log(`⚠️ [HCS] Failed to convert binary data: ${conversionError.message}`);
                                }
                            }
                            
                            // Try to parse as JSON in case it contains image URL or compressed data
                            try {
                                const jsonData = JSON.parse(messageData);
                                console.log(`📋 [HCS] Parsed JSON data:`, Object.keys(jsonData));
                                
                                // Check for direct image URL
                                if (jsonData.image || jsonData.image_url) {
                                    const imageUrl = jsonData.image || jsonData.image_url;
                                    console.log(`✅ [HCS] Found image URL in JSON data: ${imageUrl}`);
                                    return imageUrl;
                                }
                                
                                // Check for compressed data format (used by The Ape Anthology)
                                if (jsonData.c) {
                                    console.log(`🔧 [HCS] Found compressed data field 'c', attempting to decompress...`);
                                    try {
                                        // The 'c' field appears to contain base64-encoded compressed data
                                        const compressedData = Buffer.from(jsonData.c, 'base64');
                                        
                                        // Try to decompress using different methods
                                        const zlib = require('node:zlib');
                                        
                                        // Try gzip decompression
                                        try {
                                            const decompressed = zlib.gunzipSync(compressedData);
                                            const decompressedText = decompressed.toString('utf8');
                                            console.log(`📄 [HCS] Decompressed data (first 200 chars): ${decompressedText.substring(0, 200)}`);
                                            
                                            // Check if decompressed data is a data URI
                                            if (decompressedText.startsWith('data:image/')) {
                                                console.log(`✅ [HCS] Found data URI in decompressed data`);
                                                return decompressedText;
                                            }
                                            
                                            // Try to parse decompressed data as JSON
                                            try {
                                                const decompressedJson = JSON.parse(decompressedText);
                                                if (decompressedJson.image || decompressedJson.image_url) {
                                                    console.log(`✅ [HCS] Found image in decompressed JSON`);
                                                    return decompressedJson.image || decompressedJson.image_url;
                                                }
                                            } catch (parseError) {
                                                // Not JSON, might be raw image data
                                            }
                                        } catch (gzipError) {
                                            console.log(`⚠️ [HCS] Gzip decompression failed, trying deflate...`);
                                            
                                            // Try deflate decompression
                                            try {
                                                const decompressed = zlib.inflateSync(compressedData);
                                                const decompressedText = decompressed.toString('utf8');
                                                console.log(`📄 [HCS] Deflate decompressed data (first 200 chars): ${decompressedText.substring(0, 200)}`);
                                                
                                                if (decompressedText.startsWith('data:image/')) {
                                                    console.log(`✅ [HCS] Found data URI in deflate decompressed data`);
                                                    return decompressedText;
                                                }
                                            } catch (deflateError) {
                                                console.log(`⚠️ [HCS] Deflate decompression also failed`);
                                            }
                                        }
                                    } catch (decompressionError) {
                                        console.log(`⚠️ [HCS] Decompression failed: ${decompressionError.message}`);
                                    }
                                }
                            } catch (jsonError) {
                                // Not JSON, continue to next message
                            }
                            
                        } catch (decodeError) {
                            console.log(`⚠️ [HCS] Failed to decode message: ${decodeError.message}`);
                        }
                    }
                }
                
                console.log(`❌ [HCS] No image data found in topic messages for ${topicId}`);
            } else {
                console.log(`❌ [HCS] No messages found for topic ${topicId}`);
            }

            return null;
        } catch (error) {
            console.error(`❌ [HCS] Error fetching HCS data for ${hcsUrl}:`, error.message);
            if (error.response) {
                console.log(`HTTP Status: ${error.response.status}`);
            }
            return null;
        }
    }

    /**
     * Convert HRL to HTTP URL (legacy method - now uses fetchHCSImageData)
     * @param {string} hrlUrl - HRL URL (hcs://1/topicId)
     * @returns {Promise<string|null>} HTTP URL or null
     */
    async convertHRLToHttp(hrlUrl) {
        return await this.fetchHCSImageData(hrlUrl);
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