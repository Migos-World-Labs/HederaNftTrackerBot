// Test script to send a Forever Mint notification for Wild Tigers #339
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const { createForeverMintEmbed } = require('./utils/embed');
const fs = require('fs');
const path = require('path');

async function sendForeverMintNotification() {
    try {
        // Initialize Discord client
        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        // Login to Discord
        await client.login(process.env.DISCORD_TOKEN);
        
        console.log('Bot logged in successfully!');

        // Wait for bot to be ready
        await new Promise(resolve => client.once('ready', resolve));

        // Target channel ID for notifications
        const channelId = '910963234209673231';
        const channel = await client.channels.fetch(channelId);

        if (!channel) {
            console.error('Could not find target channel');
            return;
        }

        // Create mock mint data based on the actual Wild Tigers #339 from the logs
        const mintData = {
            nft_name: 'Wild Tigers #339',
            collection_name: 'Wild Tigers',
            token_id: '0.0.6024491',
            serial_number: 339,
            mint_cost: 600,
            mint_cost_symbol: 'HBAR',
            minter_account_id: '0.0.6251738',
            image_url: 'ipfs://bafkreib3vnkpr4txrslv7wmq4naqds6fpkjocs5iypvcgefbcsj453odja',
            timestamp: '2025-08-28T03:41:02.000Z',
            transaction_id: '0.0.1993805@1756352451.353904556',
            marketplace: 'SentX'
        };

        // Create Forever Mint embed
        const embed = createForeverMintEmbed(mintData, 0.13); // Mock HBAR rate

        // Create attachment for Forever Mint sticker
        const stickerPath = path.join(__dirname, 'attached_assets', 'Forever Mint Sticker_1756349371753.png');
        let attachment = null;
        
        if (fs.existsSync(stickerPath)) {
            attachment = new AttachmentBuilder(stickerPath, { name: 'forever-mint-sticker.png' });
            console.log('Forever Mint sticker found and attached');
        } else {
            console.log('Forever Mint sticker not found at:', stickerPath);
        }

        // Send the notification
        const messageOptions = { embeds: [embed] };
        if (attachment) {
            messageOptions.files = [attachment];
        }

        const message = await channel.send(messageOptions);
        console.log('🌟 Forever Mint notification sent successfully!');
        console.log(`Message ID: ${message.id}`);
        console.log(`Channel: ${channel.name} (${channel.id})`);
        console.log(`NFT: ${mintData.nft_name} - ${mintData.mint_cost} ${mintData.mint_cost_symbol}`);

        // Cleanup
        client.destroy();
        process.exit(0);

    } catch (error) {
        console.error('Error sending Forever Mint notification:', error);
        process.exit(1);
    }
}

// Run the notification
sendForeverMintNotification();