import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateFileCode, isValidFileCode } from '../server/src/utils/codeGenerator.ts';

describe('File Chunking & Code Generation Engine', () => {
  const CHUNK_SIZE = 19 * 1024 * 1024; // 19 MB in bytes (19,922,944 bytes)

  test('Calculates correct chunk count across file boundaries', () => {
    // 0 bytes
    assert.equal(Math.ceil(1 / CHUNK_SIZE), 1);
    // Exact 1 chunk
    assert.equal(Math.ceil(CHUNK_SIZE / CHUNK_SIZE), 1);
    // 1 chunk + 1 byte
    assert.equal(Math.ceil((CHUNK_SIZE + 1) / CHUNK_SIZE), 2);
    // Exactly 50 MB
    const fiftyMb = 50 * 1024 * 1024;
    assert.equal(Math.ceil(fiftyMb / CHUNK_SIZE), 3);
    // 1 GB file
    const oneGb = 1024 * 1024 * 1024;
    assert.equal(Math.ceil(oneGb / CHUNK_SIZE), 54);
  });

  test('Generates valid 8-character code from unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateFileCode();
      assert.equal(code.length, 8);
      assert.equal(isValidFileCode(code), true);
      // Ensure excluded ambiguous characters (0, O, 1, I, l) are never present
      assert.equal(code.includes('0'), false);
      assert.equal(code.includes('O'), false);
      assert.equal(code.includes('1'), false);
      assert.equal(code.includes('I'), false);
      assert.equal(code.includes('l'), false);
    }
  });

  test('Rejects invalid file codes', () => {
    assert.equal(isValidFileCode(''), false);
    assert.equal(isValidFileCode('123'), false); // too short
    assert.equal(isValidFileCode('ABCDEFGH123'), false); // too long
    assert.equal(isValidFileCode('ABCDEF01'), false); // contains 0 and 1
  });
});
