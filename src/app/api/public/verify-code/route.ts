import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, eventId, code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { valid: false, error: "Please enter a valid registration access passcode." },
        { status: 400 }
      );
    }

    let event = null;
    if (slug) {
      event = await prisma.event.findUnique({ where: { slug } });
    }
    if (!event && eventId) {
      event = await prisma.event.findUnique({ where: { id: eventId } });
    }
    if (!event) {
      event = await prisma.event.findFirst({ orderBy: { id: "desc" } });
    }

    if (!event) {
      return NextResponse.json({ valid: false, error: "Retreat not found." }, { status: 404 });
    }

    // If retreat does not require access code, always valid
    if (!event.requireAccessCode || !event.registrationAccessCode) {
      return NextResponse.json({ valid: true, requireAccessCode: false });
    }

    const provided = code.trim().toUpperCase();
    const expected = event.registrationAccessCode.trim().toUpperCase();

    if (provided === expected) {
      return NextResponse.json({ valid: true, requireAccessCode: true });
    } else {
      return NextResponse.json(
        {
          valid: false,
          error: "Incorrect passcode. Please check with your retreat leader or organizer for the private invitation code.",
        },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error("Error verifying access code:", error);
    return NextResponse.json(
      { valid: false, error: "Unable to verify passcode. Please try again." },
      { status: 500 }
    );
  }
}
