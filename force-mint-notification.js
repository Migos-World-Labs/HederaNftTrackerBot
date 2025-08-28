require('dotenv').config();
const DatabaseStorage = require('./database-storage');

async function forceMintNotification() {
    console.log('🌟 Forcing Forever Mint notification for Wild Tigers #339...');
    
    const storage = new DatabaseStorage();
    
    try {
        // Initialize database storage
        await storage.initializeDatabase();
        
        // Clear any existing processed mint records for Wild Tigers #339 to allow re-notification
        const mintId = 'mint_0.0.6024491_339_fresh_test';
        
        console.log(`🗑️ Removing any existing processed mint record: ${mintId}`);
        await storage.db.execute(`DELETE FROM processed_mints WHERE mint_id LIKE '%_339_%'`);
        
        console.log('✅ Cleared existing mint records for #339');
        console.log('🚀 The bot should now detect and send a new Forever Mint notification for Wild Tigers #339');
        console.log('📺 Check your Migos World Discord mint channel in the next few seconds!');
        
        // Exit gracefully
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error forcing mint notification:', error);
        process.exit(1);
    }
}

forceMintNotification();