import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { session, status } = await req.json();

    if (!session || !status) {
      return NextResponse.json({ error: "Session and status are required" }, { status: 400 });
    }

    const currentAttendance = await prisma.attendance.findUnique({ where: { id } });
    if (!currentAttendance) {
      return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
    }

    // Enforce 3 check-in prerequisites for Arrival Check-in
    if ((session === "checkin" || session === "Arrival Check-in") && status === "Present") {
      const family = await prisma.family.findUnique({
        where: { id: currentAttendance.familyId },
        include: { room: true, registration: true, payments: true },
      });

      if (family) {
        // 1. Only check in confirmed groups
        if (family.status !== "Confirmed" || (family.registration && family.registration.status !== "Confirmed")) {
          return NextResponse.json(
            { error: `Check-in denied: ${family.name} status is "${family.status}". Only Confirmed groups can be checked in.` },
            { status: 400 }
          );
        }

        // 2. Do not check in if room is not assigned
        if (!family.roomId && !family.room) {
          return NextResponse.json(
            { error: `Check-in denied: Housing is unassigned for ${family.name}. Room must be assigned before arrival check-in.` },
            { status: 400 }
          );
        }

        // 3. Do not check in if there is pending payment
        const balance = Number(family.registration?.balance || 0);
        const hasUnpaid = family.payments && family.payments.length > 0 ? family.payments.some(p => p.status !== "Paid") : false;
        if (balance > 0 || hasUnpaid) {
          return NextResponse.json(
            { error: `Check-in denied: ${family.name} has pending payments or an outstanding balance of $${balance.toFixed(2)}. All payments must be settled before check-in.` },
            { status: 400 }
          );
        }
      }
    }

    // Build sessions map
    let sessionsMap: Record<string, string> = {};
    if (currentAttendance.sessionsJson) {
      try {
        sessionsMap = JSON.parse(currentAttendance.sessionsJson);
      } catch {}
    } else {
      // Map legacy defaults
      sessionsMap = {
        "Arrival Check-in": currentAttendance.checkin || "Pending",
        "checkin": currentAttendance.checkin || "Pending",
        "Worship": currentAttendance.worship || "Pending",
        "worship": currentAttendance.worship || "Pending",
        "Dinner": currentAttendance.dinner || "Pending",
        "dinner": currentAttendance.dinner || "Pending",
      };
    }

    sessionsMap[session] = status;

    // Legacy field updates
    const legacyUpdates: Record<string, string> = {};
    if (session === "checkin" || session === "Arrival Check-in") {
      legacyUpdates.checkin = status;
      sessionsMap["Arrival Check-in"] = status;
      sessionsMap["checkin"] = status;
    }
    if (session === "worship" || session === "Worship") {
      legacyUpdates.worship = status;
      sessionsMap["Worship"] = status;
      sessionsMap["worship"] = status;
    }
    if (session === "dinner" || session === "Dinner") {
      legacyUpdates.dinner = status;
      sessionsMap["Dinner"] = status;
      sessionsMap["dinner"] = status;
    }

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        ...legacyUpdates,
        sessionsJson: JSON.stringify(sessionsMap),
      },
      include: { family: true },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("Failed to update attendance:", err);
    return NextResponse.json({ error: "Failed to update attendance" }, { status: 500 });
  }
}
