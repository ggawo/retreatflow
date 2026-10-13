import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendRegistrationConfirmationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      eventId,
      slug,
      accessCode,
      name,
      leader,
      email,
      phone,
      emergencyContact,
      adults = 1,
      children = 0,
      nonPayingChildren = 0,
      roomPref = "Any",
      access = "None",
      buddyRequest,
      dietary,
      notes,
      members = [],
      waiver = false,
      signature = "",
    } = body;

    if (!leader || !email) {
      return NextResponse.json({ error: "Primary contact name and email are required." }, { status: 400 });
    }

    // 1. Look up event by slug or eventId
    let event = null;
    if (slug) {
      event = await prisma.event.findUnique({ where: { slug } });
    }
    if (!event && eventId) {
      event = await prisma.event.findUnique({ where: { id: eventId } });
    }
    if (!event) {
      // Fallback: active seed event
      event = await prisma.event.findFirst({ orderBy: { id: "desc" } });
    }

    if (!event) {
      return NextResponse.json({ error: "Retreat event not found." }, { status: 404 });
    }

    // 2. Enforce registration mode
    if (event.registrationMode === "ADMIN_ONLY") {
      return NextResponse.json({
        error: "Public self-registration is closed for this retreat. Please contact the organizers directly to register.",
      }, { status: 403 });
    }

    // 3. Enforce Registration Access Code Gate
    if (event.requireAccessCode && event.registrationAccessCode) {
      const providedCode = (accessCode || "").trim().toUpperCase();
      const expectedCode = event.registrationAccessCode.trim().toUpperCase();
      if (providedCode !== expectedCode) {
        return NextResponse.json({
          error: "Invalid or missing registration access code. Please obtain the correct passcode from the retreat organizers.",
        }, { status: 403 });
      }
    }

    const numAdults = Math.max(1, Number(adults) || 1);
    const numChildren = Math.max(0, Number(children) || 0);
    const numNonPaying = Math.max(0, Number(nonPayingChildren) || 0);

    const pricePerAdult = event.pricePerAdult ?? 120;
    const pricePerChild = event.pricePerChild ?? 60;
    const totalBalance = (numAdults * pricePerAdult) + (numChildren * pricePerChild);

    const familyName = name && name.trim() ? name.trim() : `${leader.trim()} Family`;
    const registrationRef = `REQ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // 4. Create Family record with PENDING status (DO NOT confirm until payment is recorded)
    const family = await prisma.family.create({
      data: {
        eventId: event.id,
        name: familyName,
        leader: leader.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : null,
        emergencyContact: emergencyContact ? emergencyContact.trim() : null,
        adults: numAdults,
        children: numChildren,
        nonPayingChildren: numNonPaying,
        roomPref: roomPref || "Any",
        access: access || "None",
        buddyRequest: buddyRequest ? buddyRequest.trim() : null,
        dietary: dietary ? dietary.trim() : null,
        status: "Pending", // Must be Pending until payment is confirmed by organizers
        notes: notes ? notes.trim() : (signature ? `Digitally signed by: ${signature}` : null),
        membersJson: Array.isArray(members) && members.length > 0 ? JSON.stringify(members) : null,
      },
    });

    // 5. Create Registration record (Pending status, balance due)
    const isWaiverSigned = Boolean(waiver);
    await prisma.registration.create({
      data: {
        familyId: family.id,
        submitted: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        status: "Pending", // Pending payment verification
        source: "Public Online Portal",
        completeness: isWaiverSigned ? 100 : 85,
        waiver: isWaiverSigned,
        balance: totalBalance,
        note: signature ? `Waiver digitally accepted by ${signature} on ${new Date().toLocaleDateString()}` : notes || null,
      },
    });

    // 6. Create blank attendance record for check-in kiosk
    await prisma.attendance.create({
      data: { familyId: family.id },
    });

    // 7. Generate payment schedule matching event rules
    const fullDueDate = event.fullPaymentDueDate || event.startDate || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const dpDueDate = event.downpaymentDueDate || fullDueDate;

    if (event.hasDownpayment && (event.downpaymentAmount ?? 0) > 0 && totalBalance > 0) {
      const dpAmount = Math.min(totalBalance, event.downpaymentAmount);
      const remaining = totalBalance - dpAmount;

      await prisma.payment.create({
        data: {
          familyId: family.id,
          amount: dpAmount,
          status: "Overdue",
          due: dpDueDate,
          method: "None",
        },
      });

      if (remaining > 0) {
        await prisma.payment.create({
          data: {
            familyId: family.id,
            amount: remaining,
            status: "Overdue",
            due: fullDueDate,
            method: "None",
          },
        });
      }
    } else if (totalBalance > 0) {
      await prisma.payment.create({
        data: {
          familyId: family.id,
          amount: totalBalance,
          status: "Overdue",
          due: fullDueDate,
          method: "None",
        },
      });
    }

    // 8. Dispatch notification email (clarifying pending payment, NO passcode released yet)
    sendRegistrationConfirmationEmail({
      attendeeEmail: email.trim().toLowerCase(),
      attendeeName: leader.trim(),
      retreatName: event.name,
      organizationName: event.organizationName,
      retreatDates: event.date,
      location: event.location,
      adultsCount: numAdults,
      childrenCount: numChildren,
      totalAmount: totalBalance,
      balanceDue: totalBalance,
      dueDate: event.fullPaymentDueDate || event.startDate,
      registrationRef,
      isPaid: false,
      isConfirmed: false,
    }).catch((emailErr) => {
      console.error("[Public Reg Email] Delivery failed:", emailErr);
    });

    // DO NOT release boarding passcode or QR code until payment is paid and confirmed!
    return NextResponse.json({
      success: true,
      familyId: family.id,
      registrationRef,
      passCode: null, // Locked until payment verified
      isPaid: false,
      isConfirmed: false,
      status: "Pending",
      familyName,
      leader: leader.trim(),
      email: email.trim().toLowerCase(),
      totalBalance,
      dueDate: event.fullPaymentDueDate || event.startDate,
      retreatName: event.name,
      organizationName: event.organizationName,
      date: event.date,
      location: event.location,
    }, { status: 201 });
  } catch (err) {
    console.error("Public registration error:", err);
    return NextResponse.json({ error: "An unexpected error occurred while submitting your registration." }, { status: 500 });
  }
}
