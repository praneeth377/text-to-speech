const { Pool } = require('pg');
const { attachDatabasePool } = require('@vercel/functions');

// On Vercel, the Neon integration provides DATABASE_URL (a pooled connection string with SSL).
// Locally, pg reads PGHOST, PGPORT, PGUSER, PGPASSWORD and PGDATABASE from .env instead.
const pool = new Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {});

// On Vercel, closes idle connections before the function instance is suspended. No-op locally.
attachDatabasePool(pool);

// An idle connection can drop (e.g. Postgres restarts). Log it instead of crashing the server.
pool.on('error', (err) => console.error('PostgreSQL pool error:', err.message));

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transcriptions (
      id               SERIAL PRIMARY KEY,
      title            VARCHAR(200) NOT NULL DEFAULT 'Untitled',
      text             TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

module.exports = { pool, initDb };
