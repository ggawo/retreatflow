import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const payments = await prisma.payment.findMany({ include: { family: true } });
    return NextResponse.json(payments);
  } catch {
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, amount, method } = await req.json();
    const payment = await prisma.payment.create({
      data: {
        familyId,
        amount: Number(amount),
        status: "Paid",
        due: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        method,
      },
    });
    const reg = await prisma.registration.findUnique({ where: { familyId } });
    if (reg) {
      await prisma.registration.update({
        where: { familyId },
        data: { balance: Math.max(0, reg.balance - Number(amount)) },
      });
    }
    revalidatePath("/");
    revalidatePath("/payments");
    return NextResponse.json(payment);
  } catch {
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}
