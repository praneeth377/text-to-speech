// Creates the database (if missing) and the transcriptions table.
// Run with: npm run db:setup
require('dotenv').config({ quiet: true });

const { Client } = require('pg');

async function main() {
  const dbName = process.env.PGDATABASE || 'speech_to_text';

  // Connect to the default "postgres" database to create ours.
  const admin = new Client({ database: 'postgres' });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    console.log(`Created database "${dbName}"`);
  } else {
    console.log(`Database "${dbName}" already exists`);
  }
  await admin.end();

  const { pool, initDb } = require('../db');
  await initDb();
  console.log('Table "transcriptions" is ready');
  await pool.end();
}

main().catch((err) => {
  console.error('Database setup failed:', err.message);
  process.exit(1);
});
