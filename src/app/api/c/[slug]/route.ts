import { NextResponse } from "next/server";
import { roomEvent, roomNext, roomSave, roomState } from "@/lib/candidate";

/** The candidate room's API. Identity comes from the candidate's cookie; the server keeps the clock. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let b: { action?: string; qid?: string; text?: string; keystrokes?: number; type?: string } = {};
  try {
    b = await req.json();
  } catch {}
  const text = String(b.text ?? "").slice(0, 6000);
  switch (b.action) {
    case "state":
      return NextResponse.json(await roomState(slug));
    case "save":
      return NextResponse.json(await roomSave(slug, String(b.qid || ""), text, Number(b.keystrokes) || 0));
    case "next":
      return NextResponse.json(await roomNext(slug, String(b.qid || ""), text, Number(b.keystrokes) || 0));
    case "event":
      await roomEvent(slug, String(b.type || ""));
      return NextResponse.json({ ok: true });
    default:
      return NextResponse.json({ ok: false }, { status: 400 });
  }
}
