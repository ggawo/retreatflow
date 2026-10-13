import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";

export async function POST(req: NextRequest) {
  try {
    const event = await getActiveEvent();
    const body = await req.json();
    const { name, leader, email, phone, adults, children, nonPayingChildren, roomPref, access, notes, waiver, members, roomId } = body;

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const serializedMembers = Array.isArray(members) ? JSON.stringify(members) : (body.membersJson || null);

    // Create family linked to active retreat event
    const family = await prisma.family.create({
      data: {
        eventId: event.id,
        name,
        leader: leader || "",
        email: email || "",
        phone: phone || "",
        adults: Number(adults) || 0,
        children: Number(children) || 0,
        nonPayingChildren: Number(nonPayingChildren) || 0,
        roomPref: roomPref || "Any",
        access: access || "None",
        status: "Pending",
        notes: notes || "",
        roomId: roomId || null,
        membersJson: serializedMembers,
      },
    });

    // Create registration
    const isWaiverComplete = waiver === "yes";
    const numAdults = Number(adults) || 0;
    const numChildren = Number(children) || 0;
    const adultPrice = event.pricePerAdult ?? 120;
    const childPrice = event.pricePerChild ?? 60;
    const balance = (numAdults * adultPrice) + (numChildren * childPrice);

    await prisma.registration.create({
      data: {
        familyId: family.id,
        submitted: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        status: "Pending",
        source: "Online Form",
        completeness: isWaiverComplete ? 100 : 82,
        waiver: isWaiverComplete,
        balance: balance,
        note: notes || "",
      },
    });

    // Create blank attendance record
    await prisma.attendance.create({
      data: { familyId: family.id },
    });

    // Create payment schedule matching event rules
    const fullDueDate = event.fullPaymentDueDate || event.startDate || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const dpDueDate = event.downpaymentDueDate || fullDueDate;

    if (event.hasDownpayment && (event.downpaymentAmount ?? 0) > 0 && balance > 0) {
      const dpAmount = Math.min(balance, event.downpaymentAmount);
      const remaining = balance - dpAmount;

      await prisma.payment.create({
        data: {
          familyId: family.id,
          amount: dpAmount,
          status: "Overdue",
          due: dpDueDate,
          method: "None",
        }
      });

      if (remaining > 0) {
        await prisma.payment.create({
          data: {
            familyId: family.id,
            amount: remaining,
            status: "Overdue",
            due: fullDueDate,
            method: "None",
          }
        });
      }
    } else {
      await prisma.payment.create({
        data: {
          familyId: family.id,
          amount: balance,
          status: "Overdue",
          due: fullDueDate,
          method: "None",
        },
      });
    }

    return NextResponse.json({ success: true, family });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create registration" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const event = await getActiveEvent();
    const registrations = await prisma.registration.findMany({
      where: { family: { eventId: event.id } },
      include: { family: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(registrations);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch registrations" }, { status: 500 });
  }
}
