/**
 * Force a Kabila sale to be processed to test channel posting
 */

const NFTSalesBot = require('./bot');
const kabilaService = require('./services/kabila');
const currencyService = require('./services/currency');

async function testForceKabilaSale() {
    try {
        console.log('Testing forced Kabila sale processing...');
        
        // Get recent Kabila sale
        const recentSales = await kabilaService.getRecentSales(1);
        if (!recentSales || recentSales.length === 0) {
            console.log('No Kabila sales found');
            return;
        }
        
        const kabilaSale = recentSales[0];
        console.log(`Testing with Kabila sale: ${kabilaSale.price} HBAR`);
        
        // Make the sale appear "new" by setting timestamp to now
        const testSale = {
            ...kabilaSale,
            timestamp: Date.now(),
            id: `kabila_test_${Date.now()}`,
            marketplace: 'Kabila'
        };
        
        // Get HBAR rate
        const hbarRate = await currencyService.getHbarToUsdRate();
        
        // Create bot instance
        const bot = new NFTSalesBot();
        await bot.storage.init();
        
        // Force process the sale
        console.log('Processing test Kabila sale...');
        await bot.processSale(testSale, hbarRate);
        
        console.log('✅ Test completed - check Discord channels for Kabila sale notification');
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testForceKabilaSale();