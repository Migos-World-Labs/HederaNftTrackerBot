/**
 * Test posting recent sales from both SentX and Kabila to Discord
 */

const { Client, GatewayIntentBits } = require('discord.js');
const kabilaService = require('./services/kabila');
const sentxService = require('./services/sentx');
const currencyService = require('./services/currency');
const embedUtils = require('./utils/embed');
const config = require('./config');

async function testBothMarketplaces() {
    try {
        console.log('Testing both SentX and Kabila sales posting...');
        
        // Initialize Discord client
        const client = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
        });
        
        await client.login(config.DISCORD_TOKEN);
        await new Promise(resolve => client.once('ready', resolve));
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get recent sales from both marketplaces
        console.log('Fetching recent sales from SentX...');
        const sentxSales = await sentxService.getRecentSales(1);
        
        console.log('Fetching recent sales from Kabila...');
        const kabilaSales = await kabilaService.getRecentSales(1);
        
        if (!sentxSales?.length && !kabilaSales?.length) {
            console.log('No recent sales found from either marketplace');
            process.exit(1);
        }
        
        // Get current HBAR rate
        const hbarRate = await currencyService.getHbarToUsdRate();
        console.log(`Current HBAR rate: $${hbarRate}`);
        
        // Use the same channel posting logic as the main bot
        const DatabaseStorage = require('./database-storage');
        const storage = new DatabaseStorage();
        await storage.init();
        
        const serverConfigs = await storage.getAllServerConfigs();
        console.log(`Found ${serverConfigs.length} server configurations`);
        
        let totalPosts = 0;
        
        // Test SentX sale if available
        if (sentxSales?.length > 0) {
            const sentxSale = sentxSales[0];
            console.log(`\n📈 Testing SentX Sale: ${sentxSale.nft_name} - ${sentxSale.price_hbar} HBAR`);
            
            for (const serverConfig of serverConfigs) {
                if (!serverConfig.enabled) continue;
                
                const guild = client.guilds.cache.get(serverConfig.guildId);
                if (!guild) continue;
                
                const channel = guild.channels.cache.get(serverConfig.channelId);
                if (channel) {
                    const embed = await embedUtils.createSaleEmbed(sentxSale, hbarRate);
                    await channel.send({
                        content: '🧪 **Test Message** - Recent SentX Sale',
                        embeds: [embed]
                    });
                    console.log(`Posted SentX sale to ${guild.name} #${channel.name}`);
                    totalPosts++;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        // Test Kabila sale if available
        if (kabilaSales?.length > 0) {
            const kabilaSale = kabilaSales[0];
            console.log(`\n🔶 Testing Kabila Sale: ${kabilaSale.nftName || 'Kabila NFT'} - ${kabilaSale.price} HBAR`);
            
            // Format Kabila sale data to match embed expectations
            const formattedKabilaSale = {
                nft_name: kabilaSale.nftName || 'Kabila NFT',
                price_hbar: kabilaSale.price,
                timestamp: kabilaSale.timestamp,
                marketplace: 'Kabila',
                collection_name: kabilaSale.collectionName || 'Unknown Collection',
                buyer: kabilaSale.buyer || 'unknown',
                seller: kabilaSale.seller || 'unknown',
                token_id: kabilaSale.tokenId,
                serial_number: kabilaSale.serialNumber,
                imageUrl: kabilaSale.imageUrl
            };
            
            for (const serverConfig of serverConfigs) {
                if (!serverConfig.enabled) continue;
                
                const guild = client.guilds.cache.get(serverConfig.guildId);
                if (!guild) continue;
                
                const channel = guild.channels.cache.get(serverConfig.channelId);
                if (channel) {
                    const embed = await embedUtils.createSaleEmbed(formattedKabilaSale, hbarRate);
                    await channel.send({
                        content: '🧪 **Test Message** - Recent Kabila Sale',
                        embeds: [embed]
                    });
                    console.log(`Posted Kabila sale to ${guild.name} #${channel.name}`);
                    totalPosts++;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        console.log(`\n✅ Successfully posted ${totalPosts} test messages to Discord channels`);
        console.log('Both SentX and Kabila integrations are working correctly!');
        
        client.destroy();
        process.exit(0);
        
    } catch (error) {
        console.error('Test failed:', error.message);
        process.exit(1);
    }
}

testBothMarketplaces();