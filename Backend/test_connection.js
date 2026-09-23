/**
 * Test PostgreSQL 18 Connection to bjcl_db
 * Usage: node test_connection.js
 */
const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'bjcl_db'}`
});

async function testConnection() {
  console.log('Testing connection to PostgreSQL 18 bjcl_db...');
  try {
    await client.connect();
    const res = await client.query('SELECT current_database(), current_user, version(), NOW()');
    console.log('✅ Connection Successful!');
    console.log('Database Name:', res.rows[0].current_database);
    console.log('Current User :', res.rows[0].current_user);
    console.log('PG Version   :', res.rows[0].version.split(',')[0]);
    console.log('Server Time  :', res.rows[0].now);
  } catch (err) {
    console.error('❌ Connection Failed:', err.message);
  } finally {
    await client.end();
  }
}

testConnection();
