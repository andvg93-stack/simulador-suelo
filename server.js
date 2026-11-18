import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const port = process.env.PORT || 5173;
const root = process.cwd();

const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
};

const server = http.createServer(async (req, res) => {
  try {
    const reqPath = req.url === '/' ? '/index.html' : req.url;
    const safePath = path.normalize(reqPath).replace(/^\.\.(\/|\\|$)+/, '');
    const filePath = path.join(root, safePath);
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`Simulator running at http://localhost:${port}`);
});
