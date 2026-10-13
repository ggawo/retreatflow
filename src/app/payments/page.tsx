import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";
import PaymentsClient from "./PaymentsClient";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const event = await getActiveEvent();

  const payments = await prisma.payment.findMany({
    where: { family: { eventId: event.id } },
    include: { family: true },
    orderBy: { createdAt: "desc" }
  });

  const families = await prisma.family.findMany({
    where: { eventId: event.id }
  });

  return <PaymentsClient payments={payments} families={families} event={event} />;
}
