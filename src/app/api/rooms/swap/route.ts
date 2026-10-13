import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { room1Id, room2Id, family1Id, family2Id } = await req.json();

    const r1 = await prisma.room.findUnique({ where: { id: room1Id }, include: { families: true } });
    const r2 = await prisma.room.findUnique({ where: { id: room2Id }, include: { families: true } });

    if (!r1 || !r2) return NextResponse.json({ error: "Rooms not found" }, { status: 404 });

    // Swap specific family1Id to room2Id and family2Id to room1Id
    if (family1Id) {
      await prisma.family.update({ where: { id: family1Id }, data: { roomId: room2Id } });
    }
    if (family2Id) {
      await prisma.family.update({ where: { id: family2Id }, data: { roomId: room1Id } });
    }

    // If no specific family IDs provided, swap all families in room 1 with room 2
    if (!family1Id && !family2Id) {
      for (const f of r1.families) {
        await prisma.family.update({ where: { id: f.id }, data: { roomId: null } });
      }
      for (const f of r2.families) {
        await prisma.family.update({ where: { id: f.id }, data: { roomId: room1Id } });
      }
      for (const f of r1.families) {
        await prisma.family.update({ where: { id: f.id }, data: { roomId: room2Id } });
      }
    }

    revalidatePath("/");
    revalidatePath("/rooms");
    revalidatePath("/families");

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to swap rooms" }, { status: 500 });
  }
}
