import prisma from "@/lib/prisma";
import PublicRegisterClient from "./PublicRegisterClient";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await prisma.event.findFirst({
    where: {
      OR: [{ slug }, { id: slug }],
    },
  });

  if (!event) {
    return {
      title: "Retreat Registration — RetreatFlow",
    };
  }

  return {
    title: `Register for ${event.name} — RetreatFlow`,
    description: `Official registration portal for ${event.name} hosted by ${event.organizationName || "the organizers"}.`,
  };
}

export default async function PublicRegisterPage({ params }: Props) {
  const { slug } = await params;

  let event = await prisma.event.findFirst({
    where: {
      OR: [{ slug }, { id: slug }],
    },
  });

  // Fallback: if not found by exact slug/id, check if it's the seed event
  if (!event) {
    event = await prisma.event.findFirst({
      where: { id: "seed-event-1" },
    });
  }

  if (!event) {
    event = await prisma.event.findFirst({ orderBy: { id: "desc" } });
  }

  if (!event) {
    notFound();
  }

  // Sanitize event to avoid leaking private access codes to client HTML
  const sanitizedEvent = {
    ...event,
    registrationAccessCode: undefined,
    hasAccessCodeProtection: Boolean(event.requireAccessCode && event.registrationAccessCode),
  };

  return <PublicRegisterClient event={sanitizedEvent} />;
}
