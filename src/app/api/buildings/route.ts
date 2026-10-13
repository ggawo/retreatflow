import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";

export async function GET() {
  try {
    const event = await getActiveEvent();
    const buildings = await prisma.building.findMany({
      where: { eventId: event.id },
      include: { rooms: { include: { families: true } } },
    });
    return NextResponse.json(buildings);
  } catch {
    return NextResponse.json({ error: "Failed to fetch buildings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const event = await getActiveEvent();
    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Building name is required." }, { status: 400 });
    }

    const building = await prisma.building.create({
      data: {
        eventId: event.id,
        name: name.trim(),
      },
      include: { rooms: { include: { families: true } } },
    });

    return NextResponse.json(building, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create building" }, { status: 500 });
  }
}
