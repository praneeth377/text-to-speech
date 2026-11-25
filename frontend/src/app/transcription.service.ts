import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './config';

export interface Transcription {
  id: number;
  title: string;
  text: string;
  duration_seconds: number;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class TranscriptionService {
  private http = inject(HttpClient);
  private url = `${API_URL}/transcriptions`;

  getAll(search = '') {
    return this.http.get<Transcription[]>(this.url, { params: search ? { search } : {} });
  }

  create(data: { title: string; text: string; durationSeconds: number }) {
    return this.http.post<Transcription>(this.url, data);
  }

  update(id: number, data: { title: string; text: string }) {
    return this.http.put<Transcription>(`${this.url}/${id}`, data);
  }

  delete(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
