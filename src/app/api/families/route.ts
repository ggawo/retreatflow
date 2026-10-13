import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";

export async function GET() {
  try {
    const event = await getActiveEvent();
    const families = await prisma.family.findMany({
      where: { eventId: event.id },
      orderBy: { name: "asc" },
      include: {
        registration: true,
        room: { include: { building: true } },
        payments: true,
        attendance: true,
      }
    });

    // Self-healing: If family.roomId is set but room is null (room deleted), reset roomId
    const orphanedFamilies = families.filter(f => f.roomId && !f.room);
    if (orphanedFamilies.length > 0) {
      await prisma.family.updateMany({
        where: { id: { in: orphanedFamilies.map(f => f.id) } },
        data: { roomId: null },
      });
      orphanedFamilies.forEach(f => { f.roomId = null; f.room = null; });
    }

    return NextResponse.json(families);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch families" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const event = await getActiveEvent();
    const body = await req.json();
    const { name, leader, email, phone, adults, children, nonPayingChildren, roomPref, access, buddyRequest, notes, status = "Confirmed", members, roomId } = body;

    if (!name || !leader || !email) {
      return NextResponse.json({ error: "Name, leader, and email are required." }, { status: 400 });
    }

    const serializedMembers = Array.isArray(members) ? JSON.stringify(members) : (body.membersJson || null);

    const family = await prisma.family.create({
      data: {
        eventId: event.id,
        name,
        leader,
        email,
        phone: phone || "",
        adults: Number(adults) || 1,
        children: Number(children) || 0,
        nonPayingChildren: Number(nonPayingChildren) || 0,
        roomPref: roomPref || "Any",
        access: access || "None",
        buddyRequest: buddyRequest || "",
        notes: notes || "",
        status,
        roomId: roomId || null,
        membersJson: serializedMembers,
      }
    });

    const adultPrice = event.pricePerAdult ?? 120;
    const childPrice = event.pricePerChild ?? 60;
    const numAdults = Number(adults) || 1;
    const numChildren = Number(children) || 0;
    const amount = (numAdults * adultPrice) + (numChildren * childPrice);

    // Automatically create registration, payment, and attendance records for the new family
    await prisma.registration.create({
      data: {
        familyId: family.id,
        submitted: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        status: status === "Confirmed" ? "Confirmed" : "Pending",
        source: "Manual Admin",
        completeness: 100,
        waiver: true,
        balance: status === "Confirmed" ? 0 : amount,
        note: notes || "",
      }
    });

    const fullDueDate = event.fullPaymentDueDate || event.startDate || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const dpDueDate = event.downpaymentDueDate || fullDueDate;

    if (event.hasDownpayment && (event.downpaymentAmount ?? 0) > 0 && amount > 0) {
      const dpAmount = Math.min(amount, event.downpaymentAmount);
      const remaining = amount - dpAmount;

      await prisma.payment.create({
        data: {
          familyId: family.id,
          amount: dpAmount,
          status: status === "Confirmed" ? "Paid" : "Overdue",
          due: dpDueDate,
          method: "Card",
        }
      });

      if (remaining > 0) {
        await prisma.payment.create({
          data: {
            familyId: family.id,
            amount: remaining,
            status: status === "Confirmed" ? "Paid" : "Overdue",
            due: fullDueDate,
            method: "Card",
          }
        });
      }
    } else {
      await prisma.payment.create({
        data: {
          familyId: family.id,
          amount,
          status: status === "Confirmed" ? "Paid" : "Overdue",
          due: fullDueDate,
          method: "Card",
        }
      });
    }

    await prisma.attendance.create({
      data: {
        familyId: family.id,
        checkin: "Pending",
        worship: "Pending",
        dinner: "Pending",
      }
    });

    return NextResponse.json(family, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create family" }, { status: 500 });
  }
}
