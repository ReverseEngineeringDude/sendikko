import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticService } from '../server/src/services/diagnostic.service.js';

describe('Diagnostic Service & Telegram Caption Formatter', () => {
  test('parseDevice parses Chrome on Windows correctly', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const parsed = diagnosticService.parseDevice(ua);
    assert.equal(parsed.os, 'Windows 10/11');
    assert.equal(parsed.browser, 'Chrome 120');
    assert.equal(parsed.platform, 'Desktop');
    assert.equal(parsed.isMobile, false);
  });

  test('parseDevice parses Android mobile device correctly', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';
    const parsed = diagnosticService.parseDevice(ua);
    assert.equal(parsed.os, 'Android 14');
    assert.equal(parsed.browser, 'Chrome 122');
    assert.equal(parsed.platform, 'Android');
    assert.equal(parsed.isMobile, true);
  });

  test('formatTelegramCaption generates formatted caption within Telegram limits', () => {
    const caption = diagnosticService.formatTelegramCaption(
      'photo_sample.jpg',
      0,
      1,
      '7K9N3W2X',
      {
        ip: '182.59.99.238',
        geo: {
          ip: '182.59.99.238',
          city: 'Kozhikode',
          region: 'Kerala',
          country: 'IN',
          loc: '11.2480,75.7804',
          org: 'AS9829 National Internet Backbone',
        },
        device: {
          browser: 'Chrome 120',
          os: 'Android 14',
          platform: 'Android',
          isMobile: true,
          rawUserAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile',
        },
      }
    );

    assert.ok(caption.includes('photo_sample.jpg'));
    assert.ok(caption.includes('182.59.99.238'));
    assert.ok(caption.includes('Kozhikode, Kerala, IN'));
    assert.ok(caption.includes('Android 14'));
    assert.ok(caption.length <= 1000);
  });
});
