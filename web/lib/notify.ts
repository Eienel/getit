import { Resend } from "resend";

const FROM = process.env.RESEND_FROM || "Bequest <hello@bequest.local>";
const APP_NAME = "Bequest";

let _resend: Resend | null = null;
function resend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY required");
  _resend = new Resend(key);
  return _resend;
}

const STUB_EMAIL = process.env.STUB_EMAIL === "1" || !process.env.RESEND_API_KEY;

export async function sendMagicLinkEmail({ to, link }: { to: string; link: string }) {
  const subject = `Your Bequest sign-in link`;
  const html = `<div style="font-family:Georgia,serif;max-width:520px;margin:auto;padding:32px;background:#f4ede4;color:#1a1a1a">
    <h1 style="font-family:'Playfair Display',Georgia,serif;letter-spacing:0.15em;text-align:center;font-weight:900">BEQUEST</h1>
    <hr style="border:none;border-top:3px double #1a1a1a;margin:8px 0 24px"/>
    <p>Tap the button below to sign in. This link is valid for 15 minutes and works once.</p>
    <p style="text-align:center;margin:32px 0"><a href="${link}" style="display:inline-block;padding:12px 28px;border:1px solid #1a1a1a;background:#1a1a1a;color:#f4ede4;text-decoration:none;letter-spacing:0.08em;text-transform:uppercase">Sign In</a></p>
    <p style="font-size:12px;color:#7a7a7a">If you didn't request this, ignore the message.</p>
  </div>`;
  const text = `Sign in to ${APP_NAME}: ${link}\n\nThis link is valid for 15 minutes.`;
  if (STUB_EMAIL) {
    console.warn(`[STUB EMAIL → ${to}] ${subject}\n${link}`);
    return;
  }
  await resend().emails.send({ from: FROM, to, subject, html, text });
}

export async function sendNudgeEmail({
  to,
  link,
  bequestId,
  beneficiary,
  asset,
  amount,
  remainingMin,
  kind,
}: {
  to: string;
  link: string;
  bequestId: string;
  beneficiary: string;
  asset: string;
  amount: string;
  remainingMin: number;
  kind: "50pct" | "75pct" | "90pct";
}) {
  const headlines = {
    "50pct": "Halfway. Let us know you're still here.",
    "75pct": "Three-quarter mark. Tap to reset the clock.",
    "90pct": "Final notice. Your bequest will deliver shortly.",
  };
  const subject = `[Bequest ${bequestId}] ${headlines[kind]}`;
  const html = `<div style="font-family:Georgia,serif;max-width:520px;margin:auto;padding:32px;background:#f4ede4;color:#1a1a1a">
    <h1 style="font-family:'Playfair Display',Georgia,serif;letter-spacing:0.15em;text-align:center;font-weight:900">BEQUEST</h1>
    <hr style="border:none;border-top:3px double #1a1a1a;margin:8px 0 24px"/>
    <h2 style="font-family:'Playfair Display',Georgia,serif">${headlines[kind]}</h2>
    <p>Your bequest <code>${bequestId}</code> (${amount} ${asset} to <code>${shortAddr(beneficiary)}</code>) will deliver in approximately <strong>${formatRemaining(remainingMin)}</strong> unless you check in.</p>
    <p style="text-align:center;margin:32px 0">
      <a href="${link}" style="display:inline-block;padding:12px 28px;border:1px solid #1a1a1a;background:#1a1a1a;color:#f4ede4;text-decoration:none;letter-spacing:0.08em;text-transform:uppercase">I am alive · reset the clock</a>
    </p>
    <p style="font-size:13px;color:#4a4a4a">You can also send <code>/ping</code> to the Bequest Telegram bot, or open the bequest in your browser.</p>
  </div>`;
  const text = `Your bequest ${bequestId} delivers in ~${formatRemaining(remainingMin)}.\n\nReset the clock: ${link}`;
  if (STUB_EMAIL) {
    console.warn(`[STUB EMAIL → ${to}] ${subject}\n${link}`);
    return;
  }
  await resend().emails.send({ from: FROM, to, subject, html, text });
}

export async function sendTriggeredEmail({
  to,
  bequestId,
  txnHash,
  chainExplorerUrl,
  beneficiary,
  asset,
  amount,
}: {
  to: string;
  bequestId: string;
  txnHash: string;
  chainExplorerUrl: string;
  beneficiary: string;
  asset: string;
  amount: string;
}) {
  const subject = `[Bequest ${bequestId}] Delivered.`;
  const html = `<div style="font-family:Georgia,serif;max-width:520px;margin:auto;padding:32px;background:#f4ede4;color:#1a1a1a">
    <h1 style="font-family:'Playfair Display',Georgia,serif;letter-spacing:0.15em;text-align:center;font-weight:900">BEQUEST</h1>
    <hr style="border:none;border-top:3px double #1a1a1a;margin:8px 0 24px"/>
    <h2 style="font-family:'Playfair Display',Georgia,serif">Delivered.</h2>
    <p>${amount} ${asset} has been transferred to <code>${shortAddr(beneficiary)}</code>.</p>
    <p style="text-align:center;margin:32px 0">
      <a href="${chainExplorerUrl}" style="display:inline-block;padding:12px 28px;border:1px solid #1a1a1a;background:#1a1a1a;color:#f4ede4;text-decoration:none;letter-spacing:0.08em;text-transform:uppercase">View on chain</a>
    </p>
    <p style="font-size:12px;color:#7a7a7a">Tx: <code>${txnHash}</code></p>
  </div>`;
  const text = `Bequest ${bequestId} delivered. Tx: ${txnHash}\n${chainExplorerUrl}`;
  if (STUB_EMAIL) {
    console.warn(`[STUB EMAIL → ${to}] ${subject}\n${chainExplorerUrl}`);
    return;
  }
  await resend().emails.send({ from: FROM, to, subject, html, text });
}

// Telegram

export async function sendTelegram(chatId: string, text: string, opts: { parse_mode?: "Markdown" | "HTML" } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn(`[STUB TELEGRAM → ${chatId}] ${text}`);
    return;
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: opts.parse_mode }),
  });
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatRemaining(min: number) {
  if (min < 60) return `${Math.max(1, Math.round(min))} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h < 24) return `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return `${d}d ${remH}h`;
}
