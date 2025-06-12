/**
 * Test script to post the most recent Kabila sale to Discord
 */

const { Client, GatewayIntentBits } = require('discord.js');
const kabilaService = require('./services/kabila');
const currencyService = require('./services/currency');
const embedUtils = require('./utils/embed');
const DatabaseStorage = require('./database-storage');
const config = require('./config');

async function testKabilaSale() {
    try {
        console.log('Testing Kabila sale notification...');
        
        // Initialize storage
        const storage = new DatabaseStorage();
        await storage.init();
        
        // Initialize Discord client
        const client = new Client({
            intents: [GatewayIntentBits.Guilds]
        });
        
        await client.login(config.DISCORD_TOKEN);
        console.log('Discord client logged in');
        
        // Get the most recent sale from Kabila
        const recentSales = await kabilaService.getRecentSales(1);
        
        if (!recentSales || recentSales.length === 0) {
            console.log('No recent sales found from Kabila');
            process.exit(1);
        }
        
        const latestSale = recentSales[0];
        console.log('Latest Kabila sale:', JSON.stringify(latestSale, null, 2));
        
        // Enhance the sale data for better display
        const enhancedSale = {
            ...latestSale,
            tokenId: latestSale.tokenId || '0.0.unknown',
            serialNumber: latestSale.serialNumber || 1,
            seller: latestSale.seller || '0.0.seller',
            buyer: latestSale.buyer || '0.0.buyer',
            nftName: `Kabila NFT Sale`,
            collectionName: 'Kabila Marketplace',
            marketplaceUrl: 'https://kabila.app',
            explorerUrl: `https://hashscan.io/mainnet/search?q=${latestSale.price}`,
        };
        
        // Get current HBAR rate
        const hbarRate = await currencyService.getHbarToUsdRate();
        console.log('Current HBAR rate:', hbarRate);
        
        // Create a simplified embed for Kabila sales
        const { EmbedBuilder } = require('discord.js');
        const saleEmbed = new EmbedBuilder()
            .setTitle('🎯 NFT Sale - Kabila Marketplace')
            .setDescription(`**${enhancedSale.nftName}**`)
            .addFields(
                { name: '💰 Sale Price', value: `${enhancedSale.price} HBAR (~$${(enhancedSale.price * hbarRate).toFixed(2)} USD)`, inline: true },
                { name: '📅 Sale Time', value: new Date(enhancedSale.timestamp).toLocaleString(), inline: true },
                { name: '🏪 Marketplace', value: 'Kabila', inline: true }
            )
            .setColor('#00ff88')
            .setFooter({ text: 'Kabila NFT Sales Bot' })
            .setTimestamp(new Date(enhancedSale.timestamp));
            
        console.log('Created sale embed for Kabila sale');
        
        // Get server configurations
        const serverConfigs = await storage.getAllServerConfigs();
        console.log(`Found ${serverConfigs.length} configured servers`);
        
        if (serverConfigs.length === 0) {
            console.log('No Discord servers configured for notifications');
            process.exit(1);
        }
        
        // Post to all configured channels
        for (const serverConfig of serverConfigs) {
            try {
                const guild = client.guilds.cache.get(serverConfig.guild_id);
                if (!guild) {
                    console.log(`Guild ${serverConfig.guild_id} not found`);
                    continue;
                }
                
                const channel = guild.channels.cache.get(serverConfig.channel_id);
                if (!channel) {
                    console.log(`Channel ${serverConfig.channel_id} not found in guild ${guild.name}`);
                    continue;
                }
                
                console.log(`Posting Kabila sale to ${guild.name} (#${channel.name})`);
                
                await channel.send({
                    embeds: [saleEmbed],
                    content: `🎯 **Test: Latest Sale from Kabila Marketplace**`
                });
                
                console.log('✅ Successfully posted test sale notification');
                
            } catch (error) {
                console.error(`Error posting to ${serverConfig.guild_name}:`, error.message);
            }
        }
        
        console.log('Test completed');
        process.exit(0);
        
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

// Run the test
testKabilaSale();