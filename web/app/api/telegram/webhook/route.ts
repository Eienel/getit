import { NextRequest } from "next/server";
import { handleTelegramUpdate, type TelegramUpdate } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== secret) return new Response("Unauthorized", { status: 401 });
  }
  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  // Always 200 to Telegram so it doesn't retry the same update; log errors instead.
  try {
    await handleTelegramUpdate(update);
  } catch (err) {
    console.error("telegram_handler_error", err);
  }
  return Response.json({ ok: true });
}
