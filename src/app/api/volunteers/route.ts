import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";

export async function GET() {
  const event = await getActiveEvent();
  const volunteers = await prisma.volunteer.findMany({
    where: { eventId: event.id },
  });
  return NextResponse.json(volunteers);
}

export async function POST(req: NextRequest) {
  try {
    const event = await getActiveEvent();
    const { name, role, date, shift, skills } = await req.json();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    const vol = await prisma.volunteer.create({
      data: {
        eventId: event.id,
        name,
        role: role || "General",
        date: date || "",
        shift: shift || "",
        status: "Pending",
        skills: skills || "",
      },
    });
    return NextResponse.json(vol);
  } catch {
    return NextResponse.json({ error: "Failed to add volunteer" }, { status: 500 });
  }
}
