import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";
import FamiliesClient from "./FamiliesClient";

export const dynamic = "force-dynamic";

export default async function FamiliesPage() {
  const event = await getActiveEvent();
  const [families, buildings] = await Promise.all([
    prisma.family.findMany({
      where: { eventId: event.id },
      orderBy: { name: "asc" },
      include: {
        room: { include: { building: true } },
      }
    }),
    prisma.building.findMany({
      where: { eventId: event.id },
      include: { rooms: true },
      orderBy: { name: "asc" }
    })
  ]);

  return <FamiliesClient initialData={families} buildings={buildings} />;
}
