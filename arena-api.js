'use strict';

// Exemplo: const ARENA_API_BASE = 'https://seu-backend.exemplo';
const ARENA_API_BASE = '';
const arenaApi = {
  enabled: Boolean(ARENA_API_BASE) || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname),
  async request(path, { body, token } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    let response;
    try {
      response = await fetch(ARENA_API_BASE.replace(/\/$/, '') + '/api/' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store'
      });
    } catch {
      throw new Error('Não foi possível conectar ao servidor.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'O servidor não concluiu a operação.');
    return data;
  }
};
