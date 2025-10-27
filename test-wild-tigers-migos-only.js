const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const path = require('path');
const sentxService = require('./services/sentx');
const embedUtils = require('./utils/embed');

async function sendTestToMigosOnly() {
    const client = new Client({
        intents: [GatewayIntentBits.Guilds]
    });

    try {
        await client.login(process.env.DISCORD_TOKEN);
        console.log('✅ Bot logged in successfully');

        // Migos World ONLY
        const guildId = '910963230317355008';
        const channelId = '910963234209673231';

        console.log('🔍 Fetching latest Wild Tigers Forever Mint...');
        const recentMints = await sentxService.getRecentForeverMints(1);
        
        if (!recentMints || recentMints.length === 0) {
            console.log('❌ No recent Wild Tigers mints found');
            process.exit(1);
        }

        const mint = recentMints[0];
        console.log(`✅ Found: ${mint.nft_name}`);

        // Use the old format from Main Bot (no rarity/rank fields)
        const embed = await embedUtils.createForeverMintEmbed(mint, 0.05, guildId);

        // Load Forever Mint sticker
        const stickerPath = path.join(__dirname, 'attached_assets', 'Forever Mint Sticker_1756349371753.png');
        let messageOptions = { 
            embeds: [embed] 
        };
        
        const fs = require('fs');
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

        console.log('📤 Sending Wild Tigers Forever Mint to Migos World ONLY...');
        await channel.send(messageOptions);
        console.log('✅ Test message sent successfully to Migos World!');

        client.destroy();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

sendTestToMigosOnly();
