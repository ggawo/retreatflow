import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";
import RoomsClient from "./RoomsClient";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const event = await getActiveEvent();

  // Self-healing: Clean up any family.roomId pointing to deleted/non-existent rooms
  const orphanedFamilies = await prisma.family.findMany({
    where: { eventId: event.id, roomId: { not: null }, room: null }
  });
  if (orphanedFamilies.length > 0) {
    await prisma.family.updateMany({
      where: { id: { in: orphanedFamilies.map(f => f.id) } },
      data: { roomId: null }
    });
  }

  const buildings = await prisma.building.findMany({
    where: { eventId: event.id },
    include: {
      rooms: {
        include: { families: true }
      }
    }
  });

  const families = await prisma.family.findMany({
    where: { eventId: event.id }
  });

  return <RoomsClient buildings={buildings} allFamilies={families} />;
}
