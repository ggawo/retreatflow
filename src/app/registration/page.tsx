import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";
import RegistrationClient from "./RegistrationClient";

export const dynamic = "force-dynamic";

export default async function RegistrationPage() {
  const event = await getActiveEvent();
  const registrations = await prisma.registration.findMany({
    where: { family: { eventId: event.id } },
    include: { family: true },
    orderBy: { createdAt: "desc" },
  });

  return <RegistrationClient initialData={registrations} event={event} />;
}
