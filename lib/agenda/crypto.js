// AES-256-GCM helpers for secrets at rest (Google refresh tokens).
// Pure Node module (no `server-only` guard) so it can be unit tested; it is only imported by server code.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const VERSION = 'v1'

function keyFrom(keyB64) {
  if (!keyB64) throw new Error('encryption_key_missing')
  const key = Buffer.from(String(keyB64), 'base64')
  if (key.length !== 32) throw new Error('encryption_key_invalid')
  return key
}

/** Encrypts a UTF-8 string. Output: "v1.<iv>.<tag>.<ciphertext>" (base64url parts). */
export function encrypt(plaintext, keyB64) {
  const key = keyFrom(keyB64)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.')
}

/** Decrypts a value produced by encrypt(). Throws on tampering or a wrong key. */
export function decrypt(payload, keyB64) {
  const key = keyFrom(keyB64)
  const parts = String(payload || '').split('.')
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error('ciphertext_invalid')
  const [, ivB, tagB, ctB] = parts
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64url')), decipher.final()]).toString('utf8')
}
