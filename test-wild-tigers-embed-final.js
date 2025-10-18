const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const sentxService = require('./services/sentx');

async function sendTestEmbed() {
    const client = new Client({
        intents: [GatewayIntentBits.Guilds]
    });

    try {
        await client.login(process.env.DISCORD_TOKEN);
        console.log('✅ Bot logged in successfully');

        const guildId = '910963230317355008';
        const channelId = '910963234209673231';

        console.log('🔍 Fetching latest Wild Tigers mint...');
        const recentMints = await sentxService.getRecentForeverMints(1);
        
        if (!recentMints || recentMints.length === 0) {
            console.log('❌ No recent Wild Tigers mints found');
            process.exit(1);
        }

        const mint = recentMints[0];
        console.log(`✅ Found: ${mint.nft_name}`);

        const optimizedImageUrl = mint.image_url?.startsWith('ipfs://') 
            ? `https://hashpack.b-cdn.net/ipfs/${mint.image_url.replace('ipfs://', '')}?optimizer=image&width=1500`
            : mint.image_url || mint.image_cdn;

        let rarityRank = 'N/A';
        let rarityPercent = 'N/A';
        
        try {
            console.log('🔍 Fetching rarity data...');
            const nftDetails = await sentxService.getNFTDetails(mint.token_id, mint.serial_number);
            if (nftDetails && nftDetails.success && nftDetails.nft) {
                if (nftDetails.nft.rarityRank) {
                    rarityRank = `#${nftDetails.nft.rarityRank}`;
                }
                if (nftDetails.nft.rarityPct) {
                    rarityPercent = `${nftDetails.nft.rarityPct}%`;
                }
                console.log(`✅ Rarity: Rank ${rarityRank}, ${rarityPercent}`);
            }
        } catch (error) {
            console.log(`⚠️ Could not fetch rarity: ${error.message}`);
        }

        const embed = new EmbedBuilder()
            .setTitle(`${mint.nft_name}`)
            .setDescription(`Minted on SentX for **${mint.mint_cost} HBAR**`)
            .addFields([
                { name: '🔢 Serial Number', value: `#${mint.serial_number}`, inline: true },
                { name: '📊 Rarity Rank', value: rarityRank, inline: true },
                { name: '🎯 Rarity %', value: rarityPercent, inline: true }
            ])
            .setColor('#FFD700')
            .setTimestamp(new Date(mint.mint_date));

        if (optimizedImageUrl) {
            embed.setImage(optimizedImageUrl);
        }

        embed.setThumbnail('attachment://forever-mint-sticker.png');

        const stickerPath = path.join(__dirname, 'attached_assets', 'Forever Mint Sticker_1756349371753.png');
        let messageOptions = { 
            embeds: [embed] 
        };
        
        if (fs.existsSync(stickerPath)) {
            const stickerAttachment = new AttachmentBuilder(stickerPath, { name: 'forever-mint-sticker.png' });
            messageOptions.files = [stickerAttachment];
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            console.log('❌ Migos World server not found');
            process.exit(1);
        }

        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
            console.log('❌ Channel not found');
            process.exit(1);
        }

        console.log('📤 Sending final embed to Migos World...');
        await channel.send(messageOptions);
        console.log('✅ Final embed sent successfully!');

        client.destroy();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

sendTestEmbed();
