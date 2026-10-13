import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";
import {
  sendAnnouncementEmail,
  sendBalanceReminderEmail,
  sendIncompleteRegistrationEmail,
  sendVolunteerShiftEmail,
  verifySmtpConnection,
  Recipient,
} from "@/lib/email";

export async function GET(req: NextRequest) {
  try {
    const event = await getActiveEvent();
    const { searchParams } = new URL(req.url);

    // 1. Check SMTP status on demand
    if (searchParams.get("smtpStatus") === "1") {
      const status = await verifySmtpConnection();
      return NextResponse.json(status);
    }

    // 2. Audience preview (shows how many people will receive the message)
    const previewTarget = searchParams.get("target");
    if (previewTarget) {
      const audience = await resolveAudience(event, previewTarget);
      return NextResponse.json({
        target: previewTarget,
        count: audience.recipients.length,
        recipients: audience.recipients.slice(0, 15), // Preview first 15
        totalAvailable: audience.recipients.length,
      });
    }

    // 3. Default: Return message history
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ eventId: event.id }, { eventId: "seed-event-1" }],
      },
      orderBy: { id: "desc" },
    });
    return NextResponse.json(messages);
  } catch (err: any) {
    console.error("[GET /api/messages error]:", err);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const event = await getActiveEvent();
    const bodyData = await req.json();
    const {
      target = "All registered families",
      subject = "Retreat update",
      body = "",
      customNote = "",
      buttonText = null,
      buttonUrl = null,
      calloutNote = null,
      directEmails = null,
      testEmail,
      isTest = false,
      sendEmail = true,
    } = bodyData;

    // 1. Handle Test Email if requested
    if (isTest && testEmail) {
      const testResult = await sendAnnouncementEmail({
        recipients: [{ email: testEmail, name: "RetreatFlow Administrator", familyName: "Administrator" }],
        subject: `[Test] ${subject || "RetreatFlow Test Notification"}`,
        body: body || "This is a test notification confirming that RetreatFlow email delivery is working smoothly.",
        eventName: event.name,
        organizationName: event.organizationName,
        location: event.location,
        dates: event.date,
        buttonText,
        buttonUrl,
        calloutNote,
      });

      return NextResponse.json({
        success: true,
        isTest: true,
        sentCount: testResult.sentCount,
        simulated: testResult.simulated,
        message: `Test email sent to ${testEmail}`,
      });
    }

    // 2. Resolve audience & send contextual emails
    let sentCount = 0;
    let failedCount = 0;
    let simulated = false;
    let recipientsList: Array<{ email: string; name?: string; status: string; detail?: string }> = [];

    const normTarget = target.trim();
    const isBalanceReminder =
      normTarget.toLowerCase().includes("balance") ||
      normTarget.toLowerCase().includes("pending payments") ||
      subject.toLowerCase().includes("balance");

    const isIncompleteReminder =
      normTarget.toLowerCase().includes("incomplete") ||
      subject.toLowerCase().includes("incomplete") ||
      subject.toLowerCase().includes("missing");

    const pricePerAdult = event.pricePerAdult ?? 120;
    const pricePerChild = event.pricePerChild ?? 60;

    // A. BALANCE REMINDER FLOW
    if (isBalanceReminder) {
      const families = await getFamiliesForEvent(event.id);
      const targetFamilyName =
        normTarget !== "Pending payments" && normTarget !== "Families with balances"
          ? normTarget
          : null;

      const matchingFamilies = families.filter((f) => {
        if (targetFamilyName) {
          return f.name.toLowerCase().includes(targetFamilyName.toLowerCase());
        }
        // Calculate balance
        const totalFee = f.adults * pricePerAdult + f.children * pricePerChild;
        const paid = f.payments
          ?.filter((p: any) => p.status === "Paid")
          .reduce((s: number, p: any) => s + p.amount, 0) || 0;
        const bal = Math.max(0, totalFee - paid);
        return bal > 0 || (f.registration && f.registration.balance > 0);
      });

      for (const fam of matchingFamilies) {
        if (!fam.email || !fam.email.includes("@")) continue;

        const totalFee = fam.adults * pricePerAdult + fam.children * pricePerChild;
        const paid = fam.payments
          ?.filter((p: any) => p.status === "Paid")
          .reduce((s: number, p: any) => s + p.amount, 0) || 0;
        const bal = fam.registration?.balance ? fam.registration.balance : Math.max(0, totalFee - paid);

        if (sendEmail) {
          const res = await sendBalanceReminderEmail({
            recipientEmail: fam.email,
            recipientName: fam.leader,
            familyName: fam.name,
            amountDue: bal,
            totalCost: totalFee,
            amountPaid: paid,
            dueDate: event.fullPaymentDueDate || event.startDate,
            eventName: event.name,
            dates: event.date,
            location: event.location,
            customNote: body || customNote || undefined,
          });

          if (res.sent) {
            sentCount++;
            if (res.simulated) simulated = true;
            recipientsList.push({ email: fam.email, name: fam.name, status: res.simulated ? "simulated" : "sent", detail: `$${bal} balance` });
          } else {
            failedCount++;
            recipientsList.push({ email: fam.email, name: fam.name, status: "failed", detail: res.error });
          }
        } else {
          sentCount++;
          recipientsList.push({ email: fam.email, name: fam.name, status: "logged" });
        }
      }
    }

    // B. INCOMPLETE REGISTRATION REMINDER FLOW
    else if (isIncompleteReminder) {
      const families = await getFamiliesForEvent(event.id);
      const targetFamilyName =
        normTarget !== "Incomplete registrations" ? normTarget : null;

      const matchingFamilies = families.filter((f) => {
        if (targetFamilyName) {
          return f.name.toLowerCase().includes(targetFamilyName.toLowerCase());
        }
        return (
          (f.registration && f.registration.completeness < 100) ||
          (f.registration && !f.registration.waiver)
        );
      });

      for (const fam of matchingFamilies) {
        if (!fam.email || !fam.email.includes("@")) continue;

        if (sendEmail) {
          const res = await sendIncompleteRegistrationEmail({
            recipientEmail: fam.email,
            recipientName: fam.leader,
            familyName: fam.name,
            completeness: fam.registration?.completeness || 0,
            hasWaiver: fam.registration?.waiver || false,
            deadline: event.registrationDeadline,
            eventName: event.name,
            dates: event.date,
            location: event.location,
            customNote: body || customNote || undefined,
          });

          if (res.sent) {
            sentCount++;
            if (res.simulated) simulated = true;
            recipientsList.push({ email: fam.email, name: fam.name, status: res.simulated ? "simulated" : "sent" });
          } else {
            failedCount++;
            recipientsList.push({ email: fam.email, name: fam.name, status: "failed", detail: res.error });
          }
        } else {
          sentCount++;
          recipientsList.push({ email: fam.email, name: fam.name, status: "logged" });
        }
      }
    }

    // C. VOLUNTEERS FLOW
    else if (normTarget.toLowerCase().includes("volunteer")) {
      const vols = await prisma.volunteer.findMany({
        where: {
          OR: [{ eventId: event.id }, { eventId: "seed-event-1" }],
        },
      });

      const families = await getFamiliesForEvent(event.id);

      for (const vol of vols) {
        // Resolve volunteer email: direct volunteer email or family match
        let volEmail = vol.email;
        if (!volEmail) {
          const matchedFam = families.find(
            (f) =>
              f.leader.toLowerCase().includes(vol.name.toLowerCase()) ||
              vol.name.toLowerCase().includes(f.leader.toLowerCase())
          );
          if (matchedFam?.email) volEmail = matchedFam.email;
        }

        if (volEmail && volEmail.includes("@")) {
          if (sendEmail) {
            const res = await sendVolunteerShiftEmail({
              recipientEmail: volEmail,
              volunteerName: vol.name,
              role: vol.role,
              shift: vol.shift,
              date: vol.date,
              skills: vol.skills,
              eventName: event.name,
              location: event.location,
            });

            if (res.sent) {
              sentCount++;
              if (res.simulated) simulated = true;
              recipientsList.push({ email: volEmail, name: vol.name, status: res.simulated ? "simulated" : "sent", detail: vol.role });
            } else {
              failedCount++;
              recipientsList.push({ email: volEmail, name: vol.name, status: "failed", detail: res.error });
            }
          } else {
            sentCount++;
            recipientsList.push({ email: volEmail, name: vol.name, status: "logged" });
          }
        }
      }
    }

    // D. GENERAL BROADCAST / CUSTOM EMAIL FLOW
    else {
      let customRecipients: Recipient[] = [];
      if (directEmails && typeof directEmails === "string") {
        const splitEmails = directEmails.split(",").map((e: string) => e.trim()).filter((e: string) => e.includes("@"));
        customRecipients = splitEmails.map((e: string) => ({ email: e, name: e.split("@")[0], familyName: e.split("@")[0] }));
      }

      const audience = customRecipients.length > 0
        ? { recipients: customRecipients }
        : await resolveAudience(event, normTarget);

      if (sendEmail && audience.recipients.length > 0) {
        const result = await sendAnnouncementEmail({
          recipients: audience.recipients,
          subject,
          body: body || "Please see the latest retreat update and announcements below.",
          eventName: event.name,
          organizationName: event.organizationName,
          location: event.location,
          dates: event.date,
          buttonText,
          buttonUrl,
          calloutNote,
        });

        sentCount = result.sentCount;
        failedCount = result.failedCount;
        simulated = result.simulated;
        recipientsList = result.recipients;
      } else {
        sentCount = audience.recipients.length;
        recipientsList = audience.recipients.map((r) => ({
          email: r.email,
          name: r.name,
          status: "logged",
        }));
      }
    }

    // 3. Create Message record in database
    const msg = await prisma.message.create({
      data: {
        ...(event?.id ? { event: { connect: { id: event.id } } } : {}),
        target: normTarget,
        subject: subject || "Retreat update",
        body: body || null,
        sent: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        status: failedCount > 0 && sentCount === 0 ? "Failed" : "Sent",
        recipientCount: sentCount,
        recipientsJson: JSON.stringify(recipientsList),
      },
    });

    return NextResponse.json({
      success: true,
      message: msg,
      delivery: {
        target: normTarget,
        sentCount,
        failedCount,
        simulated,
        totalRecipients: recipientsList.length,
        recipients: recipientsList,
      },
    });
  } catch (err: any) {
    console.error("[POST /api/messages error]:", err);
    return NextResponse.json({ error: err?.message || "Failed to send message" }, { status: 500 });
  }
}

// -------------------------------------------------------------
// Helper: Get Families for event with fallback
// -------------------------------------------------------------
async function getFamiliesForEvent(eventId: string) {
  let families = await prisma.family.findMany({
    where: { eventId },
    include: { registration: true, payments: true },
  });

  if (families.length === 0) {
    families = await prisma.family.findMany({
      where: { eventId: "seed-event-1" },
      include: { registration: true, payments: true },
    });
  }

  return families;
}

// -------------------------------------------------------------
// Helper: Resolve Audience for segments
// -------------------------------------------------------------
async function resolveAudience(event: any, target: string): Promise<{ recipients: Recipient[] }> {
  const families = await getFamiliesForEvent(event.id);
  const recipients: Recipient[] = [];
  const addedEmails = new Set<string>();

  const add = (fam: any) => {
    if (fam.email && fam.email.includes("@") && !addedEmails.has(fam.email.toLowerCase())) {
      addedEmails.add(fam.email.toLowerCase());
      recipients.push({
        email: fam.email,
        name: fam.leader,
        familyName: fam.name,
      });
    }
  };

  const norm = target.toLowerCase();

  if (norm.includes("all") || norm.includes("registered")) {
    families.forEach(add);
  } else if (norm.includes("confirmed")) {
    families.filter((f) => f.status === "Confirmed").forEach(add);
  } else if (norm.includes("waitlist")) {
    families.filter((f) => f.status === "Waitlist" || f.registration?.status === "Waitlist").forEach(add);
  } else if (norm.includes("balance") || norm.includes("pending payment")) {
    const pricePerAdult = event.pricePerAdult ?? 120;
    const pricePerChild = event.pricePerChild ?? 60;
    families
      .filter((f) => {
        const totalFee = f.adults * pricePerAdult + f.children * pricePerChild;
        const paid = f.payments?.filter((p: any) => p.status === "Paid").reduce((s: number, p: any) => s + p.amount, 0) || 0;
        return totalFee - paid > 0 || (f.registration && f.registration.balance > 0);
      })
      .forEach(add);
  } else if (norm.includes("incomplete")) {
    families
      .filter((f) => (f.registration && f.registration.completeness < 100) || (f.registration && !f.registration.waiver))
      .forEach(add);
  } else {
    // Specific family name match
    const matching = families.filter((f) => f.name.toLowerCase().includes(norm));
    if (matching.length > 0) {
      matching.forEach(add);
    } else {
      // Fallback: all families
      families.forEach(add);
    }
  }

  return { recipients };
}
