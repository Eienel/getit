import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "./db";
import { randomToken } from "./crypto";
import { pingAllForUser, pingBequest } from "./bequest/ping";
import { sendTelegram } from "./notify";

const LINK_TTL_MIN = 30;

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number; type: string };
    text?: string;
  };
};

// Generate a one-time /start token; user clicks t.me/<bot>?start=<token>
export async function createTelegramLinkToken(userId: string): Promise<string> {
  const token = randomToken(12);
  const expiresAt = new Date(Date.now() + LINK_TTL_MIN * 60_000);
  await db.insert(schema.telegramLinks).values({ userId, token, expiresAt });
  return token;
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const msg = update.message;
  if (!msg || !msg.text) return;
  const chatId = String(msg.chat.id);
  const text = msg.text.trim();

  if (text.startsWith("/start")) {
    const parts = text.split(/\s+/);
    const token = parts[1];
    if (!token) {
      await sendTelegram(
        chatId,
        "Welcome to Bequest. To link this chat to your account, open the bequest detail page in your browser and tap *Connect Telegram*.",
        { parse_mode: "Markdown" },
      );
      return;
    }
    const rows = await db
      .select()
      .from(schema.telegramLinks)
      .where(
        and(
          eq(schema.telegramLinks.token, token),
          gt(schema.telegramLinks.expiresAt, new Date()),
        ),
      )
      .limit(1);
    const link = rows[0];
    if (!link || link.consumedAt) {
      await sendTelegram(chatId, "That link expired. Generate a new one in the web app.");
      return;
    }
    await db
      .update(schema.telegramLinks)
      .set({ consumedAt: new Date() })
      .where(eq(schema.telegramLinks.id, link.id));
    await db
      .update(schema.users)
      .set({ telegramChatId: chatId })
      .where(eq(schema.users.id, link.userId));
    await sendTelegram(
      chatId,
      "Linked. Send `/ping` to keep all bequests alive, `/list` to view, or `/ping bq_xxxxx` to ping one.",
      { parse_mode: "Markdown" },
    );
    return;
  }

  // Any other command requires the chat to be linked.
  const userRows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.telegramChatId, chatId))
    .limit(1);
  const user = userRows[0];
  if (!user) {
    await sendTelegram(chatId, "This chat isn't linked to a Bequest account. Visit the web app and tap Connect Telegram.");
    return;
  }

  if (text.startsWith("/ping")) {
    const parts = text.split(/\s+/);
    const id = parts[1];
    if (id) {
      const result = await pingBequest({ bequestId: id, source: "telegram", userId: user.id });
      if (!result.ok) {
        await sendTelegram(chatId, `Could not ping ${id} — not found, not yours, or not armed.`);
      } else {
        await sendTelegram(chatId, `Pinged ${id}. Next deadline ${result.nextDeadline?.toUTCString() ?? "?"}.`);
      }
    } else {
      const count = await pingAllForUser(user.id, "telegram");
      await sendTelegram(chatId, `Pinged ${count} bequest${count === 1 ? "" : "s"}.`);
    }
    return;
  }

  if (text === "/list") {
    const rows = await db
      .select()
      .from(schema.bequests)
      .where(eq(schema.bequests.userId, user.id));
    if (rows.length === 0) {
      await sendTelegram(chatId, "No bequests yet. Create one in the web app.");
      return;
    }
    const lines = rows.slice(0, 10).map((b) => {
      const when = b.lastPingAt
        ? new Date(new Date(b.lastPingAt).getTime() + b.checkinWindowSeconds * 1000).toISOString()
        : "—";
      return `${b.id} · ${b.amountDecimal} ${b.assetSymbol} · ${b.status} · deadline ${when}`;
    });
    await sendTelegram(chatId, lines.join("\n"));
    return;
  }

  if (text === "/help" || text === "/start") {
    await sendTelegram(chatId, "Commands:\n/ping — reset clock on all bequests\n/ping bq_xxxx — reset one\n/list — show all\n/help — this help");
    return;
  }
}
