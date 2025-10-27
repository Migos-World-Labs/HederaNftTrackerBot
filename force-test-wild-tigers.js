const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');
const sentxService = require('./services/sentx');
const embedUtils = require('./utils/embed');

async function forceTestPost() {
    const client = new Client({
        intents: [GatewayIntentBits.Guilds]
    });

    try {
        await client.login(process.env.DISCORD_TOKEN);
        console.log('✅ Bot logged in');

        // Migos World configuration from database
        const guildId = '910963230317355008';
        const channelId = '910963234209673231'; // Main chat (mint_channel_id from DB)

        console.log('🔍 Fetching latest Wild Tigers Forever Mint...');
        const recentMints = await sentxService.getRecentForeverMints(1);
        
        if (!recentMints || recentMints.length === 0) {
            console.log('❌ No Wild Tigers mints found');
            process.exit(1);
        }

        const mint = recentMints[0];
        console.log(`✅ Latest Wild Tigers Mint: ${mint.nft_name}`);
        console.log(`   Minted: ${new Date(mint.timestamp || mint.mint_date).toLocaleString()}`);
        console.log(`   Cost: ${mint.mint_cost} ${mint.mint_cost_symbol || 'HBAR'}`);

        // Create the OLD FORMAT embed (no rarity/rank fields)
        const hbarRate = 0.18;  // Example rate
        const embed = await embedUtils.createForeverMintEmbed(mint, hbarRate, guildId);

        // Load Forever Mint sticker
        const stickerPath = path.join(__dirname, 'attached_assets', 'Forever Mint Sticker_1756349371753.png');
        let messageOptions = { embeds: [embed] };
        
        if (fs.existsSync(stickerPath)) {
            const stickerAttachment = new AttachmentBuilder(stickerPath, { name: 'forever-mint-sticker.png' });
            messageOptions.files = [stickerAttachment];
            console.log('✅ Forever Mint sticker attached');
        } else {
            console.log('⚠️ Forever Mint sticker not found');
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            console.log('❌ Migos World not found');
            process.exit(1);
        }

        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
            console.log('❌ Channel not found');
            process.exit(1);
        }

        console.log(`📤 Posting to Migos World > ${channel.name}...`);
        console.log(`📋 Embed Preview:`);
        console.log(`   Title: 🌟 ${mint.nft_name} Forever Mint!`);
        console.log(`   Description: Minted on SentX Forever Mint for ${mint.mint_cost} ${mint.mint_cost_symbol || 'HBAR'}`);
        console.log(`   Format: OLD (no rarity/rank fields)`);
        
        await channel.send(messageOptions);
        console.log('✅ Wild Tigers Forever Mint posted to Migos World!');

        client.destroy();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

forceTestPost();
