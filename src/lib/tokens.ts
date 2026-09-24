import { createHash, randomBytes } from "node:crypto"

/**
 * Undangan dan atur ulang kata sandi berbagi kolom `invite_token_hash` /
 * `invite_expires_at` pada User (docs/03-erd.md §3.2, docs/04 bab 4.3).
 * Token mentah 32 byte acak, URL-safe base64; hanya hash SHA-256-nya yang
 * pernah disimpan — mengetahui hash tidak membantu menebak token.
 */
export function generateToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url")
  return { token, hash: hashToken(token) }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}
