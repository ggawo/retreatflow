import { NextRequest, NextResponse } from "next/server";
import { renderEmailPreview } from "@/lib/email";
import { getActiveEvent } from "@/lib/events";

export async function POST(req: NextRequest) {
  try {
    const event = await getActiveEvent();
    const data = await req.json();
    const {
      subject = "Important Retreat Announcement",
      body = "Your announcement text will appear here...",
      buttonText,
      buttonUrl,
      calloutNote,
      recipientName = "Abebe Family",
      familyName = "Abebe Family",
    } = data;

    const html = renderEmailPreview({
      subject,
      body,
      recipientName,
      familyName,
      eventName: event?.name || "2026 Family Summer Retreat",
      organizationName: event?.organizationName,
      dates: event?.date || "July 24–26, 2026",
      location: event?.location || "Camp Hope",
      buttonText,
      buttonUrl,
      calloutNote,
    });

    return NextResponse.json({ html });
  } catch (err: any) {
    console.error("[POST /api/messages/preview error]:", err);
    return NextResponse.json({ error: "Failed to render preview" }, { status: 500 });
  }
}
