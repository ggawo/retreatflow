"use client";

import { useState, useEffect } from "react";
import Logo from "@/components/Logo";
import { formatHumanDateRange } from "@/lib/dates";

interface SchedulePrintModalProps {
  events: any[];
  inclusiveDays: any[];
  eventInfo?: any;
  onClose: () => void;
}

export default function SchedulePrintModal({
  events,
  inclusiveDays,
  eventInfo,
  onClose,
}: SchedulePrintModalProps) {
  const [selectedDayTab, setSelectedDayTab] = useState<string>("all");

  useEffect(() => {
    const onBefore = () => document.body.classList.add("printing-modal");
    const onAfter = () => document.body.classList.remove("printing-modal");
    window.addEventListener("beforeprint", onBefore);
    window.addEventListener("afterprint", onAfter);
    return () => {
      window.removeEventListener("beforeprint", onBefore);
      window.removeEventListener("afterprint", onAfter);
      document.body.classList.remove("printing-modal");
    };
  }, []);

  const handlePrint = () => {
    document.body.classList.add("printing-modal");
    window.print();
  };

  const matchesDay = (eDay: string, tabLabel: string) => {
    if (!eDay) return false;
    const cleanEDay = eDay.trim().toLowerCase();
    const cleanTab = tabLabel.trim().toLowerCase();
    if (cleanEDay === cleanTab) return true;

    // Check weekday matching (e.g. "friday" in "oct 9, 2026 (friday)")
    const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    for (const wd of weekdays) {
      if (cleanEDay === wd || cleanEDay.includes(wd)) {
        if (cleanTab.includes(`(${wd})`) || cleanTab.includes(wd)) return true;
      }
    }

    // Check month and day number (e.g. "oct 9")
    const dayMatch = cleanEDay.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}/i);
    if (dayMatch && cleanTab.includes(dayMatch[0].toLowerCase())) return true;

    return cleanTab.includes(cleanEDay) || cleanEDay.includes(cleanTab);
  };

  const retreatDaysToDisplay = inclusiveDays.length > 0 
    ? inclusiveDays 
    : [{ fullLabel: "Retreat Schedule", shortLabel: "Schedule", isStart: true, isEnd: true, dayNumber: 1, dateStr: "all" }];

  const filteredDays = selectedDayTab === "all"
    ? retreatDaysToDisplay
    : retreatDaysToDisplay.filter(d => d.dateStr === selectedDayTab || d.fullLabel === selectedDayTab);

  const eventName = eventInfo?.name || "2026 Family Summer Retreat";
  const dateRangeDisplay = formatHumanDateRange(eventInfo?.startDate, eventInfo?.endDate);
  const locationDisplay = eventInfo?.location || "Pine Valley Christian Camp";

  // Total events in selected filter
  const totalEventsInView = events.filter(e => {
    if (selectedDayTab === "all") return true;
    return matchesDay(e.day, selectedDayTab);
  }).length;

  return (
    <div
      className="modal-backdrop print-modal-active"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(15, 23, 42, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        className="modal-content schedule-print-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "960px",
          width: "95%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
          borderRadius: "16px",
          background: "#ffffff",
        }}
      >
        {/* Sticky Control Header (Hidden when printing) */}
        <div
          className="no-print"
          style={{
            background: "#0f172a",
            color: "#ffffff",
            padding: "16px 58px 16px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            borderBottom: "1px solid #334155",
            position: "relative",
          }}
        >
          {/* Upper Right Corner Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="no-print"
            style={{
              position: "absolute",
              top: "14px",
              right: "16px",
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#94a3b8",
              fontSize: "18px",
              cursor: "pointer",
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
              zIndex: 10,
            }}
            title="Close modal"
            aria-label="Close modal"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.16)";
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
              e.currentTarget.style.color = "#94a3b8";
            }}
          >
            ✕
          </button>

          {/* Left Title and Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Logo size={32} showText={false} glow />
            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "#818cf8",
                }}
              >
                SCHEDULE & ITINERARY PRINT
              </div>
              <h2 style={{ margin: "2px 0 0 0", fontSize: "19px", fontWeight: 800, color: "#fff" }}>
                Retreat Schedule ({totalEventsInView} Items)
              </h2>
            </div>
          </div>

          {/* Filter Segment & Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div
              style={{
                display: "flex",
                background: "#1e293b",
                padding: "3px",
                borderRadius: "8px",
                border: "1px solid #334155",
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedDayTab("all")}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 700,
                  border: 0,
                  borderRadius: "6px",
                  cursor: "pointer",
                  background: selectedDayTab === "all" ? "#6366f1" : "transparent",
                  color: selectedDayTab === "all" ? "#ffffff" : "#94a3b8",
                }}
              >
                All Days
              </button>
              {inclusiveDays.map((d) => (
                <button
                  key={d.dateStr}
                  type="button"
                  onClick={() => setSelectedDayTab(d.fullLabel)}
                  style={{
                    padding: "6px 10px",
                    fontSize: "12px",
                    fontWeight: 700,
                    border: 0,
                    borderRadius: "6px",
                    cursor: "pointer",
                    background: selectedDayTab === d.fullLabel ? "#16a34a" : "transparent",
                    color: selectedDayTab === d.fullLabel ? "#ffffff" : "#94a3b8",
                  }}
                  title={d.fullLabel}
                >
                  {d.isStart ? `🚩 Start` : d.isEnd ? `🏁 End` : `Day ${d.dayNumber}`}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn primary"
              onClick={handlePrint}
              style={{
                backgroundColor: "#16a34a",
                borderColor: "#16a34a",
                color: "#ffffff",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 700,
                fontSize: "13px",
                padding: "8px 14px",
              }}
            >
              🖨️ Print Schedule
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div
          className="printable-schedule-area"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "32px",
            background: "#ffffff",
            color: "#0f172a",
          }}
        >
          {/* Printable Document Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              borderBottom: "2px solid #0f172a",
              paddingBottom: "16px",
              marginBottom: "24px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  color: "#4f46e5",
                  marginBottom: "4px",
                }}
              >
                RETREATFLOW · OFFICIAL EVENT PROGRAM
              </div>
              <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" }}>
                {eventName}
              </h1>
              <div style={{ fontSize: "13px", color: "#475569", fontWeight: 600 }}>
                📅 {dateRangeDisplay || "Full Retreat Schedule"} · 📍 {locationDisplay}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <Logo size={36} showText={false} />
              <div style={{ fontSize: "10px", color: "#64748b", marginTop: "6px", fontWeight: 600 }}>
                Filter: <strong>{selectedDayTab === "all" ? "All Days" : selectedDayTab}</strong>
              </div>
              <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                {totalEventsInView} Scheduled Activities
              </div>
            </div>
          </div>

          {/* Schedule Days Container */}
          {filteredDays.map((d) => {
            const dayEvents = events.filter((e) => matchesDay(e.day, d.fullLabel || d));

            return (
              <div key={d.dateStr || d.fullLabel} style={{ marginBottom: "28px", pageBreakInside: "avoid", breakInside: "avoid" }}>
                {/* Day Header Banner */}
                <div
                  style={{
                    background: "#f1f5f9",
                    borderLeft: "4px solid #4f46e5",
                    padding: "8px 14px",
                    borderRadius: "0 8px 8px 0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: "14px", color: "#0f172a" }}>
                    {d.isStart && <span style={{ color: "#16a34a", marginRight: "6px" }}>🚩 [Start Date]</span>}
                    {d.isEnd && <span style={{ color: "#b76e00", marginRight: "6px" }}>🏁 [End Date]</span>}
                    {d.fullLabel || d}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>
                    {dayEvents.length} {dayEvents.length === 1 ? "Activity" : "Activities"}
                  </div>
                </div>

                {dayEvents.length === 0 ? (
                  <div style={{ padding: "12px", color: "#94a3b8", fontStyle: "italic", fontSize: "12px" }}>
                    No activities scheduled for this day yet.
                  </div>
                ) : (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "12px",
                      marginBottom: "6px",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1", textAlign: "left" }}>
                        <th style={{ padding: "8px 10px", width: "130px", color: "#334155", fontWeight: 800 }}>Time</th>
                        <th style={{ padding: "8px 10px", color: "#334155", fontWeight: 800 }}>Activity / Event</th>
                        <th style={{ padding: "8px 10px", width: "180px", color: "#334155", fontWeight: 800 }}>Location</th>
                        <th style={{ padding: "8px 10px", width: "150px", color: "#334155", fontWeight: 800 }}>Ministry / Lead</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayEvents.map((e, index) => (
                        <tr
                          key={e.id || index}
                          className="schedule-print-row"
                          style={{
                            borderBottom: "1px solid #e2e8f0",
                            background: index % 2 === 0 ? "#ffffff" : "#fcfcfd",
                            pageBreakInside: "avoid",
                            breakInside: "avoid",
                          }}
                        >
                          <td style={{ padding: "8px 10px", verticalAlign: "top", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>
                            {e.start} {e.end && <span style={{ color: "#64748b", fontWeight: 500 }}>– {e.end}</span>}
                          </td>
                          <td style={{ padding: "8px 10px", verticalAlign: "top" }}>
                            <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "13px" }}>{e.title}</div>
                          </td>
                          <td style={{ padding: "8px 10px", verticalAlign: "top", color: "#334155" }}>
                            📍 {e.location || "Main Campus"}
                          </td>
                          <td style={{ padding: "8px 10px", verticalAlign: "top", color: "#475569" }}>
                            {e.team ? (
                              <span style={{ background: "#e0e7ff", color: "#3730a3", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: 700 }}>
                                {e.team}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}

          {/* Printable Document Footer */}
          <div
            style={{
              marginTop: "24px",
              paddingTop: "12px",
              borderTop: "1px solid #cbd5e1",
              fontSize: "11px",
              color: "#64748b",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>RetreatFlow Event Operations · Official Schedule</span>
            <span>Printed Itinerary · Subject to change</span>
          </div>
        </div>
      </div>
    </div>
  );
}
