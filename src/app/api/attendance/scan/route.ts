import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";

export async function POST(req: NextRequest) {
  try {
    const event = await getActiveEvent();
    const body = await req.json();
    let { code, session = "Arrival Check-in" } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Missing or invalid QR code" }, { status: 400 });
    }

    let familyId = code.trim();

    // Support payload formats:
    // 1. RETREATFLOW:FAM:<familyId>
    // 2. JSON payload: { "familyId": "..." }
    // 3. URL format: ...?familyId=<familyId> or .../checkin/<familyId>
    if (familyId.startsWith("RETREATFLOW:FAM:")) {
      familyId = familyId.replace("RETREATFLOW:FAM:", "");
    } else if (familyId.startsWith("{")) {
      try {
        const parsed = JSON.parse(familyId);
        if (parsed.familyId) familyId = parsed.familyId;
        else if (parsed.id) familyId = parsed.id;
      } catch {
        // use raw string
      }
    } else if (familyId.includes("familyId=")) {
      const match = familyId.match(/familyId=([^&]+)/);
      if (match) familyId = match[1];
    } else if (familyId.includes("/checkin/")) {
      const parts = familyId.split("/checkin/");
      familyId = parts[parts.length - 1];
    }

    // Lookup family by ID or matching leader name/email if id search fails
    let family = await prisma.family.findFirst({
      where: {
        id: familyId,
        eventId: event.id,
      },
      include: {
        attendance: true,
        registration: true,
        room: true,
        payments: true,
      },
    });

    if (!family) {
      // Fallback: search by ID prefix or exact registration ID
      family = await prisma.family.findFirst({
        where: {
          eventId: event.id,
          OR: [
            { id: { startsWith: familyId } },
            { registration: { id: familyId } },
          ],
        },
        include: {
          attendance: true,
          registration: true,
          room: true,
          payments: true,
        },
      });
    }

    if (!family) {
      return NextResponse.json({ error: "Family not found for this event" }, { status: 404 });
    }

    // 1. Only allow check-in for Confirmed status
    if (family.status !== "Confirmed" || (family.registration && family.registration.status !== "Confirmed")) {
      return NextResponse.json(
        { error: `Check-in denied: ${family.name} registration status is "${family.status}". Only Confirmed groups are permitted to check in.` },
        { status: 403 }
      );
    }

    const isArrivalSession = session === "Arrival Check-in" || session === "checkin";
    if (isArrivalSession) {
      // 2. Room must be assigned
      if (!family.roomId && !family.room) {
        return NextResponse.json(
          { error: `Check-in denied: Room is not assigned for ${family.name}. Lodging must be assigned before check-in.` },
          { status: 400 }
        );
      }

      // 3. Must not have pending payment / balance
      const balance = Number(family.registration?.balance || 0);
      const hasUnpaid = family.payments && family.payments.length > 0 ? family.payments.some((p: any) => p.status !== "Paid") : false;
      if (balance > 0 || hasUnpaid) {
        return NextResponse.json(
          { error: `Check-in denied: ${family.name} has pending payments or an outstanding balance of $${balance.toFixed(2)}. All fees must be settled before check-in.` },
          { status: 400 }
        );
      }
    }

    // Find or create attendance record
    let attendance = family.attendance && family.attendance.length > 0 ? family.attendance[0] : null;

    if (!attendance) {
      attendance = await prisma.attendance.create({
        data: {
          familyId: family.id,
          checkin: "Pending",
          worship: "Pending",
          dinner: "Pending",
        },
      });
    }

    let sessionsMap: Record<string, string> = {};
    if (attendance.sessionsJson) {
      try {
        sessionsMap = JSON.parse(attendance.sessionsJson);
      } catch {}
    } else {
      sessionsMap = {
        "Arrival Check-in": attendance.checkin || "Pending",
        "checkin": attendance.checkin || "Pending",
        "Worship": attendance.worship || "Pending",
        "worship": attendance.worship || "Pending",
        "Dinner": attendance.dinner || "Pending",
        "dinner": attendance.dinner || "Pending",
      };
    }

    const previousStatus = sessionsMap[session] || (attendance as any)[session] || "Pending";
    sessionsMap[session] = "Present";

    const legacyUpdates: Record<string, string> = {};
    if (session === "checkin" || session === "Arrival Check-in") {
      legacyUpdates.checkin = "Present";
      sessionsMap["Arrival Check-in"] = "Present";
      sessionsMap["checkin"] = "Present";
    }
    if (session === "worship" || session === "Worship") {
      legacyUpdates.worship = "Present";
      sessionsMap["Worship"] = "Present";
      sessionsMap["worship"] = "Present";
    }
    if (session === "dinner" || session === "Dinner") {
      legacyUpdates.dinner = "Present";
      sessionsMap["Dinner"] = "Present";
      sessionsMap["dinner"] = "Present";
    }

    // Update status to Present
    const updatedAttendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        ...legacyUpdates,
        sessionsJson: JSON.stringify(sessionsMap),
      },
    });

    return NextResponse.json({
      success: true,
      alreadyCheckedIn: previousStatus === "Present",
      session,
      attendance: updatedAttendance,
      family: {
        id: family.id,
        name: family.name,
        leader: family.leader,
        adults: family.adults,
        children: family.children,
        nonPayingChildren: family.nonPayingChildren,
        roomPref: family.roomPref,
        status: family.status,
      },
    });
  } catch (err: any) {
    console.error("Scan attendance error:", err);
    return NextResponse.json({ error: "Failed to process scan: " + (err.message || "Unknown error") }, { status: 500 });
  }
}
