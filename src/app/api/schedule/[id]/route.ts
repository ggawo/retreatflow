import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { day, title, location, team, start, end, status } = await req.json();
    const updated = await prisma.schedule.update({
      where: { id },
      data: { day, title, location, team, start, end, status },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update schedule event" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await prisma.schedule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete schedule event" }, { status: 500 });
  }
}
