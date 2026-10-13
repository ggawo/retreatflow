import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";
import ScheduleClient from "./ScheduleClient";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const event = await getActiveEvent();
  const schedule = await prisma.schedule.findMany({
    where: { eventId: event.id },
    orderBy: { id: "asc" }
  });

  return <ScheduleClient initialData={schedule} event={event} />;
}
