require('dotenv').config({ quiet: true });

const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const { initDb } = require('./db');
const transcriptionRoutes = require('./routes/transcriptionRoutes');
const { handleLiveConnection } = require('./controllers/liveTranscriptionController');

const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:4200';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/transcriptions', transcriptionRoutes);

app.use((req, res) => res.status(404).json({ message: 'Not found' }));

// Express 5 forwards errors thrown in async handlers here.
app.use((err, req, res, next) => {
  // Errors like malformed JSON come with a 4xx status; anything else is a server error.
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ message: 'Invalid request' });
  }
  console.error(err);
  res.status(500).json({ message: 'Something went wrong' });
});

// One HTTP server for both the REST API and the live-transcription WebSocket.
const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  path: '/ws/transcribe',
  maxPayload: 1024 * 1024, // audio chunks are ~3 KB; reject anything huge
  // Only our frontend may open a transcription session (it uses our Gemini quota).
  verifyClient: ({ origin }) => origin === CLIENT_ORIGIN,
});
wss.on('connection', handleLiveConnection);

initDb()
  .then(() => console.log('Database ready'))
  .catch((err) => console.error('Database not ready:', err.message));

server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
