"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

interface KioskClientProps {
  initialFamilies: any[];
  eventName: string;
  initialCategories?: string[];
}

export default function KioskClient({ initialFamilies, eventName, initialCategories = ["Arrival Check-in", "Worship", "Dinner"] }: KioskClientProps) {
  const [families, setFamilies] = useState(initialFamilies);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [session, setSession] = useState<string>(initialCategories[0] || "Arrival Check-in");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLetter, setActiveLetter] = useState("ALL");
  const [selectedFamily, setSelectedFamily] = useState<any | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInBlockModal, setCheckInBlockModal] = useState<{ familyName: string; reasons: string[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const playSuccessChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {}
  };

  const triggerVibration = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  };

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Filter & Group families alphabetically
  const filteredFamilies = families.filter(f => {
    const searchHay = `${f.name} ${f.leader} ${f.email}`.toLowerCase();
    const matchesSearch = !searchQuery || searchHay.includes(searchQuery.toLowerCase());
    const matchesLetter = activeLetter === "ALL" || f.name.toUpperCase().startsWith(activeLetter);
    return matchesSearch && matchesLetter;
  });

  // Group filtered families by starting letter
  const groupedFamilies: Record<string, any[]> = {};
  filteredFamilies.forEach(f => {
    const letter = f.name.charAt(0).toUpperCase() || "#";
    if (!groupedFamilies[letter]) groupedFamilies[letter] = [];
    groupedFamilies[letter].push(f);
  });

  const lettersWithData = Object.keys(groupedFamilies).sort();

  const getAttendanceRecord = (f: any) => {
    if (f.attendance && f.attendance.length > 0) return f.attendance[0];
    return null;
  };

  const getAttendanceStatus = (f: any): "Present" | "Pending" => {
    const rec = getAttendanceRecord(f);
    if (!rec) return "Pending";
    if (rec.sessionsJson) {
      try {
        const parsed = JSON.parse(rec.sessionsJson);
        if (parsed[session]) return parsed[session] === "Present" ? "Present" : "Pending";
      } catch {}
    }
    if (session === "checkin" || session === "Arrival Check-in") return rec.checkin === "Present" ? "Present" : "Pending";
    if (session === "worship" || session === "Worship") return rec.worship === "Present" ? "Present" : "Pending";
    if (session === "dinner" || session === "Dinner") return rec.dinner === "Present" ? "Present" : "Pending";
    return "Pending";
  };

  const getBlockReasons = (family: any) => {
    const isArrivalSession = session === "Arrival Check-in" || session === "checkin";
    if (!isArrivalSession) return [];

    const reasons: string[] = [];

    // 1. Only check in confirmed groups
    const isConfirmed = family.status === "Confirmed" && (family.registration?.status === "Confirmed" || !family.registration);
    if (!isConfirmed) {
      reasons.push(`Registration status is "${family.status || "Pending"}". Only Confirmed registrations can be checked in.`);
    }

    // 2. Room must be assigned
    const hasRoom = Boolean(family.room || family.roomId);
    if (!hasRoom) {
      reasons.push("Housing is unassigned. Room assignment must be completed before arrival check-in.");
    }

    // 3. Must not have pending payment / balance
    const balance = Number(family.registration?.balance || 0);
    const hasUnpaid = family.payments && family.payments.length > 0 ? family.payments.some((p: any) => p.status !== "Paid") : false;
    if (balance > 0 || hasUnpaid) {
      reasons.push(`Pending payment of $${balance.toFixed(2)} is due. All retreat registration fees must be settled before check-in.`);
    }

    return reasons;
  };

  const handleCheckIn = (family: any) => {
    if (isCheckingIn) return;
    const reasons = getBlockReasons(family);
    if (reasons.length > 0) {
      setCheckInBlockModal({ familyName: family.name, reasons });
      return;
    }
    executeCheckIn(family);
  };

  const executeCheckIn = async (family: any) => {
    if (isCheckingIn) return;
    setIsCheckingIn(true);

    try {
      const rec = getAttendanceRecord(family);

      if (rec) {
        const res = await fetch(`/api/attendance/${rec.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session, status: "Present" }),
        });

        if (!res.ok) {
          const errData = await res.json();
          showToastMsg(errData.error || "Check-in blocked: Requirements not met.");
          setIsCheckingIn(false);
          return;
        }

        const updatedRec = await res.json();
        setFamilies(prev => prev.map(f => {
          if (f.id === family.id) {
            return {
              ...f,
              attendance: [{ ...(getAttendanceRecord(f) || {}), ...updatedRec }]
            };
          }
          return f;
        }));

        setSelectedFamily((prev: any) => {
          if (prev && prev.id === family.id) {
            return {
              ...prev,
              attendance: [{ ...(getAttendanceRecord(prev) || {}), ...updatedRec }]
            };
          }
          return prev;
        });

        playSuccessChime();
        triggerVibration();
        showToastMsg(`✅ ${family.name} checked in successfully!`);
      } else {
        // Fallback: use scan endpoint
        const res = await fetch("/api/attendance/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: family.id, session }),
        });

        if (!res.ok) {
          const errData = await res.json();
          showToastMsg(errData.error || "Check-in blocked: Requirements not met.");
          setIsCheckingIn(false);
          return;
        }

        const data = await res.json();
        setFamilies(prev => prev.map(f => {
          if (f.id === family.id) {
            return { ...f, attendance: [data.attendance] };
          }
          return f;
        }));

        setSelectedFamily((prev: any) => {
          if (prev && prev.id === family.id) {
            return { ...prev, attendance: [data.attendance] };
          }
          return prev;
        });

        playSuccessChime();
        triggerVibration();
        showToastMsg(`✅ ${family.name} checked in successfully!`);
      }

      setTimeout(() => {
        setIsCheckingIn(false);
        if (typeof window !== "undefined" && window.innerWidth <= 900) {
          setSelectedFamily(null);
        }
      }, 1500);
    } catch (err) {
      console.error(err);
      showToastMsg("Failed to check in. Please try again.");
      setIsCheckingIn(false);
    }
  };

  // Detail Card Renderer (Shared between Desktop Side Panel and Mobile Center Modal)
  const renderDetailCard = (isMobileModal = false) => {
    if (!selectedFamily) return null;
    const selectedReasons = getBlockReasons(selectedFamily);
    const isBlocked = selectedReasons.length > 0;
    const isPresent = getAttendanceStatus(selectedFamily) === "Present";

    return (
      <div 
        style={{
          background: "#1e293b",
          border: isMobileModal ? "2px solid #6366f1" : "2px solid #6366f1",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: isMobileModal 
            ? "0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(99, 102, 241, 0.35)" 
            : "0 10px 30px rgba(99, 102, 241, 0.25)",
          animation: "slideIn 0.25s ease-out",
          width: "100%",
          maxHeight: isMobileModal ? "90vh" : undefined,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Card Header */}
        <div style={{ background: "linear-gradient(135deg, #312e81 0%, #0f172a 100%)", padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1.5px", color: "#818cf8" }}>
                SELF CHECK-IN DETAILS
              </div>
              <h2 style={{ margin: "4px 0 0 0", fontSize: "22px", fontWeight: "800", color: "#ffffff", lineHeight: 1.2 }}>
                {selectedFamily.name}
              </h2>
              <div style={{ fontSize: "13px", color: "#cbd5e1", marginTop: "3px" }}>
                Leader: {selectedFamily.leader}
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setSelectedFamily(null)} 
              disabled={isCheckingIn}
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                border: "none",
                color: "#e2e8f0",
                fontSize: "20px",
                cursor: "pointer",
                padding: "6px 12px",
                borderRadius: "10px",
                lineHeight: 1,
                flexShrink: 0,
              }}
              title="Close details"
              aria-label="Close details"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Card Body (Scrollable if modal is tall on small screens) */}
        <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
          
          {/* Info Grid Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
            <div style={{ background: "#0f172a", padding: "12px 14px", borderRadius: "12px", border: "1px solid #334155" }}>
              <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "700" }}>Attendees</div>
              <div style={{ fontSize: "15px", fontWeight: "800", color: "#ffffff", marginTop: "2px" }}>
                {selectedFamily.adults} Adults, {selectedFamily.children} Children
                {selectedFamily.nonPayingChildren ? `, ${selectedFamily.nonPayingChildren} Free` : ""}
              </div>
            </div>

            <div style={{ background: "#0f172a", padding: "12px 14px", borderRadius: "12px", border: "1px solid #334155" }}>
              <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "700" }}>Assigned Room</div>
              <div style={{ fontSize: "15px", fontWeight: "800", color: selectedFamily.room ? "#38bdf8" : "#fbbf24", marginTop: "2px" }}>
                {selectedFamily.room 
                  ? `${selectedFamily.room.building?.name || "Building"} · Room ${selectedFamily.room.number}` 
                  : "Housing Pending"}
              </div>
            </div>
          </div>

          {/* Dietary & Accessibility Notes */}
          {(selectedFamily.notes || selectedFamily.access !== "None" || selectedFamily.buddyRequest) && (
            <div style={{ background: "#0f172a", padding: "12px 14px", borderRadius: "12px", border: "1px solid #334155", marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", color: "#818cf8", textTransform: "uppercase", fontWeight: "700", marginBottom: "4px" }}>
                Notes & Special Requirements
              </div>
              {selectedFamily.access !== "None" && (
                <div style={{ fontSize: "12px", color: "#cbd5e1" }}>♿ Accessibility: {selectedFamily.access}</div>
              )}
              {selectedFamily.buddyRequest && (
                <div style={{ fontSize: "12px", color: "#cbd5e1" }}>🤝 Buddy Preference: {selectedFamily.buddyRequest}</div>
              )}
              {selectedFamily.notes && (
                <div style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "2px" }}>📝 {selectedFamily.notes}</div>
              )}
            </div>
          )}

          {/* Prerequisite Alert Box if Blocked */}
          {isBlocked && (
            <div style={{
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "12px",
              padding: "12px 14px",
              marginBottom: "16px",
              color: "#fca5a5"
            }}>
              <div style={{ fontWeight: "800", color: "#f87171", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🚫</span> Arrival Check-In Blocked
              </div>
              <div style={{ fontSize: "12px", color: "#fca5a5", marginTop: "4px" }}>
                Prerequisites must be met before check-in:
              </div>
              <ul style={{ margin: "6px 0 0 16px", padding: 0, fontSize: "12px", color: "#f87171" }}>
                {selectedReasons.map((r, i) => (
                  <li key={i} style={{ marginTop: "2px" }}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Session & Status Indicator */}
          <div style={{ textAlign: "center", marginBottom: "18px", background: "#0f172a", padding: "10px", borderRadius: "10px" }}>
            <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", fontWeight: "700" }}>
              Selected Session: <strong style={{ color: "#38bdf8" }}>{session}</strong>
            </div>
            <div style={{ fontSize: "16px", fontWeight: "800", marginTop: "3px", color: isPresent ? "#4ade80" : isBlocked ? "#f87171" : "#fbbf24" }}>
              {isPresent ? "✓ Marked Present" : isBlocked ? "🚫 Check-In Blocked" : "○ Awaiting Check-in"}
            </div>
          </div>

          {/* Touch Check In Action Button */}
          <button 
            type="button" 
            onClick={() => handleCheckIn(selectedFamily)}
            disabled={isCheckingIn}
            style={{
              width: "100%",
              padding: "16px",
              fontSize: isBlocked ? "15px" : "18px",
              fontWeight: "800",
              borderRadius: "14px",
              border: isBlocked ? "1px solid rgba(239, 68, 68, 0.4)" : "none",
              cursor: "pointer",
              background: isBlocked 
                ? "rgba(239, 68, 68, 0.2)" 
                : isPresent 
                ? "#059669" 
                : "#16a34a",
              color: isBlocked ? "#fca5a5" : "#ffffff",
              boxShadow: isBlocked ? "none" : "0 6px 20px rgba(22, 163, 74, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {isCheckingIn ? (
              <span>Checking in... ⏳</span>
            ) : isBlocked ? (
              <span>🚫 Check-In Blocked (Requirements Pending)</span>
            ) : isPresent ? (
              <span>Re-check in ✅</span>
            ) : (
              <span>CHECK IN FAMILY NOW 🚀</span>
            )}
          </button>

          {/* Mobile modal quick close button */}
          {isMobileModal && (
            <button
              type="button"
              onClick={() => setSelectedFamily(null)}
              style={{
                width: "100%",
                marginTop: "10px",
                padding: "10px",
                background: "transparent",
                border: "1px solid #334155",
                borderRadius: "10px",
                color: "#94a3b8",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Cancel & Close
            </button>
          )}

        </div>
      </div>
    );
  };

  // Metrics
  const totalConfirmed = families.length;
  const checkedInCount = families.filter(f => getAttendanceStatus(f) === "Present").length;
  const pendingCount = totalConfirmed - checkedInCount;

  return (
    <div style={{ background: "#0f172a", minHeight: "100vh", color: "#f8fafc", padding: "20px" }}>
      {toast && <div className="toast show" style={{ background: "#16a34a", color: "#fff", fontSize: "16px", fontWeight: "700" }}>{toast}</div>}

      {/* Header Bar */}
      <div style={{ background: "#1e293b", padding: "20px 24px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.1)", marginBottom: "20px", boxShadow: "0 10px 25px rgba(0,0,0,0.3)" }}>
        {/* Top Header Row: Branding/Title on left, Back Arrow in upper right corner */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Logo size={46} showText={false} glow priority />
            <div>
              <div style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1.5px", color: "#818cf8" }}>
                RETREATFLOW SELF-CHECK-IN KIOSK
              </div>
              <h1 style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "800", color: "#ffffff" }}>
                {eventName}
              </h1>
              <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "2px" }}>
                Touch your family card to view details & check in for <strong style={{ color: "#38bdf8" }}>{session}</strong>
              </div>
            </div>
          </div>

          {/* Upper Right Corner Back Arrow Button */}
          <Link 
            href="/" 
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "#334155",
              color: "#ffffff",
              padding: "10px 18px",
              borderRadius: "12px",
              fontSize: "13px",
              fontWeight: "700",
              textDecoration: "none",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              transition: "all 0.2s ease",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
            className="kiosk-exit-btn"
            title="Exit Kiosk & Return to Dashboard"
          >
            <span style={{ fontSize: "16px" }}>←</span> Exit Kiosk
          </Link>
        </div>

        {/* Bottom Sub-Header Row: Session Switcher & Attendance Stats Badges */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "14px" }}>
          {/* Session Switcher */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", background: "#0f172a", padding: "4px", borderRadius: "12px", border: "1px solid #334155" }}>
            {categories.map(cat => (
              <button 
                key={cat} 
                onClick={() => setSession(cat)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "700",
                  border: "none",
                  cursor: "pointer",
                  background: session === cat ? "#6366f1" : "transparent",
                  color: session === cat ? "#ffffff" : "#94a3b8",
                  transition: "all 0.2s ease",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Counter Badges */}
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ background: "rgba(22, 163, 74, 0.15)", border: "1px solid #16a34a", padding: "6px 14px", borderRadius: "10px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", textTransform: "uppercase", color: "#4ade80", fontWeight: "700" }}>Checked In</div>
              <div style={{ fontSize: "17px", fontWeight: "800", color: "#4ade80" }}>{checkedInCount} / {totalConfirmed}</div>
            </div>
            <div style={{ background: "rgba(217, 119, 6, 0.15)", border: "1px solid #d97706", padding: "6px 14px", borderRadius: "10px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", textTransform: "uppercase", color: "#fbbf24", fontWeight: "700" }}>Pending</div>
              <div style={{ fontSize: "17px", fontWeight: "800", color: "#fbbf24" }}>{pendingCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Alphabet Jump Bar */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ marginBottom: "12px" }}>
          <input 
            type="text" 
            placeholder="🔍 Search family name or leader..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "14px 18px",
              fontSize: "17px",
              borderRadius: "14px",
              border: "2px solid #334155",
              background: "#1e293b",
              color: "#ffffff",
              outline: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          />
        </div>

        {/* Alphabet Index Pills */}
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", justifyContent: "center", background: "#1e293b", padding: "8px 12px", borderRadius: "12px", border: "1px solid #334155" }}>
          <button 
            onClick={() => setActiveLetter("ALL")}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "800",
              border: "none",
              cursor: "pointer",
              background: activeLetter === "ALL" ? "#6366f1" : "#0f172a",
              color: activeLetter === "ALL" ? "#ffffff" : "#cbd5e1",
            }}
          >
            ALL
          </button>
          {alphabet.map(letter => {
            const hasFamilies = families.some(f => f.name.toUpperCase().startsWith(letter));
            return (
              <button 
                key={letter}
                onClick={() => setActiveLetter(letter)}
                disabled={!hasFamilies}
                style={{
                  padding: "5px 9px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "700",
                  border: "none",
                  cursor: hasFamilies ? "pointer" : "not-allowed",
                  background: activeLetter === letter ? "#6366f1" : hasFamilies ? "#0f172a" : "transparent",
                  color: activeLetter === letter ? "#ffffff" : hasFamilies ? "#ffffff" : "#475569",
                  opacity: hasFamilies ? 1 : 0.4,
                }}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split Layout: Left Column (Cards Grid) vs Right Column (Selected Family Detail Card) */}
      <div className="kiosk-split-layout" style={{ display: "grid", gridTemplateColumns: "1fr minmax(360px, 440px)", gap: "24px", alignItems: "start" }}>
        
        {/* Left Column: Alphabetical Family Groups */}
        <div>
          {lettersWithData.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", background: "#1e293b", borderRadius: "16px", border: "1px dashed #334155" }}>
              <div style={{ fontSize: "42px", marginBottom: "12px" }}>🔍</div>
              <h3 style={{ color: "#94a3b8", margin: "0 0 6px 0" }}>No Confirmed Families Found</h3>
              <p style={{ color: "#64748b", margin: 0 }}>Try clearing your search query or choosing another letter.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {lettersWithData.map(letter => (
                <section key={letter}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                    <div style={{ background: "#6366f1", color: "#ffffff", width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "16px" }}>
                      {letter}
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>
                      {groupedFamilies[letter].length} {groupedFamilies[letter].length === 1 ? "Family" : "Families"}
                    </div>
                    <div style={{ flex: 1, height: "1px", background: "#334155" }} />
                  </div>

                  {/* Family Cards Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "14px" }}>
                    {groupedFamilies[letter].map(family => {
                      const isPresent = getAttendanceStatus(family) === "Present";
                      const isSelected = selectedFamily?.id === family.id;
                      const totalPpl = family.adults + family.children + (family.nonPayingChildren || 0);
                      const isArrivalSession = session === "Arrival Check-in" || session === "checkin";
                      const cardReasons = getBlockReasons(family);
                      const isBlocked = isArrivalSession && cardReasons.length > 0;
                      const balance = Number(family.registration?.balance || 0);

                      return (
                        <div 
                          key={family.id}
                          onClick={() => setSelectedFamily(family)}
                          style={{
                            background: isSelected 
                              ? "linear-gradient(145deg, #312e81 0%, #1e1b4b 100%)" 
                              : isPresent ? "linear-gradient(145deg, #1e293b 0%, #064e3b 100%)" : "#1e293b",
                            border: isSelected 
                              ? "3px solid #6366f1" 
                              : isPresent ? "2px solid #10b981" : isBlocked ? "2px solid rgba(239, 68, 68, 0.4)" : "2px solid #334155",
                            borderRadius: "14px",
                            padding: "16px",
                            cursor: "pointer",
                            boxShadow: isSelected ? "0 0 20px rgba(99, 102, 241, 0.5)" : "0 4px 12px rgba(0,0,0,0.2)",
                            transition: "all 0.2s ease",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                          className="kiosk-card"
                        >
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#ffffff", lineHeight: "1.2" }}>
                                {family.name}
                              </h3>
                              <span style={{
                                fontSize: "10px",
                                fontWeight: "800",
                                padding: "3px 8px",
                                borderRadius: "20px",
                                background: isPresent ? "#10b981" : isBlocked ? "rgba(239, 68, 68, 0.15)" : "rgba(217, 119, 6, 0.2)",
                                color: isPresent ? "#ffffff" : isBlocked ? "#f87171" : "#fbbf24",
                                border: isPresent ? "none" : isBlocked ? "1px solid #ef4444" : "1px solid #d97706",
                              }}>
                                {isPresent ? "✓ PRESENT" : isBlocked ? "🚫 BLOCKED" : "○ PENDING"}
                              </span>
                            </div>

                            <div style={{ fontSize: "13px", color: "#cbd5e1", marginBottom: "8px" }}>
                              Leader: {family.leader}
                            </div>

                            {/* Prerequisite indicators for Arrival Check-in */}
                            {isArrivalSession && !isPresent && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
                                {family.status !== "Confirmed" && (
                                  <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "4px", background: "rgba(239, 68, 68, 0.15)", color: "#f87171", fontWeight: 700 }}>
                                    ⚠️ Reg: {family.status || "Pending"}
                                  </span>
                                )}
                                {!family.room && (
                                  <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "4px", background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", fontWeight: 700 }}>
                                    🏠 Room Pending
                                  </span>
                                )}
                                {balance > 0 && (
                                  <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "4px", background: "rgba(239, 68, 68, 0.15)", color: "#f87171", fontWeight: 700 }}>
                                    💳 ${balance.toFixed(2)} Due
                                  </span>
                                )}
                                {!isBlocked && (
                                  <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "4px", background: "rgba(16, 185, 129, 0.15)", color: "#34d399", fontWeight: 700 }}>
                                    ✓ Ready to Check In
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div style={{ paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                              👥 <strong>{totalPpl}</strong> People
                            </div>
                            <div style={{ fontSize: "11px", color: family.room ? "#38bdf8" : "#f87171", fontWeight: "600" }}>
                              {family.room ? `🏢 Room ${family.room.number}` : "Room Unassigned"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Sticky Side Panel on Desktop */}
        <div className="kiosk-desktop-column" style={{ position: "sticky", top: "20px" }}>
          {selectedFamily ? (
            renderDetailCard(false)
          ) : (
            /* Placeholder state when no card is selected */
            <div 
              style={{
                background: "#1e293b",
                border: "2px dashed #334155",
                borderRadius: "20px",
                padding: "40px 24px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              <div style={{ fontSize: "42px", marginBottom: "12px" }}>👈</div>
              <h3 style={{ color: "#94a3b8", margin: "0 0 6px 0", fontSize: "18px" }}>No Family Selected</h3>
              <p style={{ fontSize: "13px", color: "#64748b", margin: 0, lineHeight: "1.5" }}>
                Touch any family card on the left to view their room assignment, details, and complete check-in.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Mobile Modal Overlay: Appears directly in center of mobile viewport when family is touched */}
      {selectedFamily && (
        <div 
          className="kiosk-mobile-modal-overlay"
          onClick={() => setSelectedFamily(null)}
        >
          <div 
            className="kiosk-mobile-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            {renderDetailCard(true)}
          </div>
        </div>
      )}

      {/* Check-In Blocked Modal (Strict requirements: Room assigned, No pending payment, Group confirmed) */}
      {checkInBlockModal && (
        <div 
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={() => setCheckInBlockModal(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{
              background: "#1e293b",
              border: "2px solid #ef4444",
              borderRadius: "20px",
              padding: "28px",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
              color: "#ffffff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ fontSize: "36px" }}>🚫</div>
              <div>
                <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#f87171" }}>
                  Check-In Blocked
                </h3>
                <div style={{ fontSize: "13px", color: "#94a3b8" }}>
                  Prerequisites Not Met for Arrival Check-In
                </div>
              </div>
            </div>

            <p style={{ fontSize: "14px", color: "#cbd5e1", lineHeight: "1.5", margin: "0 0 16px 0" }}>
              <strong style={{ color: "#ffffff" }}>{checkInBlockModal.familyName}</strong> cannot be checked in until all arrival requirements are satisfied:
            </p>

            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "14px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "12px",
              marginBottom: "20px",
            }}>
              {checkInBlockModal.reasons.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", color: "#fca5a5" }}>
                  <span style={{ fontWeight: "bold", color: "#ef4444" }}>•</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setCheckInBlockModal(null)}
                style={{
                  padding: "12px 24px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#ef4444",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: "800",
                  cursor: "pointer",
                }}
              >
                Understood — Resolve Requirements
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Responsive layout styles */}
      <style jsx global>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .kiosk-card:hover {
          transform: translateY(-2px);
          border-color: #6366f1 !important;
        }
        .kiosk-card:active {
          transform: scale(0.98);
        }
        .kiosk-exit-btn:hover {
          background: #475569 !important;
          border-color: #6366f1 !important;
          transform: translateX(-2px);
        }
        @media (max-width: 900px) {
          .kiosk-split-layout {
            grid-template-columns: 1fr !important;
          }
          .kiosk-desktop-column {
            display: none !important;
          }
          .kiosk-mobile-modal-overlay {
            position: fixed;
            inset: 0;
            z-index: 9998;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            overflow-y: auto;
            animation: fadeIn 0.2s ease-out;
          }
          .kiosk-mobile-modal-container {
            width: 100%;
            max-width: 480px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
          }
        }
        @media (min-width: 901px) {
          .kiosk-mobile-modal-overlay {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
