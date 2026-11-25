const { Pool } = require('pg');

// pg reads PGHOST, PGPORT, PGUSER, PGPASSWORD and PGDATABASE from .env automatically.
const pool = new Pool();

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
