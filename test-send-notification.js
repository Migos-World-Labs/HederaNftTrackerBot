const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Discord client setup
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Migos World Discord configuration
const MIGOS_WORLD_GUILD_ID = '910963230317355008';
const MIGOS_WORLD_CHANNEL_ID = '1303104859074138273'; // Wild Tigers mint channel

async function sendForeverMintNotification() {
    try {
        console.log('🤖 Connecting to Discord...');
        await client.login(process.env.DISCORD_TOKEN);
        
        console.log('✅ Discord connected successfully');
        
        // Get the guild and channel
        const guild = await client.guilds.fetch(MIGOS_WORLD_GUILD_ID);
        const channel = await guild.channels.fetch(MIGOS_WORLD_CHANNEL_ID);
        
        console.log(`🎯 Found channel: ${channel.name} in ${guild.name}`);
        
        // Create Forever Mint sticker attachment
        const stickerPath = path.join(__dirname, 'attached_assets', 'Forever Mint Sticker_1756349371753.png');
        const stickerAttachment = new AttachmentBuilder(stickerPath, { name: 'forever-mint-sticker.png' });
        
        // Sample Wild Tigers #339 data with Hashpack CDN optimization
        const sampleMint = {
            name: 'Wild Tigers #339',
            serialNumber: '339',
            cost: '600',
            currency: 'HBAR',
            minter: '0.0.4839',
            imageUrl: 'https://hashpack.b-cdn.net/ipfs/bafkreib3vnkpr4txrslv7wmq4naqds6fpkjocs5iypvcgefbcsj453odja?optimizer=image&width=1500',
            rank: '2137',
            rarity: '64.14'
        };
        
        // Create the optimized Forever Mint embed
        const embed = new EmbedBuilder()
            .setTitle(`🌟 ${sampleMint.name} Forever Mint!`)
            .setDescription(`Minted on SentX Forever Mint for **${sampleMint.cost} ${sampleMint.currency}**\nRarity: #${sampleMint.rank} (${sampleMint.rarity}% rare)`)
            .setColor(0xFFD700) // Golden color
            .setImage(sampleMint.imageUrl) // Hashpack CDN optimized URL
            .setThumbnail('attachment://forever-mint-sticker.png')
            .addFields(
                { name: '💎 NFT', value: sampleMint.name, inline: true },
                { name: '💰 Cost', value: `${sampleMint.cost} ${sampleMint.currency}`, inline: true },
                { name: '🏆 Rarity', value: `#${sampleMint.rank} (${sampleMint.rarity}% rare)`, inline: true },
                { name: '👤 Minter', value: `\`${sampleMint.minter}\``, inline: false }
            )
            .setFooter({ text: 'SentX Forever Mint | Powered by Hashpack CDN' })
            .setTimestamp();
        
        console.log('📤 Sending Forever Mint notification with Hashpack CDN optimization...');
        console.log(`🖼️ Image URL: ${sampleMint.imageUrl}`);
        console.log('🚀 Features: CDN acceleration + image optimization + 1500px width');
        
        // Send the notification
        await channel.send({
            embeds: [embed],
            files: [stickerAttachment]
        });
        
        console.log('✅ Forever Mint notification sent successfully!');
        console.log('🎯 Target: Migos World Discord only');
        console.log('⚡ Performance: Maximum speed with Hashpack CDN');
        
    } catch (error) {
        console.error('❌ Error sending Forever Mint notification:', error);
    } finally {
        await client.destroy();
        console.log('🔌 Discord client disconnected');
    }
}

// Run the test
sendForeverMintNotification();