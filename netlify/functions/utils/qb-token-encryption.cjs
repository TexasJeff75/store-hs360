const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'enc:v1:';

function getEncryptionKey() {
  const keyHex = process.env.QB_TOKEN_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'QB_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(keyHex, 'hex');
}

function encrypt(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${PREFIX}${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

function decrypt(encryptedPayload) {
  if (!isEncrypted(encryptedPayload)) {
    throw new Error('Value is not in encrypted format');
  }

  const key = getEncryptionKey();
  const payload = encryptedPayload.slice(PREFIX.length);
  const [ivHex, authTagHex, ciphertext] = payload.split(':');

  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error('Malformed encrypted payload');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

module.exports = { encrypt, decrypt, isEncrypted };
