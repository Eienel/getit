import { randomBytes } from "node:crypto";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/O/1/I/l/i

export function newBequestId(): string {
  const buf = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[buf[i] % ALPHABET.length];
  }
  return `bq_${out}`;
}
