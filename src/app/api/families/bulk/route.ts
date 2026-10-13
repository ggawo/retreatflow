import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";

export async function POST(req: NextRequest) {
  try {
    const event = await getActiveEvent();
    const familiesData = await req.json();

    if (!Array.isArray(familiesData) || familiesData.length === 0) {
      return NextResponse.json({ error: "No family records provided" }, { status: 400 });
    }

    const createdFamilies = [];

    for (const item of familiesData) {
      const {
        name,
        leader,
        email,
        phone,
        adults = 1,
        children = 0,
        nonPayingChildren = 0,
        roomPref = "Any",
        access = "None",
        notes = "",
        status = "Confirmed"
      } = item;

      if (!name || !leader || !email) continue;

      const family = await prisma.family.create({
        data: {
          eventId: event.id,
          name,
          leader,
          email,
          phone: phone || "",
          adults: Number(adults) || 1,
          children: Number(children) || 0,
          nonPayingChildren: Number(nonPayingChildren) || 0,
          roomPref: roomPref || "Any",
          access: access || "None",
          notes: notes || "",
          status,
        }
      });

      const adultPrice = event.pricePerAdult ?? 120;
      const childPrice = event.pricePerChild ?? 60;
      const numAdults = Number(adults) || 1;
      const numChildren = Number(children) || 0;
      const amount = (numAdults * adultPrice) + (numChildren * childPrice);

      await prisma.registration.create({
        data: {
          familyId: family.id,
          submitted: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          status: status === "Confirmed" ? "Confirmed" : "Pending",
          source: "Bulk CSV Import",
          completeness: 100,
          waiver: true,
          balance: status === "Confirmed" ? 0 : amount,
          note: notes || "",
        }
      });

      const fullDueDate = event.fullPaymentDueDate || event.startDate || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const dpDueDate = event.downpaymentDueDate || fullDueDate;

      if (event.hasDownpayment && (event.downpaymentAmount ?? 0) > 0 && amount > 0) {
        const dpAmount = Math.min(amount, event.downpaymentAmount);
        const remaining = amount - dpAmount;

        await prisma.payment.create({
          data: {
            familyId: family.id,
            amount: dpAmount,
            status: status === "Confirmed" ? "Paid" : "Overdue",
            due: dpDueDate,
            method: "Card",
          }
        });

        if (remaining > 0) {
          await prisma.payment.create({
            data: {
              familyId: family.id,
              amount: remaining,
              status: status === "Confirmed" ? "Paid" : "Overdue",
              due: fullDueDate,
              method: "Card",
            }
          });
        }
      } else {
        await prisma.payment.create({
          data: {
            familyId: family.id,
            amount,
            status: status === "Confirmed" ? "Paid" : "Overdue",
            due: fullDueDate,
            method: "Card",
          }
        });
      }

      await prisma.attendance.create({
        data: {
          familyId: family.id,
          checkin: "Pending",
          worship: "Pending",
          dinner: "Pending",
        }
      });

      createdFamilies.push(family);
    }

    revalidatePath("/");
    revalidatePath("/families");
    revalidatePath("/registration");
    revalidatePath("/payments");

    return NextResponse.json({ success: true, count: createdFamilies.length, families: createdFamilies });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to perform bulk registration" }, { status: 500 });
  }
}
