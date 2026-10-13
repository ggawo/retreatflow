import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";
import AttendanceClient from "./AttendanceClient";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const event = await getActiveEvent();
  const attendance = await prisma.attendance.findMany({
    where: { family: { eventId: event.id } },
    include: {
      family: {
        include: {
          room: true,
          registration: true,
          payments: true,
        },
      },
    },
  });

  return <AttendanceClient initialData={attendance} event={event} />;
}
