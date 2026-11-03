import crypto from 'crypto';

// Unambiguous alphabet: 31 characters, omitting 0, O, 1, I, l
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 8;

/**
 * Generates an 8-character cryptographically secure random code
 * using an unambiguous character set.
 */
export function generateFileCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let result = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const randomIndex = bytes[i] % ALPHABET.length;
    result += ALPHABET[randomIndex];
  }
  return result;
}

/**
 * Validates whether a provided string conforms to the 8-character unambiguous code format.
 */
export function isValidFileCode(code: string): boolean {
  if (typeof code !== 'string' || code.length !== CODE_LENGTH) {
    return false;
  }
  const regex = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);
  return regex.test(code.toUpperCase());
}
