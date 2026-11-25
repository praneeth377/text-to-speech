# Speech to Text — real-time multilingual transcription

Speak into the browser in Hindi, English, or a mix of both (Hinglish). The words appear live
while you talk, and finished transcriptions are saved to PostgreSQL. A history dashboard lets
you search, view, edit, delete, copy, and listen to them.

## How it works

```
Angular (browser)                    Node.js backend                    Google
─────────────────                    ───────────────                    ──────
Mic → AudioWorklet      WebSocket                         WebSocket
(16 kHz PCM, 100 ms) ─────────────►  /ws/transcribe  ─────────────────►  Gemini Live
                                     relay                               (gemini-3.5-transcribe-live)
Live text  ◄──────────  interim / final text  ◄──────────────────────────┘

History (CRUD)  ◄──── REST /api/transcriptions ────►  PostgreSQL 16
```

- The browser never talks to Gemini directly, so the API key stays on the server.
- `interim` messages show words while they are being recognised (grey text); `final`
  messages confirm a phrase once the speaker pauses.
- Language hints `hi-IN,en-IN` help with code-switched Hindi/English speech
  (change `LANGUAGE_CODES` in `.env`, or leave it empty for automatic detection).
- "Listen" uses the browser's built-in Web Speech API for text-to-speech (no extra service).

## Tech stack

| Part      | Tech                                                         |
| --------- | ------------------------------------------------------------ |
| Frontend  | Angular 22 (standalone components, signals, zoneless), Tailwind CSS 4, Karma + Jasmine |
| Backend   | Node.js 26, Express 5, `ws`, `pg`, `@google/genai`           |
| Database  | PostgreSQL 16                                                |
| Speech    | Gemini Live API — `gemini-3.5-transcribe-live`               |

## Project structure

```
speech-to-text/
├── backend/
│   ├── server.js                              Express app + WebSocket server
│   ├── db.js                                  PostgreSQL pool + table creation
│   ├── routes/transcriptionRoutes.js          REST routes
│   ├── controllers/transcriptionController.js CRUD handlers
│   ├── controllers/liveTranscriptionController.js  Browser ⇄ Gemini relay
│   ├── scripts/setupDb.js                     Creates the database and table
│   └── .env                                   Your settings (not committed)
└── frontend/
    ├── public/pcm-recorder-worklet.js         Mic audio → 16 kHz PCM chunks
    └── src/app/
        ├── app.component.{ts,html,css,spec.ts}    Page layout
        ├── recorder/recorder.component.*          Live recording component
        ├── history/history.component.*            History dashboard (CRUD)
        ├── transcription.service.ts               REST API calls
        └── config.ts                              Backend URLs
```

## Setup

Requirements: Node.js 22.22+ (26 LTS recommended), PostgreSQL 16, and a Gemini API key from
[Google AI Studio](https://aistudio.google.com/apikey).

1. **Backend settings** — copy `backend/.env.example` to `backend/.env` and fill in
   `PGPASSWORD` and `GEMINI_API_KEY`.

2. **Install and create the database**

   ```powershell
   cd backend
   npm install
   npm run db:setup
   ```

3. **Start the backend** (http://localhost:3000)

   ```powershell
   npm run dev
   ```

4. **Start the frontend** in a second terminal (http://localhost:4200)

   ```powershell
   cd frontend
   npm install
   npm start
   ```

5. Open http://localhost:4200, allow microphone access, press the mic button and speak.

## Unit tests (frontend)

Karma + Jasmine, run in Chrome:

```powershell
cd frontend
npm test                                          # watch mode, opens Chrome
npx ng test --watch=false --browsers=ChromeHeadless  # single run
```

## REST API

| Method | Endpoint                          | Body                                  |
| ------ | --------------------------------- | ------------------------------------- |
| GET    | `/api/transcriptions?search=text` | —                                     |
| GET    | `/api/transcriptions/:id`         | —                                     |
| POST   | `/api/transcriptions`             | `{ "text", "title"?, "durationSeconds"? }` |
| PUT    | `/api/transcriptions/:id`         | `{ "text", "title" }`                 |
| DELETE | `/api/transcriptions/:id`         | —                                     |

## WebSocket protocol (`/ws/transcribe`)

- Browser → server: binary frames of 16 kHz, 16-bit mono PCM; `{"type":"stop"}` to finish.
- Server → browser: `ready`, `interim` (`text`), `final` (`text`), `done`, `error` (`message`).

## Limits

- One Gemini live-transcription session can stream for up to 10 minutes.
- Microphone access needs `localhost` or HTTPS.
