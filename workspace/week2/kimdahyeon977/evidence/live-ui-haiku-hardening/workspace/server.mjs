import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname, normalize } from 'node:path';
import { EventFileReader } from './lib/file-reader.mjs';
import { EventStream } from './lib/event-stream.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dir, 'public');

const eventsFile = process.env.RALPH_EVENTS_FILE;
if (!eventsFile) {
  console.error('Error: RALPH_EVENTS_FILE environment variable is required');
  process.exit(1);
}

let fileReader;
let eventStream;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Health check
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Snapshot API
  if (pathname === '/api/snapshot') {
    try {
      const data = await fileReader.getSnapshot();
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Events SSE
  if (pathname === '/api/events') {
    const lastEventId = req.headers['last-event-id'];
    const lastId = lastEventId ? parseInt(lastEventId, 10) : undefined;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    try {
      const unsubscribe = await eventStream.subscribe(res, lastId);
      req.on('close', unsubscribe);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
    return;
  }

  // Static files
  let filePath;
  if (pathname === '/') {
    filePath = join(publicDir, 'index.html');
  } else if (pathname === '/app.js' || pathname === '/style.css') {
    filePath = join(publicDir, pathname);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  // Security: prevent path traversal
  const normalized = normalize(filePath);
  if (!normalized.startsWith(publicDir)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  try {
    await stat(filePath);
    const ext = extname(filePath);
    const contentType = ext === '.html'
      ? 'text/html; charset=utf-8'
      : ext === '.js'
        ? 'application/javascript; charset=utf-8'
        : ext === '.css'
          ? 'text/css; charset=utf-8'
          : 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

async function start() {
  fileReader = new EventFileReader(eventsFile);
  eventStream = new EventStream(fileReader);

  // Wait for initial load
  await fileReader.ready();

  const port = parseInt(process.env.PORT || '3000', 10);
  server.listen(port, '127.0.0.1', () => {
    const actualPort = server.address().port;
    console.log(`READY ${actualPort}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  server.close();
  if (eventStream) eventStream.shutdown();
  if (fileReader) fileReader.shutdown();
  process.exit(0);
});
