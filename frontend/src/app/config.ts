// The backend is always served from the same domain as the frontend:
// - on Vercel, /api and /ws are routed to the backend service (see vercel.json)
// - locally, the Angular dev server proxies them to localhost:3000 (see proxy.conf.json)
export const API_URL = '/api';

export function getWebSocketUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/ws/transcribe`;
}
