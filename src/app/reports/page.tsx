import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const event = await getActiveEvent();

  const families = await prisma.family.findMany({
    where: { eventId: event.id },
    include: { registration: true, room: true }
  });
  const payments = await prisma.payment.findMany({
    where: { family: { eventId: event.id } },
    include: { family: true }
  });
  const volunteers = await prisma.volunteer.findMany({
    where: { eventId: event.id }
  });
  const attendance = await prisma.attendance.findMany({
    where: { family: { eventId: event.id } }
  });
  const rooms = await prisma.room.findMany({
    where: { building: { eventId: event.id } },
    include: { families: true }
  });
  const notifications = await prisma.notification.findMany({
    where: { eventId: event.id }
  });

  return (
    <ReportsClient 
      families={families} 
      payments={payments} 
      volunteers={volunteers} 
      attendance={attendance} 
      rooms={rooms}
      notifications={notifications}
      event={event}
    />
  );
}
