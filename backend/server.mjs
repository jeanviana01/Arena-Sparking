import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = new Set([
  'index.html', 'campeonato-sparking-br.html', 'admin.html', 'arena-api.js',
  'arena-fundo.png', 'arena-impacto.png', 'arena-contra-ataque.png', 'arena-chute.png',
  'arena-prepara-chute.png', 'arena-recuo.png', 'arenasparking-letreiro.png',
  'sparking-zero-logo.png', 'campeonato-resultados.json'
]);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json' };
const databasePath = process.env.ARENA_DATABASE || resolve(root, 'data/arena.sqlite');
if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000; CREATE TABLE IF NOT EXISTS arena_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL)');
const initial = { players: [], matches: [], championship: { players: [], fights: [], january2027Selection: [] }, waitlist: [] };
db.prepare('INSERT OR IGNORE INTO arena_state VALUES (1, ?)').run(JSON.stringify(initial));
const read = db.prepare('SELECT payload FROM arena_state WHERE id=1');
const write = db.prepare('UPDATE arena_state SET payload=? WHERE id=1');
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });
const equal = (a, b) => collator.compare(a, b) === 0;
const token = process.env.ARENA_ADMIN_TOKEN || '';
const allowedOrigins = new Set((process.env.ARENA_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean));

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function nick(value, limit = 64) {
  const result = typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ').normalize() : '';
  if (!result || result.length > limit) throw new HttpError(400, 'Informe um texto válido de até ' + limit + ' caracteres.');
  return result;
}

function state() {
  return JSON.parse(read.get().payload);
}

function mutate(update) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const current = state();
    const result = update(current);
    write.run(JSON.stringify(current));
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function ranking(data) {
  return { players: data.players.map((player) => player.name), matches: data.matches };
}

function normalizeFight(body, players) {
  const winner = players.find((player) => equal(player.name, nick(body.winner)));
  const loser = players.find((player) => equal(player.name, nick(body.loser)));
  if (!winner || !loser || winner === loser) throw new HttpError(400, 'Selecione dois participantes ativos e diferentes.');
  return { winner: winner.name, loser: loser.name };
}

async function bodyJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8192) throw new HttpError(413, 'Pedido grande demais.');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error();
    return value;
  } catch {
    throw new HttpError(400, 'JSON inválido.');
  }
}

function authorize(request) {
  if (!token) throw new HttpError(503, 'A gestão precisa de uma chave configurada no servidor.');
  const expected = Buffer.from('Bearer ' + token);
  const received = Buffer.from(request.headers.authorization || '');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new HttpError(401, 'Chave administrativa inválida.');
  }
}

function adminAction(data, body) {
  const cup = data.championship;
  switch (body.action) {
    case 'arena-fight': {
      data.matches.push(normalizeFight(body, data.players));
      break;
    }
    case 'tournament-player': {
      const name = nick(body.nick);
      if (cup.players.some((player) => equal(player.name, name))) throw new HttpError(409, 'Nick já está sendo utilizado.');
      cup.players.push({ name, disqualified: false, reason: '' });
      break;
    }
    case 'tournament-fight': {
      cup.fights.push(normalizeFight(body, cup.players.filter((player) => !player.disqualified)));
      break;
    }
    case 'disqualify':
    case 'restore': {
      const name = nick(body.nick);
      const player = cup.players.find((entry) => equal(entry.name, name));
      if (!player) throw new HttpError(404, 'Participante não encontrado.');
      player.disqualified = body.action === 'disqualify';
      player.reason = player.disqualified && typeof body.reason === 'string' && body.reason.trim() ? nick(body.reason, 120) : '';
      break;
    }
    case 'select-next': {
      if (cup.january2027Selection.length) throw new HttpError(409, 'A seleção para janeiro de 2027 já foi confirmada.');
      if (data.waitlist.length < 8) throw new HttpError(400, 'São necessários pelo menos oito inscritos na fila.');
      cup.january2027Selection = data.waitlist.splice(0, 8);
      break;
    }
    default:
      throw new HttpError(400, 'Ação desconhecida.');
  }
  return { ranking: ranking(data), championship: cup, waitlist: data.waitlist };
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  const sameOrigin = origin === 'http://' + request.headers.host || origin === 'https://' + request.headers.host;
  if (origin && (sameOrigin || allowedOrigins.has(origin))) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  response.setHeader('X-Content-Type-Options', 'nosniff');
  const send = (status, value) => {
    response.writeHead(status, { 'Content-Type': mime['.json'], 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(value));
  };
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    const method = request.method;
    if (path.startsWith('/api/')) {
      if (origin && !sameOrigin && !allowedOrigins.has(origin)) throw new HttpError(403, 'Origem não autorizada.');
      if (method === 'OPTIONS') {
        response.writeHead(204).end();
        return;
      }
      if (method === 'GET' && path === '/api/ranking') return send(200, ranking(state()));
      if (method === 'GET' && path === '/api/championship') {
        const data = state();
        return send(200, { ...data.championship, waitlist: data.waitlist });
      }
      if (method === 'GET' && path === '/api/admin') {
        authorize(request);
        const data = state();
        return send(200, { ranking: ranking(data), championship: data.championship, waitlist: data.waitlist });
      }
      if (method === 'POST' && path === '/api/register') {
        const body = await bodyJson(request);
        const profile = { gameNick: nick(body.gameNick), steamNick: nick(body.steamNick) };
        return send(201, mutate((data) => {
          if (data.players.some((player) => equal(player.name, profile.gameNick))) {
            throw new HttpError(409, 'Nick já está sendo utilizado.');
          }
          data.players.push({ name: profile.gameNick, steamNick: profile.steamNick });
          return ranking(data);
        }));
      }
      if (method === 'POST' && path === '/api/waitlist') {
        const body = await bodyJson(request);
        const name = nick(body.nick);
        return send(201, mutate((data) => {
          if (data.championship.january2027Selection.some((entry) => equal(entry, name))) throw new HttpError(409, 'Esse nick já foi selecionado para o campeonato.');
          if (data.waitlist.some((entry) => equal(entry, name))) throw new HttpError(409, 'Esse nick já está na lista de espera.');
          data.waitlist.push(name);
          return { waitlist: data.waitlist };
        }));
      }
      if (method === 'POST' && path === '/api/admin') {
        authorize(request);
        const body = await bodyJson(request);
        return send(200, mutate((data) => adminAction(data, body)));
      }
      throw new HttpError(404, 'Rota não encontrada.');
    }

    const name = path === '/' ? 'index.html' : path.slice(1);
    if (!files.has(name) || !['GET', 'HEAD'].includes(method)) throw new HttpError(404, 'Página não encontrada.');
    const file = readFileSync(resolve(root, name));
    const content = name === 'arena-api.js'
      ? Buffer.from(file.toString().replace("const ARENA_API_BASE = '';", 'const ARENA_API_BASE = location.origin;'))
      : file;
    response.writeHead(200, { 'Content-Type': mime[extname(name)], 'Content-Length': content.length });
    response.end(method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (!error.status) console.error(error);
    if (!response.headersSent) send(error.status || 500, { error: error.status ? error.message : 'Erro interno.' });
  }
});
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () => console.log('ArenaSparking em http://' + host + ':' + server.address().port));
