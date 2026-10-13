"use client";

import { useState, useEffect, useRef } from "react";
import QRScannerModal from "@/components/QRScannerModal";
import { getInclusiveRetreatDays, formatHumanDateRange, RetreatDayOption } from "@/lib/dates";
import ActionDropdown, { ActionDropdownItem } from "@/components/ActionDropdown";

export default function AttendanceClient({ initialData, event: initialEvent }: { initialData: any[]; event?: any }) {
  const [eventData, setEventData] = useState<any>(initialEvent || null);
  const [categories, setCategories] = useState<string[]>(["Arrival Check-in", "Worship", "Dinner"]);
  const [activeCategory, setActiveCategory] = useState<string>("Arrival Check-in");
  const [q, setQ] = useState("");
  const [data, setData] = useState(initialData);
  const [toast, setToast] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const [showAddCatModal, setShowAddCatModal] = useState<boolean>(false);

  // New Category / Session Creator Form State
  const [selectedDayKey, setSelectedDayKey] = useState<string>("first");
  const [activityPreset, setActivityPreset] = useState<string>("Full Day Attendance");
  const [customSessionName, setCustomSessionName] = useState<string>("");

  const inputRef = useRef<HTMLInputElement | null>(null);
  const statuses: Array<"Pending" | "Present" | "Absent"> = ["Pending", "Present", "Absent"];

  // Compute inclusive retreat days (Start date, in-between days, and end date)
  const inclusiveDays = getInclusiveRetreatDays(eventData?.startDate, eventData?.endDate);

  // Fetch event settings for custom categories
  useEffect(() => {
    fetch("/api/event")
      .then(res => res.json())
      .then(evt => {
        if (evt) {
          setEventData(evt);
          if (evt.attendanceSessions) {
            try {
              const parsed = typeof evt.attendanceSessions === "string" 
                ? JSON.parse(evt.attendanceSessions) 
                : evt.attendanceSessions;
              if (Array.isArray(parsed) && parsed.length > 0) {
                const hasArrival = parsed.some((c: string) => c === "Arrival Check-in" || c === "checkin");
                const catList = hasArrival ? parsed : ["Arrival Check-in", ...parsed];
                setCategories(catList);
                if (!catList.includes(activeCategory)) {
                  setActiveCategory(catList[0]);
                }
              }
            } catch {}
          }
        }
      })
      .catch(() => {});
  }, []);

  // Auto focus input when modal opens
  useEffect(() => {
    if (showAddCatModal && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showAddCatModal]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  // Resolve status for active category for a family record
  const getStatusForRecord = (rec: any, cat: string): "Pending" | "Present" | "Absent" => {
    if (rec.sessionsJson) {
      try {
        const parsed = JSON.parse(rec.sessionsJson);
        if (parsed[cat]) return parsed[cat];
      } catch {}
    }
    // Fallback for legacy fields
    if (cat === "Arrival Check-in" || cat === "checkin") return (rec.checkin as any) || "Pending";
    if (cat === "Worship" || cat === "worship") return (rec.worship as any) || "Pending";
    if (cat === "Dinner" || cat === "dinner") return (rec.dinner as any) || "Pending";
    return "Pending";
  };

  const filteredData = data.filter(a => !q || (a.family?.name || "").toLowerCase().includes(q.toLowerCase()));
  const count = data.filter(a => getStatusForRecord(a, activeCategory) === "Present").length;
  const total = data.length;
  const rate = total ? Math.round((count / total) * 100) : 0;
  const pending = data.filter(a => getStatusForRecord(a, activeCategory) === "Pending").length;
  const absent = data.filter(a => getStatusForRecord(a, activeCategory) === "Absent").length;

  // Strict check-in block modal state
  const [checkInBlockModal, setCheckInBlockModal] = useState<{ familyName: string; reasons: string[] } | null>(null);

  const handleCycle = async (id: string, familyName: string) => {
    const rec = data.find(a => a.id === id)!;
    const currentStatus = getStatusForRecord(rec, activeCategory);
    const nextStatus = statuses[(statuses.indexOf(currentStatus) + 1) % statuses.length];

    const isArrivalSession = activeCategory === "Arrival Check-in" || activeCategory === "checkin";
    if (isArrivalSession && nextStatus === "Present") {
      const reasons: string[] = [];

      // 1. Only check in if person/group is Confirmed
      const isConfirmed = (rec.family?.status === "Confirmed" && (rec.family?.registration?.status === "Confirmed" || !rec.family?.registration));
      if (!isConfirmed) {
        reasons.push(`Registration is "${rec.family?.status || "Pending"}". Only Confirmed registrations can be checked in.`);
      }

      // 2. Do not check in if room is not assigned
      const hasRoom = Boolean(rec.family?.room || rec.family?.roomId);
      if (!hasRoom) {
        reasons.push("Housing is unassigned. Lodging must be assigned before arrival check-in.");
      }

      // 3. Do not check in if there is pending payment / balance
      const balance = Number(rec.family?.registration?.balance || 0);
      const hasUnpaid = rec.family?.payments && rec.family.payments.length > 0 ? rec.family.payments.some((p: any) => p.status !== "Paid") : false;
      if (balance > 0 || hasUnpaid) {
        reasons.push(`Pending payment of $${balance.toFixed(2)} is due. All retreat fees must be settled before check-in.`);
      }

      if (reasons.length > 0) {
        setCheckInBlockModal({ familyName, reasons });
        return;
      }
    }

    await executeStatusChange(id, familyName, nextStatus);
  };

  const executeStatusChange = async (id: string, familyName: string, status: string) => {
    try {
      const res = await fetch(`/api/attendance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: activeCategory, status }),
      });

      const updatedRec = await res.json();
      if (res.ok) {
        setData(prev => prev.map(a => a.id === id ? { ...a, ...updatedRec } : a));
        showToast(`${familyName}: ${status} (${activeCategory})`);
      } else {
        showToast(updatedRec.error || "Failed to update attendance status.");
      }
    } catch {
      showToast("Network error updating attendance status.");
    }
  };

  const handleMarkAll = async () => {
    const isArrivalSession = activeCategory === "Arrival Check-in" || activeCategory === "checkin";

    // If arrival session, filter only eligible groups
    const eligibleRecords = isArrivalSession
      ? data.filter(rec => {
          const isConfirmed = rec.family?.status === "Confirmed" && (rec.family?.registration?.status === "Confirmed" || !rec.family?.registration);
          const hasRoom = Boolean(rec.family?.room || rec.family?.roomId);
          const balance = Number(rec.family?.registration?.balance || 0);
          const hasUnpaid = rec.family?.payments && rec.family.payments.length > 0 ? rec.family.payments.some((p: any) => p.status !== "Paid") : false;
          return isConfirmed && hasRoom && balance <= 0 && !hasUnpaid;
        })
      : data;

    if (isArrivalSession && eligibleRecords.length === 0) {
      showToast("No eligible groups for Arrival Check-in (all have unassigned rooms, pending payments, or unconfirmed status).");
      return;
    }

    const promises = eligibleRecords.map(rec => 
      fetch(`/api/attendance/${rec.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: activeCategory, status: "Present" }),
      })
    );
    await Promise.all(promises);

    const eligibleIds = new Set(eligibleRecords.map(r => r.id));
    setData(prev => prev.map(rec => {
      if (!eligibleIds.has(rec.id)) return rec;
      let sessionsMap: Record<string, string> = {};
      if (rec.sessionsJson) {
        try { sessionsMap = JSON.parse(rec.sessionsJson); } catch {}
      }
      sessionsMap[activeCategory] = "Present";
      return { ...rec, sessionsJson: JSON.stringify(sessionsMap) };
    }));

    if (isArrivalSession) {
      const skippedCount = data.length - eligibleRecords.length;
      showToast(`Marked ${eligibleRecords.length} eligible groups present.${skippedCount > 0 ? ` (${skippedCount} skipped due to unassigned rooms, pending payments, or unconfirmed status)` : ""}`);
    } else {
      showToast(`Everyone marked present for "${activeCategory}".`);
    }
  };

  // Compute final generated title for single creation
  const getComputedSessionTitle = () => {
    if (customSessionName.trim()) {
      return customSessionName.trim();
    }

    if (selectedDayKey === "all") {
      return activityPreset;
    }

    if (selectedDayKey === "none") {
      return activityPreset;
    }

    const matchedDay = inclusiveDays.find(d => d.dateStr === selectedDayKey) || inclusiveDays[0];
    if (!matchedDay) return activityPreset;

    const dayPrefix = matchedDay.isStart 
      ? `Start Date (${matchedDay.shortLabel})` 
      : matchedDay.isEnd 
      ? `End Date (${matchedDay.shortLabel})` 
      : `Day ${matchedDay.dayNumber} (${matchedDay.shortLabel})`;

    return `${dayPrefix} - ${activityPreset}`;
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();

    let newSessionsToAdd: string[] = [];

    if (selectedDayKey === "all") {
      // Create a session for start date, every in-between day, and end date
      newSessionsToAdd = inclusiveDays.map(d => {
        const tagLabel = d.isStart ? "Start Date" : d.isEnd ? "End Date" : `Day ${d.dayNumber}`;
        return `${tagLabel} (${d.shortLabel}) - ${activityPreset}`;
      });
    } else {
      const title = getComputedSessionTitle();
      if (!title) return;
      newSessionsToAdd = [title];
    }

    // Filter duplicates
    const uniqueToAdd = newSessionsToAdd.filter(s => !categories.includes(s));
    if (uniqueToAdd.length === 0) {
      showToast("Selected session(s) already exist.");
      return;
    }

    const updatedCatList = [...categories, ...uniqueToAdd];
    setCategories(updatedCatList);
    setActiveCategory(uniqueToAdd[0]);
    setCustomSessionName("");
    setShowAddCatModal(false);

    try {
      await fetch("/api/event", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceSessions: updatedCatList }),
      });
      showToast(`Added ${uniqueToAdd.length} attendance session(s)!`);
    } catch {
      showToast("Error saving session settings.");
    }
  };

  // 1-Click quick batch add all retreat days
  const handleBatchAddAllRetreatDays = async () => {
    if (inclusiveDays.length === 0) {
      showToast("Please configure retreat start and end dates in Settings.");
      return;
    }

    const generated = inclusiveDays.map(d => {
      const tagLabel = d.isStart ? "Start Date" : d.isEnd ? "End Date" : `Day ${d.dayNumber}`;
      return `${tagLabel} (${d.shortLabel}) - Attendance`;
    });

    const uniqueToAdd = generated.filter(s => !categories.includes(s));
    if (uniqueToAdd.length === 0) {
      showToast("All retreat day sessions are already created.");
      return;
    }

    const updatedCatList = [...categories, ...uniqueToAdd];
    setCategories(updatedCatList);
    setActiveCategory(uniqueToAdd[0]);
    setShowAddCatModal(false);

    try {
      await fetch("/api/event", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceSessions: updatedCatList }),
      });
      showToast(`Created attendance sessions for all ${uniqueToAdd.length} retreat days!`);
    } catch {
      showToast("Error saving attendance sessions.");
    }
  };

  const handleDeleteCategory = async (catToDelete: string) => {
    if (catToDelete === "Arrival Check-in" || catToDelete === "checkin") {
      showToast('"Arrival Check-in" is the default category and cannot be removed.');
      return;
    }
    if (categories.length <= 1) {
      showToast("Must keep at least one category.");
      return;
    }
    const updatedCatList = categories.filter(c => c !== catToDelete);
    setCategories(updatedCatList);
    if (activeCategory === catToDelete) {
      setActiveCategory(updatedCatList[0]);
    }

    try {
      await fetch("/api/event", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceSessions: updatedCatList }),
      });
      showToast(`Session "${catToDelete}" removed.`);
    } catch {
      showToast("Error updating sessions.");
    }
  };

  const handleScanSuccess = (scanResult: any) => {
    if (scanResult && scanResult.attendance) {
      const updatedAtt = scanResult.attendance;
      const familyName = scanResult.family?.name || "Family";

      setData(prev => {
        const exists = prev.some(a => a.id === updatedAtt.id);
        if (exists) {
          return prev.map(a => a.id === updatedAtt.id ? { ...a, ...updatedAtt, family: scanResult.family || a.family } : a);
        } else {
          return [{ ...updatedAtt, family: scanResult.family }, ...prev];
        }
      });

      showToast(`✅ ${familyName} checked in for ${activeCategory}!`);
    }
  };

  const attendanceActions: ActionDropdownItem[] = [
    {
      id: "create-session",
      label: "Create Attendance Session",
      icon: "➕",
      description: "Add a session for start, in-between, or end date",
      onClick: () => {
        if (inclusiveDays.length > 0) {
          setSelectedDayKey(inclusiveDays[0].dateStr);
        }
        setShowAddCatModal(true);
      },
    },
    {
      id: "mark-all",
      label: `Mark All Present (${activeCategory})`,
      icon: "✓",
      description: "Mark all visible attendees present for the active session",
      onClick: handleMarkAll,
    },
    {
      id: "batch-days",
      label: "Sync All Retreat Days",
      icon: "⚡",
      description: `Auto-create sessions for all ${inclusiveDays.length} retreat dates`,
      onClick: handleBatchAddAllRetreatDays,
    },
    {
      id: "div-1",
      divider: true,
      label: "",
    },
    {
      id: "manage-sessions",
      label: "Manage Existing Categories",
      icon: "⚙️",
      description: "View, reorder, or delete custom sessions",
      onClick: () => setShowAddCatModal(true),
    },
  ];

  return (
    <>
      {toast && <div className="toast show">{toast}</div>}

      <div className="top">
        <div>
          <h1>Attendance</h1>
          <div className="sub">
            {inclusiveDays.length > 0 ? (
              <span>
                Retreat Timeline: <b>{formatHumanDateRange(eventData?.startDate, eventData?.endDate)}</b> (First Day: <b>{inclusiveDays[0]?.fullLabel}</b> · Last Day: <b>{inclusiveDays[inclusiveDays.length - 1]?.fullLabel}</b>)
              </span>
            ) : (
              "Track retreat attendance across inclusive retreat dates."
            )}
          </div>
        </div>
        <div className="actions" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button 
            type="button" 
            className="btn primary" 
            onClick={() => setShowScanner(true)} 
            style={{ 
              backgroundColor: "#16a34a", 
              color: "#fff", 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "6px",
              padding: "7px 14px",
              fontWeight: 700,
            }}
          >
            📷 Scan QR Code
          </button>
          <ActionDropdown label="Actions" items={attendanceActions} />
        </div>
      </div>

      {/* Sync Banner if sessions don't include the retreat dates */}
      {inclusiveDays.length > 0 && categories.every(c => !inclusiveDays.some(d => c.includes(d.monthDay))) && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "10px 14px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ fontSize: "12px", color: "#166534" }}>
            📅 <b>Retreat Dates Configured:</b> First Day: <b>{inclusiveDays[0]?.fullLabel}</b> · Last Day: <b>{inclusiveDays[inclusiveDays.length - 1]?.fullLabel}</b> ({inclusiveDays.length} Days Inclusive)
          </div>
          <button
            type="button"
            className="btn tiny primary"
            onClick={handleBatchAddAllRetreatDays}
            style={{ fontSize: "11px", fontWeight: 700 }}
          >
            ⚡ Sync Attendance Sessions to Retreat Days ({inclusiveDays[0]?.shortLabel} – {inclusiveDays[inclusiveDays.length - 1]?.shortLabel})
          </button>
        </div>
      )}

      {/* Dynamic Category Segment Tabs */}
      <div className="segment section">
        {categories.map(cat => (
          <button 
            key={cat} 
            type="button"
            className={activeCategory === cat ? "active" : ""} 
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
        <button 
          type="button"
          className="btn tiny"
          onClick={() => {
            if (inclusiveDays.length > 0) {
              setSelectedDayKey(inclusiveDays[0].dateStr);
            }
            setShowAddCatModal(true);
          }}
          style={{ marginLeft: "8px", fontSize: "12px", border: "1px dashed var(--line)", background: "#ffffff", cursor: "pointer", fontWeight: 700 }}
        >
          ⚙ Manage / Add Days
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid cards4 section">
        <div className="card metric"><div className="label">{activeCategory}</div><div className="value">{count}/{total}</div></div>
        <div className="card metric"><div className="label">Attendance Rate</div><div className="value">{rate}%</div></div>
        <div className="card metric"><div className="label">Pending</div><div className="value">{pending}</div></div>
        <div className="card metric"><div className="label">Absent</div><div className="value">{absent}</div></div>
      </div>

      {/* Family Attendance List */}
      <div className="card panel section">
        <div style={{ marginBottom: "12px", display: "flex", gap: "8px" }}>
          <input className="input wide" placeholder="Search family or group..." value={q} onChange={e => setQ(e.target.value)} />
          <button type="button" className="btn" onClick={() => setShowScanner(true)} title="Open Camera Scanner">
            📷 Camera Scanner
          </button>
        </div>
        <div>
          {filteredData.map(a => {
            const currentStatus = getStatusForRecord(a, activeCategory);
            const isArrivalSession = activeCategory === "Arrival Check-in" || activeCategory === "checkin";
            const isConfirmed = a.family?.status === "Confirmed" && (a.family?.registration?.status === "Confirmed" || !a.family?.registration);
            const hasRoom = Boolean(a.family?.room || a.family?.roomId);
            const balance = Number(a.family?.registration?.balance || 0);
            const hasUnpaid = a.family?.payments && a.family.payments.length > 0 ? a.family.payments.some((p: any) => p.status !== "Paid") : false;
            const hasPendingPayment = balance > 0 || hasUnpaid;

            return (
              <div key={a.id} className="listitem">
                <span>
                  <b>{a.family?.name}</b>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", marginTop: "3px" }}>
                    <span className="small">{a.family ? a.family.adults + a.family.children : 0} people</span>
                    {isArrivalSession && (
                      <>
                        {!isConfirmed && (
                          <span style={{ fontSize: "11px", padding: "1px 6px", borderRadius: "4px", background: "rgba(239, 68, 68, 0.12)", color: "#dc2626", fontWeight: 600 }}>
                            ⚠️ Reg: {a.family?.status || "Pending"}
                          </span>
                        )}
                        {!hasRoom && (
                          <span style={{ fontSize: "11px", padding: "1px 6px", borderRadius: "4px", background: "rgba(217, 119, 6, 0.12)", color: "#b45309", fontWeight: 600 }}>
                            🏠 Room Unassigned
                          </span>
                        )}
                        {hasPendingPayment && (
                          <span style={{ fontSize: "11px", padding: "1px 6px", borderRadius: "4px", background: "rgba(239, 68, 68, 0.12)", color: "#dc2626", fontWeight: 600 }}>
                            💳 ${balance > 0 ? balance.toFixed(2) : "Payment"} Due
                          </span>
                        )}
                        {isConfirmed && hasRoom && !hasPendingPayment && (
                          <span style={{ fontSize: "11px", padding: "1px 6px", borderRadius: "4px", background: "rgba(16, 185, 129, 0.12)", color: "#059669", fontWeight: 600 }}>
                            ✓ Ready to Check In
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </span>
                <span className="actions-cell">
                  <span className={`pill ${currentStatus.toLowerCase()}`}>{currentStatus}</span>
                  <button type="button" className="btn tiny" onClick={() => handleCycle(a.id, a.family?.name)}>Change</button>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Camera Scanner Modal */}
      {showScanner && (
        <QRScannerModal 
          session={activeCategory as any} 
          onClose={() => setShowScanner(false)} 
          onScanSuccess={handleScanSuccess} 
        />
      )}

      {/* Add / Manage Categories & Retreat Dates Modal */}
      {showAddCatModal && (
        <div className="modalbg show" onClick={() => setShowAddCatModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <div>
                <h2 style={{ margin: 0 }}>Create Attendance Session</h2>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                  Options include the retreat Start Date, End Date, and all in-between days.
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddCatModal(false)}
                style={{ background: "transparent", border: 0, fontSize: "18px", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Quick Batch Button */}
            {inclusiveDays.length > 0 && (
              <div 
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  marginBottom: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#1e40af" }}>
                    📅 Retreat: {inclusiveDays.length} Days Inclusive
                  </div>
                  <div style={{ fontSize: "11px", color: "#3b82f6" }}>
                    {inclusiveDays[0]?.shortLabel} (Start) → {inclusiveDays[inclusiveDays.length - 1]?.shortLabel} (End)
                  </div>
                </div>
                <button
                  type="button"
                  className="btn tiny primary"
                  onClick={handleBatchAddAllRetreatDays}
                  style={{ fontSize: "11px", padding: "5px 10px" }}
                >
                  ⚡ Add All Retreat Days
                </button>
              </div>
            )}

            {/* Add New Session Form */}
            <form onSubmit={handleCreateSession} className="form" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px" }}>
              <div style={{ fontWeight: 800, fontSize: "13px", color: "#1e293b", marginBottom: "10px" }}>
                New Session Details
              </div>

              {/* 1. Date Selector (Inclusive Start, End, and in-between) */}
              <div>
                <label style={{ fontWeight: 700, fontSize: "12px", display: "block", marginBottom: "4px" }}>
                  1. Select Retreat Date (Start, In-Between, or End Date) *
                </label>
                <select
                  className="select"
                  value={selectedDayKey}
                  onChange={(e) => setSelectedDayKey(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", fontSize: "13px" }}
                >
                  {inclusiveDays.map((d) => (
                    <option key={d.dateStr} value={d.dateStr}>
                      {d.isStart 
                        ? `🚩 First Day (Start Date): ${d.fullLabel}` 
                        : d.isEnd 
                        ? `🏁 Last Day (End Date): ${d.fullLabel}` 
                        : `📅 Day ${d.dayNumber} (In-Between): ${d.fullLabel}`}
                    </option>
                  ))}
                  <option value="all">✨ All Retreat Days (Batch Create for Each Day)</option>
                  <option value="none">🌐 General / Non-dated Session</option>
                </select>
              </div>

              {/* 2. Activity / Session Type */}
              <div style={{ marginTop: "12px" }}>
                <label style={{ fontWeight: 700, fontSize: "12px", display: "block", marginBottom: "4px" }}>
                  2. Session Activity / Type
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                  {[
                    "Full Day Attendance",
                    "Arrival Check-in",
                    "Morning Worship",
                    "Afternoon Session",
                    "Dinner Check-in",
                    "Evening Service",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setActivityPreset(preset)}
                      style={{
                        fontSize: "11px",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        border: activityPreset === preset ? "1.5px solid #6366f1" : "1px solid #cbd5e1",
                        background: activityPreset === preset ? "#e0e7ff" : "#ffffff",
                        color: activityPreset === preset ? "#4338ca" : "#334155",
                        fontWeight: activityPreset === preset ? 700 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <input
                  ref={inputRef}
                  type="text"
                  className="input"
                  placeholder="Or custom session activity (e.g. Campfire, Breakfast, Workshop)"
                  value={customSessionName}
                  onChange={(e) => setCustomSessionName(e.target.value)}
                  style={{ width: "100%", padding: "6px 10px", fontSize: "12px" }}
                />
              </div>

              {/* Preview */}
              <div
                style={{
                  marginTop: "12px",
                  background: "#ffffff",
                  border: "1px dashed #cbd5e1",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "12px",
                }}
              >
                <span style={{ color: "#64748b" }}>Generated Session Name: </span>
                <b style={{ color: "#4f46e5" }}>
                  {selectedDayKey === "all"
                    ? `[Will generate ${inclusiveDays.length} separate sessions for each day: Start Date to End Date]`
                    : getComputedSessionTitle()}
                </b>
              </div>

              <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn primary" style={{ fontWeight: 700, fontSize: "12px", padding: "6px 14px" }}>
                  + Create Attendance Session
                </button>
              </div>
            </form>

            {/* Existing Categories List */}
            <div style={{ marginTop: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label style={{ fontWeight: "700", fontSize: "13px" }}>
                  Current Attendance Sessions ({categories.length})
                </label>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "180px", overflowY: "auto" }}>
                {categories.map((cat) => {
                  const isDefaultCat = cat === "Arrival Check-in" || cat === "checkin";
                  return (
                    <div 
                      key={cat} 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "space-between", 
                        padding: "6px 10px", 
                        background: "var(--panel)", 
                        border: "1px solid var(--line)", 
                        borderRadius: "6px" 
                      }}
                    >
                      <span style={{ fontWeight: "600", fontSize: "13px", color: "#1e293b" }}>
                        {cat}
                        {isDefaultCat && (
                          <span style={{ fontSize: "10px", color: "var(--primary)", fontWeight: "700", marginLeft: "6px", background: "rgba(99,102,241,0.1)", padding: "1px 6px", borderRadius: "4px" }}>
                            Default
                          </span>
                        )}
                      </span>
                      {!isDefaultCat && categories.length > 1 ? (
                        <button 
                          type="button" 
                          className="btn tiny" 
                          onClick={() => handleDeleteCategory(cat)}
                          style={{ color: "#ef4444", borderColor: "#fca5a5", background: "#fef2f2", cursor: "pointer", fontSize: "11px", padding: "2px 6px" }}
                          title={`Remove "${cat}"`}
                        >
                          ✕ Remove
                        </button>
                      ) : (
                        <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                          {isDefaultCat ? "Required" : "Min 1"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: "16px" }}>
              <button type="button" className="btn" onClick={() => setShowAddCatModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Check-In Blocked Modal (Strict requirements: Room assigned, No pending payment, Group confirmed) */}
      {checkInBlockModal && (
        <div className="modalbg show" onClick={() => setCheckInBlockModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <span style={{ fontSize: "28px" }}>🚫</span>
              <div>
                <h2 style={{ margin: 0, color: "#ef4444", fontSize: "1.2rem" }}>Check-In Blocked</h2>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                  Prerequisites not met for Arrival Check-in
                </div>
              </div>
            </div>
            <p style={{ marginBottom: "14px", color: "var(--fg)", fontSize: "14px" }}>
              <b>{checkInBlockModal.familyName}</b> cannot be checked in until all arrival requirements are satisfied:
            </p>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "12px",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: "8px",
              marginBottom: "20px"
            }}>
              {checkInBlockModal.reasons.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", color: "#dc2626" }}>
                  <span style={{ fontWeight: "bold" }}>•</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
            <div className="modal-actions" style={{ justifyContent: "flex-end" }}>
              <button 
                type="button" 
                className="btn primary" 
                style={{ backgroundColor: "#ef4444", borderColor: "#dc2626" }}
                onClick={() => setCheckInBlockModal(null)}
              >
                Dismiss & Resolve Requirements
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
