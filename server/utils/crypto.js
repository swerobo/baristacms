/**
 * Simple encryption utility for sensitive settings
 * Uses AES-256-CBC encryption with random IV
 */

import crypto from 'crypto';

// Encryption key - should be set in production via environment variable
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-char-key-for-dev-only!';

/**
 * Encrypt a string value
 * @param {string} text - The text to encrypt
 * @returns {string|null} - Encrypted string in format "iv:encrypted" or null if text is empty
 */
export function encrypt(text) {
  if (!text) return null;

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt an encrypted string value
 * @param {string} text - The encrypted text in format "iv:encrypted"
 * @returns {string|null} - Decrypted string or null if text is empty/invalid
 */
export function decrypt(text) {
  if (!text) return null;

  try {
    const parts = text.split(':');
    if (parts.length !== 2) return null;

    const [ivHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption failed:', error.message);
    return null;
  }
}

export default { encrypt, decrypt };
