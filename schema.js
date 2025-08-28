const { pgTable, text, boolean, timestamp, integer, jsonb } = require('drizzle-orm/pg-core');

// Collections table - now per server, supports both NFT collections and HTS tokens
const collections = pgTable('collections', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  guildId: text('guild_id').notNull(),
  tokenId: text('token_id').notNull(),
  name: text('name').notNull(),
  token_type: text('token_type').notNull().default('NFT'), // 'NFT' or 'HTS'
  enabled: boolean('enabled').notNull().default(true),
  addedDate: timestamp('added_date').defaultNow().notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull()
});

// Server configurations table
const serverConfigs = pgTable('server_configs', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  guildId: text('guild_id').notNull().unique(),
  channelId: text('channel_id').notNull(),
  listingsChannelId: text('listings_channel_id'), // Optional separate channel for listings
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

// Processed mints table for duplicate prevention (Forever Mints)
const processedMints = pgTable('processed_mints', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  mintId: text('mint_id').notNull().unique(),
  tokenId: text('token_id').notNull(),
  processedAt: timestamp('processed_at').defaultNow().notNull()
});

module.exports = {
  collections,
  serverConfigs,
  botState,
  processedSales,
  processedMints
};