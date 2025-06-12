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
        
        // Find the target guild and channel
        const targetGuild = client.guilds.cache.find(guild => guild.name.includes('Migos'));
        if (!targetGuild) {
            console.log('Target guild not found');
            process.exit(1);
        }
        
        // Post to bot-test channel
        const channel = targetGuild.channels.cache.find(ch => 
            ch.type === 0 && ch.name.includes('bot-test')
        );
        
        if (!channel) {
            console.log('bot-test channel not found');
            process.exit(1);
        }
        
        // Post the message
        await channel.send({
            content: '🧪 **Test Message** - Recent Kabila Sale Notification',
            embeds: [embed]
        });
        
        console.log(`Successfully posted recent Kabila sale (${latestSale.price} HBAR) to #${channel.name}`);
        
        client.destroy();
        process.exit(0);
        
    } catch (error) {
        console.error('Test failed:', error.message);
        process.exit(1);
    }
}

testRecentSaleMessage();