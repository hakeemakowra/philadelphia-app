const postgres = require('postgres');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

// This connects to your Supabase PostgreSQL database
const sql = postgres(connectionString, {
  ssl: 'require', // Supabase requires SSL to be secure
});

// Test the connection
sql`select 1`.then(() => {
  console.log('✅ Connected to Supabase PostgreSQL!');
}).catch((err) => {
  console.error('❌ Connection failed:', err.message);
});

module.exports = sql;
