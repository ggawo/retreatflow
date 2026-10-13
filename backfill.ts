import prisma from "./src/lib/prisma";

async function run() {
  const lastEvent = await prisma.event.findFirst({ orderBy: { id: "desc" } });
  if (lastEvent) {
    const updatedFam = await prisma.family.updateMany({
      where: { eventId: null },
      data: { eventId: lastEvent.id }
    });
    console.log(`Backfilled ${updatedFam.count} families to event: ${lastEvent.name} (${lastEvent.id})`);
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
