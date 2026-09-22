/**
 * generate-keys.js
 *
 * Generates an asymmetric RSA keypair (2048-bit) for RS256 JWT signing and
 * symmetric AES encryption keys.
 *
 * Security model:
 *   - The RSA PRIVATE key is written to server/.keys/jwt_private.pem (chmod 600).
 *     Only the file PATH is stored in server/.env as JWT_PRIVATE_KEY_FILE.
 *     This keeps the raw key material out of .env files.
 *   - The RSA PUBLIC key (not sensitive) is written inline to server/.env.
 *   - The .keys/ directory is gitignored; it must never be committed.
 *
 * In production use Railway secrets, Doppler, or 1Password to inject
 * JWT_PRIVATE_KEY (inline PEM) or mount the private key as a file secret.
 * The server supports both approaches — see server/src/lib/@system/Helpers/jwt.js.
 *
 * Idempotent: skips any key that already has a value.
 *
 * Usage (from project root):
 *   npm run generate-keys
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEYS_DIR = path.resolve(__dirname, '../../../server/.keys');
const PRIVATE_KEY_FILE = path.join(KEYS_DIR, 'jwt_private.pem');
const ENV_FILE_PATH = path.resolve(__dirname, '../../../server/.env');

try {
  let envFile = fs.readFileSync(ENV_FILE_PATH, 'utf8');

  // Check if keys already exist and are real (not placeholder values)
  const privateKeyFileExists = /JWT_PRIVATE_KEY_FILE=(?!.*GENERATE_WITH)[^\s]+/.test(envFile)
    && fs.existsSync(PRIVATE_KEY_FILE)
    && fs.readFileSync(PRIVATE_KEY_FILE, 'utf8').includes('BEGIN');

  const publicKeyExists = /JWT_PUBLIC_KEY=(?!.*GENERATE_WITH)(?!.*<base64>).+BEGIN PUBLIC KEY/.test(envFile);
  const encryptKeyExists = /ENCRYPT_KEY=(?!.*GENERATE_WITH)(?!.*<[^>]+>)[^=\s]+/.test(envFile);
  const encryptIvExists = /ENCRYPT_IV=(?!.*GENERATE_WITH)(?!.*<[^>]+>)[^=\s]+/.test(envFile);

  let newEnvFile = envFile;
  let keysGenerated = false;

  // ── RSA keypair ──────────────────────────────────────────────────────────
  if (!privateKeyFileExists || !publicKeyExists) {
    console.log('Generating RSA keys...');
    const { publicKey: publicKeyPem, privateKey: privateKeyPem } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Write private key to a separate file with restricted permissions
    // This keeps the raw key material out of .env
    if (!privateKeyFileExists) {
      if (!fs.existsSync(KEYS_DIR)) {
        fs.mkdirSync(KEYS_DIR, { recursive: true });
        // Restrict directory to owner-only access
        fs.chmodSync(KEYS_DIR, 0o700);
      }
      fs.writeFileSync(PRIVATE_KEY_FILE, privateKeyPem, { mode: 0o600 });
      console.log(`RSA private key written to: server/.keys/jwt_private.pem (chmod 600)`);

      // Store the relative file path in .env, not the key material
      const relPath = path.relative(path.dirname(ENV_FILE_PATH), PRIVATE_KEY_FILE);
      const privateKeyFileLineExists = /JWT_PRIVATE_KEY_FILE=/m.test(newEnvFile);
      const privateKeyInlineLineExists = /JWT_PRIVATE_KEY=/m.test(newEnvFile);

      if (privateKeyFileLineExists) {
        newEnvFile = newEnvFile.replace(/JWT_PRIVATE_KEY_FILE=.*$/m, `JWT_PRIVATE_KEY_FILE=${relPath}`);
      } else if (privateKeyInlineLineExists) {
        // Replace the inline var with the file-based var
        newEnvFile = newEnvFile.replace(/JWT_PRIVATE_KEY=.*$/m, `JWT_PRIVATE_KEY_FILE=${relPath}`);
      } else {
        newEnvFile += `\nJWT_PRIVATE_KEY_FILE=${relPath}`;
      }
    }

    // Public key is not sensitive — store inline in .env as before
    if (!publicKeyExists) {
      // Flatten to single-line with literal \n for .env compatibility
      const publicKeyPemFlat = publicKeyPem.replace(/\n/g, '\\n');
      const publicKeyLineExists = /JWT_PUBLIC_KEY=/m.test(newEnvFile);
      if (publicKeyLineExists) {
        newEnvFile = newEnvFile.replace(/JWT_PUBLIC_KEY=.*$/m, `JWT_PUBLIC_KEY=${publicKeyPemFlat}`);
      } else {
        newEnvFile += `\nJWT_PUBLIC_KEY=${publicKeyPemFlat}`;
      }
    }

    console.log('RSA keys generated successfully!');
    keysGenerated = true;
  } else {
    console.log('RSA keys already exist, skipping...');
  }

  // ── Symmetric encryption keys ────────────────────────────────────────────
  if (!encryptKeyExists || !encryptIvExists) {
    console.log('Generating encryption keys...');
    const encryptionKeyBase64 = crypto.randomBytes(32).toString('base64');
    const ivBase64 = crypto.randomBytes(16).toString('base64');

    const encryptKeyLineExists = /ENCRYPT_KEY=/m.test(newEnvFile);
    const encryptIvLineExists = /ENCRYPT_IV=/m.test(newEnvFile);

    if (!encryptKeyExists) {
      if (encryptKeyLineExists) {
        newEnvFile = newEnvFile.replace(/ENCRYPT_KEY=.*$/m, `ENCRYPT_KEY=${encryptionKeyBase64}`);
      } else {
        newEnvFile += `\nENCRYPT_KEY=${encryptionKeyBase64}`;
      }
    }

    if (!encryptIvExists) {
      if (encryptIvLineExists) {
        newEnvFile = newEnvFile.replace(/ENCRYPT_IV=.*$/m, `ENCRYPT_IV=${ivBase64}`);
      } else {
        newEnvFile += `\nENCRYPT_IV=${ivBase64}`;
      }
    }

    console.log('Encryption keys generated successfully!');
    keysGenerated = true;
  } else {
    console.log('Encryption keys already exist, skipping...');
  }

  if (keysGenerated) {
    fs.writeFileSync(ENV_FILE_PATH, newEnvFile);
    console.log('\nKeys written:');
    console.log('  server/.env              — JWT_PRIVATE_KEY_FILE path + public key + encryption keys');
    console.log('  server/.keys/jwt_private.pem — RSA private key (chmod 600, gitignored)');
    console.log('\nNOTE: server/.keys/ is gitignored. Back up jwt_private.pem securely.');
    console.log('      In production, use Railway secrets / Doppler / 1Password instead.');
  } else {
    console.log('\nAll keys already exist. No changes made.');
  }
} catch (error) {
  console.error('Error generating keys:', error.message);
  console.error(error.stack);
  process.exit(1);
}
