import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { email, passcode, newPassword } = await req.json();

    if (!email || !passcode || !newPassword) {
      return NextResponse.json(
        { error: "Email, passcode, and new password are required." },
        { status: 400 }
      );
    }

    if (String(newPassword).length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const cleanPasscode = String(passcode).trim();

    // 1. Verify passcode token exists and has not expired
    const activeToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: normalizedEmail,
        token: cleanPasscode,
        expires: {
          gt: new Date(),
        },
      },
    });

    if (!activeToken) {
      return NextResponse.json(
        { error: "Invalid or expired verification passcode. Please request a new code." },
        { status: 400 }
      );
    }

    // 2. Verify account exists
    const user = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Account could not be found." },
        { status: 404 }
      );
    }

    // 3. Update the user password in database
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: String(newPassword).trim(),
      },
    });

    // 4. Invalidate and delete all used tokens for this account
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: normalizedEmail,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Password changed successfully! You can now sign in with your new password.",
      email: normalizedEmail,
    });
  } catch (err: any) {
    console.error("[reset-password API error]:", err);
    return NextResponse.json(
      { error: "Failed to reset password. Please try again." },
      { status: 500 }
    );
  }
}
