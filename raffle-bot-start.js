/**
 * Startup script for Wild Tiger Raffle Bot
 * Monitors raffle NFT ticket mints (token 0.0.10053295) and posts to Migos World Discord
 */

require('dotenv').config();

// Import and start the raffle bot
require('./wild-tiger-raffle-bot');

console.log('🎟️ Wild Tiger Raffle Bot starting...');
console.log('📡 Monitoring token: 0.0.10053295');
console.log('📢 Posting to Migos World Discord channel: 1432509660937719839');
