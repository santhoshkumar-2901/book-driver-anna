import http from 'http';
import { app } from '../server/index.js';

export function startTestServer() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const baseUrl = `http://127.0.0.1:${port}`;
      resolve({ server, baseUrl, port });
    });
  });
}
