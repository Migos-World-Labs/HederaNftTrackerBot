/**
 * Direct test to post Kabila sale to Discord without database dependency
 */

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const kabilaService = require('./services/kabila');
const currencyService = require('./services/currency');
const config = require('./config');

async function testDirectKabilaPost() {
    try {
        console.log('Testing direct Kabila sale post...');
        
        // Initialize Discord client
        const client = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
        });
        
        await client.login(config.DISCORD_TOKEN);
        console.log('Discord client connected');
        
        // Wait for client to be ready
        await new Promise(resolve => client.once('ready', resolve));
        
        // Get the most recent sale from Kabila
        const recentSales = await kabilaService.getRecentSales(1);
        
        if (!recentSales || recentSales.length === 0) {
            console.log('No recent sales found from Kabila');
            process.exit(1);
        }
        
        const latestSale = recentSales[0];
        console.log('Latest Kabila sale price:', latestSale.price, 'HBAR');
        console.log('Sale timestamp:', new Date(latestSale.timestamp).toISOString());
        
        // Get current HBAR rate
        const hbarRate = await currencyService.getHbarToUsdRate();
        const usdValue = (latestSale.price * hbarRate).toFixed(2);
        
        // Create embed for Kabila sale
        const embed = new EmbedBuilder()
            .setTitle('🎯 NFT Sale - Kabila Marketplace')
            .setDescription('**Test: Recent Kabila Sale Notification**')
            .addFields(
                { name: '💰 Price', value: `${latestSale.price} HBAR (~$${usdValue} USD)`, inline: true },
                { name: '📅 Date', value: new Date(latestSale.timestamp).toLocaleDateString(), inline: true },
                { name: '🏪 Marketplace', value: 'Kabila', inline: true },
                { name: '🔗 Link', value: '[View on Kabila](https://kabila.app)', inline: false }
            )
            .setColor('#00ff88')
            .setFooter({ text: 'Kabila Integration Test' })
            .setTimestamp();
        
        // Find the Migos World Labs server
        const targetGuild = client.guilds.cache.find(guild => guild.name.includes('Migos'));
        
        if (!targetGuild) {
            console.log('Available guilds:');
            client.guilds.cache.forEach(guild => {
                console.log(`- ${guild.name} (${guild.id})`);
            });
            throw new Error('Target guild not found');
        }
        
        console.log(`Found target guild: ${targetGuild.name}`);
        
        // Find the sales channel specifically
        const channel = targetGuild.channels.cache.find(ch => 
            ch.type === 0 && // Text channel
            (ch.name.includes('𝐌𝐢𝐠𝐨𝐬-𝐒𝐚𝐥𝐞𝐬') || ch.id === '910963234209673232')
        );
        
        if (!channel) {
            console.log('Available channels:');
            targetGuild.channels.cache
                .filter(ch => ch.type === 0)
                .forEach(ch => console.log(`- #${ch.name} (${ch.id})`));
            throw new Error('Suitable channel not found');
        }
        
        console.log(`Posting to channel: #${channel.name}`);
        
        // Post the test message
        await channel.send({
            content: '🧪 **Kabila Integration Test** - This is a test of the new Kabila marketplace monitoring',
            embeds: [embed]
        });
        
        console.log('✅ Successfully posted Kabila sale test to Discord!');
        
        // Cleanup
        client.destroy();
        process.exit(0);
        
    } catch (error) {
        console.error('Test failed:', error.message);
        process.exit(1);
    }
}

testDirectKabilaPost();