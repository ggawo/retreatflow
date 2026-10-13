import nodemailer from "nodemailer";

export interface Recipient {
  email: string;
  name?: string;
  familyName?: string;
}

export interface EmailSendResult {
  total: number;
  sentCount: number;
  failedCount: number;
  simulated: boolean;
  recipients: Array<{ email: string; name?: string; status: "sent" | "failed" | "simulated"; error?: string }>;
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT) || 587;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function getFromAddress(): string {
  return (
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    `"RetreatFlow" <${process.env.SMTP_USER || "noreply@retreatflow.com"}>`
  );
}

export async function verifySmtpConnection(): Promise<{ connected: boolean; host?: string; user?: string; error?: string }> {
  const transporter = getTransporter();
  if (!transporter) {
    return { connected: false, error: "SMTP credentials not configured" };
  }
  try {
    await transporter.verify();
    return {
      connected: true,
      host: process.env.SMTP_HOST,
      user: process.env.SMTP_USER,
    };
  } catch (err: any) {
    return {
      connected: false,
      host: process.env.SMTP_HOST,
      error: err?.message || "Failed to verify SMTP",
    };
  }
}

async function sendSingleEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; messageId?: string; simulated: boolean; error?: string }> {
  const transporter = getTransporter();
  const from = getFromAddress();

  // If address is RFC 2606 documentation domain (@example.com, @example.org, @example.net)
  const isDocDomain = /@(example\.(com|org|net)|test\.invalid)$/i.test(to.trim());
  if (isDocDomain) {
    console.log(`[Email] Simulated delivery for documentation address: ${to}`);
    return { sent: true, simulated: true };
  }

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });
      console.log(`[Email] Delivered to ${to} (${info.messageId})`);
      return { sent: true, messageId: info.messageId, simulated: false };
    } catch (err: any) {
      console.error(`[Email] Failed to send to ${to}:`, err);
      return { sent: false, error: err?.message, simulated: false };
    }
  }

  // Local development / console fallback simulation
  console.log("=================================================");
  console.log(`✉️ [SIMULATED EMAIL DISPATCH]`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body Snippet: ${text.slice(0, 150)}...`);
  console.log("=================================================");
  return { sent: true, simulated: true };
}

// -------------------------------------------------------------
// HTML Branded Email Template Generator
// -------------------------------------------------------------
function buildEmailHtml({
  subtitle,
  eventName,
  organizationName,
  heading,
  greeting,
  bodyHtml,
  highlightCardHtml,
  actionButtonHtml,
  footerNote,
}: {
  subtitle: string;
  eventName: string;
  organizationName?: string;
  heading: string;
  greeting?: string;
  bodyHtml: string;
  highlightCardHtml?: string;
  actionButtonHtml?: string;
  footerNote?: string;
}): string {
  const brandSub = [eventName, organizationName].filter(Boolean).join(" · ") || "Retreat Management";
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${heading}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 36px 12px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.35);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 32px 36px; text-align: left;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <div style="font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                            Retreat<span style="color: #818cf8;">Flow</span>
                          </div>
                          <div style="font-size: 13px; color: #c7d2fe; margin-top: 4px; font-weight: 500;">
                            ${brandSub} · ${subtitle}
                          </div>
                        </td>
                        <td align="right" valign="middle">
                          <span style="display: inline-block; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                            Official Notice
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Content Area -->
                <tr>
                  <td style="padding: 36px;">
                    <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                      ${heading}
                    </h2>

                    ${
                      greeting
                        ? `<p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
                            ${greeting}
                          </p>`
                        : ""
                    }

                    <div style="font-size: 14px; line-height: 1.7; color: #475569;">
                      ${bodyHtml}
                    </div>

                    ${highlightCardHtml ? `<div style="margin: 24px 0;">${highlightCardHtml}</div>` : ""}

                    ${actionButtonHtml ? `<div style="margin: 28px 0 16px; text-align: center;">${actionButtonHtml}</div>` : ""}

                    <div style="border-top: 1px solid #e2e8f0; padding-top: 18px; margin-top: 28px; font-size: 12px; color: #64748b; line-height: 1.6;">
                      ${footerNote || "Thank you for using RetreatFlow for your retreat operations. If you have questions, please reach out to support or your coordinator."}
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 20px 36px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; line-height: 1.6;">
                    <div style="font-weight: 700; color: #64748b; margin-bottom: 2px;">Powered by RetreatFlow</div>
                    Modern Retreat, Camp & Event Management Platform
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

// -------------------------------------------------------------
// 1. Password Reset Email (Preserved)
// -------------------------------------------------------------
export async function sendPasswordResetEmail({
  toEmail,
  userName,
  passcode,
  eventName = "RetreatFlow",
}: {
  toEmail: string;
  userName?: string | null;
  passcode: string;
  eventName?: string;
}): Promise<{ sent: boolean; messageId?: string; simulated?: boolean }> {
  const htmlContent = buildEmailHtml({
    subtitle: "Password Verification",
    eventName,
    heading: "Reset Your Password",
    greeting: `Hello ${userName ? `<strong>${userName}</strong>` : "there"},`,
    bodyHtml: `
      <p style="margin: 0 0 16px;">We received a request to change your RetreatFlow admin account password. Use the verification passcode below to complete your password reset:</p>
    `,
    highlightCardHtml: `
      <div style="background-color: #f1f5f9; border: 2px dashed #6366f1; border-radius: 12px; padding: 20px; text-align: center;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #4338ca; margin-bottom: 8px;">
          Your 6-Digit Verification Passcode
        </div>
        <div style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #1e1b4b; font-family: 'Courier New', Courier, monospace;">
          ${passcode}
        </div>
        <div style="font-size: 12px; color: #64748b; margin-top: 8px;">
          ⏱️ Valid for the next <strong>15 minutes</strong>
        </div>
      </div>
    `,
    footerNote: "🔒 <strong>Security Note:</strong> If you did not request a password reset, you can safely ignore this email. Your current password remains unchanged.",
  });

  const textContent = `RetreatFlow Password Reset\n\nYour 6-digit verification passcode is: ${passcode}\n\nThis code is valid for 15 minutes.\n\nIf you did not request a password reset, please ignore this email.`;

  return sendSingleEmail({
    to: toEmail,
    subject: `[RetreatFlow] Password Reset Passcode: ${passcode}`,
    html: htmlContent,
    text: textContent,
  });
}

// -------------------------------------------------------------
// 2. Broadcast / Segmented Communications Email
// -------------------------------------------------------------
export interface Recipient {
  email: string;
  name?: string;
  familyName?: string;
  balance?: number;
}

export function replaceMergeTags(
  text: string,
  recipient: { name?: string; familyName?: string; email?: string; balance?: number },
  context: { eventName: string; location?: string; dates?: string }
): string {
  if (!text) return "";
  let out = text;
  const name = recipient.name || recipient.familyName || "Friend";
  const family = recipient.familyName || recipient.name || "Family";
  const event = context.eventName || "Retreat";
  const dates = context.dates || "";
  const location = context.location || "";
  const balance = recipient.balance !== undefined ? `$${recipient.balance}` : "$0";
  const email = recipient.email || "";

  out = out.replace(/\{\{\s*name\s*\}\}|\{\s*name\s*\}/gi, name);
  out = out.replace(/\{\{\s*family\s*\}\}|\{\s*family\s*\}/gi, family);
  out = out.replace(/\{\{\s*event\s*\}\}|\{\s*event\s*\}/gi, event);
  out = out.replace(/\{\{\s*dates\s*\}\}|\{\s*dates\s*\}/gi, dates);
  out = out.replace(/\{\{\s*location\s*\}\}|\{\s*location\s*\}/gi, location);
  out = out.replace(/\{\{\s*balance\s*\}\}|\{\s*balance\s*\}/gi, balance);
  out = out.replace(/\{\{\s*email\s*\}\}|\{\s*email\s*\}/gi, email);

  return out;
}

// -------------------------------------------------------------
// 2. Broadcast & Custom Email Dispatch
// -------------------------------------------------------------
export async function sendAnnouncementEmail({
  recipients,
  subject,
  body,
  eventName = "RetreatFlow",
  organizationName,
  location,
  dates,
  buttonText,
  buttonUrl,
  calloutNote,
}: {
  recipients: Recipient[];
  subject: string;
  body: string;
  eventName?: string;
  organizationName?: string;
  location?: string;
  dates?: string;
  buttonText?: string | null;
  buttonUrl?: string | null;
  calloutNote?: string | null;
}): Promise<EmailSendResult> {
  const result: EmailSendResult = {
    total: recipients.length,
    sentCount: 0,
    failedCount: 0,
    simulated: false,
    recipients: [],
  };

  for (const recipient of recipients) {
    if (!recipient.email || !recipient.email.includes("@")) {
      result.failedCount++;
      result.recipients.push({
        email: recipient.email || "unknown",
        name: recipient.name,
        status: "failed",
        error: "Invalid email address",
      });
      continue;
    }

    const personalizedSubject = replaceMergeTags(subject, recipient, { eventName, location, dates });
    const personalizedBody = replaceMergeTags(body, recipient, { eventName, location, dates });
    const personalizedCallout = calloutNote
      ? replaceMergeTags(calloutNote, recipient, { eventName, location, dates })
      : null;

    const formattedBodyHtml = personalizedBody
      .split("\n\n")
      .map((p) => `<p style="margin: 0 0 14px 0;">${p.replace(/\n/g, "<br/>")}</p>`)
      .join("");

    const greeting = recipient.name
      ? `Dear <strong>${recipient.name}</strong>,`
      : recipient.familyName
      ? `Dear <strong>${recipient.familyName}</strong>,`
      : "Dear Participant,";

    const highlightCardHtml = [
      personalizedCallout
        ? `
        <div style="background-color: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 14px 18px; margin-bottom: 12px; font-size: 13px; color: #166534;">
          <strong>Notice:</strong> ${personalizedCallout}
        </div>
      `
        : "",
      dates || location
        ? `
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 18px; font-size: 13px; color: #475569;">
          ${dates ? `<div>📅 <strong>Dates:</strong> ${dates}</div>` : ""}
          ${location ? `<div style="margin-top: 4px;">📍 <strong>Location:</strong> ${location}</div>` : ""}
        </div>
      `
        : "",
    ].filter(Boolean).join("");

    const actionButtonHtml =
      buttonText && buttonUrl
        ? `
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">
              <a href="${buttonUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
                ${buttonText}
              </a>
            </td>
          </tr>
        </table>
      `
        : undefined;

    const htmlContent = buildEmailHtml({
      subtitle: "Official Notice",
      eventName,
      organizationName,
      heading: personalizedSubject,
      greeting,
      bodyHtml: formattedBodyHtml,
      highlightCardHtml: highlightCardHtml || undefined,
      actionButtonHtml,
    });

    const singleRes = await sendSingleEmail({
      to: recipient.email,
      subject: `[${eventName}] ${personalizedSubject}`,
      html: htmlContent,
      text: `${personalizedSubject}\n\n${personalizedBody}\n\nEvent: ${eventName}${dates ? `\nDates: ${dates}` : ""}${location ? `\nLocation: ${location}` : ""}`,
    });

    if (singleRes.sent) {
      result.sentCount++;
      if (singleRes.simulated) result.simulated = true;
      result.recipients.push({
        email: recipient.email,
        name: recipient.name || recipient.familyName,
        status: singleRes.simulated ? "simulated" : "sent",
      });
    } else {
      result.failedCount++;
      result.recipients.push({
        email: recipient.email,
        name: recipient.name || recipient.familyName,
        status: "failed",
        error: singleRes.error,
      });
    }

    // Brief delay between sends to prevent throttling
    await new Promise((r) => setTimeout(r, 60));
  }

  return result;
}

export function renderEmailPreview({
  subject,
  body,
  recipientName = "Abebe Family",
  familyName = "Abebe Family",
  eventName = "2026 Family Summer Retreat",
  organizationName,
  dates = "July 24–26, 2026",
  location = "Camp Hope",
  buttonText,
  buttonUrl,
  calloutNote,
}: {
  subject: string;
  body: string;
  recipientName?: string;
  familyName?: string;
  eventName?: string;
  organizationName?: string;
  dates?: string;
  location?: string;
  buttonText?: string | null;
  buttonUrl?: string | null;
  calloutNote?: string | null;
}): string {
  const dummyRecipient = { name: recipientName, familyName, balance: 120, email: "attendee@example.com" };
  const personalizedSubject = replaceMergeTags(subject || "Your Event Announcement", dummyRecipient, { eventName, location, dates });
  const personalizedBody = replaceMergeTags(body || "Your message text here...", dummyRecipient, { eventName, location, dates });
  const personalizedCallout = calloutNote
    ? replaceMergeTags(calloutNote, dummyRecipient, { eventName, location, dates })
    : null;

  const formattedBodyHtml = personalizedBody
    .split("\n\n")
    .map((p) => `<p style="margin: 0 0 14px 0;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const highlightCardHtml = [
    personalizedCallout
      ? `
      <div style="background-color: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 14px 18px; margin-bottom: 12px; font-size: 13px; color: #166534;">
        <strong>Notice:</strong> ${personalizedCallout}
      </div>
    `
      : "",
    dates || location
      ? `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 18px; font-size: 13px; color: #475569;">
        ${dates ? `<div>📅 <strong>Dates:</strong> ${dates}</div>` : ""}
        ${location ? `<div style="margin-top: 4px;">📍 <strong>Location:</strong> ${location}</div>` : ""}
      </div>
    `
      : "",
  ].filter(Boolean).join("");

  const actionButtonHtml =
    buttonText && buttonUrl
      ? `
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center">
            <span style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
              ${buttonText}
            </span>
          </td>
        </tr>
      </table>
    `
      : undefined;

  return buildEmailHtml({
    subtitle: "Official Notice",
    eventName,
    organizationName,
    heading: personalizedSubject,
    greeting: `Dear <strong>${recipientName}</strong>,`,
    bodyHtml: formattedBodyHtml,
    highlightCardHtml: highlightCardHtml || undefined,
    actionButtonHtml,
  });
}

// -------------------------------------------------------------
// 3. Balance Due Reminder Email
// -------------------------------------------------------------
export async function sendBalanceReminderEmail({
  recipientEmail,
  recipientName,
  familyName,
  amountDue,
  totalCost,
  amountPaid,
  dueDate,
  eventName = "RetreatFlow",
  location,
  dates,
  customNote,
}: {
  recipientEmail: string;
  recipientName?: string;
  familyName: string;
  amountDue: number;
  totalCost?: number;
  amountPaid?: number;
  dueDate?: string | null;
  eventName?: string;
  location?: string;
  dates?: string;
  customNote?: string;
}): Promise<{ sent: boolean; simulated: boolean; error?: string }> {
  const greeting = recipientName
    ? `Dear <strong>${recipientName}</strong> (${familyName}),`
    : `Dear <strong>${familyName}</strong>,`;

  const highlightCardHtml = `
    <div style="background-color: #fef2f2; border: 1.5px solid #fecaca; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #fee2e2; padding-bottom: 12px; margin-bottom: 12px;">
        <span style="font-size: 13px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">Outstanding Balance</span>
        <span style="font-size: 26px; font-weight: 900; color: #b91c1c;">$${amountDue.toLocaleString()}</span>
      </div>
      <table width="100%" cellpadding="4" cellspacing="0" style="font-size: 13px; color: #4b5563;">
        ${totalCost !== undefined ? `<tr><td style="color: #6b7280;">Total Registration Fee:</td><td align="right" style="font-weight: 600;">$${totalCost.toLocaleString()}</td></tr>` : ""}
        ${amountPaid !== undefined ? `<tr><td style="color: #6b7280;">Amount Already Paid:</td><td align="right" style="font-weight: 600; color: #15803d;">$${amountPaid.toLocaleString()}</td></tr>` : ""}
        ${dueDate ? `<tr><td style="color: #6b7280;">Payment Due Date:</td><td align="right" style="font-weight: 700; color: #b91c1c;">${dueDate}</td></tr>` : ""}
        ${dates ? `<tr><td style="color: #6b7280;">Retreat Dates:</td><td align="right;">${dates}</td></tr>` : ""}
        ${location ? `<tr><td style="color: #6b7280;">Location:</td><td align="right;">${location}</td></tr>` : ""}
      </table>
    </div>
  `;

  const bodyHtml = `
    <p style="margin: 0 0 14px 0;">This is a friendly reminder regarding your outstanding balance for the upcoming <strong>${eventName}</strong>.</p>
    <p style="margin: 0 0 14px 0;">To ensure your lodging reservation and meal arrangements are finalized without disruption, please settle your remaining balance prior to the due date.</p>
    ${customNote ? `<div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #1e40af;"><strong>Note from Organizer:</strong> ${customNote}</div>` : ""}
    <p style="margin: 0 0 14px 0; font-size: 13px; color: #64748b;">
      <strong>Accepted Payment Methods:</strong> Card, Check, ACH, or Cash at check-in. If you have already submitted payment recently, please notify us so we can mark your record as completed.
    </p>
  `;

  const subject = `[${eventName}] Balance Due Reminder for ${familyName} ($${amountDue})`;
  const text = `Dear ${recipientName || familyName},\n\nThis is a friendly reminder that you have an open balance of $${amountDue} for ${eventName}.\n\nDue Date: ${dueDate || "Before retreat start"}\n\nAccepted methods: Card, Check, ACH, Cash.`;

  return sendSingleEmail({
    to: recipientEmail,
    subject,
    html: buildEmailHtml({
      subtitle: "Payment Follow-up",
      eventName,
      heading: "Retreat Balance Reminder",
      greeting,
      bodyHtml,
      highlightCardHtml,
      footerNote: "If you have already paid this balance or have financial arrangement questions, please reach out directly to the retreat organizers.",
    }),
    text,
  });
}

// -------------------------------------------------------------
// 4. Incomplete Registration Reminder Email
// -------------------------------------------------------------
export async function sendIncompleteRegistrationEmail({
  recipientEmail,
  recipientName,
  familyName,
  completeness,
  hasWaiver,
  deadline,
  eventName = "RetreatFlow",
  location,
  dates,
  customNote,
}: {
  recipientEmail: string;
  recipientName?: string;
  familyName: string;
  completeness: number;
  hasWaiver: boolean;
  deadline?: string | null;
  eventName?: string;
  location?: string;
  dates?: string;
  customNote?: string;
}): Promise<{ sent: boolean; simulated: boolean; error?: string }> {
  const greeting = recipientName
    ? `Dear <strong>${recipientName}</strong> (${familyName}),`
    : `Dear <strong>${familyName}</strong>,`;

  const missingItems: string[] = [];
  if (!hasWaiver) missingItems.push("✍️ Signed Liability & Health Waiver Form");
  if (completeness < 100) missingItems.push("📋 Incomplete attendee details or room preferences");

  const highlightCardHtml = `
    <div style="background-color: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #fef3c7; padding-bottom: 12px; margin-bottom: 12px;">
        <span style="font-size: 13px; font-weight: 700; color: #92400e; text-transform: uppercase;">Registration Status</span>
        <span style="font-size: 18px; font-weight: 800; color: #b45309;">${completeness}% Complete</span>
      </div>
      <div style="font-size: 13px; color: #78350f; font-weight: 600; margin-bottom: 8px;">Action Required Items:</div>
      <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #92400e; line-height: 1.6;">
        ${missingItems.map((item) => `<li>${item}</li>`).join("")}
      </ul>
      ${deadline ? `<div style="margin-top: 12px; font-size: 12px; color: #b45309;">⏰ <strong>Registration Deadline:</strong> ${deadline}</div>` : ""}
    </div>
  `;

  const bodyHtml = `
    <p style="margin: 0 0 14px 0;">We noticed that your family registration for <strong>${eventName}</strong> has incomplete items requiring your confirmation.</p>
    <p style="margin: 0 0 14px 0;">Completing these details helps our planning committee assign appropriate room lodging, accommodate dietary restrictions, and prepare materials in advance.</p>
    ${customNote ? `<div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #1e40af;"><strong>Note:</strong> ${customNote}</div>` : ""}
  `;

  const subject = `[${eventName}] Action Required: Incomplete Registration for ${familyName}`;
  const text = `Dear ${recipientName || familyName},\n\nPlease complete your registration for ${eventName}.\n\nStatus: ${completeness}% complete.\nMissing items:\n${missingItems.join("\n")}\n\nDeadline: ${deadline || "Upcoming"}`;

  return sendSingleEmail({
    to: recipientEmail,
    subject,
    html: buildEmailHtml({
      subtitle: "Registration Action Required",
      eventName,
      heading: "Complete Your Registration",
      greeting,
      bodyHtml,
      highlightCardHtml,
      footerNote: "Please complete these items soon so your family's room and schedule are confirmed.",
    }),
    text,
  });
}

// -------------------------------------------------------------
// 5. Volunteer Shift Reminder Email
// -------------------------------------------------------------
export async function sendVolunteerShiftEmail({
  recipientEmail,
  volunteerName,
  role,
  shift,
  date,
  skills,
  eventName = "RetreatFlow",
  location,
}: {
  recipientEmail: string;
  volunteerName: string;
  role: string;
  shift: string;
  date: string;
  skills?: string | null;
  eventName?: string;
  location?: string;
}): Promise<{ sent: boolean; simulated: boolean; error?: string }> {
  const highlightCardHtml = `
    <div style="background-color: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <div style="font-size: 13px; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 8px;">Volunteer Shift Details</div>
      <table width="100%" cellpadding="4" cellspacing="0" style="font-size: 13px; color: #374151;">
        <tr><td style="color: #6b7280;">Assigned Role:</td><td align="right" style="font-weight: 700; color: #15803d;">${role}</td></tr>
        <tr><td style="color: #6b7280;">Date:</td><td align="right; font-weight: 600;">${date}</td></tr>
        <tr><td style="color: #6b7280;">Shift Time:</td><td align="right; font-weight: 600;">${shift}</td></tr>
        ${skills ? `<tr><td style="color: #6b7280;">Focus / Area:</td><td align="right;">${skills}</td></tr>` : ""}
        ${location ? `<tr><td style="color: #6b7280;">Location:</td><td align="right;">${location}</td></tr>` : ""}
      </table>
    </div>
  `;

  const bodyHtml = `
    <p style="margin: 0 0 14px 0;">Thank you for serving at <strong>${eventName}</strong>! Here are the details of your confirmed volunteer shift:</p>
    <p style="margin: 0 0 14px 0;">Please check in with your ministry team lead 10 minutes prior to your shift start time.</p>
  `;

  const subject = `[${eventName}] Volunteer Shift Details: ${role} (${date})`;
  const text = `Dear ${volunteerName},\n\nThank you for volunteering at ${eventName}!\n\nRole: ${role}\nDate: ${date}\nShift: ${shift}\n${skills ? `Focus: ${skills}\n` : ""}`;

  return sendSingleEmail({
    to: recipientEmail,
    subject,
    html: buildEmailHtml({
      subtitle: "Volunteer Coordination",
      eventName,
      heading: "Your Volunteer Shift Confirmation",
      greeting: `Dear <strong>${volunteerName}</strong>,`,
      bodyHtml,
      highlightCardHtml,
      footerNote: "If you have a schedule conflict, please notify your team coordinator as early as possible so we can arrange coverage.",
    }),
    text,
  });
}

// -------------------------------------------------------------
// 6. Admin Welcome & Onboarding Email (New Tenant Onboarding)
// -------------------------------------------------------------
export async function sendAdminWelcomeEmail({
  adminEmail,
  adminName,
  organizationName,
  organizationType,
  retreatName,
  retreatDates,
  location,
  planTier = "RetreatFlow Event Pass (Free Dev & Launch Mode)",
  dashboardUrl = "http://localhost:3000",
}: {
  adminEmail: string;
  adminName?: string | null;
  organizationName?: string | null;
  organizationType?: string | null;
  retreatName: string;
  retreatDates?: string | null;
  location?: string | null;
  planTier?: string;
  dashboardUrl?: string;
}): Promise<{ sent: boolean; messageId?: string; simulated: boolean; error?: string }> {
  const highlightCardHtml = `
    <div style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 22px; margin: 20px 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px;">
        <span style="font-size: 12px; font-weight: 700; color: #4338ca; text-transform: uppercase; letter-spacing: 0.5px;">Retreat Setup Summary</span>
        <span style="display: inline-block; background: #e0e7ff; color: #3730a3; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px;">Active Workspace</span>
      </div>
      <table width="100%" cellpadding="4" cellspacing="0" style="font-size: 13px; color: #334155;">
        <tr><td style="color: #64748b; width: 140px;">Retreat Name:</td><td style="font-weight: 700; color: #0f172a;">${retreatName}</td></tr>
        ${organizationName ? `<tr><td style="color: #64748b;">Organization:</td><td style="font-weight: 600;">${organizationName} ${organizationType ? `(${organizationType})` : ""}</td></tr>` : ""}
        ${retreatDates ? `<tr><td style="color: #64748b;">Dates:</td><td style="font-weight: 600;">${retreatDates}</td></tr>` : ""}
        ${location ? `<tr><td style="color: #64748b;">Venue Location:</td><td style="font-weight: 600;">${location}</td></tr>` : ""}
        <tr><td style="color: #64748b;">Platform Plan:</td><td style="font-weight: 700; color: #166534;">${planTier}</td></tr>
      </table>
    </div>
  `;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
      Welcome to <strong>RetreatFlow</strong>! Your administrator account has been created and your retreat workspace is active and ready for coordination.
    </p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin: 18px 0;">
      <div style="font-size: 14px; font-weight: 700; color: #166534; margin-bottom: 8px;">🚀 4-Step Quick Start Checklist:</div>
      <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #15803d; line-height: 1.8;">
        <li><strong>Set Up Housing & Buildings:</strong> Visit <em>Room Assignment</em> to define your dorms, cabins, and bed capacities.</li>
        <li><strong>Open or Import Registration:</strong> Go to <em>Registration</em> to upload existing rosters via CSV or record registrations directly.</li>
        <li><strong>Configure Pricing & Balances:</strong> Review <em>Settings</em> to adjust adult/child fee schedules and track incoming payments.</li>
        <li><strong>Send Branded Communications:</strong> Use <em>Communications</em> to broadcast custom schedules, reminders, and notices with dynamic merge tags.</li>
      </ol>
    </div>
  `;

  const actionButtonHtml = `
    <a href="${dashboardUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);">
      Launch Your Retreat Dashboard →
    </a>
  `;

  const subject = `Welcome to RetreatFlow — Your ${retreatName} Workspace is Ready!`;
  const text = `Hello ${adminName || "Organizer"},\n\nWelcome to RetreatFlow!\n\nYour retreat workspace "${retreatName}" is ready.\n\nSummary:\n- Retreat: ${retreatName}\n- Organization: ${organizationName || "N/A"}\n- Dates: ${retreatDates || "Upcoming"}\n- Location: ${location || "N/A"}\n\nAccess your dashboard at: ${dashboardUrl}\n\nBest regards,\nThe RetreatFlow Team`;

  return sendSingleEmail({
    to: adminEmail,
    subject,
    html: buildEmailHtml({
      subtitle: "Welcome & Getting Started",
      eventName: retreatName,
      organizationName: organizationName || undefined,
      heading: `Welcome to RetreatFlow, ${adminName || "Organizer"}!`,
      greeting: `Hello <strong>${adminName || "Retreat Coordinator"}</strong>,`,
      bodyHtml,
      highlightCardHtml,
      actionButtonHtml,
      footerNote: "Need assistance setting up your retreat? Reply directly to this email or reach out to your RetreatFlow onboarding team.",
    }),
    text,
  });
}

// -------------------------------------------------------------
// 7. Attendee Self-Registration Confirmation Email
// -------------------------------------------------------------
export async function sendRegistrationConfirmationEmail({
  attendeeEmail,
  attendeeName,
  retreatName,
  organizationName,
  retreatDates,
  location,
  adultsCount = 0,
  childrenCount = 0,
  totalAmount = 0,
  balanceDue = 0,
  dueDate,
  registrationRef,
  isPaid = false,
  isConfirmed = false,
}: {
  attendeeEmail: string;
  attendeeName: string;
  retreatName: string;
  organizationName?: string | null;
  retreatDates?: string | null;
  location?: string | null;
  adultsCount: number;
  childrenCount: number;
  totalAmount: number;
  balanceDue: number;
  dueDate?: string | null;
  registrationRef?: string;
  isPaid?: boolean;
  isConfirmed?: boolean;
}): Promise<{ sent: boolean; messageId?: string; simulated: boolean; error?: string }> {
  const refCode = registrationRef || `REQ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const statusBadge = isPaid && isConfirmed 
    ? `<span style="display: inline-block; background: #dcfce7; color: #166534; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px;">✓ Confirmed & Paid</span>`
    : `<span style="display: inline-block; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px;">⏳ Pending Payment</span>`;

  const highlightCardHtml = `
    <div style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 22px; margin: 20px 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px;">
        <span style="font-size: 12px; font-weight: 700; color: #4338ca; text-transform: uppercase; letter-spacing: 0.5px;">Registration Request</span>
        ${statusBadge}
      </div>
      <table width="100%" cellpadding="4" cellspacing="0" style="font-size: 13px; color: #334155;">
        <tr><td style="color: #64748b; width: 140px;">Request Ref:</td><td style="font-weight: 700; color: #0f172a;">#${refCode}</td></tr>
        <tr><td style="color: #64748b;">Primary Contact:</td><td style="font-weight: 700; color: #0f172a;">${attendeeName}</td></tr>
        <tr><td style="color: #64748b;">Retreat:</td><td style="font-weight: 600;">${retreatName}</td></tr>
        ${organizationName ? `<tr><td style="color: #64748b;">Hosted By:</td><td style="font-weight: 600;">${organizationName}</td></tr>` : ""}
        ${retreatDates ? `<tr><td style="color: #64748b;">Dates:</td><td style="font-weight: 600;">${retreatDates}</td></tr>` : ""}
        ${location ? `<tr><td style="color: #64748b;">Location:</td><td style="font-weight: 600;">${location}</td></tr>` : ""}
        <tr><td style="color: #64748b;">Party Size:</td><td style="font-weight: 600;">${adultsCount} Adult${adultsCount === 1 ? "" : "s"}${childrenCount > 0 ? `, ${childrenCount} Child${childrenCount === 1 ? "" : "ren"}` : ""}</td></tr>
        <tr><td style="color: #64748b;">Total Fee:</td><td style="font-weight: 700; color: #0f172a;">$${totalAmount.toFixed(2)}</td></tr>
        <tr><td style="color: #64748b;">Balance Due:</td><td style="font-weight: 700; color: ${balanceDue > 0 ? '#b91c1c' : '#166534'};">$${balanceDue.toFixed(2)} ${dueDate ? `(Due: ${dueDate})` : ""}</td></tr>
      </table>
    </div>
  `;

  const bodyHtml = isPaid && isConfirmed ? `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
      Thank you! Your registration for <strong>${retreatName}</strong> has been fully confirmed and paid.
    </p>
  ` : `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">
      Thank you for submitting your registration for <strong>${retreatName}</strong>! Your registration details have been received and recorded.
    </p>
    <div style="background-color: #fffbeb; border: 1.5px solid #fef3c7; border-radius: 10px; padding: 16px; margin: 18px 0;">
      <div style="font-size: 14px; font-weight: 700; color: #92400e; margin-bottom: 6px;">🔒 Check-in Pass Locked: Payment Confirmation Required</div>
      <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.6;">
        Your scannable check-in QR code and official retreat boarding pass will be issued <strong>after your payment of $${balanceDue.toFixed(2)} is received and confirmed</strong> by retreat coordinators. Please retain this email and request reference <strong>#${refCode}</strong> for your records.
      </p>
    </div>
  `;

  const subject = isPaid && isConfirmed 
    ? `Confirmed: Your Registration for ${retreatName} (#${refCode})`
    : `Registration Received (Pending Payment): ${retreatName} (#${refCode})`;

  const text = `Hello ${attendeeName},\n\nYour registration request for ${retreatName} has been received.\n\nReference: #${refCode}\nRetreat: ${retreatName}\nDates: ${retreatDates || "Upcoming"}\nParty: ${adultsCount} Adults, ${childrenCount} Children\nTotal Fee: $${totalAmount.toFixed(2)}\nBalance Due: $${balanceDue.toFixed(2)}\n\nNote: Your Check-in Pass and QR Code will be unlocked once payment is confirmed by organizers.\n\nBest regards,\n${organizationName || "RetreatFlow"}`;

  return sendSingleEmail({
    to: attendeeEmail,
    subject,
    html: buildEmailHtml({
      subtitle: isPaid && isConfirmed ? "Registration Confirmed" : "Registration Received — Pending Payment",
      eventName: retreatName,
      organizationName: organizationName || undefined,
      heading: isPaid && isConfirmed ? "Registration Confirmed!" : "Registration Request Received",
      greeting: `Hello <strong>${attendeeName}</strong>,`,
      bodyHtml,
      highlightCardHtml,
      footerNote: "Questions about your balance or lodging? Contact your retreat coordinator directly.",
    }),
    text,
  });
}


