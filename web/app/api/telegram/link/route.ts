import { requireSession } from "@/lib/auth";
import { createTelegramLinkToken } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await requireSession();
    const token = await createTelegramLinkToken(session.userId);
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "BequestBot";
    return Response.json({
      token,
      url: `https://t.me/${botUsername}?start=${encodeURIComponent(token)}`,
    });
  } catch (err) {
    return Response.json(
      { error: (err as Error).message },
      { status: (err as { status?: number }).status ?? 400 },
    );
  }
}
