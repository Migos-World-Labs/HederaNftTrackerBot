/**
 * Test posting the most recent Kabila sale to Discord
 */

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const kabilaService = require('./services/kabila');
const currencyService = require('./services/currency');
const config = require('./config');

async function testRecentSaleMessage() {
    try {
        console.log('Fetching and posting most recent Kabila sale...');
        
        // Initialize Discord client
        const client = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
        });
        
        await client.login(config.DISCORD_TOKEN);
        await new Promise(resolve => client.once('ready', resolve));
        
        // Wait a moment for the client to fully initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get the most recent sale from Kabila
        const recentSales = await kabilaService.getRecentSales(1);
        if (!recentSales || recentSales.length === 0) {
            console.log('No recent sales found');
            process.exit(1);
        }
        
        const latestSale = recentSales[0];
        console.log(`Recent sale: ${latestSale.price} HBAR at ${new Date(latestSale.timestamp).toISOString()}`);
        
        // Get current HBAR rate
        const hbarRate = await currencyService.getHbarToUsdRate();
        const usdValue = (latestSale.price * hbarRate).toFixed(2);
        
        // Create enhanced embed for the sale
        const embed = new EmbedBuilder()
            .setTitle('💎 Recent NFT Sale - Kabila Marketplace')
            .setDescription('**Most Recent Sale from Kabila**')
            .addFields(
                { name: '💰 Sale Price', value: `**${latestSale.price} HBAR** (~$${usdValue} USD)`, inline: true },
                { name: '📅 Sale Date', value: `<t:${Math.floor(latestSale.timestamp / 1000)}:R>`, inline: true },
                { name: '🏪 Marketplace', value: '**Kabila**', inline: true },
                { name: '🔗 Marketplace Link', value: '[View on Kabila](https://kabila.app)', inline: false }
            )
            .setColor('#00ff88')
            .setFooter({ text: 'Kabila Sales Bot - Test Message' })
            .setTimestamp();
        
        // Use the same channel posting logic as the main bot
        const DatabaseStorage = require('./database-storage');
        const storage = new DatabaseStorage();
        await storage.init();
        
        const serverConfigs = await storage.getAllServerConfigs();
        let successCount = 0;
        
        console.log(`Found ${serverConfigs.length} server configurations`);
        
        for (const serverConfig of serverConfigs) {
            console.log(`Checking server: ${serverConfig.guildName} (${serverConfig.guildId})`);
            if (!serverConfig.enabled) {
                console.log('Server disabled, skipping');
                continue;
            }
            
            const guild = client.guilds.cache.get(serverConfig.guildId);
            if (!guild) {
                console.log(`Guild ${serverConfig.guildId} not found in cache`);
                continue;
            }
            
            const channel = guild.channels.cache.get(serverConfig.channelId);
            if (channel) {
                console.log(`Found channel: #${channel.name} in ${guild.name}`);
                // Create enhanced embed using the same utility as the main bot
                const embedUtils = require('./utils/embed');
                
                // Format sale data to match bot expectations
                const formattedSale = {
                    nft_name: latestSale.nftName || 'Kabila NFT',
                    price_hbar: latestSale.price,
                    timestamp: latestSale.timestamp,
                    marketplace: 'Kabila',
                    collection_name: latestSale.collectionName || 'Unknown Collection',
                    buyer: latestSale.buyer || 'unknown',
                    seller: latestSale.seller || 'unknown',
                    token_id: latestSale.tokenId,
                    serial_number: latestSale.serialNumber,
                    imageUrl: latestSale.imageUrl
                };
                
                const botEmbed = await embedUtils.createSaleEmbed(formattedSale, hbarRate);
                
                await channel.send({
                    content: '🧪 **Test Message** - Recent Kabila Sale Notification',
                    embeds: [botEmbed]
                });
                
                successCount++;
                console.log(`Posted to ${serverConfig.guild_name} #${channel.name}`);
            }
        }
        
        console.log(`Successfully posted recent Kabila sale (${latestSale.price} HBAR) to ${successCount} channels`);
        
        client.destroy();
        process.exit(0);
        
    } catch (error) {
        console.error('Test failed:', error.message);
        process.exit(1);
    }
}

testRecentSaleMessage();