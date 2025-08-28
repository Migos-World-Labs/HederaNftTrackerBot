/**
 * Test script to demonstrate the Forever Mint notification 
 * image optimization implemented for Migos World Discord
 */

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Simulate the createForeverMintEmbed function with optimized image loading
function createForeverMintEmbedOptimized(mint, hbarRate) {
    const nftName = mint.nft_name || `NFT #${mint.serial_number || 'Unknown'}`;
    const collectionName = mint.collection_name || 'Wild Tigers 🐯';
    
    // Format mint cost (HBAR only, no USD conversion)
    let costText = 'Free';
    if (mint.mint_cost && mint.mint_cost > 0) {
        costText = `${mint.mint_cost} ${mint.mint_cost_symbol}`;
    }
    
    // Build description with mint cost and rarity
    let description = `Minted on SentX Forever Mint for **${costText}**`;
    
    // Add rarity information if available
    if (mint.rarity_rank) {
        const rarityText = mint.rarity_percentage 
            ? `Rarity: #${mint.rarity_rank} (${(mint.rarity_percentage * 100).toFixed(2)}% rare)`
            : `Rarity: #${mint.rarity_rank}`;
        description += `\n${rarityText}`;
    }
    
    const embed = new EmbedBuilder()
        .setTitle(`🌟 ${nftName} Forever Mint!`)
        .setDescription(description)
        .setColor('#FFD700') // Golden color to match the Forever Mint sticker
        .setTimestamp(new Date(mint.timestamp));

    // Add collection info
    embed.setAuthor({
        name: `${collectionName} Forever Mint`,
        iconURL: null
    });

    // Set NFT image if available - OPTIMIZED VERSION
    console.log(`🖼️ Image Optimization Demo for ${nftName}:`);
    console.log(`   Original IPFS URL: ${mint.image_url}`);
    
    if (mint.image_url) {
        const imageUrl = mint.image_url;
        
        // BEFORE: Old slow gateways
        const oldPinata = imageUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
        const oldCloudflare = imageUrl.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
        console.log(`   ❌ OLD (Pinata): ${oldPinata}`);
        console.log(`   ❌ OLD (Cloudflare): ${oldCloudflare}`);
        
        // AFTER: New optimized Hashpack CDN with image optimization
        let finalImageUrl = imageUrl;
        if (imageUrl.startsWith('ipfs://')) {
            const ipfsHash = imageUrl.replace('ipfs://', '');
            finalImageUrl = `https://hashpack.b-cdn.net/ipfs/${ipfsHash}?optimizer=image&width=1500`;
        }
        
        console.log(`   ✅ NEW (Hashpack CDN): ${finalImageUrl}`);
        console.log(`   🚀 Optimization: Using Hashpack CDN with image optimizer for fastest Discord loading`);
        
        embed.setImage(finalImageUrl);
    }

    // Set Wild Tigers Forever Mint sticker as thumbnail
    embed.setThumbnail('attachment://forever-mint-sticker.png');

    // Set footer with timestamp and marketplace
    embed.setFooter({
        text: `Forever Minted on SentX • ${new Date(mint.timestamp).toLocaleString()}`,
        iconURL: 'https://sentinent-bherbhd8e3cyg4dn.z01.azurefd.net/media/web/hedera-logo-128.png'
    });

    return embed;
}

// Test with sample Wild Tigers mint data
console.log('\n🎯 FOREVER MINT IMAGE OPTIMIZATION TEST');
console.log('=====================================\n');

const sampleMint = {
    nft_name: 'Wild Tigers #339',
    collection_name: 'Wild Tigers',
    token_id: '0.0.6024491',
    serial_number: 339,
    mint_cost: 600,
    mint_cost_symbol: 'HBAR',
    minter_account_id: '0.0.6251738',
    image_url: 'ipfs://bafkreib3vnkpr4txrslv7wmq4naqds6fpkjocs5iypvcgefbcsj453odja',
    timestamp: '2025-08-28T03:41:02.000Z',
    rarity_rank: 2137,
    rarity_percentage: 0.6414
};

// Generate the optimized embed
const optimizedEmbed = createForeverMintEmbedOptimized(sampleMint, 0.13);

console.log('\n🌟 OPTIMIZED FOREVER MINT EMBED GENERATED');
console.log('==========================================');
console.log(`Title: ${optimizedEmbed.data.title}`);
console.log(`Color: ${optimizedEmbed.data.color} (Golden)`);
console.log(`Description: ${optimizedEmbed.data.description}`);
console.log(`Image URL: ${optimizedEmbed.data.image.url}`);
console.log(`Thumbnail: ${optimizedEmbed.data.thumbnail.url}`);

console.log('\n✅ IMAGE OPTIMIZATION SUMMARY:');
console.log('===============================');
console.log('• Changed from: gateway.pinata.cloud (slowest)');
console.log('• Previous: cloudflare-ipfs.com (faster)');
console.log('• NOW USING: hashpack.b-cdn.net with image optimizer (FASTEST)');
console.log('• Features: Image optimization, 1500px width, CDN acceleration');
console.log('• Target: Migos World Discord only');
console.log('• Result: Maximum speed image loading in Discord notifications');

console.log('\n🎯 The Hashpack CDN optimization is now active in the bot!');
console.log('   All new Forever Mint notifications will use the fastest Hashpack CDN with image optimization.');