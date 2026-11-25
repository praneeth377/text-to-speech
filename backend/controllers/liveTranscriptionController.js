const { GoogleGenAI, Modality } = require('@google/genai');

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-transcribe-live';

// Language hints for the transcriber. Hindi + English covers Hinglish speech.
// Leave LANGUAGE_CODES empty in .env to let Gemini auto-detect instead.
const LANGUAGE_CODES = (process.env.LANGUAGE_CODES ?? 'hi-IN,en-IN')
  .split(',')
  .map((code) => code.trim())
  .filter(Boolean);

// How long to wait for the last words after the user presses Stop.
const FINISH_TIMEOUT_MS = 3000;
// Audio kept while Gemini is still connecting (100 chunks = 10 seconds).
const MAX_PENDING_CHUNKS = 100;

/**
 * One WebSocket connection = one recording.
 *
 * Browser -> server:  binary frames (16 kHz, 16-bit mono PCM)  |  {"type":"stop"}
 * Server  -> browser: {"type":"ready"} | {"type":"interim","text"} | {"type":"final","text"}
 *                     {"type":"done"}  | {"type":"error","message"}
 */
async function handleLiveConnection(clientWs) {
  const send = (payload) => {
    if (clientWs.readyState === clientWs.OPEN) clientWs.send(JSON.stringify(payload));
  };

  if (!process.env.GEMINI_API_KEY) {
    send({ type: 'error', message: 'Speech service is not configured (GEMINI_API_KEY is missing).' });
    return clientWs.close();
  }

  let session = null;
  let sessionOpen = false;
  let stopping = false;
  let finished = false;
  let finishTimer = null;
  const pendingAudio = [];

  const closeSession = () => {
    if (!sessionOpen) return;
    sessionOpen = false;
    try {
      session.close();
    } catch (err) {
      console.error('Error closing Gemini session:', err.message);
    }
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(finishTimer);
    send({ type: 'done' });
    closeSession();
    clientWs.close();
  };

  // Any error from Gemini ends the recording cleanly instead of crashing the server.
  const sendToGemini = (input) => {
    if (!sessionOpen) return;
    try {
      session.sendRealtimeInput(input);
    } catch (err) {
      console.error('Error sending to Gemini:', err.message);
      send({ type: 'error', message: 'Lost connection to the speech service.' });
      finish();
    }
  };

  const sendAudio = (buffer) =>
    sendToGemini({ audio: { data: buffer.toString('base64'), mimeType: 'audio/pcm;rate=16000' } });

  // Listen to the browser right away so no audio is lost while Gemini connects.
  clientWs.on('message', (data, isBinary) => {
    if (isBinary) {
      if (stopping) return;
      if (sessionOpen) return sendAudio(data);
      if (pendingAudio.length < MAX_PENDING_CHUNKS) pendingAudio.push(data);
      return;
    }

    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return; // ignore anything that isn't valid JSON
    }
    if (message.type === 'stop' && !stopping) {
      stopping = true;
      sendToGemini({ audioStreamEnd: true });
      finishTimer = setTimeout(finish, FINISH_TIMEOUT_MS);
    }
  });

  clientWs.on('close', () => {
    finished = true;
    clearTimeout(finishTimer);
    closeSession();
  });

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { apiVersion: 'v1beta' },
    });

    session = await ai.live.connect({
      model: MODEL,
      config: {
        responseModalities: [Modality.TEXT],
        inputAudioTranscription: { languageCodes: LANGUAGE_CODES },
      },
      callbacks: {
        onmessage: (message) => {
          const content = message.serverContent;
          if (!content) return;

          if (content.interimInputTranscription?.text) {
            send({ type: 'interim', text: content.interimInputTranscription.text });
          }
          if (content.inputTranscription?.text) {
            send({ type: 'final', text: content.inputTranscription.text });
          }
          // After Stop, finish as soon as Gemini says the turn is complete.
          if (stopping && content.turnComplete) finish();
        },
        onerror: (err) => {
          console.error('Gemini error:', err.message);
          send({ type: 'error', message: 'The speech service reported an error.' });
        },
        onclose: (event) => {
          sessionOpen = false;
          if (finished) return;
          // Gemini ended the session on its own (e.g. the 10-minute limit or a network issue).
          if (!stopping) {
            console.error('Gemini closed the session:', event?.reason);
            send({ type: 'error', message: 'The speech service ended the session. Your text so far is kept.' });
          }
          finish();
        },
      },
    });
    sessionOpen = true;

    // The browser may have closed while we were connecting.
    if (clientWs.readyState !== clientWs.OPEN) return closeSession();

    pendingAudio.splice(0).forEach(sendAudio);
    if (stopping) sendToGemini({ audioStreamEnd: true });
    send({ type: 'ready' });
  } catch (err) {
    console.error('Gemini connection failed:', err);
    send({ type: 'error', message: 'Could not connect to the speech service. Please try again.' });
    clientWs.close();
  }
}

module.exports = { handleLiveConnection };
