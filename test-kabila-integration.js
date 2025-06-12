/**
 * Test Kabila integration by simulating a new sale posting
 */

const { Client, GatewayIntentBits } = require('discord.js');
const kabilaService = require('./services/kabila');
const currencyService = require('./services/currency');
const embedUtils = require('./utils/embed');
const DatabaseStorage = require('./database-storage');
const config = require('./config');

async function testKabilaIntegration() {
    try {
        console.log('Testing Kabila integration with existing server configurations...');
        
        // Initialize storage and Discord client
        const storage = new DatabaseStorage();
        await storage.init();
        
        const client = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
        });
        
        await client.login(config.DISCORD_TOKEN);
        await new Promise(resolve => client.once('ready', resolve));
        
        // Get recent Kabila sale
        const recentSales = await kabilaService.getRecentSales(1);
        if (!recentSales || recentSales.length === 0) {
            console.log('No Kabila sales found');
            process.exit(1);
        }
        
        const kabilaSale = recentSales[0];
        console.log(`Testing with Kabila sale: ${kabilaSale.price} HBAR from ${new Date(kabilaSale.timestamp).toISOString()}`);
        
        // Get HBAR rate
        const hbarRate = await currencyService.getHbarToUsdRate();
        
        // Get all server configurations
        const serverConfigs = await storage.getAllServerConfigs();
        console.log(`Found ${serverConfigs.length} server configurations`);
        
        if (serverConfigs.length === 0) {
            console.log('No server configurations found');
            process.exit(1);
        }
        
        let posted = 0;
        
        // Test posting to each configured server
        for (const serverConfig of serverConfigs) {
            try {
                if (!serverConfig.enabled) {
                    console.log(`Server ${serverConfig.guild_name} is disabled, skipping`);
                    continue;
                }
                
                const guild = client.guilds.cache.get(serverConfig.guild_id);
                if (!guild) {
                    console.log(`Guild ${serverConfig.guild_id} not found`);
                    continue;
                }
                
                const channel = guild.channels.cache.get(serverConfig.channel_id);
                if (!channel) {
                    console.log(`Channel ${serverConfig.channel_id} not found in ${guild.name}`);
                    continue;
                }
                
                // Create embed for Kabila sale
                const embed = await embedUtils.createSaleEmbed(kabilaSale, hbarRate);
                
                // Post to channel
                await channel.send({
                    content: '🧪 **Kabila Integration Test** - Testing dual marketplace monitoring',
                    embeds: [embed]
                });
                
                console.log(`✅ Posted Kabila test sale to ${guild.name} (#${channel.name})`);
                posted++;
                
            } catch (error) {
                console.error(`Failed to post to server ${serverConfig.guild_name}:`, error.message);
            }
        }
        
        console.log(`\n✅ Integration test complete. Posted to ${posted} channels.`);
        console.log('Kabila sales will now post to the same channels as SentX sales.');
        
        client.destroy();
        process.exit(0);
        
    } catch (error) {
        console.error('Integration test failed:', error.message);
        process.exit(1);
    }
}

testKabilaIntegration();