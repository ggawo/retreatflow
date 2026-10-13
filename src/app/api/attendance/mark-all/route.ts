import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { session } = await req.json();
    const validSessions = ["checkin", "worship", "dinner"];
    if (!validSessions.includes(session)) return NextResponse.json({ error: "Invalid session" }, { status: 400 });

    if (session === "checkin") {
      // Only mark present families that are Confirmed, have a room assigned, and zero balance with all payments paid
      const eligibleFamilies = await prisma.family.findMany({
        where: {
          status: "Confirmed",
          roomId: { not: null },
          registration: { balance: { lte: 0 } },
        },
        include: {
          payments: true,
        },
      });

      // Further filter out any families with unpaid payment rows
      const validFamilyIds = eligibleFamilies
        .filter(f => !f.payments.some(p => p.status !== "Paid"))
        .map(f => f.id);

      await prisma.attendance.updateMany({
        where: { familyId: { in: validFamilyIds } },
        data: { checkin: "Present" },
      });

      return NextResponse.json({ success: true, count: validFamilyIds.length });
    }

    await prisma.attendance.updateMany({ data: { [session]: "Present" } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to mark all present" }, { status: 500 });
  }
}
