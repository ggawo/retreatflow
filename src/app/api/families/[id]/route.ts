import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const family = await prisma.family.findUnique({
      where: { id },
      include: {
        registration: true,
        room: { include: { building: true } },
        payments: true,
        attendance: true,
      }
    });

    if (!family) return NextResponse.json({ error: "Family not found" }, { status: 404 });
    return NextResponse.json(family);
  } catch {
    return NextResponse.json({ error: "Failed to fetch family" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const updated = await prisma.family.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.leader && { leader: body.leader }),
        ...(body.email && { email: body.email }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.adults !== undefined && { adults: Number(body.adults) }),
        ...(body.children !== undefined && { children: Number(body.children) }),
        ...(body.nonPayingChildren !== undefined && { nonPayingChildren: Number(body.nonPayingChildren) }),
        ...(body.roomPref !== undefined && { roomPref: body.roomPref }),
        ...(body.access !== undefined && { access: body.access }),
        ...(body.buddyRequest !== undefined && { buddyRequest: body.buddyRequest }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.status && body.status !== "Confirmed" && { roomId: null }),
        ...(body.roomId !== undefined && { roomId: body.roomId }),
        ...(body.members !== undefined && { membersJson: Array.isArray(body.members) ? JSON.stringify(body.members) : body.members }),
        ...(body.membersJson !== undefined && { membersJson: body.membersJson }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });

    if (body.status) {
      await prisma.registration.updateMany({
        where: { familyId: id },
        data: { status: body.status }
      });
    }

    revalidatePath("/");
    revalidatePath("/families");
    revalidatePath("/registration");
    revalidatePath("/payments");

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update family" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await prisma.family.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete family" }, { status: 500 });
  }
}
