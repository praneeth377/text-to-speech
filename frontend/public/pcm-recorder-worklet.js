// Runs on the browser's audio thread.
// Converts microphone audio to 16 kHz, 16-bit mono PCM (what Gemini expects)
// and posts ~100 ms chunks back to the page.
class PcmRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 16000;
    this.ratio = sampleRate / this.targetRate; // e.g. 48000 / 16000 = 3
    this.chunkSize = 1600; // 100 ms at 16 kHz
    this.buffer = new Int16Array(this.chunkSize);
    this.length = 0;
    this.position = 0; // fractional read position into the input
  }

  process(inputs) {
    const input = inputs[0][0];
    if (!input) return true;

    // Downsample by picking every `ratio`-th sample.
    while (this.position < input.length) {
      const sample = Math.max(-1, Math.min(1, input[Math.floor(this.position)]));
      this.buffer[this.length++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      this.position += this.ratio;

      if (this.length === this.chunkSize) {
        this.port.postMessage(this.buffer.buffer, [this.buffer.buffer]);
        this.buffer = new Int16Array(this.chunkSize);
        this.length = 0;
      }
    }
    this.position -= input.length;
    return true;
  }
}

registerProcessor('pcm-recorder', PcmRecorderProcessor);
