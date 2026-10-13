import prisma from "@/lib/prisma";
import { auth } from "@/auth";

function normalizeEvent(event: any) {
  if (!event) return null;
  return {
    ...event,
    organizationName: event.organizationName || "Retreat Ministry",
    organizationType: event.organizationType || "Church / Ministry",
    planTier: event.planTier || "PER_EVENT",
    billingStatus: event.billingStatus || "ACTIVE",
    startDate: event.startDate || "Jul 24, 2026",
    endDate: event.endDate || "Jul 26, 2026",
    registrationMode: event.registrationMode || "PUBLIC_SELF",
    slug: event.slug || "summer-retreat-2026",
    publicRegIntro: event.publicRegIntro || "",
    requireWaiver: event.requireWaiver ?? true,
    requireAccessCode: event.requireAccessCode ?? true,
    registrationAccessCode: event.registrationAccessCode || "RETREAT2026",
    pricePerAdult: event.pricePerAdult ?? 120,
    pricePerChild: event.pricePerChild ?? 60,
    childAgeThreshold: event.childAgeThreshold ?? 12,
    hasDownpayment: event.hasDownpayment ?? false,
    downpaymentAmount: event.downpaymentAmount ?? 0,
    downpaymentDueDate: event.downpaymentDueDate || null,
    fullPaymentDueDate: event.fullPaymentDueDate || event.startDate || "Jul 24, 2026",
  };
}

const DEFAULT_EVENT = {
  id: "seed-event-1",
  userId: null,
  name: "2026 Family Summer Retreat",
  organizationName: "Grace Fellowship",
  organizationType: "Church / Ministry",
  planTier: "PER_EVENT",
  billingStatus: "ACTIVE",
  date: "July 24–26, 2026",
  startDate: "Jul 24, 2026",
  endDate: "Jul 26, 2026",
  location: "Camp Hope",
  capacity: 90,
  registrationDeadline: "July 12, 2026",
  registrationMode: "PUBLIC_SELF",
  slug: "summer-retreat-2026",
  publicRegIntro: "Welcome! Please complete the form below to register your family or group for the 2026 Annual Summer Retreat.",
  requireWaiver: true,
  requireAccessCode: true,
  registrationAccessCode: "RETREAT2026",
  pricePerAdult: 120,
  pricePerChild: 60,
  childAgeThreshold: 12,
  hasDownpayment: false,
  downpaymentAmount: 0,
  downpaymentDueDate: null,
  fullPaymentDueDate: "Jul 24, 2026",
};

export async function getActiveEvent() {
  try {
    const session = await auth();
    const email = session?.user?.email;

    // 1. If explicitly logged in as default exercise admin
    if (email === "admin@retreatflow.com") {
      const defaultEvent = await prisma.event.findFirst({
        where: { id: "seed-event-1" },
      });
      if (defaultEvent) return normalizeEvent(defaultEvent);
    }

    // 2. Look up event for the authenticated user
    if (email) {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { events: { orderBy: { id: "desc" } } },
      });

      if (user && user.events.length > 0) {
        return normalizeEvent(user.events[0]);
      }
    }

    // 3. Fallback: Find latest user-created retreat event
    const userEvent = await prisma.event.findFirst({
      where: { userId: { not: null } },
      orderBy: { id: "desc" },
    });

    if (userEvent) return normalizeEvent(userEvent);

    // 4. Default seed event fallback
    const seedEvent = await prisma.event.findFirst({
      where: { id: "seed-event-1" },
    });

    return normalizeEvent(seedEvent) || DEFAULT_EVENT;
  } catch (err) {
    console.error("getActiveEvent error:", err);
    try {
      const fallback = await prisma.event.findFirst({ orderBy: { id: "desc" } });
      return normalizeEvent(fallback) || DEFAULT_EVENT;
    } catch {
      return DEFAULT_EVENT;
    }
  }
}
