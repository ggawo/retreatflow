"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toDateInputValue, getInclusiveRetreatDays } from "@/lib/dates";

export default function SettingsClient({ event: initialEvent }: { event: any }) {
  const [event, setEvent] = useState(initialEvent);

  const initialStartDate = toDateInputValue(event.startDate) || "2026-07-24";
  const initialEndDate = toDateInputValue(event.endDate) || "2026-07-26";
  const initialRegDeadline = toDateInputValue(event.registrationDeadline) || "";
  const initialFullPaymentDueDate = toDateInputValue(event.fullPaymentDueDate) || initialStartDate;
  const initialDownpaymentDueDate = toDateInputValue(event.downpaymentDueDate) || "";

  const initialSessions: string[] = (() => {
    if (!event.attendanceSessions) return ["Arrival Check-in", "Worship", "Dinner"];
    try {
      const parsed = typeof event.attendanceSessions === "string" ? JSON.parse(event.attendanceSessions) : event.attendanceSessions;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : ["Arrival Check-in", "Worship", "Dinner"];
    } catch {
      return ["Arrival Check-in", "Worship", "Dinner"];
    }
  })();

  const [name, setName] = useState(event.name || "");
  const [organizationName, setOrganizationName] = useState(event.organizationName || "My Organization");
  const [organizationType, setOrganizationType] = useState(event.organizationType || "Church / Ministry");
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [location, setLocation] = useState(event.location || "");
  const [capacity, setCapacity] = useState(String(event.capacity || 100));
  const [registrationDeadline, setRegistrationDeadline] = useState(initialRegDeadline);
  const [pricePerAdult, setPricePerAdult] = useState(String(event.pricePerAdult ?? 120));
  const [pricePerChild, setPricePerChild] = useState(String(event.pricePerChild ?? 60));
  const [childAgeThreshold, setChildAgeThreshold] = useState(String(event.childAgeThreshold ?? 12));

  const [fullPaymentDueDate, setFullPaymentDueDate] = useState(initialFullPaymentDueDate);
  const [hasDownpayment, setHasDownpayment] = useState(event.hasDownpayment ?? false);
  const [downpaymentAmount, setDownpaymentAmount] = useState(String(event.downpaymentAmount ?? 50));
  const [downpaymentDueDate, setDownpaymentDueDate] = useState(initialDownpaymentDueDate);
  const [attendanceSessions, setAttendanceSessions] = useState<string[]>(initialSessions);

  const [registrationMode, setRegistrationMode] = useState<"PUBLIC_SELF" | "ADMIN_ONLY">(event.registrationMode || "PUBLIC_SELF");
  const [slug, setSlug] = useState(event.slug || "summer-retreat-2026");
  const [publicRegIntro, setPublicRegIntro] = useState(event.publicRegIntro || "");
  const [requireWaiver, setRequireWaiver] = useState(event.requireWaiver ?? true);
  const [requireAccessCode, setRequireAccessCode] = useState(event.requireAccessCode ?? true);
  const [registrationAccessCode, setRegistrationAccessCode] = useState(event.registrationAccessCode || "RETREAT2026");
  const [copiedLink, setCopiedLink] = useState(false);

  // Saved Snapshot to track whether any changes have been made
  const [savedSnapshot, setSavedSnapshot] = useState({
    name: event.name || "",
    organizationName: event.organizationName || "My Organization",
    organizationType: event.organizationType || "Church / Ministry",
    startDate: initialStartDate,
    endDate: initialEndDate,
    location: event.location || "",
    capacity: String(event.capacity || 100),
    registrationDeadline: initialRegDeadline,
    pricePerAdult: String(event.pricePerAdult ?? 120),
    pricePerChild: String(event.pricePerChild ?? 60),
    childAgeThreshold: String(event.childAgeThreshold ?? 12),
    fullPaymentDueDate: initialFullPaymentDueDate,
    hasDownpayment: event.hasDownpayment ?? false,
    downpaymentAmount: String(event.downpaymentAmount ?? 50),
    downpaymentDueDate: initialDownpaymentDueDate,
    attendanceSessions: JSON.stringify(initialSessions),
    registrationMode: event.registrationMode || "PUBLIC_SELF",
    slug: event.slug || "summer-retreat-2026",
    publicRegIntro: event.publicRegIntro || "",
    requireWaiver: event.requireWaiver ?? true,
    requireAccessCode: event.requireAccessCode ?? true,
    registrationAccessCode: event.registrationAccessCode || "RETREAT2026",
  });

  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Check if form has any unsaved modifications
  const hasChanges =
    name !== savedSnapshot.name ||
    organizationName !== savedSnapshot.organizationName ||
    organizationType !== savedSnapshot.organizationType ||
    startDate !== savedSnapshot.startDate ||
    endDate !== savedSnapshot.endDate ||
    location !== savedSnapshot.location ||
    capacity !== savedSnapshot.capacity ||
    registrationDeadline !== savedSnapshot.registrationDeadline ||
    pricePerAdult !== savedSnapshot.pricePerAdult ||
    pricePerChild !== savedSnapshot.pricePerChild ||
    childAgeThreshold !== savedSnapshot.childAgeThreshold ||
    fullPaymentDueDate !== savedSnapshot.fullPaymentDueDate ||
    hasDownpayment !== savedSnapshot.hasDownpayment ||
    downpaymentAmount !== savedSnapshot.downpaymentAmount ||
    downpaymentDueDate !== savedSnapshot.downpaymentDueDate ||
    JSON.stringify(attendanceSessions) !== savedSnapshot.attendanceSessions ||
    registrationMode !== savedSnapshot.registrationMode ||
    slug !== savedSnapshot.slug ||
    publicRegIntro !== savedSnapshot.publicRegIntro ||
    requireWaiver !== savedSnapshot.requireWaiver ||
    requireAccessCode !== savedSnapshot.requireAccessCode ||
    registrationAccessCode !== savedSnapshot.registrationAccessCode;

  // Calculate inclusive retreat days (Start date, in-between days, and end date)
  const inclusiveDays = getInclusiveRetreatDays(startDate, endDate);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    const codeParam = requireAccessCode && registrationAccessCode ? `?code=${registrationAccessCode.trim().toUpperCase()}` : "";
    const url = `${window.location.origin}/r/${slug}${codeParam}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    showToast("✓ Protected registration invite link copied!");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges || loading) return;

    setLoading(true);

    try {
      const res = await fetch("/api/event", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          organizationName,
          organizationType,
          startDate,
          endDate,
          location,
          capacity: Number(capacity),
          registrationDeadline,
          pricePerAdult: Number(pricePerAdult),
          pricePerChild: Number(pricePerChild),
          childAgeThreshold: Number(childAgeThreshold),
          hasDownpayment,
          downpaymentAmount: Number(downpaymentAmount),
          downpaymentDueDate: hasDownpayment ? downpaymentDueDate : null,
          fullPaymentDueDate,
          attendanceSessions,
          registrationMode,
          slug,
          publicRegIntro,
          requireWaiver,
          requireAccessCode,
          registrationAccessCode,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setEvent(updated);
        // Update saved snapshot so hasChanges becomes false (Save button becomes inactive)
        setSavedSnapshot({
          name,
          organizationName,
          organizationType,
          startDate,
          endDate,
          location,
          capacity,
          registrationDeadline,
          pricePerAdult,
          pricePerChild,
          childAgeThreshold,
          fullPaymentDueDate,
          hasDownpayment,
          downpaymentAmount,
          downpaymentDueDate,
          attendanceSessions: JSON.stringify(attendanceSessions),
          registrationMode,
          slug,
          publicRegIntro,
          requireWaiver,
          requireAccessCode,
          registrationAccessCode,
        });
        showToast("✓ Retreat settings updated successfully!");
        router.refresh();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to update settings.");
      }
    } catch {
      showToast("Error saving settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {toast && <div className="toast show">{toast}</div>}

      <div className="top">
        <div>
          <h1>⚙️ Retreat Settings</h1>
          <div className="sub">Update your retreat event details, pricing rules, capacity, and schedule dates.</div>
        </div>
        <div className="actions" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Top Save button - inactive when no changes */}
          <button
            type="button"
            onClick={handleSave}
            className={`btn ${hasChanges ? "primary" : ""}`}
            disabled={!hasChanges || loading}
            style={{
              opacity: hasChanges && !loading ? 1 : 0.55,
              cursor: hasChanges && !loading ? "pointer" : "not-allowed",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {loading ? "Saving..." : hasChanges ? "Save Changes" : "✓ Saved"}
          </button>
          <button type="button" className="btn" onClick={() => router.push("/")}>
            ✕ Close Settings
          </button>
        </div>
      </div>

      <div className="card panel section" style={{ maxWidth: "860px" }}>
        <form onSubmit={handleSave} className="form">
          {/* Plan & Subscription Badge */}
          <div style={{
            background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
            color: "#ffffff",
            borderRadius: "10px",
            padding: "16px 20px",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}>
            <div>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "#a5b4fc", fontWeight: 700 }}>
                Platform Subscription
              </div>
              <div style={{ fontSize: "16px", fontWeight: 800, marginTop: "2px" }}>
                RetreatFlow Event Pass · <span style={{ color: "#34d399" }}>Active</span>
              </div>
              <div style={{ fontSize: "12px", color: "#c7d2fe", marginTop: "2px" }}>
                Development & Launch Mode · 60-day post-retreat active grace window with 1-year archive access.
              </div>
            </div>
            <span style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.25)",
              padding: "6px 12px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 700,
            }}>
              ✨ All Modules Unlocked
            </span>
          </div>

          <div className="section-title">1. Organization & Retreat Identity</div>
          
          <div className="formgrid">
            <div>
              <label>Organization / Group Name *</label>
              <input 
                className="input" 
                required 
                value={organizationName} 
                onChange={(e) => setOrganizationName(e.target.value)} 
                placeholder="e.g. Grace Fellowship, Lincoln High, Camp Hope" 
              />
            </div>
            <div>
              <label>Organization Type</label>
              <select
                className="input select"
                value={organizationType}
                onChange={(e) => setOrganizationType(e.target.value)}
              >
                <option value="Church / Ministry">Church / Ministry</option>
                <option value="School / University">School / University</option>
                <option value="Corporate / Team">Corporate / Team</option>
                <option value="Retreat Center / Camp">Retreat Center / Camp</option>
                <option value="Non-Profit / NGO">Non-Profit / NGO</option>
                <option value="Community Group">Community Group</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label>Retreat Event Name *</label>
            <input 
              className="input" 
              required 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. 2026 Family Summer Retreat" 
            />
          </div>

          <div className="formgrid">
            <div>
              <label>Start Date (Inclusive) *</label>
              <input 
                className="input" 
                type="date"
                required 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
              />
            </div>
            <div>
              <label>End Date (Inclusive) *</label>
              <input 
                className="input" 
                type="date"
                required 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
              />
            </div>
          </div>

          {/* Inclusive Dates Preview Banner */}
          {inclusiveDays.length > 0 && (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "8px",
                padding: "10px 14px",
                margin: "4px 0 14px 0",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "#166534" }}>
                  📅 Retreat Duration: {inclusiveDays.length} Days (Inclusive)
                </span>
                <span style={{ fontSize: "11px", color: "#15803d", fontWeight: 600 }}>
                  Start: {inclusiveDays[0]?.shortLabel} · End: {inclusiveDays[inclusiveDays.length - 1]?.shortLabel}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                {inclusiveDays.map((d) => (
                  <span
                    key={d.dateStr}
                    style={{
                      fontSize: "11px",
                      background: d.isStart ? "#dbeafe" : d.isEnd ? "#fef3c7" : "#ffffff",
                      color: d.isStart ? "#1e40af" : d.isEnd ? "#92400e" : "#334155",
                      border: "1px solid",
                      borderColor: d.isStart ? "#93c5fd" : d.isEnd ? "#fde68a" : "#cbd5e1",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontWeight: 700,
                    }}
                  >
                    {d.isStart ? "🚩 First Day (Start Date): " : d.isEnd ? "🏁 Last Day (End Date): " : `📅 Day ${d.dayNumber}: `}{d.fullLabel}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <label>Location / Venue *</label>
            <input 
              className="input" 
              required 
              value={location} 
              onChange={(e) => setLocation(e.target.value)} 
              placeholder="e.g. Camp Hope, Pine Valley" 
            />
          </div>

          <div className="formgrid">
            <div>
              <label>Total Capacity (People)</label>
              <input 
                className="input" 
                type="number" 
                min="1" 
                value={capacity} 
                onChange={(e) => setCapacity(e.target.value)} 
              />
            </div>
            <div>
              <label>Registration Deadline</label>
              <input 
                className="input" 
                type="date"
                value={registrationDeadline} 
                onChange={(e) => setRegistrationDeadline(e.target.value)} 
              />
            </div>
          </div>

          <div className="section-title" style={{ marginTop: "24px" }}>2. Registration Mode & Public Link</div>
          <div className="small" style={{ marginBottom: "12px" }}>
            Choose how attendees register for your retreat. You can toggle between public self-registration and admin-managed registration at any time.
          </div>

          <div className="reg-mode-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div
              onClick={() => setRegistrationMode("PUBLIC_SELF")}
              style={{
                padding: "14px",
                borderRadius: "10px",
                border: `2px solid ${registrationMode === "PUBLIC_SELF" ? "#4f46e5" : "var(--line)"}`,
                background: registrationMode === "PUBLIC_SELF" ? "rgba(99, 102, 241, 0.08)" : "transparent",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <input
                  type="radio"
                  id="settings_mode_public"
                  name="settings_reg_mode"
                  checked={registrationMode === "PUBLIC_SELF"}
                  onChange={() => setRegistrationMode("PUBLIC_SELF")}
                  style={{ cursor: "pointer", accentColor: "#4f46e5" }}
                />
                <label htmlFor="settings_mode_public" style={{ fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>
                  🌐 Public Self-Registration
                </label>
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: "1.4" }}>
                Attendees register directly online via your custom link. Automatic fee calculation, digital waiver & QR check-in pass.
              </div>
            </div>

            <div
              onClick={() => setRegistrationMode("ADMIN_ONLY")}
              style={{
                padding: "14px",
                borderRadius: "10px",
                border: `2px solid ${registrationMode === "ADMIN_ONLY" ? "#4f46e5" : "var(--line)"}`,
                background: registrationMode === "ADMIN_ONLY" ? "rgba(99, 102, 241, 0.08)" : "transparent",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <input
                  type="radio"
                  id="settings_mode_admin"
                  name="settings_reg_mode"
                  checked={registrationMode === "ADMIN_ONLY"}
                  onChange={() => setRegistrationMode("ADMIN_ONLY")}
                  style={{ cursor: "pointer", accentColor: "#4f46e5" }}
                />
                <label htmlFor="settings_mode_admin" style={{ fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>
                  🔒 Admin-Only Registration
                </label>
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: "1.4" }}>
                Organizers manually input registrations or import rosters via CSV. The public link is closed to the public.
              </div>
            </div>
          </div>

          {registrationMode === "PUBLIC_SELF" ? (
            <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e1b4b", marginBottom: "8px" }}>
                🔗 Protected Shareable Registration Link
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" }}>
                <input
                  className="input"
                  readOnly
                  value={
                    typeof window !== "undefined"
                      ? `${window.location.origin}/r/${slug}${requireAccessCode && registrationAccessCode ? `?code=${registrationAccessCode.trim().toUpperCase()}` : ""}`
                      : `/r/${slug}`
                  }
                  style={{ flex: 1, minWidth: "260px", background: "#ffffff", fontWeight: 600, color: "#334155" }}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={handleCopyLink}
                  style={{ fontWeight: 600, whiteSpace: "nowrap" }}
                >
                  {copiedLink ? "✓ Copied!" : "📋 Copy Protected Link"}
                </button>
                <a
                  href={`/r/${slug}${requireAccessCode && registrationAccessCode ? `?code=${registrationAccessCode.trim().toUpperCase()}` : ""}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn primary"
                  style={{ fontWeight: 600, whiteSpace: "nowrap", textDecoration: "none" }}
                >
                  Open Form ↗
                </a>
              </div>

              <div style={{
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "12px 14px",
                marginBottom: "14px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <input
                    type="checkbox"
                    id="requireAccessCodeCheck"
                    checked={requireAccessCode}
                    onChange={(e) => setRequireAccessCode(e.target.checked)}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <label htmlFor="requireAccessCodeCheck" style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", cursor: "pointer" }}>
                    🔒 Require Registration Access Passcode (Prevents unauthorized public entries)
                  </label>
                </div>
                {requireAccessCode && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px", flexWrap: "wrap" }}>
                    <div style={{ minWidth: "180px" }}>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "2px" }}>
                        Access Passcode:
                      </label>
                      <input
                        className="input"
                        value={registrationAccessCode}
                        onChange={(e) => setRegistrationAccessCode(e.target.value.toUpperCase())}
                        placeholder="e.g. RETREAT2026"
                        style={{ background: "#ffffff", fontWeight: 800, color: "#0f172a", letterSpacing: "1px", textTransform: "uppercase" }}
                      />
                    </div>
                    <span style={{ fontSize: "11px", color: "#64748b", flex: 1, minWidth: "220px", lineHeight: "1.4" }}>
                      Invited members opening the protected link are verified automatically. Anyone visiting the plain address without this code will be prompted to enter it before accessing the form.
                    </span>
                  </div>
                )}
              </div>

              <div className="formgrid">
                <div>
                  <label style={{ fontSize: "12px" }}>Custom URL Slug (/r/your-slug)</label>
                  <input
                    className="input"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    placeholder="e.g. summer-retreat-2026"
                    style={{ background: "#fff" }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", paddingTop: "20px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={requireWaiver}
                      onChange={(e) => setRequireWaiver(e.target.checked)}
                      style={{ width: "16px", height: "16px" }}
                    />
                    Require digital liability waiver acceptance
                  </label>
                </div>
              </div>

              <div style={{ marginTop: "10px" }}>
                <label style={{ fontSize: "12px" }}>Attendee Welcome Note (Displayed on Registration Form)</label>
                <textarea
                  className="input"
                  rows={2}
                  value={publicRegIntro}
                  onChange={(e) => setPublicRegIntro(e.target.value)}
                  placeholder="e.g. Welcome! Please register your family or group for the retreat. If you need financial assistance, please speak to the coordinator."
                  style={{ background: "#fff", resize: "vertical" }}
                />
              </div>
            </div>
          ) : (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "14px 16px", marginBottom: "16px", color: "#991b1b", fontSize: "13px" }}>
              <strong>🔒 Public Self-Registration is Disabled</strong>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#7f1d1d" }}>
                Attendees cannot register themselves online. If someone visits your retreat link, they will see an advisory notice directing them to contact the organizers directly.
              </p>
            </div>
          )}

          <div className="section-title" style={{ marginTop: "20px" }}>3. Unit Pricing & Fee Structure</div>
          <div className="small" style={{ marginBottom: "10px" }}>
            These unit amounts determine the expected balance calculated for each registered family or group attendee.
          </div>

          <div className="formgrid">
            <div>
              <label>Price per Adult ($)</label>
              <input 
                className="input" 
                type="number" 
                min="0" 
                value={pricePerAdult} 
                onChange={(e) => setPricePerAdult(e.target.value)} 
              />
            </div>
            <div>
              <label>Price per Child ($)</label>
              <input 
                className="input" 
                type="number" 
                min="0" 
                value={pricePerChild} 
                onChange={(e) => setPricePerChild(e.target.value)} 
              />
            </div>
          </div>

          <div>
            <label>Child Age Threshold (Years)</label>
            <input 
              className="input" 
              type="number" 
              min="0" 
              value={childAgeThreshold} 
              onChange={(e) => setChildAgeThreshold(e.target.value)} 
              placeholder="12 (children under this age pay child rate)" 
            />
          </div>

          <div className="section-title" style={{ marginTop: "20px" }}>3. Payment Due Dates & Downpayment Rules</div>
          <div>
            <label>Full Payment Due Date *</label>
            <input 
              className="input" 
              type="date"
              required 
              value={fullPaymentDueDate} 
              onChange={(e) => setFullPaymentDueDate(e.target.value)} 
            />
          </div>

          <div style={{ margin: "12px 0", display: "flex", alignItems: "center", gap: "8px" }}>
            <input 
              type="checkbox" 
              id="settingsDownpayment" 
              checked={hasDownpayment} 
              onChange={(e) => setHasDownpayment(e.target.checked)} 
              style={{ width: "16px", height: "16px", cursor: "pointer" }}
            />
            <label htmlFor="settingsDownpayment" style={{ cursor: "pointer", fontWeight: "600" }}>
              Require optional downpayment / deposit
            </label>
          </div>

          {hasDownpayment && (
            <div className="formgrid">
              <div>
                <label>Downpayment Amount ($)</label>
                <input 
                  className="input" 
                  type="number" 
                  min="1" 
                  value={downpaymentAmount} 
                  onChange={(e) => setDownpaymentAmount(e.target.value)} 
                />
              </div>
              <div>
                <label>Downpayment Due Date</label>
                <input 
                  className="input" 
                  type="date"
                  value={downpaymentDueDate} 
                  onChange={(e) => setDownpaymentDueDate(e.target.value)} 
                />
              </div>
            </div>
          )}

          {/* Section 4: Attendance Sessions based on Retreat Dates */}
          <div className="section-title" style={{ marginTop: "20px" }}>4. Attendance Sessions & Days</div>
          <div className="small" style={{ marginBottom: "10px" }}>
            Attendance sessions correspond to the inclusive retreat dates (start date, end date, and days in between).
          </div>

          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "8px", color: "#334155" }}>
              Active Attendance Sessions ({attendanceSessions.length}):
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {attendanceSessions.map((session) => (
                <span
                  key={session}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    padding: "4px 8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#1e293b",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {session}
                </span>
              ))}
            </div>
            <div style={{ marginTop: "10px", fontSize: "12px", color: "#64748b" }}>
              Manage full session schedules and scan passes in the <a href="/attendance" style={{ color: "#4f46e5", fontWeight: 700 }}>Attendance</a> module.
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="modal-actions" style={{ marginTop: "25px", display: "flex", gap: "10px", alignItems: "center" }}>
            <button 
              type="submit" 
              className={`btn ${hasChanges ? "primary" : ""}`} 
              disabled={!hasChanges || loading}
              style={{
                opacity: hasChanges && !loading ? 1 : 0.55,
                cursor: hasChanges && !loading ? "pointer" : "not-allowed",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 18px",
              }}
            >
              {loading ? "Saving Settings..." : hasChanges ? "Save Settings" : "✓ Saved"}
            </button>
            <button type="button" className="btn" onClick={() => router.push("/")}>
              Close
            </button>
            {!hasChanges && !loading && (
              <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 600, marginLeft: "4px" }}>
                ✓ All settings are up to date
              </span>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
