module.exports = {
  dialect: 'postgresql',
  schema: './schema.js',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
};