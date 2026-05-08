import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { signToken, verifyToken, hashToken, randomToken } from "./crypto";
import { sendMagicLinkEmail } from "./notify";

const SESSION_COOKIE = "bq_session";
const SESSION_TTL_DAYS = 30;
const MAGIC_LINK_TTL_MIN = 15;

export type Session = { userId: string; email: string; iat: number };

export async function getSession(): Promise<Session | null> {
  const cookie = cookies().get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  const v = verifyToken<Session>(cookie);
  return v;
}

export async function setSession(s: { userId: string; email: string }) {
  const token = signToken({ ...s, iat: Math.floor(Date.now() / 1000) }, SESSION_TTL_DAYS * 86400);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 86400,
  });
}

export async function clearSession() {
  cookies().delete(SESSION_COOKIE);
}

export async function startMagicLinkLogin(email: string, appUrl: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!/.+@.+\..+/.test(normalized)) throw new Error("Invalid email");

  const token = randomToken(24);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MIN * 60_000);

  await db.insert(schema.magicLinks).values({
    email: normalized,
    tokenHash,
    expiresAt,
  });

  const link = `${appUrl.replace(/\/$/, "")}/login?token=${encodeURIComponent(token)}`;
  await sendMagicLinkEmail({ to: normalized, link });
}

export async function consumeMagicLink(token: string): Promise<{ userId: string; email: string } | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);

  const rows = await db
    .select()
    .from(schema.magicLinks)
    .where(eq(schema.magicLinks.tokenHash, tokenHash))
    .limit(1);
  const link = rows[0];
  if (!link) return null;
  if (link.consumedAt) return null;
  if (new Date(link.expiresAt) < new Date()) return null;

  await db
    .update(schema.magicLinks)
    .set({ consumedAt: new Date() })
    .where(eq(schema.magicLinks.id, link.id));

  // Upsert user
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, link.email))
    .limit(1);
  let userId: string;
  if (existing.length > 0) {
    userId = existing[0].id;
  } else {
    const [created] = await db
      .insert(schema.users)
      .values({ email: link.email })
      .returning({ id: schema.users.id });
    userId = created.id;
  }

  return { userId, email: link.email };
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) {
    const e = new Error("Not authenticated") as Error & { status: number };
    e.status = 401;
    throw e;
  }
  return s;
}
