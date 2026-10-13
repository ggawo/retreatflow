import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      include: { building: true, families: true },
    });
    return NextResponse.json(rooms);
  } catch {
    return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { buildingId, number, capacity, accessible } = await req.json();

    if (!buildingId || !number || !capacity) {
      return NextResponse.json({ error: "Building, room number, and capacity are required." }, { status: 400 });
    }

    const room = await prisma.room.create({
      data: {
        buildingId,
        number: String(number).trim(),
        capacity: Number(capacity),
        accessible: Boolean(accessible),
      },
      include: { building: true, families: true },
    });

    return NextResponse.json(room, { status: 201 });
  } catch (err) {
    console.error("Room creation error:", err);
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}
