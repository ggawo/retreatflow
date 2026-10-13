import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";

import { formatHumanDateRange, formatHumanDate } from "@/lib/dates";

export async function GET() {
  const event = await getActiveEvent();
  return NextResponse.json(event);
}

export async function PATCH(req: NextRequest) {
  try {
    const currentEvent = await getActiveEvent();
    const body = await req.json();

    const {
      name,
      organizationName,
      organizationType,
      startDate,
      endDate,
      location,
      capacity,
      registrationDeadline,
      pricePerAdult,
      pricePerChild,
      childAgeThreshold,
      hasDownpayment,
      downpaymentAmount,
      downpaymentDueDate,
      fullPaymentDueDate,
      registrationMode,
      slug,
      publicRegIntro,
      requireWaiver,
      requireAccessCode,
      registrationAccessCode,
      attendanceSessions,
    } = body;

    const formattedDate = (startDate && endDate) 
      ? formatHumanDateRange(startDate, endDate) 
      : (startDate ? formatHumanDate(startDate) : currentEvent.date);

    // If slug is provided and modified, ensure URL-friendly format
    let cleanSlug = undefined;
    if (slug) {
      cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    }

    const cleanAccessCode = registrationAccessCode ? registrationAccessCode.trim().toUpperCase() : undefined;

    const updated = await prisma.event.update({
      where: { id: currentEvent.id },
      data: {
        ...(name && { name }),
        ...(organizationName !== undefined && { organizationName }),
        ...(organizationType !== undefined && { organizationType }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(formattedDate && { date: formattedDate }),
        ...(location && { location }),
        ...(capacity !== undefined && { capacity: Number(capacity) }),
        ...(registrationDeadline !== undefined && { registrationDeadline }),
        ...(registrationMode !== undefined && { registrationMode }),
        ...(cleanSlug && { slug: cleanSlug }),
        ...(publicRegIntro !== undefined && { publicRegIntro }),
        ...(requireWaiver !== undefined && { requireWaiver: Boolean(requireWaiver) }),
        ...(requireAccessCode !== undefined && { requireAccessCode: Boolean(requireAccessCode) }),
        ...(cleanAccessCode !== undefined && { registrationAccessCode: cleanAccessCode }),
        ...(pricePerAdult !== undefined && { pricePerAdult: Number(pricePerAdult) }),
        ...(pricePerChild !== undefined && { pricePerChild: Number(pricePerChild) }),
        ...(childAgeThreshold !== undefined && { childAgeThreshold: Number(childAgeThreshold) }),
        ...(hasDownpayment !== undefined && { hasDownpayment: Boolean(hasDownpayment) }),
        ...(downpaymentAmount !== undefined && { downpaymentAmount: Number(downpaymentAmount) }),
        ...(downpaymentDueDate !== undefined && { downpaymentDueDate }),
        ...(fullPaymentDueDate !== undefined && { fullPaymentDueDate }),
        ...(attendanceSessions !== undefined && { 
          attendanceSessions: typeof attendanceSessions === "string" ? attendanceSessions : JSON.stringify(attendanceSessions) 
        }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Failed to update retreat settings:", err);
    return NextResponse.json({ error: "Failed to update retreat settings" }, { status: 500 });
  }
}
