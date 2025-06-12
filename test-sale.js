#!/usr/bin/env node

const bot = require('./bot.js');

async function runTest() {
    try {
        console.log('Starting bot for testing...');
        await bot.start();
        
        // Wait a moment for bot to fully initialize
        await bot.delay(3000);
        
        console.log('Running test sale...');
        await bot.testLastSale();
        
        console.log('Test completed, keeping bot running...');
        
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

runTest();