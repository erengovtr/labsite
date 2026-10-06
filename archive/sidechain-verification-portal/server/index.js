import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const port = Number(process.env.PORT) || 8080;
const dataDir = process.env.DATA_DIR || fileURLToPath(new URL('../data/', import.meta.url));
const adminToken = process.env.ADMIN_TOKEN || '';

if (adminToken && adminToken.length < 24) {
  console.error('ADMIN_TOKEN must be at least 24 characters. Generate one with: openssl rand -hex 24');
  process.exit(1);
}

const { server } = createApp({
  dataDir,
  adminToken,
  publicUrl: process.env.PUBLIC_URL,
  trustProxy: process.env.TRUST_PROXY === '1',
});

server.listen(port, () => {
  console.log(`SideChain site + COA verification on http://localhost:${port}`);
  console.log(`Data directory: ${dataDir}`);
  if (!adminToken) console.log('Admin API disabled (set ADMIN_TOKEN to enable /admin).');
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
