import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";

export async function GET() {
  const event = await getActiveEvent();
  const schedule = await prisma.schedule.findMany({
    where: { eventId: event.id },
    orderBy: { id: "asc" }
  });
  return NextResponse.json(schedule);
}

export async function POST(req: NextRequest) {
  try {
    const activeEvent = await getActiveEvent();
    const { day, start, end, title, location, team } = await req.json();
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    const ev = await prisma.schedule.create({
      data: {
        eventId: activeEvent.id,
        day,
        start,
        end,
        title,
        location,
        team,
        status: "Draft",
      },
    });
    return NextResponse.json(ev);
  } catch {
    return NextResponse.json({ error: "Failed to create schedule event" }, { status: 500 });
  }
}
