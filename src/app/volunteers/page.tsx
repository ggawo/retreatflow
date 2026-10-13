import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";
import VolunteersClient from "./VolunteersClient";

export const dynamic = "force-dynamic";

export default async function VolunteersPage() {
  const event = await getActiveEvent();
  const volunteers = await prisma.volunteer.findMany({
    where: { eventId: event.id },
    orderBy: { date: "asc" }
  });

  return <VolunteersClient initialData={volunteers} event={event} />;
}
