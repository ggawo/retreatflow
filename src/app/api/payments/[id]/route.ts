import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { action } = await req.json();
    if (action === "mark-paid") {
      const payment = await prisma.payment.update({
        where: { id },
        data: { status: "Paid" },
        include: { family: true },
      });
      // Update the registration balance
      const reg = await prisma.registration.findUnique({ where: { familyId: payment.familyId } });
      if (reg) {
        await prisma.registration.update({
          where: { familyId: payment.familyId },
          data: { balance: Math.max(0, reg.balance - payment.amount) },
        });
      }
      revalidatePath("/");
      revalidatePath("/payments");
      return NextResponse.json(payment);
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update payment" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, amount, method, paymentType } = await req.json();
    const payment = await prisma.payment.create({
      data: {
        familyId,
        amount: Number(amount),
        status: "Paid",
        due: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        method,
      },
    });
    // Reduce registration balance
    const reg = await prisma.registration.findUnique({ where: { familyId } });
    if (reg) {
      await prisma.registration.update({
        where: { familyId },
        data: { balance: Math.max(0, reg.balance - Number(amount)) },
      });
    }
    return NextResponse.json(payment);
  } catch (err) {
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}
