import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { action } = body;

    if (action === "approve") {
      const reg = await prisma.registration.findUnique({ where: { id } });
      if (!reg) return NextResponse.json({ error: "Not found" }, { status: 404 });
      
      const updated = await prisma.registration.update({
        where: { id },
        data: {
          status: "Confirmed",
          waiver: true,
          completeness: 100,
        },
      });
      if (reg.familyId) {
        await prisma.family.update({
          where: { id: reg.familyId },
          data: { status: "Confirmed" },
        });
      }
      return NextResponse.json(updated);
    }

    if (action === "update") {
      const updated = await prisma.registration.update({
        where: { id },
        data: { ...body.data },
      });
      if (body.data?.status && updated.familyId) {
        await prisma.family.update({
          where: { id: updated.familyId },
          data: {
            status: body.data.status,
            ...(body.data.status !== "Confirmed" ? { roomId: null } : {}),
          },
        });
      }
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update registration" }, { status: 500 });
  }
}
