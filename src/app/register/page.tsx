import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import PublicRegisterClient from "../r/[slug]/PublicRegisterClient";

export const dynamic = "force-dynamic";

export default async function RegisterDefaultPage() {
  const event =
    (await prisma.event.findFirst({
      where: { id: "seed-event-1" },
    })) || (await prisma.event.findFirst({ orderBy: { id: "desc" } }));

  if (event?.slug) {
    redirect(`/r/${event.slug}`);
  }

  if (event) {
    return <PublicRegisterClient event={event} />;
  }

  return (
    <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
      No retreat event currently found.
    </div>
  );
}
