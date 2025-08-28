const { createForeverMintEmbed, optimizeImageUrl } = require('./utils/embed');
const { sendDiscordMessage } = require('./services/discord');
const fs = require('fs');
const path = require('path');

async function triggerForeverMintNotification() {
    try {
        console.log('🚀 Triggering Forever Mint notification with Hashpack CDN optimization...');
        
        // Sample Wild Tigers #339 mint data 
        const sampleMint = {
            nft_id: '0.0.6024491/339',
            token_id: '0.0.6024491',
            serial_number: '339',
            name: 'Wild Tigers #339',
            cost: '600',
            cost_hbar: 600,
            cost_usd: 42.00,
            currency: 'HBAR',
            account_id: '0.0.4839',
            image_url: 'ipfs://bafkreib3vnkpr4txrslv7wmq4naqds6fpkjocs5iypvcgefbcsj453odja',
            rank: '2137',
            rarity: 64.14,
            timestamp: Date.now(),
            marketplace: 'SentX'
        };
        
        console.log(`🎯 Processing mint: ${sampleMint.name}`);
        console.log(`💰 Cost: ${sampleMint.cost} ${sampleMint.currency}`);
        console.log(`🏆 Rarity: #${sampleMint.rank} (${sampleMint.rarity}% rare)`);
        
        // Optimize image URL using Hashpack CDN
        const optimizedImageUrl = optimizeImageUrl(sampleMint.image_url);
        console.log(`📸 Original: ${sampleMint.image_url}`);
        console.log(`✨ Optimized: ${optimizedImageUrl}`);
        
        // Update the mint data with optimized image
        const optimizedMint = {
            ...sampleMint,
            image_url: optimizedImageUrl
        };
        
        // Create the Forever Mint embed
        console.log('🎨 Creating Forever Mint embed...');
        const { embed, files } = await createForeverMintEmbed(optimizedMint);
        
        // Migos World Discord configuration
        const MIGOS_WORLD_GUILD_ID = '910963230317355008';
        const MIGOS_WORLD_CHANNEL_ID = '1303104859074138273'; // Wild Tigers mint channel
        
        console.log('📤 Sending to Migos World Discord...');
        console.log(`🎯 Guild: ${MIGOS_WORLD_GUILD_ID}`);
        console.log(`📺 Channel: ${MIGOS_WORLD_CHANNEL_ID}`);
        
        // Send the notification
        await sendDiscordMessage(MIGOS_WORLD_GUILD_ID, MIGOS_WORLD_CHANNEL_ID, {
            embeds: [embed],
            files: files
        });
        
        console.log('✅ Forever Mint notification sent successfully!');
        console.log('🚀 Features used:');
        console.log('  • Hashpack CDN with image optimization');
        console.log('  • 1500px width optimization for Discord');
        console.log('  • CDN acceleration for fastest loading');
        console.log('  • Golden Forever Mint theme');
        console.log('  • NFT rarity and cost information');
        console.log('🎯 Target: Migos World Discord only');
        
    } catch (error) {
        console.error('❌ Error triggering Forever Mint notification:', error);
        console.error('Stack:', error.stack);
    }
}

// Run the trigger
triggerForeverMintNotification();