const { pool } = require('../db');

const MAX_TITLE_LENGTH = 200; // matches VARCHAR(200) in db.js
const MAX_TEXT_LENGTH = 50000;

// Returns the id as a number, or sends a 400 and returns null.
function parseId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: 'Invalid id' });
    return null;
  }
  return id;
}

// Reads and validates { title, text } from the request body.
// Returns { title, text } or sends a 400 and returns null.
function parseBody(req, res) {
  const body = req.body ?? {};
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const title = (typeof body.title === 'string' ? body.title.trim() : '') || 'Untitled';

  if (!text) {
    res.status(400).json({ message: 'Text is required' });
    return null;
  }
  if (text.length > MAX_TEXT_LENGTH) {
    res.status(400).json({ message: `Text must be at most ${MAX_TEXT_LENGTH} characters` });
    return null;
  }
  if (title.length > MAX_TITLE_LENGTH) {
    res.status(400).json({ message: `Title must be at most ${MAX_TITLE_LENGTH} characters` });
    return null;
  }
  return { title, text };
}

// GET /api/transcriptions?search=hello
async function getAll(req, res) {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  if (!search) {
    const result = await pool.query('SELECT * FROM transcriptions ORDER BY created_at DESC');
    return res.json(result.rows);
  }

  // Escape % and _ so they are searched for literally.
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  const result = await pool.query(
    `SELECT * FROM transcriptions
     WHERE title ILIKE $1 OR text ILIKE $1
     ORDER BY created_at DESC`,
    [pattern]
  );
  res.json(result.rows);
}

// GET /api/transcriptions/:id
async function getById(req, res) {
  const id = parseId(req, res);
  if (!id) return;

  const result = await pool.query('SELECT * FROM transcriptions WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'Transcription not found' });
  }
  res.json(result.rows[0]);
}

// POST /api/transcriptions  { text, title?, durationSeconds? }
async function create(req, res) {
  const fields = parseBody(req, res);
  if (!fields) return;

  // Whole seconds, never negative (the column is an INTEGER).
  const durationSeconds = Math.max(0, Math.round(Number(req.body.durationSeconds) || 0));

  const result = await pool.query(
    `INSERT INTO transcriptions (title, text, duration_seconds)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [fields.title, fields.text, durationSeconds]
  );
  res.status(201).json(result.rows[0]);
}

// PUT /api/transcriptions/:id  { title, text }
async function update(req, res) {
  const id = parseId(req, res);
  if (!id) return;
  const fields = parseBody(req, res);
  if (!fields) return;

  const result = await pool.query(
    `UPDATE transcriptions
     SET title = $1, text = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [fields.title, fields.text, id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'Transcription not found' });
  }
  res.json(result.rows[0]);
}

// DELETE /api/transcriptions/:id
async function remove(req, res) {
  const id = parseId(req, res);
  if (!id) return;

  const result = await pool.query('DELETE FROM transcriptions WHERE id = $1', [id]);
  if (result.rowCount === 0) {
    return res.status(404).json({ message: 'Transcription not found' });
  }
  res.status(204).end();
}

module.exports = { getAll, getById, create, update, remove };
