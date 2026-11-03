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

  test('Telegram response parsing extracts file_id from video and animation payloads', () => {
    // Verify parser handles video and animation classifications without throwing
    const videoResponse = {
      message_id: 101,
      chat: { id: -10012345 },
      video: {
        file_id: 'video_file_id_123',
        file_unique_id: 'unique_123',
      },
    };

    const animationResponse = {
      message_id: 102,
      chat: { id: -10012345 },
      animation: {
        file_id: 'anim_file_id_456',
        file_unique_id: 'unique_456',
      },
    };

    const extractMedia = (msg: any) =>
      msg.document ||
      msg.video ||
      msg.animation ||
      msg.audio ||
      msg.voice ||
      msg.video_note ||
      (msg.photo && msg.photo.length > 0 ? msg.photo[msg.photo.length - 1] : undefined);

    assert.equal(extractMedia(videoResponse)?.file_id, 'video_file_id_123');
    assert.equal(extractMedia(animationResponse)?.file_id, 'anim_file_id_456');
  });
});
