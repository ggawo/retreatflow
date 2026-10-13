import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";
import CommunicationsClient from "./CommunicationsClient";

export const dynamic = "force-dynamic";

export default async function CommunicationsPage() {
  const event = await getActiveEvent();
  const messages = await prisma.message.findMany({
    where: {
      OR: [{ eventId: event.id }, { eventId: "seed-event-1" }],
    },
    orderBy: { id: "desc" },
  });

  const families = await prisma.family.findMany({
    where: {
      OR: [{ eventId: event.id }, { eventId: "seed-event-1" }],
    },
    select: {
      id: true,
      name: true,
      leader: true,
      email: true,
      status: true,
    },
    orderBy: { name: "asc" },
  });

  return <CommunicationsClient initialData={messages} event={event} families={families} />;
}
