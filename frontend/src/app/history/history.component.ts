import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Transcription, TranscriptionService } from '../transcription.service';

@Component({
  selector: 'app-history',
  imports: [FormsModule, DatePipe],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css',
})
export class HistoryComponent implements OnInit, OnDestroy {
  private service = inject(TranscriptionService);
  private searchTimer?: ReturnType<typeof setTimeout>;
  private copiedTimer?: ReturnType<typeof setTimeout>;
  private loadRequest?: Subscription;

  items = signal<Transcription[]>([]);
  loading = signal(false);
  error = signal('');
  search = signal('');

  // Inline editing
  editingId = signal<number | null>(null);
  editTitle = signal('');
  editText = signal('');

  // Read aloud (browser text-to-speech) and copy feedback
  speakingId = signal<number | null>(null);
  copiedId = signal<number | null>(null);

  emptyMessage = computed(() => {
    if (this.loading()) return 'Loading…';
    if (this.search().trim()) return 'No transcriptions match your search.';
    return 'No transcriptions yet. Record one to get started.';
  });

  ngOnInit() {
    this.load();
  }

  ngOnDestroy() {
    clearTimeout(this.searchTimer);
    clearTimeout(this.copiedTimer);
    this.loadRequest?.unsubscribe();
    if (this.speakingId() !== null) speechSynthesis.cancel();
  }

  load() {
    // Cancel an older request so a slow response can't overwrite newer results.
    this.loadRequest?.unsubscribe();
    this.loading.set(true);
    this.loadRequest = this.service.getAll(this.search().trim()).subscribe({
      next: (items) => {
        this.items.set(items);
        this.error.set('');
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load history. Check that the backend and database are running.');
        this.loading.set(false);
      },
    });
  }

  onSearch(value: string) {
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 300);
  }

  startEdit(item: Transcription) {
    this.editingId.set(item.id);
    this.editTitle.set(item.title);
    this.editText.set(item.text);
  }

  cancelEdit() {
    this.editingId.set(null);
  }

  saveEdit(id: number) {
    if (!this.editText().trim()) return;
    this.service.update(id, { title: this.editTitle(), text: this.editText() }).subscribe({
      next: (updated) => {
        this.items.update((items) => items.map((item) => (item.id === id ? updated : item)));
        this.editingId.set(null);
      },
      error: () => this.error.set('Could not update the transcription.'),
    });
  }

  remove(item: Transcription) {
    if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    if (this.speakingId() === item.id) this.stopSpeaking();
    this.service.delete(item.id).subscribe({
      next: () => this.items.update((items) => items.filter((i) => i.id !== item.id)),
      error: () => this.error.set('Could not delete the transcription.'),
    });
  }

  speak(item: Transcription) {
    const wasSpeakingThis = this.speakingId() === item.id;
    this.stopSpeaking();
    if (wasSpeakingThis) return;

    const utterance = new SpeechSynthesisUtterance(item.text);
    // Use a Hindi voice when the text contains Devanagari script.
    utterance.lang = /[ऀ-ॿ]/.test(item.text) ? 'hi-IN' : 'en-IN';
    utterance.onend = () => this.speakingId.set(null);
    utterance.onerror = () => this.speakingId.set(null);
    this.speakingId.set(item.id);
    speechSynthesis.speak(utterance);
  }

  copy(item: Transcription) {
    navigator.clipboard
      .writeText(item.text)
      .then(() => {
        this.copiedId.set(item.id);
        clearTimeout(this.copiedTimer);
        this.copiedTimer = setTimeout(() => this.copiedId.set(null), 1500);
      })
      .catch(() => this.error.set('Could not copy to the clipboard.'));
  }

  formatDuration(seconds: number) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  private stopSpeaking() {
    speechSynthesis.cancel();
    this.speakingId.set(null);
  }
}
