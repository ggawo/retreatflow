"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import QRCode from "qrcode";

interface PublicRegisterClientProps {
  event: any;
}

interface Member {
  name: string;
  role: "Adult" | "Child" | "Infant";
  age?: string;
  dietary?: string;
}

export default function PublicRegisterClient({ event }: PublicRegisterClientProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Access Passcode Gate State (Protects against unwelcome registrations)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(!event.hasAccessCodeProtection);
  const [accessCodeInput, setAccessCodeInput] = useState<string>("");
  const [verifiedAccessCode, setVerifiedAccessCode] = useState<string>("");
  const [verifyingGate, setVerifyingGate] = useState<boolean>(false);
  const [gateError, setGateError] = useState<string | null>(null);

  // Step 1: Contact
  const [leader, setLeader] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  // Step 2: Party Size & Members
  const [adults, setAdults] = useState<number>(1);
  const [children, setChildren] = useState<number>(0);
  const [nonPaying, setNonPaying] = useState<number>(0);
  const [members, setMembers] = useState<Member[]>([
    { name: "", role: "Adult", age: "", dietary: "" },
  ]);

  // Step 3: Housing & Dietary
  const [roomPref, setRoomPref] = useState("Cabin / Lodge");
  const [selectedDietTags, setSelectedDietTags] = useState<string[]>([]);
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [buddyRequest, setBuddyRequest] = useState("");
  const [access, setAccess] = useState("");
  const [notes, setNotes] = useState("");

  // Step 4: Waiver
  const [waiver, setWaiver] = useState(false);
  const [signature, setSignature] = useState("");

  // Step 5: Success Pass
  const [confirmedPass, setConfirmedPass] = useState<any | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Check URL query parameters for auto-unlock passcode (?code=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const queryCode = params.get("code") || params.get("pin");
    if (queryCode && event.hasAccessCodeProtection) {
      const clean = queryCode.trim().toUpperCase();
      setAccessCodeInput(clean);
      verifyAccessCode(clean);
    }
  }, [event.hasAccessCodeProtection]);

  const verifyAccessCode = async (codeToCheck: string) => {
    const clean = codeToCheck.trim().toUpperCase();
    if (!clean) {
      setGateError("Please enter the registration passcode.");
      return;
    }
    setVerifyingGate(true);
    setGateError(null);
    try {
      const res = await fetch("/api/public/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: event.slug, eventId: event.id, code: clean }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setVerifiedAccessCode(clean);
        setIsUnlocked(true);
        setGateError(null);
      } else {
        setGateError(data.error || "Incorrect passcode. Please request the invitation code from your retreat organizers.");
      }
    } catch {
      setGateError("Network connection issue while verifying code. Please try again.");
    } finally {
      setVerifyingGate(false);
    }
  };

  const handleGateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyAccessCode(accessCodeInput);
  };

  // Sync member rows when adult or child count changes
  useEffect(() => {
    const totalCount = Math.max(1, adults + children + nonPaying);
    setMembers((prev) => {
      const next: Member[] = [];
      for (let i = 0; i < totalCount; i++) {
        const isAdult = i < adults;
        const isChild = i >= adults && i < adults + children;
        const role: "Adult" | "Child" | "Infant" = isAdult ? "Adult" : isChild ? "Child" : "Infant";
        if (prev[i]) {
          next.push({ ...prev[i], role });
        } else {
          next.push({
            name: i === 0 ? leader : "",
            role,
            age: "",
            dietary: "",
          });
        }
      }
      return next;
    });
  }, [adults, children, nonPaying, leader]);

  // STRICT REQUIREMENT: Only generate QR code when BOTH isPaid and isConfirmed are true!
  // Never generate a check-in passcode or QR code following self-registration while payment is pending.
  useEffect(() => {
    if (confirmedPass?.isPaid && confirmedPass?.isConfirmed && confirmedPass?.familyId) {
      QRCode.toDataURL(
        `RETREATFLOW:FAM:${confirmedPass.familyId}`,
        { width: 240, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } },
        (err, url) => {
          if (!err && url) setQrDataUrl(url);
        }
      );
    } else {
      setQrDataUrl(null);
    }
  }, [confirmedPass]);

  // Pricing calculations
  const pricePerAdult = event.pricePerAdult ?? 120;
  const pricePerChild = event.pricePerChild ?? 60;
  const totalBalance = (adults * pricePerAdult) + (children * pricePerChild);

  const toggleDietTag = (tag: string) => {
    if (tag === "None") {
      setSelectedDietTags(["None"]);
      return;
    }
    setSelectedDietTags((prev) => {
      const filtered = prev.filter((t) => t !== "None");
      return filtered.includes(tag) ? filtered.filter((t) => t !== tag) : [...filtered, tag];
    });
  };

  const handleNextFromStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!leader.trim()) {
      setError("Please enter the primary contact / leader name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address to receive your confirmation pass.");
      return;
    }
    if (!familyName.trim()) {
      setFamilyName(`${leader.trim()} Group`);
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNextFromStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (adults < 1) {
      setError("There must be at least 1 registered adult.");
      return;
    }
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNextFromStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStep(4);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (event.requireWaiver && !waiver) {
      setError("Please accept the liability waiver and safety policies to complete registration.");
      return;
    }

    if (event.requireWaiver && !signature.trim()) {
      setError("Please enter your legal name as an electronic signature.");
      return;
    }

    setLoading(true);

    const compiledDietary = [
      ...selectedDietTags.filter((t) => t !== "None"),
      dietaryNotes.trim(),
    ].filter(Boolean).join(", ");

    try {
      const res = await fetch("/api/public/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: event.slug,
          eventId: event.id,
          accessCode: verifiedAccessCode || accessCodeInput.trim().toUpperCase(),
          name: familyName.trim() || `${leader.trim()} Family`,
          leader: leader.trim(),
          email: email.trim(),
          phone: phone.trim(),
          emergencyContact: emergencyContact.trim(),
          adults,
          children,
          nonPayingChildren: nonPaying,
          roomPref,
          access: access.trim(),
          buddyRequest: buddyRequest.trim(),
          dietary: compiledDietary,
          notes: notes.trim(),
          members,
          waiver,
          signature: signature.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit registration. Please try again.");
      } else {
        setConfirmedPass(data);
        setStep(5);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      setError("Network connection issue. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  };

  const isClosed = event.registrationMode === "ADMIN_ONLY";

  return (
    <div className="public-reg-wrapper">
      {/* Top Header */}
      <header className="public-reg-header">
        <div className="public-reg-header-inner">
          <div className="public-reg-brand">
            <Logo size={36} textSize="22px" href="/" priority />
            {event.organizationName && (
              <span className="public-org-badge">
                Hosted by {event.organizationName}
              </span>
            )}
          </div>
          <Link href="/login" className="public-admin-link">
            Organizer Sign In →
          </Link>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="public-reg-hero">
        <div className="public-reg-hero-content">
          <div className="public-badge-row">
            <span className="public-tag">Official Registration</span>
            <span className="public-dates-badge">📅 {event.date}</span>
          </div>
          <h1 className="public-hero-title">{event.name}</h1>
          <p className="public-hero-meta">
            📍 <strong>Location:</strong> {event.location || "Camp & Conference Center"}
            {event.registrationDeadline && (
              <> · ⏳ <strong>Deadline:</strong> {event.registrationDeadline}</>
            )}
          </p>
          {event.publicRegIntro ? (
            <p className="public-hero-intro">{event.publicRegIntro}</p>
          ) : (
            <p className="public-hero-intro">
              Welcome! Complete the form below to reserve your lodging, register your family or group, and receive your digital check-in pass.
            </p>
          )}
        </div>
      </section>

      {/* Main Body */}
      <main className="public-reg-main">
        {/* If Admin Only Mode */}
        {isClosed ? (
          <div className="public-card public-closed-card">
            <div className="public-closed-icon">🔒</div>
            <h2>Online Registration is Currently Closed</h2>
            <p>
              Registration for <strong>{event.name}</strong> is managed directly by the organizers at <strong>{event.organizationName || "the retreat committee"}</strong>.
            </p>
            <p style={{ color: "#64748b", fontSize: "14px", marginTop: "12px" }}>
              If you have questions about lodging, availability, or need to register, please contact your retreat coordinator.
            </p>
            <div style={{ marginTop: "24px" }}>
              <Link href="/login" className="btn primary" style={{ textDecoration: "none" }}>
                Admin & Organizer Portal
              </Link>
            </div>
          </div>
        ) : event.hasAccessCodeProtection && !isUnlocked ? (
          /* Passcode Gate Screen: Prevents uninvited registrations */
          <div className="public-card public-gate-card">
            <div className="gate-icon-circle">🔒</div>
            <div className="gate-badge">Invitation Only</div>
            <h2 style={{ fontSize: "24px", fontWeight: "900", color: "#0f172a", margin: "0 0 8px" }}>
              Private Retreat Registration
            </h2>
            <p style={{ color: "#64748b", fontSize: "14px", lineHeight: "1.5", margin: "0 0 20px" }}>
              Registration for <strong>{event.name}</strong> is restricted to invited participants. Please enter the invitation passcode provided by your retreat organizer to proceed.
            </p>

            {gateError && (
              <div className="public-error-alert" style={{ textAlign: "left", marginBottom: "16px" }}>
                ⚠️ {gateError}
              </div>
            )}

            <form onSubmit={handleGateSubmit} className="gate-input-box">
              <label className="public-label" style={{ textAlign: "center", display: "block", marginBottom: "8px" }}>
                Enter Invitation Passcode
              </label>
              <input
                type="text"
                className="input gate-pin-input"
                placeholder="e.g. RETREAT2026"
                value={accessCodeInput}
                onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                autoFocus
                required
              />
              <button
                type="submit"
                disabled={verifyingGate || !accessCodeInput.trim()}
                className="btn primary"
                style={{ width: "100%", marginTop: "14px", padding: "14px", fontWeight: 800, fontSize: "15px" }}
              >
                {verifyingGate ? "Verifying Code..." : "Unlock Registration Form →"}
              </button>
            </form>

            <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.5" }}>
              💡 <em>Did you receive a shareable link?</em> Links formatted with <code>?code=YOURCODE</code> unlock automatically. Contact your retreat coordinator if you need assistance.
            </div>
          </div>
        ) : step === 5 && confirmedPass ? (
          /* Step 5: Post-Registration Confirmation Screen */
          confirmedPass.isPaid && confirmedPass.isConfirmed ? (
            /* Condition A: Fully Paid & Confirmed Attendee -> Display Official Boarding Pass & QR Code */
            <div className="public-card public-pass-card">
              <div className="public-pass-badge">✓ Registration Confirmed & Paid</div>
              <h2 style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", margin: "10px 0 4px" }}>
                🎉 You're All Set, {leader}!
              </h2>
              <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 24px" }}>
                Your check-in boarding pass and receipt have been dispatched to <strong>{email}</strong>.
              </p>

              {/* Visual Pass Ticket */}
              <div className="public-ticket-container">
                <div className="public-ticket-header">
                  <div>
                    <span className="ticket-label">Retreat Boarding Pass</span>
                    <div className="ticket-event-name">{event.name}</div>
                    <div className="ticket-meta">{event.date} · {event.location}</div>
                  </div>
                  <div className="ticket-code-block">
                    <span className="ticket-code-label">Pass Reference</span>
                    <span className="ticket-code">{confirmedPass.confirmationCode || confirmedPass.passCode}</span>
                  </div>
                </div>

                <div className="public-ticket-body">
                  <div className="ticket-details">
                    <div className="ticket-row">
                      <span className="t-label">Primary Contact:</span>
                      <span className="t-val">{leader}</span>
                    </div>
                    <div className="ticket-row">
                      <span className="t-label">Group / Family:</span>
                      <span className="t-val">{confirmedPass.familyName}</span>
                    </div>
                    <div className="ticket-row">
                      <span className="t-label">Total Attendees:</span>
                      <span className="t-val">{adults} Adult{adults === 1 ? "" : "s"}{children > 0 ? `, ${children} Child${children === 1 ? "" : "ren"}` : ""}</span>
                    </div>
                    <div className="ticket-row">
                      <span className="t-label">Lodging Preference:</span>
                      <span className="t-val">{roomPref}</span>
                    </div>
                    <div className="ticket-row">
                      <span className="t-label">Total Fee:</span>
                      <span className="t-val" style={{ fontWeight: 800, color: "#0f172a" }}>${totalBalance.toFixed(2)}</span>
                    </div>
                    <div className="ticket-row">
                      <span className="t-label">Payment Status:</span>
                      <span className="t-val" style={{ color: "#166534", fontWeight: 700 }}>
                        ✓ Paid in Full
                      </span>
                    </div>
                  </div>

                  <div className="ticket-qr-section">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="QR Check-in Pass" className="ticket-qr-img" />
                    ) : (
                      <div className="ticket-qr-placeholder">Generating QR...</div>
                    )}
                    <span className="ticket-qr-hint">Scan at On-Site Kiosk</span>
                  </div>
                </div>
              </div>

              <div className="public-pass-actions">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn primary"
                  style={{ padding: "12px 28px", fontWeight: 700 }}
                >
                  🖨️ Print or Save Pass (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setConfirmedPass(null);
                    setLeader("");
                    setEmail("");
                    setPhone("");
                    setEmergencyContact("");
                    setFamilyName("");
                    setAdults(1);
                    setChildren(0);
                    setNonPaying(0);
                    setWaiver(false);
                    setSignature("");
                  }}
                  className="btn"
                  style={{ padding: "12px 24px" }}
                >
                  + Register Another Person
                </button>
              </div>
            </div>
          ) : (
            /* Condition B: Pending Payment -> DO NOT Generate Check-in Passcode or QR Code! */
            <div className="public-card public-pass-card">
              <div className="public-pass-badge" style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                ⏳ Status: Registration Received — Pending Payment
              </div>
              <h2 style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", margin: "14px 0 6px" }}>
                📋 Registration Received, {leader}!
              </h2>
              <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 20px" }}>
                Your registration has been logged under Request Reference <strong>#{confirmedPass.registrationRef}</strong>. A summary was sent to <strong>{email}</strong>.
              </p>

              {/* Strict Notice: Check-in pass locked */}
              <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: "12px", padding: "16px 20px", margin: "0 0 24px", textAlign: "left", display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "26px", lineHeight: "1" }}>🔒</span>
                <div style={{ fontSize: "13px", color: "#92400e", lineHeight: "1.5" }}>
                  <strong style={{ display: "block", fontSize: "14px", marginBottom: "3px", color: "#78350f" }}>
                    Check-in Passcode & Scannable QR Code Are Locked
                  </strong>
                  Per retreat policy, scannable check-in boarding passes and passcodes are generated <strong>only after required payments are verified and confirmed</strong> by organizers. Please complete your payment using the voucher details below. Once confirmed by the organizers, your scannable check-in pass will be issued and emailed to <strong>{email}</strong>.
                </div>
              </div>

              {/* Registration Voucher & Invoice */}
              <div className="public-ticket-container">
                <div className="public-ticket-header" style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)" }}>
                  <div>
                    <span className="ticket-label" style={{ color: "#cbd5e1" }}>Registration Voucher & Invoice</span>
                    <div className="ticket-event-name">{event.name}</div>
                    <div className="ticket-meta">{event.date} · {event.location}</div>
                  </div>
                  <div className="ticket-code-block" style={{ background: "rgba(255, 255, 255, 0.15)" }}>
                    <span className="ticket-code-label" style={{ color: "#e2e8f0" }}>Request Reference</span>
                    <span className="ticket-code" style={{ color: "#fef08a" }}>#{confirmedPass.registrationRef}</span>
                  </div>
                </div>

                <div className="public-ticket-body">
                  <div className="ticket-details">
                    <div className="ticket-row">
                      <span className="t-label">Primary Contact:</span>
                      <span className="t-val">{leader} ({email})</span>
                    </div>
                    <div className="ticket-row">
                      <span className="t-label">Group / Family:</span>
                      <span className="t-val">{confirmedPass.familyName}</span>
                    </div>
                    <div className="ticket-row">
                      <span className="t-label">Attendees Registered:</span>
                      <span className="t-val">{adults} Adult{adults === 1 ? "" : "s"}{children > 0 ? `, ${children} Child${children === 1 ? "" : "ren"}` : ""}{nonPaying > 0 ? ` (${nonPaying} Infant)` : ""}</span>
                    </div>
                    <div className="ticket-row">
                      <span className="t-label">Lodging Preference:</span>
                      <span className="t-val">{roomPref}</span>
                    </div>
                    <div className="ticket-row">
                      <span className="t-label">Total Retreat Fee:</span>
                      <span className="t-val" style={{ fontWeight: 800, color: "#0f172a" }}>${totalBalance.toFixed(2)}</span>
                    </div>
                    <div className="ticket-row">
                      <span className="t-label">Payment Status:</span>
                      <span className="t-val" style={{ color: "#b91c1c", fontWeight: 800 }}>
                        ● Pending Payment (${totalBalance.toFixed(2)} due by {confirmedPass.dueDate || event.fullPaymentDueDate || event.startDate || "check-in"})
                      </span>
                    </div>
                  </div>

                  {/* Locked QR Box Placeholder */}
                  <div className="ticket-qr-section ticket-qr-locked">
                    <div className="qr-lock-icon">🔒</div>
                    <div className="qr-lock-title">Pass Code Locked</div>
                    <p className="qr-lock-desc">
                      Scannable QR code & check-in passcode will unlock once payment of ${totalBalance.toFixed(2)} is verified.
                    </p>
                    <span className="qr-lock-tag">Pending Payment</span>
                  </div>
                </div>
              </div>

              {/* Payment Instructions & Next Steps */}
              <div className="payment-instructions-box">
                <div className="payment-instructions-title">
                  💳 How to Complete Payment & Unlock Your Passcode
                </div>
                <ul className="payment-steps-list">
                  <li className="payment-step-item">
                    <span className="step-bullet">1</span>
                    <div>
                      <strong>Submit your retreat payment of ${totalBalance.toFixed(2)}:</strong> Please submit payment to <strong>{event.organizationName || "the retreat committee"}</strong> via your group's accepted payment method (Zelle, check, bank transfer, or cash).
                      {event.hasDownpayment && (event.downpaymentAmount ?? 0) > 0 && (
                        <span style={{ display: "block", color: "#1e40af", marginTop: "3px" }}>
                          📌 Note: Minimum deposit of <strong>${Math.min(totalBalance, event.downpaymentAmount).toFixed(2)}</strong> is required {event.downpaymentDueDate ? `by ${event.downpaymentDueDate}` : ""}.
                        </span>
                      )}
                    </div>
                  </li>
                  <li className="payment-step-item">
                    <span className="step-bullet">2</span>
                    <div>
                      <strong>Include your Reference in the memo:</strong> Always include <strong>#{confirmedPass.registrationRef}</strong> and <strong>"{leader}"</strong> in your payment memo.
                    </div>
                  </li>
                  <li className="payment-step-item">
                    <span className="step-bullet">3</span>
                    <div>
                      <strong>Organizer Verification:</strong> Once received, the retreat organizers will confirm your payment and room assignment.
                    </div>
                  </li>
                  <li className="payment-step-item">
                    <span className="step-bullet">4</span>
                    <div>
                      <strong>Automatic Pass Release:</strong> Upon confirmation, your official check-in passcode and scannable QR pass will be unlocked and emailed to <strong>{email}</strong> for instant check-in!
                    </div>
                  </li>
                </ul>
              </div>

              <div className="public-pass-actions">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn primary"
                  style={{ padding: "12px 28px", fontWeight: 700 }}
                >
                  🖨️ Print Registration Voucher & Invoice (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setConfirmedPass(null);
                    setLeader("");
                    setEmail("");
                    setPhone("");
                    setEmergencyContact("");
                    setFamilyName("");
                    setAdults(1);
                    setChildren(0);
                    setNonPaying(0);
                    setWaiver(false);
                    setSignature("");
                  }}
                  className="btn"
                  style={{ padding: "12px 24px" }}
                >
                  + Register Another Person
                </button>
              </div>
            </div>
          )
        ) : (
          /* Multi-Step Registration Form */
          <div className="public-card public-form-card">
            {event.hasAccessCodeProtection && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "8px 14px", borderRadius: "8px", marginBottom: "18px", fontSize: "12px", color: "#166534" }}>
                <span>🔒 <strong>Passcode Verified:</strong> Private registration unlocked for invited attendee</span>
                <span style={{ fontSize: "11px", color: "#15803d", fontWeight: 700 }}>Authorized Member</span>
              </div>
            )}

            {/* Stepper Navigation */}
            <div className="public-stepper">
              <div className={`step-item ${step >= 1 ? "active" : ""}`}>
                <span className="step-num">1</span>
                <span className="step-label">Contact</span>
              </div>
              <div className="step-divider" />
              <div className={`step-item ${step >= 2 ? "active" : ""}`}>
                <span className="step-num">2</span>
                <span className="step-label">Attendees</span>
              </div>
              <div className="step-divider" />
              <div className={`step-item ${step >= 3 ? "active" : ""}`}>
                <span className="step-num">3</span>
                <span className="step-label">Lodging</span>
              </div>
              <div className="step-divider" />
              <div className={`step-item ${step >= 4 ? "active" : ""}`}>
                <span className="step-num">4</span>
                <span className="step-label">Waiver & Review</span>
              </div>
            </div>

            {error && (
              <div className="public-error-alert">
                ⚠️ {error}
              </div>
            )}

            {/* STEP 1: Contact Information */}
            {step === 1 && (
              <form onSubmit={handleNextFromStep1} className="public-form-step">
                <div className="step-heading">
                  <h2>Step 1: Primary Contact Information</h2>
                  <p>Please enter the primary attendee or family coordinator details.</p>
                </div>

                <div className="formgrid">
                  <div>
                    <label className="public-label">Full Name (Primary Contact) *</label>
                    <input
                      className="input"
                      required
                      value={leader}
                      onChange={(e) => setLeader(e.target.value)}
                      placeholder="e.g. Rachel Tekle"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="public-label">Family / Group Name</label>
                    <input
                      className="input"
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      placeholder={leader ? `${leader} Group` : "e.g. Tekle Family"}
                    />
                  </div>
                </div>

                <div className="formgrid">
                  <div>
                    <label className="public-label">Email Address (For Pass & Receipt) *</label>
                    <input
                      className="input"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="rachel@example.com"
                    />
                  </div>
                  <div>
                    <label className="public-label">Mobile Phone Number *</label>
                    <input
                      className="input"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 234-5678"
                    />
                  </div>
                </div>

                <div>
                  <label className="public-label">Emergency Contact (Name & Phone)</label>
                  <input
                    className="input"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="e.g. John Doe (Brother) - 555-987-6543"
                  />
                </div>

                <div className="step-buttons">
                  <div />
                  <button type="submit" className="btn primary step-next-btn">
                    Next: Attendees & Party Size →
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Party Size & Member Breakdown */}
            {step === 2 && (
              <form onSubmit={handleNextFromStep2} className="public-form-step">
                <div className="step-heading">
                  <h2>Step 2: Attendees & Group Size</h2>
                  <p>Specify how many adults and children will be attending.</p>
                </div>

                <div className="pricing-info-pill">
                  <span>💰 Rates: <strong>${pricePerAdult}</strong> per Adult · <strong>${pricePerChild}</strong> per Child (Ages {event.childAgeThreshold ? `under ${event.childAgeThreshold}` : "under 12"})</span>
                </div>

                <div className="party-counter-grid">
                  {/* Adults Counter */}
                  <div className="counter-card">
                    <div className="counter-title">Adults (13+)</div>
                    <div className="counter-rate">${pricePerAdult} / person</div>
                    <div className="counter-controls">
                      <button
                        type="button"
                        className="counter-btn"
                        onClick={() => setAdults((prev) => Math.max(1, prev - 1))}
                        disabled={adults <= 1}
                      >
                        –
                      </button>
                      <span className="counter-val">{adults}</span>
                      <button
                        type="button"
                        className="counter-btn"
                        onClick={() => setAdults((prev) => prev + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Children Counter */}
                  <div className="counter-card">
                    <div className="counter-title">Children</div>
                    <div className="counter-rate">${pricePerChild} / person</div>
                    <div className="counter-controls">
                      <button
                        type="button"
                        className="counter-btn"
                        onClick={() => setChildren((prev) => Math.max(0, prev - 1))}
                        disabled={children <= 0}
                      >
                        –
                      </button>
                      <span className="counter-val">{children}</span>
                      <button
                        type="button"
                        className="counter-btn"
                        onClick={() => setChildren((prev) => prev + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Infants Counter */}
                  <div className="counter-card">
                    <div className="counter-title">Infants (Under 2)</div>
                    <div className="counter-rate">Free of charge</div>
                    <div className="counter-controls">
                      <button
                        type="button"
                        className="counter-btn"
                        onClick={() => setNonPaying((prev) => Math.max(0, prev - 1))}
                        disabled={nonPaying <= 0}
                      >
                        –
                      </button>
                      <span className="counter-val">{nonPaying}</span>
                      <button
                        type="button"
                        className="counter-btn"
                        onClick={() => setNonPaying((prev) => prev + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Attendee Names Breakdown */}
                <div style={{ marginTop: "24px" }}>
                  <label className="public-label" style={{ marginBottom: "8px", display: "block" }}>
                    Attendee Names & Ages (Optional but Recommended for Nametags)
                  </label>
                  <div className="members-list">
                    {members.map((m, idx) => (
                      <div key={idx} className="member-row">
                        <span className="member-index">#{idx + 1}</span>
                        <input
                          className="input"
                          placeholder={idx === 0 ? `${leader || "Primary Attendee"} (Leader)` : `Attendee ${idx + 1} Name`}
                          value={m.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMembers((prev) => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], name: val };
                              return copy;
                            });
                          }}
                        />
                        <span className={`member-role-badge ${m.role.toLowerCase()}`}>
                          {m.role}
                        </span>
                        {m.role === "Child" && (
                          <input
                            className="input member-age-input"
                            type="number"
                            placeholder="Age"
                            min="1"
                            max="18"
                            value={m.age || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setMembers((prev) => {
                                const copy = [...prev];
                                copy[idx] = { ...copy[idx], age: val };
                                return copy;
                              });
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subtotal Preview */}
                <div className="step-subtotal-box">
                  <span>Calculated Fee:</span>
                  <strong>${totalBalance.toFixed(2)}</strong>
                </div>

                <div className="step-buttons">
                  <button type="button" onClick={() => setStep(1)} className="btn">
                    ← Back
                  </button>
                  <button type="submit" className="btn primary step-next-btn">
                    Next: Lodging & Dietary →
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Housing & Dietary */}
            {step === 3 && (
              <form onSubmit={handleNextFromStep3} className="public-form-step">
                <div className="step-heading">
                  <h2>Step 3: Lodging, Dietary & Accommodations</h2>
                  <p>Help organizers prepare comfortable rooms and meals for your group.</p>
                </div>

                <div>
                  <label className="public-label">Room & Lodging Preference *</label>
                  <div className="room-pref-grid">
                    {[
                      { id: "Cabin / Lodge", label: "🏡 Cabin / Lodge Room", desc: "Standard shared or private retreat cabin" },
                      { id: "Dormitory / Bunkhouse", label: "🛏️ Dormitory / Bunkhouse", desc: "Camp bunks, community dorm style" },
                      { id: "Family Suite", label: "👨‍👩‍👧 Family Suite", desc: "Contiguous room for parents and children" },
                      { id: "Commuter (No lodging)", label: "🚗 Commuter / Off-Site", desc: "Day program only, staying off-campus" },
                      { id: "No Preference", label: "✨ Any Available", desc: "Let the coordinator assign best fit" },
                    ].map((pref) => (
                      <div
                        key={pref.id}
                        onClick={() => setRoomPref(pref.id)}
                        className={`room-pref-card ${roomPref === pref.id ? "selected" : ""}`}
                      >
                        <strong>{pref.label}</strong>
                        <span>{pref.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: "20px" }}>
                  <label className="public-label">Dietary Restrictions & Allergies</label>
                  <div className="diet-chips-wrap">
                    {["None", "Vegetarian", "Vegan", "Gluten-Free", "Nut Allergy", "Dairy-Free", "Halal / Kosher", "Seafood Allergy"].map((tag) => (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => toggleDietTag(tag)}
                        className={`diet-chip ${selectedDietTags.includes(tag) ? "selected" : ""}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <input
                    className="input"
                    style={{ marginTop: "10px" }}
                    placeholder="Specific dietary notes or severe allergy details for camp kitchen..."
                    value={dietaryNotes}
                    onChange={(e) => setDietaryNotes(e.target.value)}
                  />
                </div>

                <div className="formgrid" style={{ marginTop: "16px" }}>
                  <div>
                    <label className="public-label">Roommate / Near-Neighbor Request</label>
                    <input
                      className="input"
                      placeholder="e.g. We would like to room next to the Smith family"
                      value={buddyRequest}
                      onChange={(e) => setBuddyRequest(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="public-label">Mobility / Accessibility Needs</label>
                    <input
                      className="input"
                      placeholder="e.g. Ground floor required, wheelchair access"
                      value={access}
                      onChange={(e) => setAccess(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ marginTop: "12px" }}>
                  <label className="public-label">General Notes or Questions for Organizers</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Any special requests or details..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div className="step-buttons">
                  <button type="button" onClick={() => setStep(2)} className="btn">
                    ← Back
                  </button>
                  <button type="submit" className="btn primary step-next-btn">
                    Next: Review & Liability Waiver →
                  </button>
                </div>
              </form>
            )}

            {/* STEP 4: Review, Waiver & Submission */}
            {step === 4 && (
              <form onSubmit={handleSubmitRegistration} className="public-form-step">
                <div className="step-heading">
                  <h2>Step 4: Review, Waiver & Confirmation</h2>
                  <p>Please review your registration details and accept the liability waiver.</p>
                </div>

                {/* Itemized Invoice Box */}
                <div className="review-invoice-card">
                  <div className="invoice-header">
                    <span>Itemized Fee Calculation</span>
                    <strong>{event.name}</strong>
                  </div>
                  <div className="invoice-rows">
                    <div className="invoice-row">
                      <span>{adults} Adult{adults === 1 ? "" : "s"} × ${pricePerAdult}</span>
                      <span>${(adults * pricePerAdult).toFixed(2)}</span>
                    </div>
                    {children > 0 && (
                      <div className="invoice-row">
                        <span>{children} Child{children === 1 ? "" : "ren"} × ${pricePerChild}</span>
                        <span>${(children * pricePerChild).toFixed(2)}</span>
                      </div>
                    )}
                    {nonPaying > 0 && (
                      <div className="invoice-row" style={{ color: "#166534" }}>
                        <span>{nonPaying} Infant{nonPaying === 1 ? "" : "s"}</span>
                        <span>$0.00 (Free)</span>
                      </div>
                    )}
                    <div className="invoice-row total-row">
                      <strong>Total Retreat Balance:</strong>
                      <strong style={{ fontSize: "20px", color: "#4338ca" }}>${totalBalance.toFixed(2)}</strong>
                    </div>
                  </div>

                  <div className="payment-due-note">
                    {event.hasDownpayment && (event.downpaymentAmount ?? 0) > 0 ? (
                      <>
                        📌 <strong>Deposit Due:</strong> ${Math.min(totalBalance, event.downpaymentAmount).toFixed(2)} {event.downpaymentDueDate ? `by ${event.downpaymentDueDate}` : ""}<br/>
                        📌 <strong>Remaining Balance:</strong> ${(totalBalance - Math.min(totalBalance, event.downpaymentAmount)).toFixed(2)} due by {event.fullPaymentDueDate || event.startDate}
                      </>
                    ) : (
                      <>
                        📌 Full payment of <strong>${totalBalance.toFixed(2)}</strong> due by <strong>{event.fullPaymentDueDate || event.startDate || "check-in day"}</strong>.
                      </>
                    )}
                  </div>
                </div>

                {/* Summary Card */}
                <div className="reg-summary-strip">
                  <div><strong>Primary Leader:</strong> {leader} ({email})</div>
                  <div><strong>Group:</strong> {familyName} · {adults} Adult{adults === 1 ? "" : "s"}{children > 0 ? `, ${children} Children` : ""}</div>
                  <div><strong>Lodging:</strong> {roomPref}</div>
                  {selectedDietTags.length > 0 && (
                    <div><strong>Dietary:</strong> {selectedDietTags.join(", ")}</div>
                  )}
                </div>

                {/* Liability Waiver Section */}
                <div className="waiver-section">
                  <div className="waiver-title">Participant Liability Release & Safety Waiver</div>
                  <div className="waiver-scroll-box">
                    <p>
                      <strong>Retreat Agreement & Medical Authorization:</strong> By completing this registration for <em>{event.name}</em> hosted by <em>{event.organizationName || "the organizers"}</em>, I hereby declare that all members of my party are in proper physical condition to attend the retreat.
                    </p>
                    <p>
                      In the event of an emergency, I grant permission to authorized retreat staff and medical personnel to provide first aid and seek necessary medical treatment. I agree to respect the venue facility rules, camp safety guidelines, and quiet hours.
                    </p>
                    <p>
                      I release the organizers, volunteers, and camp hosts from liability for personal injury, accidental damage, or lost personal property during the retreat.
                    </p>
                  </div>

                  <div className="waiver-checkbox-wrap">
                    <input
                      type="checkbox"
                      id="publicWaiverCheck"
                      checked={waiver}
                      onChange={(e) => setWaiver(e.target.checked)}
                      required={event.requireWaiver}
                    />
                    <label htmlFor="publicWaiverCheck">
                      I have read, understood, and accept the liability release and retreat policies on behalf of all registered party members. *
                    </label>
                  </div>

                  <div style={{ marginTop: "14px" }}>
                    <label className="public-label">Digital Signature (Type Full Legal Name) *</label>
                    <input
                      className="input"
                      required={event.requireWaiver}
                      placeholder="e.g. Rachel Tekle"
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                    />
                  </div>
                </div>

                <div className="step-buttons">
                  <button type="button" onClick={() => setStep(3)} className="btn">
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || (event.requireWaiver && (!waiver || !signature.trim()))}
                    className="btn primary step-next-btn submit-final-btn"
                  >
                    {loading ? "Confirming Registration..." : "✨ Complete & Confirm Registration"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="public-reg-footer">
        <div>
          Powered by <strong>RetreatFlow</strong> · The Modern Operating System for Group Programs & Retreats
        </div>
      </footer>
    </div>
  );
}
