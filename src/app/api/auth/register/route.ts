import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendAdminWelcomeEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { 
      name, 
      email, 
      password, 
      organizationName = "My Organization",
      organizationType = "Church / Ministry",
      retreatName, 
      startDate, 
      endDate, 
      location,
      pricePerAdult = 120,
      pricePerChild = 60,
      childAgeThreshold = 12,
      hasDownpayment = false,
      downpaymentAmount = 0,
      downpaymentDueDate,
      fullPaymentDueDate,
      registrationMode = "PUBLIC_SELF",
      registrationAccessCode,
    } = await req.json();

    if (!name || !email || !password || !retreatName || !startDate || !location) {
      return NextResponse.json({ error: "All required fields must be filled out." }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: "An admin account with this email already exists." }, { status: 400 });
    }

    // 1. Create Admin User
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password,
        organizationName,
        role: "ADMIN",
      },
    });

    // 2. Generate unique URL-friendly slug
    let baseSlug = retreatName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!baseSlug) baseSlug = "retreat";
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.event.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    // 3. Calculate Expiration (60 days after retreat end date)
    const effectiveEndDate = endDate || startDate;
    let expiresAt: Date | null = null;
    try {
      const parsedEnd = new Date(effectiveEndDate);
      if (!isNaN(parsedEnd.getTime())) {
        expiresAt = new Date(parsedEnd.getTime() + 60 * 24 * 60 * 60 * 1000);
      }
    } catch {
      expiresAt = null;
    }

    // 4. Format Retreat Date & create associated Event
    const formattedDate = endDate ? `${startDate} – ${endDate}` : startDate;
    const finalRegMode = registrationMode === "ADMIN_ONLY" ? "ADMIN_ONLY" : "PUBLIC_SELF";
    const finalAccessCode = (registrationAccessCode || `PASS${Math.floor(1000 + Math.random() * 9000)}`).trim().toUpperCase();

    const event = await prisma.event.create({
      data: {
        userId: user.id,
        name: retreatName,
        slug,
        organizationName,
        organizationType,
        planTier: "FREE_DEV",
        billingStatus: "ACTIVE",
        billingPaidAt: new Date(),
        expiresAt,
        startDate: startDate,
        endDate: effectiveEndDate,
        date: formattedDate,
        location: location,
        capacity: 100,
        registrationDeadline: startDate,
        registrationMode: finalRegMode,
        requireAccessCode: true,
        registrationAccessCode: finalAccessCode,
        publicRegIntro: `Welcome to ${retreatName}! Please complete this form to register your family or group.`,
        pricePerAdult: Number(pricePerAdult) || 120,
        pricePerChild: Number(pricePerChild) || 60,
        childAgeThreshold: Number(childAgeThreshold) || 12,
        hasDownpayment: Boolean(hasDownpayment),
        downpaymentAmount: Number(downpaymentAmount) || 0,
        downpaymentDueDate: downpaymentDueDate || null,
        fullPaymentDueDate: fullPaymentDueDate || startDate,
      },
    });

    // 5. Send Welcome Email asynchronously
    const origin = req.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";
    sendAdminWelcomeEmail({
      adminEmail: user.email || email,
      adminName: user.name,
      organizationName,
      organizationType,
      retreatName,
      retreatDates: formattedDate,
      location,
      planTier: "Event Pass (Free Dev & Launch Mode)",
      dashboardUrl: `${origin}/`,
    }).catch((emailErr) => {
      console.error("[Welcome Email] Failed to send welcome email:", emailErr);
    });

    return NextResponse.json({ 
      success: true, 
      user: { id: user.id, name: user.name, email: user.email },
      eventId: event.id,
    }, { status: 201 });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Failed to create customer account and retreat event." }, { status: 500 });
  }
}
