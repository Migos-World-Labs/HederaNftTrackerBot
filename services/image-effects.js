/**
 * Image Effects Service for Discord NFT Sales Bot
 * Adds visual enhancements and special effects to NFT images
 */

const Canvas = require('canvas');
const sharp = require('sharp');
const Jimp = require('jimp');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class ImageEffectsService {
    constructor() {
        this.tempDir = './temp_images';
        this.cacheDir = './cache_images';
        this.ensureDirectories();
    }

    async ensureDirectories() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
            await fs.mkdir(this.cacheDir, { recursive: true });
        } catch (error) {
            console.log('Directory creation skipped:', error.message);
        }
    }

    /**
     * Generate enhanced image with effects based on sale data
     * @param {string} originalImageUrl - Original NFT image URL
     * @param {Object} saleData - Sale information for context
     * @returns {Promise<string>} Path to enhanced image file
     */
    async generateEnhancedImage(originalImageUrl, saleData) {
        try {
            if (!originalImageUrl) return null;

            console.log(`🎨 [IMAGE FX] Processing image for ${saleData.nft_name}`);
            
            // Download original image
            const imagePath = await this.downloadImage(originalImageUrl, saleData.token_id, saleData.serial_number);
            if (!imagePath) return null;

            // Determine effect type based on sale data
            const effectType = this.determineEffectType(saleData);
            console.log(`🎨 [IMAGE FX] Applying ${effectType} effect`);

            // Apply effects based on type
            let enhancedImagePath;
            switch (effectType) {
                case 'legendary':
                    enhancedImagePath = await this.createLegendaryEffect(imagePath, saleData);
                    break;
                case 'rare':
                    enhancedImagePath = await this.createRareEffect(imagePath, saleData);
                    break;
                case 'whale':
                    enhancedImagePath = await this.createWhaleEffect(imagePath, saleData);
                    break;
                case 'milestone':
                    enhancedImagePath = await this.createMilestoneEffect(imagePath, saleData);
                    break;
                case 'hashinal':
                    enhancedImagePath = await this.createHashinalEffect(imagePath, saleData);
                    break;
                default:
                    enhancedImagePath = await this.createStandardEffect(imagePath, saleData);
            }

            return enhancedImagePath;

        } catch (error) {
            console.error('🎨 [IMAGE FX] Error generating enhanced image:', error.message);
            return null;
        }
    }

    /**
     * Download image from URL and save locally
     */
    async downloadImage(imageUrl, tokenId, serialNumber) {
        try {
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const filename = `original_${tokenId}_${serialNumber}_${Date.now()}.png`;
            const filepath = path.join(this.tempDir, filename);
            
            await fs.writeFile(filepath, response.data);
            console.log(`🎨 [IMAGE FX] Downloaded image: ${filepath}`);
            return filepath;

        } catch (error) {
            console.error('🎨 [IMAGE FX] Error downloading image:', error.message);
            return null;
        }
    }

    /**
     * Determine what type of effect to apply based on sale data
     */
    determineEffectType(saleData) {
        // Price-based effects (high value sales)
        if (saleData.price_hbar >= 1000) return 'legendary';
        if (saleData.price_hbar >= 500) return 'rare';

        // Rarity-based effects
        if (saleData.rarity && saleData.rarity <= 0.01) return 'legendary'; // Top 1%
        if (saleData.rarity && saleData.rarity <= 0.05) return 'rare'; // Top 5%

        // Rank-based effects
        if (saleData.rank && saleData.rank <= 10) return 'legendary'; // Top 10
        if (saleData.rank && saleData.rank <= 50) return 'rare'; // Top 50

        // Collection-specific effects
        if (saleData.collection_name && (
            saleData.collection_name.toLowerCase().includes('hashinal') ||
            saleData.collection_name.toLowerCase().includes('hcs-')
        )) return 'hashinal';

        // Whale buyer effect (check if this sale indicates whale activity)
        if (saleData.price_hbar >= 100) return 'whale';

        // Special milestone effects for round numbers
        if (saleData.price_hbar % 100 === 0 && saleData.price_hbar >= 100) return 'milestone';

        return 'standard';
    }

    /**
     * Create legendary effect with golden border and particle effects
     */
    async createLegendaryEffect(imagePath, saleData) {
        try {
            const image = await Jimp.read(imagePath);
            const size = 400;
            
            // Resize image maintaining aspect ratio
            image.scaleToFit(size - 40, size - 40);
            
            // Create canvas for effects
            const canvas = Canvas.createCanvas(size, size);
            const ctx = canvas.getContext('2d');

            // Create golden gradient background
            const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
            gradient.addColorStop(0, '#FFD700');
            gradient.addColorStop(0.7, '#FFA500');
            gradient.addColorStop(1, '#FF8C00');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);

            // Add animated golden border
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 8;
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 20;
            ctx.strokeRect(10, 10, size - 20, size - 20);

            // Add sparkle effects
            this.addSparkleEffects(ctx, size);

            // Add price badge
            this.addPriceBadge(ctx, saleData.price_hbar, '#FFD700', size);

            // Convert Jimp image to buffer and overlay
            const imageBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
            const img = await Canvas.loadImage(imageBuffer);
            
            const imgX = (size - image.bitmap.width) / 2;
            const imgY = (size - image.bitmap.height) / 2;
            ctx.drawImage(img, imgX, imgY);

            // Save enhanced image
            const outputPath = path.join(this.tempDir, `legendary_${Date.now()}.png`);
            const buffer = canvas.toBuffer('image/png');
            await fs.writeFile(outputPath, buffer);
            
            console.log(`🎨 [IMAGE FX] Created legendary effect: ${outputPath}`);
            return outputPath;

        } catch (error) {
            console.error('🎨 [IMAGE FX] Error creating legendary effect:', error.message);
            return imagePath; // Return original if effect fails
        }
    }

    /**
     * Create rare effect with silver/purple border
     */
    async createRareEffect(imagePath, saleData) {
        try {
            const image = await Jimp.read(imagePath);
            const size = 400;
            
            image.scaleToFit(size - 40, size - 40);
            
            const canvas = Canvas.createCanvas(size, size);
            const ctx = canvas.getContext('2d');

            // Purple gradient background
            const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
            gradient.addColorStop(0, '#9932CC');
            gradient.addColorStop(0.7, '#8A2BE2');
            gradient.addColorStop(1, '#4B0082');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);

            // Silver border with glow
            ctx.strokeStyle = '#C0C0C0';
            ctx.lineWidth = 6;
            ctx.shadowColor = '#C0C0C0';
            ctx.shadowBlur = 15;
            ctx.strokeRect(15, 15, size - 30, size - 30);

            // Add rarity badge
            this.addRarityBadge(ctx, saleData.rarity, saleData.rank, size);

            // Overlay image
            const imageBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
            const img = await Canvas.loadImage(imageBuffer);
            
            const imgX = (size - image.bitmap.width) / 2;
            const imgY = (size - image.bitmap.height) / 2;
            ctx.drawImage(img, imgX, imgY);

            const outputPath = path.join(this.tempDir, `rare_${Date.now()}.png`);
            const buffer = canvas.toBuffer('image/png');
            await fs.writeFile(outputPath, buffer);
            
            console.log(`🎨 [IMAGE FX] Created rare effect: ${outputPath}`);
            return outputPath;

        } catch (error) {
            console.error('🎨 [IMAGE FX] Error creating rare effect:', error.message);
            return imagePath;
        }
    }

    /**
     * Create whale effect with ocean theme
     */
    async createWhaleEffect(imagePath, saleData) {
        try {
            const image = await Jimp.read(imagePath);
            const size = 400;
            
            image.scaleToFit(size - 40, size - 40);
            
            const canvas = Canvas.createCanvas(size, size);
            const ctx = canvas.getContext('2d');

            // Ocean gradient background
            const gradient = ctx.createLinearGradient(0, 0, 0, size);
            gradient.addColorStop(0, '#001f3f');
            gradient.addColorStop(0.5, '#0074D9');
            gradient.addColorStop(1, '#7FDBFF');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);

            // Wave effect border
            ctx.strokeStyle = '#7FDBFF';
            ctx.lineWidth = 5;
            ctx.shadowColor = '#7FDBFF';
            ctx.shadowBlur = 10;
            
            // Draw wavy border
            this.drawWavyBorder(ctx, size);

            // Add whale emoji and price
            ctx.font = 'bold 24px Arial';
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.fillText('🐋 WHALE ACTIVITY', size/2, 30);
            
            this.addPriceBadge(ctx, saleData.price_hbar, '#7FDBFF', size);

            // Overlay image
            const imageBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
            const img = await Canvas.loadImage(imageBuffer);
            
            const imgX = (size - image.bitmap.width) / 2;
            const imgY = (size - image.bitmap.height) / 2;
            ctx.drawImage(img, imgX, imgY);

            const outputPath = path.join(this.tempDir, `whale_${Date.now()}.png`);
            const buffer = canvas.toBuffer('image/png');
            await fs.writeFile(outputPath, buffer);
            
            console.log(`🎨 [IMAGE FX] Created whale effect: ${outputPath}`);
            return outputPath;

        } catch (error) {
            console.error('🎨 [IMAGE FX] Error creating whale effect:', error.message);
            return imagePath;
        }
    }

    /**
     * Create milestone effect for round number sales
     */
    async createMilestoneEffect(imagePath, saleData) {
        try {
            const image = await Jimp.read(imagePath);
            const size = 400;
            
            image.scaleToFit(size - 40, size - 40);
            
            const canvas = Canvas.createCanvas(size, size);
            const ctx = canvas.getContext('2d');

            // Celebration gradient
            const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
            gradient.addColorStop(0, '#FF69B4');
            gradient.addColorStop(0.5, '#FF1493');
            gradient.addColorStop(1, '#DC143C');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);

            // Celebration border
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 6;
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 15;
            ctx.strokeRect(10, 10, size - 20, size - 20);

            // Add confetti effect
            this.addConfettiEffect(ctx, size);

            // Milestone banner
            ctx.font = 'bold 20px Arial';
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeText(`🎉 ${saleData.price_hbar} HBAR MILESTONE! 🎉`, size/2, 30);
            ctx.fillText(`🎉 ${saleData.price_hbar} HBAR MILESTONE! 🎉`, size/2, 30);

            // Overlay image
            const imageBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
            const img = await Canvas.loadImage(imageBuffer);
            
            const imgX = (size - image.bitmap.width) / 2;
            const imgY = (size - image.bitmap.height) / 2;
            ctx.drawImage(img, imgX, imgY);

            const outputPath = path.join(this.tempDir, `milestone_${Date.now()}.png`);
            const buffer = canvas.toBuffer('image/png');
            await fs.writeFile(outputPath, buffer);
            
            console.log(`🎨 [IMAGE FX] Created milestone effect: ${outputPath}`);
            return outputPath;

        } catch (error) {
            console.error('🎨 [IMAGE FX] Error creating milestone effect:', error.message);
            return imagePath;
        }
    }

    /**
     * Create Hashinal-specific effect with HCS theme
     */
    async createHashinalEffect(imagePath, saleData) {
        try {
            const image = await Jimp.read(imagePath);
            const size = 400;
            
            image.scaleToFit(size - 40, size - 40);
            
            const canvas = Canvas.createCanvas(size, size);
            const ctx = canvas.getContext('2d');

            // Tech/blockchain gradient
            const gradient = ctx.createLinearGradient(0, 0, size, size);
            gradient.addColorStop(0, '#0a0a0a');
            gradient.addColorStop(0.3, '#1a1a2e');
            gradient.addColorStop(0.7, '#16213e');
            gradient.addColorStop(1, '#0f3460');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);

            // Circuit board pattern border
            this.drawCircuitBorder(ctx, size);

            // Hashinal label
            ctx.font = 'bold 18px monospace';
            ctx.fillStyle = '#00ff41';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeText('⛓️ HASHINAL • HCS-5', size/2, 30);
            ctx.fillText('⛓️ HASHINAL • HCS-5', size/2, 30);

            this.addPriceBadge(ctx, saleData.price_hbar, '#00ff41', size);

            // Overlay image
            const imageBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
            const img = await Canvas.loadImage(imageBuffer);
            
            const imgX = (size - image.bitmap.width) / 2;
            const imgY = (size - image.bitmap.height) / 2;
            ctx.drawImage(img, imgX, imgY);

            const outputPath = path.join(this.tempDir, `hashinal_${Date.now()}.png`);
            const buffer = canvas.toBuffer('image/png');
            await fs.writeFile(outputPath, buffer);
            
            console.log(`🎨 [IMAGE FX] Created hashinal effect: ${outputPath}`);
            return outputPath;

        } catch (error) {
            console.error('🎨 [IMAGE FX] Error creating hashinal effect:', error.message);
            return imagePath;
        }
    }

    /**
     * Create standard effect with clean border and info
     */
    async createStandardEffect(imagePath, saleData) {
        try {
            const image = await Jimp.read(imagePath);
            const size = 400;
            
            image.scaleToFit(size - 40, size - 40);
            
            const canvas = Canvas.createCanvas(size, size);
            const ctx = canvas.getContext('2d');

            // Clean gradient background
            const gradient = ctx.createLinearGradient(0, 0, 0, size);
            gradient.addColorStop(0, '#f8f9fa');
            gradient.addColorStop(1, '#e9ecef');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);

            // Clean border
            ctx.strokeStyle = '#6c757d';
            ctx.lineWidth = 3;
            ctx.strokeRect(15, 15, size - 30, size - 30);

            this.addPriceBadge(ctx, saleData.price_hbar, '#007bff', size);

            // Overlay image
            const imageBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
            const img = await Canvas.loadImage(imageBuffer);
            
            const imgX = (size - image.bitmap.width) / 2;
            const imgY = (size - image.bitmap.height) / 2;
            ctx.drawImage(img, imgX, imgY);

            const outputPath = path.join(this.tempDir, `standard_${Date.now()}.png`);
            const buffer = canvas.toBuffer('image/png');
            await fs.writeFile(outputPath, buffer);
            
            console.log(`🎨 [IMAGE FX] Created standard effect: ${outputPath}`);
            return outputPath;

        } catch (error) {
            console.error('🎨 [IMAGE FX] Error creating standard effect:', error.message);
            return imagePath;
        }
    }

    // Helper methods for visual effects

    addSparkleEffects(ctx, size) {
        ctx.fillStyle = '#FFD700';
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const sparkleSize = Math.random() * 3 + 1;
            
            ctx.beginPath();
            ctx.arc(x, y, sparkleSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    addConfettiEffect(ctx, size) {
        const colors = ['#FF69B4', '#FFD700', '#00FF00', '#00BFFF', '#FF4500'];
        for (let i = 0; i < 30; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const width = Math.random() * 6 + 2;
            const height = Math.random() * 6 + 2;
            
            ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
            ctx.fillRect(x, y, width, height);
        }
    }

    drawWavyBorder(ctx, size) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        
        // Top wave
        for (let x = 0; x <= size; x += 10) {
            const y = 15 + Math.sin(x * 0.1) * 5;
            ctx.lineTo(x, y);
        }
        
        // Right wave
        for (let y = 0; y <= size; y += 10) {
            const x = size - 15 - Math.sin(y * 0.1) * 5;
            ctx.lineTo(x, y);
        }
        
        // Bottom wave
        for (let x = size; x >= 0; x -= 10) {
            const y = size - 15 - Math.sin(x * 0.1) * 5;
            ctx.lineTo(x, y);
        }
        
        // Left wave
        for (let y = size; y >= 0; y -= 10) {
            const x = 15 + Math.sin(y * 0.1) * 5;
            ctx.lineTo(x, y);
        }
        
        ctx.closePath();
        ctx.stroke();
    }

    drawCircuitBorder(ctx, size) {
        ctx.strokeStyle = '#00ff41';
        ctx.lineWidth = 2;
        
        // Draw circuit-like patterns
        const step = 20;
        for (let i = step; i < size - step; i += step) {
            // Horizontal lines
            ctx.beginPath();
            ctx.moveTo(step, i);
            ctx.lineTo(size - step, i);
            ctx.stroke();
            
            // Vertical lines
            ctx.beginPath();
            ctx.moveTo(i, step);
            ctx.lineTo(i, size - step);
            ctx.stroke();
            
            // Small dots at intersections
            ctx.fillStyle = '#00ff41';
            ctx.beginPath();
            ctx.arc(i, i, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    addPriceBadge(ctx, price, color, canvasSize) {
        const badgeY = canvasSize - 40;
        const badgeWidth = 150;
        const badgeHeight = 30;
        const badgeX = (canvasSize - badgeWidth) / 2;

        // Badge background
        ctx.fillStyle = color;
        ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
        
        // Badge border
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.strokeRect(badgeX, badgeY, badgeWidth, badgeHeight);

        // Price text
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(`${price} HBAR`, canvasSize/2, badgeY + 20);
    }

    addRarityBadge(ctx, rarity, rank, canvasSize) {
        if (!rarity && !rank) return;
        
        const badgeY = 50;
        const badgeWidth = 120;
        const badgeHeight = 25;
        const badgeX = (canvasSize - badgeWidth) / 2;

        ctx.fillStyle = '#9932CC';
        ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
        
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.strokeRect(badgeX, badgeY, badgeWidth, badgeHeight);

        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        
        if (rank) {
            ctx.fillText(`RANK #${rank}`, canvasSize/2, badgeY + 16);
        } else if (rarity) {
            const rarityPct = (rarity * 100).toFixed(1);
            ctx.fillText(`${rarityPct}% RARE`, canvasSize/2, badgeY + 16);
        }
    }

    /**
     * Clean up temporary files older than 1 hour
     */
    async cleanupTempFiles() {
        try {
            const files = await fs.readdir(this.tempDir);
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            
            for (const file of files) {
                const filepath = path.join(this.tempDir, file);
                const stats = await fs.stat(filepath);
                
                if (stats.mtime.getTime() < oneHourAgo) {
                    await fs.unlink(filepath);
                    console.log(`🎨 [IMAGE FX] Cleaned up old file: ${file}`);
                }
            }
        } catch (error) {
            console.log('🎨 [IMAGE FX] Cleanup error:', error.message);
        }
    }
}

module.exports = ImageEffectsService;