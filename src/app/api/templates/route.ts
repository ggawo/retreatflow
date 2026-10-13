import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";

export const BUILT_IN_TEMPLATES = [
  {
    id: "builtin-announcement",
    name: "General Announcement & Welcome",
    category: "announcement",
    subject: "Important Retreat Update & Welcome",
    body: "Greetings {{name}} and {{family}}!\n\nWe are looking forward to our upcoming {{event}} from {{dates}} at {{location}}. Please find our latest updates, preparation details, and schedule notes below.\n\nIf you have any questions or require special accommodations, feel free to reply to this email.\n\nBlessings,\nRetreat Planning Committee",
    target: "All registered families",
    calloutNote: "Check-in begins at 2:00 PM at the Welcome Center.",
    buttonText: "View Retreat Info",
    buttonUrl: "http://localhost:3000/schedule",
    isBuiltin: true,
  },
  {
    id: "builtin-packing",
    name: "Packing List & What to Bring",
    category: "logistics",
    subject: "Retreat Packing List & What to Bring for {{family}}",
    body: "Hello {{name}}!\n\nAs we prepare for {{event}} at {{location}}, here is a checklist of items to bring for your group:\n\n• Bible, notebook, and pen\n• Bedding or sleeping bag and pillow\n• Casual and athletic clothing appropriate for the weather\n• Personal toiletries, towel, and flashlight\n• Any personal medications or dietary essentials\n\nLooking forward to a wonderful time of fellowship together!",
    target: "All registered families",
    calloutNote: "Linens are not provided by the camp facility. Please bring sheets or sleeping bags.",
    buttonText: "Check Schedule",
    buttonUrl: "http://localhost:3000/schedule",
    isBuiltin: true,
  },
  {
    id: "builtin-arrival",
    name: "Arrival & Check-in Schedule",
    category: "logistics",
    subject: "Arrival & Check-in Details for {{family}}",
    body: "Welcome {{name}}!\n\nRegistration and room check-in will open at 2:00 PM at the Welcome Center. Please have your QR pass ready on your phone or printed for expedited check-in.\n\nDinner will be served from 5:30 PM, followed by our Opening Worship session at 7:00 PM in the Main Chapel.\n\nSafe travels, and we look forward to greeting {{family}} in person!",
    target: "Confirmed families",
    calloutNote: "Have your Digital QR Pass ready at the front gate for instant check-in.",
    buttonText: "View My Passes",
    buttonUrl: "http://localhost:3000/registration",
    isBuiltin: true,
  },
  {
    id: "builtin-dietary",
    name: "Dietary Needs & Food Allergies",
    category: "custom",
    subject: "Meal Planning: Dietary Restrictions for {{family}}",
    body: "Dear {{name}},\n\nOur kitchen and hospitality committee is preparing menus for {{event}}. If anyone in {{family}} has specific dietary restrictions, allergies (e.g. gluten-free, peanut allergy, vegetarian), please reply to this email as soon as possible so we can notify the dining staff.\n\nThank you for helping us serve everyone safely and well!",
    target: "All registered families",
    calloutNote: "Please reply by this Wednesday so our kitchen team can finalize portions.",
    buttonText: "Contact Coordinator",
    buttonUrl: "mailto:info@lightoftheworldpa.org",
    isBuiltin: true,
  },
  {
    id: "builtin-baptism",
    name: "Baptism Service & Prayer Night Notice",
    category: "announcement",
    subject: "Special Gathering: Baptism & Prayer Night at {{event}}",
    body: "Dear {{name}},\n\nWe are overjoyed to announce a special evening of worship, prayer, and water baptism during our retreat at {{location}}.\n\nIf you or a member of {{family}} would like to participate in water baptism, please speak with our pastoral leadership or reply to this notice.\n\n'Therefore go and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit.' — Matthew 28:19",
    target: "All registered families",
    calloutNote: "Baptism service will take place Saturday at 3:00 PM by the lakeside.",
    buttonText: "Schedule of Events",
    buttonUrl: "http://localhost:3000/schedule",
    isBuiltin: true,
  },
];

export async function GET() {
  try {
    const event = await getActiveEvent();
    const customTemplates = await prisma.emailTemplate.findMany({
      where: {
        OR: [{ eventId: event.id }, { eventId: "seed-event-1" }],
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      builtin: BUILT_IN_TEMPLATES,
      custom: customTemplates.map((t) => ({ ...t, isBuiltin: false })),
    });
  } catch (err: any) {
    console.error("[GET /api/templates error]:", err);
    return NextResponse.json({ builtin: BUILT_IN_TEMPLATES, custom: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const event = await getActiveEvent();
    const body = await req.json();
    const { name, subject, body: templateBody, target = "All registered families", buttonText, buttonUrl, calloutNote } = body;

    if (!name || !subject || !templateBody) {
      return NextResponse.json(
        { error: "Template name, subject, and body are required." },
        { status: 400 }
      );
    }

    const created = await prisma.emailTemplate.create({
      data: {
        ...(event?.id ? { event: { connect: { id: event.id } } } : {}),
        name: name.trim(),
        subject: subject.trim(),
        body: templateBody,
        target,
        buttonText: buttonText?.trim() || null,
        buttonUrl: buttonUrl?.trim() || null,
        calloutNote: calloutNote?.trim() || null,
        category: "custom",
      },
    });

    return NextResponse.json({ success: true, template: created });
  } catch (err: any) {
    console.error("[POST /api/templates error]:", err);
    return NextResponse.json({ error: "Failed to save email template" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Template ID is required." }, { status: 400 });
    }

    await prisma.emailTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[DELETE /api/templates error]:", err);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
