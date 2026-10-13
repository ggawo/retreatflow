import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Strict Account Check: Do not send passcode if account doesn't exist
    const user = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: "No account found with this email address. Please verify your email or create a new account.",
          accountFound: false,
        },
        { status: 404 }
      );
    }

    // 2. Generate secure 6-digit numeric passcode
    const passcode = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Clear any existing active tokens for this email to prevent reuse
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: normalizedEmail,
      },
    });

    // 4. Save new passcode with 15-minute expiration
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: passcode,
        expires,
      },
    });

    // 5. Send verification email
    const emailResult = await sendPasswordResetEmail({
      toEmail: normalizedEmail,
      userName: user.name,
      passcode,
    });

    return NextResponse.json({
      success: true,
      message: `A 6-digit verification passcode was sent to ${normalizedEmail}.`,
      accountFound: true,
      expiresInMinutes: 15,
      // For immediate dev convenience if SMTP is unconfigured locally
      devPasscode: emailResult.simulated ? passcode : undefined,
    });
  } catch (err: any) {
    console.error("[forgot-password API error]:", err);
    return NextResponse.json(
      { error: "Unable to process password reset request. Please try again." },
      { status: 500 }
    );
  }
}
