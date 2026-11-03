import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/src/app.ts';

describe('Sendikko Express API Server Health & Routes', () => {
  const app = createApp();

  test('GET /health returns 200 OK with service metadata', async () => {
    // Perform simulated request using node http or supertest-like fetch
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.service, 'Sendikko API');
      assert.equal(data.status, 'ok');
    } finally {
      server.close();
    }
  });

  test('GET /api/v1/files/INVALID_CODE returns 404', async () => {
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/files/INVALID_CODE`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.error.code, 'FILE_NOT_FOUND');
    } finally {
      server.close();
    }
  });

  test('GET /api/v1/files/INVALID_CODE/preview returns 404', async () => {
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/files/INVALID_CODE/preview`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.error.code, 'FILE_NOT_FOUND');
    } finally {
      server.close();
    }
  });

  test('GET / serves frontend index.html when client dist exists', async () => {
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      assert.equal(res.status, 200);
      const text = await res.text();
      assert.ok(text.includes('<!doctype html>') || text.includes('<html'));
    } finally {
      server.close();
    }
  });
});
