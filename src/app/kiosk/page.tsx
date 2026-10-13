import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";
import KioskClient from "./KioskClient";

export const dynamic = "force-dynamic";

export default async function KioskPage() {
  const event = await getActiveEvent();

  // Fetch confirmed families with their assigned room, building, and attendance record
  const families = await prisma.family.findMany({
    where: {
      eventId: event.id,
      status: "Confirmed",
    },
    orderBy: { name: "asc" },
    include: {
      room: { include: { building: true } },
      attendance: true,
      registration: true,
      payments: true,
    },
  });

  let initialCategories = ["Arrival Check-in", "Worship", "Dinner"];
  if (event.attendanceSessions) {
    try {
      const parsed = typeof event.attendanceSessions === "string" ? JSON.parse(event.attendanceSessions) : event.attendanceSessions;
      if (Array.isArray(parsed) && parsed.length > 0) initialCategories = parsed;
    } catch {}
  }

  return (
    <KioskClient 
      initialFamilies={families} 
      eventName={event.name || "2026 Family Summer Retreat"} 
      initialCategories={initialCategories}
    />
  );
}
