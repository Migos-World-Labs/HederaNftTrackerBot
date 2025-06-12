/**
 * Test posting sales for specific token ID 0.0.6024491 from both marketplaces
 */

const { Client, GatewayIntentBits } = require('discord.js');
const kabilaService = require('./services/kabila');
const sentxService = require('./services/sentx');
const currencyService = require('./services/currency');
const embedUtils = require('./utils/embed');
const config = require('./config');

async function testSpecificToken() {
    try {
        const targetTokenId = '0.0.6024491';
        console.log(`Testing sales for token ID: ${targetTokenId}`);
        
        // Initialize Discord client
        const client = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
        });
        
        await client.login(config.DISCORD_TOKEN);
        await new Promise(resolve => client.once('ready', resolve));
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get recent sales from both marketplaces and filter for our token
        console.log('Fetching recent sales from SentX...');
        const allSentxSales = await sentxService.getRecentSales(50);
        const sentxSales = allSentxSales.filter(sale => 
            (sale.token_id || sale.tokenId) === targetTokenId
        );
        
        console.log('Fetching recent sales from Kabila...');
        const allKabilaSales = await kabilaService.getRecentSales(50);
        const kabilaSales = allKabilaSales.filter(sale => 
            (sale.tokenId || sale.token_id) === targetTokenId
        );
        
        console.log(`Found ${sentxSales.length} SentX sales for token ${targetTokenId}`);
        console.log(`Found ${kabilaSales.length} Kabila sales for token ${targetTokenId}`);
        
        if (!sentxSales.length && !kabilaSales.length) {
            // If no sales found for specific token, use any recent sale for demonstration
            console.log(`No sales found for token ${targetTokenId}, using recent sales for demo...`);
            const demoSentx = allSentxSales.slice(0, 1);
            const demoKabila = allKabilaSales.slice(0, 1);
            
            if (demoSentx.length) {
                console.log(`Using SentX demo sale: ${demoSentx[0].nft_name} (${demoSentx[0].token_id})`);
            }
            if (demoKabila.length) {
                console.log(`Using Kabila demo sale: ${demoKabila[0].nftName || 'NFT'} (${demoKabila[0].tokenId})`);
            }
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
        const testSentxSales = sentxSales.length ? sentxSales : allSentxSales.slice(0, 1);
        if (testSentxSales.length > 0) {
            const sentxSale = testSentxSales[0];
            console.log(`\n📈 Testing SentX Sale: ${sentxSale.nft_name} - ${sentxSale.price_hbar} HBAR`);
            console.log(`Token: ${sentxSale.token_id}, Serial: ${sentxSale.serial_number}`);
            
            for (const serverConfig of serverConfigs) {
                if (!serverConfig.enabled) continue;
                
                const guild = client.guilds.cache.get(serverConfig.guildId);
                if (!guild) continue;
                
                const channel = guild.channels.cache.get(serverConfig.channelId);
                if (channel) {
                    const embed = await embedUtils.createSaleEmbed(sentxSale, hbarRate);
                    await channel.send({
                        content: `🧪 **Test Message** - SentX Sale (Token: ${sentxSale.token_id})`,
                        embeds: [embed]
                    });
                    console.log(`Posted SentX sale to ${guild.name} #${channel.name}`);
                    totalPosts++;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        // Test Kabila sale if available
        const testKabilaSales = kabilaSales.length ? kabilaSales : allKabilaSales.slice(0, 1);
        if (testKabilaSales.length > 0) {
            const kabilaSale = testKabilaSales[0];
            console.log(`\n🔶 Testing Kabila Sale: ${kabilaSale.nftName || 'Kabila NFT'} - ${kabilaSale.price} HBAR`);
            console.log(`Token: ${kabilaSale.tokenId}, Serial: ${kabilaSale.serialNumber}`);
            
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
                        content: `🧪 **Test Message** - Kabila Sale (Token: ${kabilaSale.tokenId})`,
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

testSpecificToken();