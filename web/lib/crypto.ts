import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";

const ALG = "aes-256-gcm";

function getMasterKey(): Buffer {
  const raw = process.env.MASTER_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MASTER_KEY is required in production");
    }
    // Deterministic dev fallback so local sessions survive restarts.
    return createHash("sha256").update("bequest-dev-master-key").digest();
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `MASTER_KEY must be 32 bytes base64; got ${buf.length} bytes. Generate with: openssl rand -base64 32`,
    );
  }
  return buf;
}

// Per-bequest derived key — HKDF over the master key with the bequest id as info.
// This way each bequest's ciphertext can only be decrypted with knowledge of
// both the master key AND the bequest id.
function deriveKey(info: string): Buffer {
  const master = getMasterKey();
  const okm = hkdfSync("sha256", master, Buffer.alloc(0), `bequest:${info}`, 32);
  return Buffer.from(okm);
}

export function encrypt(plaintext: string, info: string): { ciphertext: string; nonce: string } {
  const key = deriveKey(info);
  const nonce = randomBytes(12);
  const cipher = createCipheriv(ALG, key, nonce);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store ciphertext||tag concatenated, base64-encoded. Nonce stored separately.
  return {
    ciphertext: Buffer.concat([enc, tag]).toString("base64"),
    nonce: nonce.toString("base64"),
  };
}

export function decrypt(ciphertextB64: string, nonceB64: string, info: string): string {
  const key = deriveKey(info);
  const nonce = Buffer.from(nonceB64, "base64");
  const buf = Buffer.from(ciphertextB64, "base64");
  // Last 16 bytes are the GCM auth tag.
  const enc = buf.subarray(0, buf.length - 16);
  const tag = buf.subarray(buf.length - 16);
  const decipher = createDecipheriv(ALG, key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// Sign + verify HMAC tokens for email "I'm alive" one-tap links and Telegram /start tokens.
// Format: <payload-base64url>.<sig-base64url>
function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function authKey(): Buffer {
  return deriveKey("auth-tokens");
}

export function signToken(payload: object, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = b64url(Buffer.from(JSON.stringify({ ...payload, exp })));
  const sig = b64url(createHmac("sha256", authKey()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyToken<T = Record<string, unknown>>(token: string): T | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = b64url(createHmac("sha256", authKey()).update(body).digest());
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(fromB64url(body).toString("utf8"));
    if (typeof parsed.exp === "number" && parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed as T;
  } catch {
    return null;
  }
}

// One-way hash for storing magic-link tokens at rest (we never need to recover them).
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Generate a high-entropy random token (URL-safe).
export function randomToken(bytes: number = 24): string {
  return b64url(randomBytes(bytes));
}
