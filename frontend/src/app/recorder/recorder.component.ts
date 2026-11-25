import { Component, OnDestroy, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getWebSocketUrl } from '../config';
import { TranscriptionService } from '../transcription.service';

type Status = 'idle' | 'connecting' | 'recording' | 'finishing';

@Component({
  selector: 'app-recorder',
  imports: [FormsModule],
  templateUrl: './recorder.component.html',
  styleUrl: './recorder.component.css',
})
export class RecorderComponent implements OnDestroy {
  private service = inject(TranscriptionService);

  /** Tells the parent a transcription was saved, so the history can refresh. */
  saved = output<void>();

  status = signal<Status>('idle');
  finalText = signal(''); // confirmed words
  interimText = signal(''); // words still being recognised
  title = signal('');
  error = signal('');
  seconds = signal(0);
  saving = signal(false);

  isBusy = computed(() => this.status() !== 'idle');
  hasText = computed(() => this.finalText().trim().length > 0);
  timer = computed(() => {
    const s = this.seconds();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  private ws?: WebSocket;
  private audioContext?: AudioContext;
  private stream?: MediaStream;
  private timerId?: ReturnType<typeof setInterval>;

  async start() {
    this.error.set('');
    this.finalText.set('');
    this.interimText.set('');
    this.seconds.set(0);
    this.status.set('connecting');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      this.error.set('Microphone access was blocked. Allow it in the browser and try again.');
      this.status.set('idle');
      return;
    }

    // The user may have pressed Stop while the browser was asking for the microphone.
    if (this.status() !== 'connecting') {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;

    this.ws = new WebSocket(getWebSocketUrl());
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => this.startAudio();
    this.ws.onmessage = (event) => this.handleMessage(event.data);
    this.ws.onerror = () => this.error.set('Could not reach the backend. Is it running?');
    this.ws.onclose = () => this.cleanup();
  }

  stop() {
    if (this.status() !== 'recording' && this.status() !== 'connecting') return;
    this.status.set('finishing');
    this.stopAudio();
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'stop' }));
    } else {
      this.cleanup();
    }
  }

  save() {
    if (!this.hasText()) return;
    this.saving.set(true);
    this.service
      .create({
        title: this.title().trim() || this.defaultTitle(),
        text: this.finalText().trim(),
        durationSeconds: this.seconds(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.discard();
          this.saved.emit();
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Could not save. Check that the backend and database are running.');
        },
      });
  }

  discard() {
    this.finalText.set('');
    this.interimText.set('');
    this.title.set('');
    this.seconds.set(0);
  }

  ngOnDestroy() {
    if (this.ws) this.ws.onclose = null;
    this.ws?.close();
    this.stopAudio();
  }

  private async startAudio() {
    try {
      const audioContext = new AudioContext();
      this.audioContext = audioContext;
      await audioContext.audioWorklet.addModule('pcm-recorder-worklet.js');

      // The user may have pressed Stop while the audio worklet was loading.
      if (this.status() !== 'connecting' || !this.stream) return;

      const source = audioContext.createMediaStreamSource(this.stream);
      const recorder = new AudioWorkletNode(audioContext, 'pcm-recorder');
      recorder.port.onmessage = (event) => {
        if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(event.data);
      };
      source.connect(recorder);

      this.status.set('recording');
      this.timerId = setInterval(() => this.seconds.update((s) => s + 1), 1000);
    } catch {
      this.error.set('Could not start audio capture in this browser.');
      this.ws?.close();
    }
  }

  private handleMessage(data: string) {
    let message: { type: string; text?: string; message?: string };
    try {
      message = JSON.parse(data);
    } catch {
      return; // ignore anything that isn't valid JSON
    }

    switch (message.type) {
      case 'interim':
        this.interimText.set(message.text ?? '');
        break;
      case 'final':
        this.finalText.update((text) => `${text} ${message.text ?? ''}`.replace(/\s+/g, ' ').trim());
        this.interimText.set('');
        break;
      case 'error':
        this.error.set(message.message ?? 'Transcription error');
        break;
      case 'done':
        this.ws?.close();
        break;
    }
  }

  private stopAudio() {
    clearInterval(this.timerId);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.audioContext?.close().catch(() => {});
    this.stream = undefined;
    this.audioContext = undefined;
  }

  private cleanup() {
    this.stopAudio();
    // Keep any words that were still "interim" when the connection ended.
    if (this.interimText()) {
      this.finalText.update((text) => `${text} ${this.interimText()}`.trim());
      this.interimText.set('');
    }
    this.ws = undefined;
    this.status.set('idle');
  }

  private defaultTitle() {
    const words = this.finalText().trim().split(/\s+/).slice(0, 6).join(' ');
    return words.length > 0 ? words : 'Untitled';
  }
}
