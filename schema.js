const { pgTable, text, boolean, timestamp, integer, jsonb } = require('drizzle-orm/pg-core');

// Collections table - now per server
const collections = pgTable('collections', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  guildId: text('guild_id').notNull(),
  tokenId: text('token_id').notNull(),
  name: text('name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  addedDate: timestamp('added_date').defaultNow().notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull()
});

// Server configurations table
const serverConfigs = pgTable('server_configs', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  guildId: text('guild_id').notNull().unique(),
  channelId: text('channel_id').notNull(),
  guildName: text('guild_name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  addedDate: timestamp('added_date').defaultNow().notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull()
});

// Bot state table
const botState = pgTable('bot_state', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  key: text('key').notNull().unique(),
  value: jsonb('value'),
  lastUpdated: timestamp('last_updated').defaultNow().notNull()
});

// Processed sales table for duplicate prevention
const processedSales = pgTable('processed_sales', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  saleId: text('sale_id').notNull().unique(),
  tokenId: text('token_id').notNull(),
  processedAt: timestamp('processed_at').defaultNow().notNull()
});

module.exports = {
  collections,
  serverConfigs,
  botState,
  processedSales
};