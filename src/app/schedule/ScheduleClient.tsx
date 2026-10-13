"use client";

import { useState } from "react";
import Link from "next/link";
import { getInclusiveRetreatDays, formatHumanDateRange } from "@/lib/dates";
import SchedulePrintModal from "@/components/SchedulePrintModal";

function formatTime(timeStr: string) {
  if (!timeStr) return "";
  if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;
  const parts = timeStr.split(":");
  if (parts.length >= 2) {
    let hour = parseInt(parts[0], 10);
    const minute = parts[1];
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  }
  return timeStr;
}

export default function ScheduleClient({ initialData, event }: { initialData: any[]; event?: any }) {
  // Use timezone-safe inclusive retreat days (Start Date, in-between days, and End Date)
  const inclusiveDays = getInclusiveRetreatDays(event?.startDate, event?.endDate);
  const retreatDays = inclusiveDays.map(d => d.fullLabel);
  const dayTabs = ["All", ...retreatDays];

  const [day, setDay] = useState("All");
  const [data, setData] = useState(initialData);
  const [toast, setToast] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [editEvent, setEditEvent] = useState<any | null>(null);
  const [newEvent, setNewEvent] = useState({ 
    day: retreatDays[0] || "Day 1", 
    start: "14:00", 
    end: "15:00", 
    title: "", 
    location: "Family Center", 
    team: "Program" 
  });

  const matchesDay = (eDay: string, selectedTab: string) => {
    if (selectedTab === "All") return true;
    if (!eDay) return false;
    const cleanEDay = eDay.trim().toLowerCase();
    const cleanTab = selectedTab.trim().toLowerCase();
    if (cleanEDay === cleanTab) return true;

    // Check weekday matching (e.g. "Friday" matching "Oct 9, 2026 (Friday)")
    const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    for (const wd of weekdays) {
      if (cleanEDay === wd || cleanEDay.includes(wd)) {
        if (cleanTab.includes(`(${wd})`) || cleanTab.includes(wd)) return true;
      }
    }

    // Check month and day number (e.g. "oct 9" in "oct 9, 2026 (friday)")
    const dayMatch = cleanEDay.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}/i);
    if (dayMatch && cleanTab.includes(dayMatch[0].toLowerCase())) return true;

    return cleanTab.includes(cleanEDay) || cleanEDay.includes(cleanTab);
  };

  const filteredData = data.filter(e => matchesDay(e.day, day));

  const conflicts: any[] = [];
  data.forEach((a, i) => {
    data.slice(i + 1).forEach(b => {
      if (a.day === b.day && a.location === b.location && a.start === b.start) {
        if (!conflicts.find(x => x.id === a.id)) conflicts.push(a);
        if (!conflicts.find(x => x.id === b.id)) conflicts.push(b);
      }
    });
  });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  const handleAdd = async () => {
    if (!newEvent.title.trim()) { showToast("Enter an event title."); return; }
    const formattedEvent = {
      ...newEvent,
      start: formatTime(newEvent.start),
      end: formatTime(newEvent.end),
    };
    const res = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formattedEvent),
    });
    if (res.ok) {
      const ev = await res.json();
      setData(prev => [...prev, ev]);
      setShowModal(false);
      setNewEvent({ day: retreatDays[0] || "Day 1", start: "14:00", end: "15:00", title: "", location: "Family Center", team: "Program" });
      showToast("Schedule event added.");
    }
  };

  const handleUpdate = async () => {
    if (!editEvent) return;
    const formattedEvent = {
      ...editEvent,
      start: formatTime(editEvent.start),
      end: formatTime(editEvent.end),
    };
    const res = await fetch(`/api/schedule/${editEvent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formattedEvent),
    });
    if (res.ok) {
      setData(prev => prev.map(e => e.id === editEvent.id ? formattedEvent : e));
      setEditEvent(null);
      showToast("Event updated.");
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/schedule/${id}`, { method: "DELETE" });
    if (res.ok) {
      setData(prev => prev.filter(e => e.id !== id));
      setEditEvent(null);
      showToast("Event deleted.");
    }
  };

  const dateRangeDisplay = formatHumanDateRange(event?.startDate, event?.endDate);

  return (
    <>
      {toast && <div className="toast show">{toast}</div>}

      {/* Add Event Modal */}
      {showModal && (
        <div className="modalbg show" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2>Add Schedule Event</h2>
            <div className="form">
              <div className="formgrid">
                <label>Retreat Day
                  <select value={newEvent.day} onChange={e => setNewEvent(p => ({...p, day: e.target.value}))}>
                    {inclusiveDays.map(d => (
                      <option key={d.fullLabel} value={d.fullLabel}>
                        {d.isStart ? `🚩 Start Date: ` : d.isEnd ? `🏁 End Date: ` : `📅 Day ${d.dayNumber}: `}{d.fullLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <label>Location<input value={newEvent.location} onChange={e => setNewEvent(p => ({...p, location: e.target.value}))} /></label>
              </div>
              <div className="formgrid">
                <label>Start Time<input type="time" value={newEvent.start} onChange={e => setNewEvent(p => ({...p, start: e.target.value}))} /></label>
                <label>End Time<input type="time" value={newEvent.end} onChange={e => setNewEvent(p => ({...p, end: e.target.value}))} /></label>
              </div>
              <label>Title *<input value={newEvent.title} onChange={e => setNewEvent(p => ({...p, title: e.target.value}))} placeholder="Family activity" /></label>
              <label>Team<input value={newEvent.team} onChange={e => setNewEvent(p => ({...p, team: e.target.value}))} /></label>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn primary" onClick={handleAdd}>Save Event</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {editEvent && (
        <div className="modalbg show" onClick={(e) => e.target === e.currentTarget && setEditEvent(null)}>
          <div className="modal">
            <h2>Edit Event</h2>
            <div className="form">
              <label>Title<input value={editEvent.title} onChange={e => setEditEvent((p: any) => ({...p, title: e.target.value}))} /></label>
              <div className="formgrid">
                <label>Retreat Day
                  <select value={editEvent.day} onChange={e => setEditEvent((p: any) => ({...p, day: e.target.value}))}>
                    {inclusiveDays.map(d => (
                      <option key={d.fullLabel} value={d.fullLabel}>
                        {d.isStart ? `🚩 Start Date: ` : d.isEnd ? `🏁 End Date: ` : `📅 Day ${d.dayNumber}: `}{d.fullLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <label>Location<input value={editEvent.location} onChange={e => setEditEvent((p: any) => ({...p, location: e.target.value}))} /></label>
              </div>
              <div className="formgrid">
                <label>Start Time<input type="time" value={editEvent.start} onChange={e => setEditEvent((p: any) => ({...p, start: e.target.value}))} /></label>
                <label>End Time<input type="time" value={editEvent.end} onChange={e => setEditEvent((p: any) => ({...p, end: e.target.value}))} /></label>
              </div>
              <div>
                <label>Team<input value={editEvent.team} onChange={e => setEditEvent((p: any) => ({...p, team: e.target.value}))} /></label>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn danger" onClick={() => handleDelete(editEvent.id)}>Delete</button>
              <button className="btn" onClick={() => setEditEvent(null)}>Cancel</button>
              <button className="btn primary" onClick={handleUpdate}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      <div className="top">
        <div>
          <h1>Schedule</h1>
          <div className="sub">
            Timeline for {event?.name || "Retreat"} ({dateRangeDisplay || "All retreat days"})
          </div>
        </div>
        <div className="actions" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button 
            type="button" 
            className="btn" 
            onClick={() => setShowPrintModal(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
          >
            🖨️ Print Schedule
          </button>
          <button className="btn primary" onClick={() => setShowModal(true)}>+ Add Event</button>
          <Link href="/volunteers" className="btn">View Team Coverage</Link>
        </div>
      </div>

      <div className="segment section">
        {dayTabs.map((d, idx) => (
          <button 
            key={d} 
            className={day === d ? "active" : ""} 
            onClick={() => setDay(d)}
            style={{ fontWeight: 700 }}
          >
            {d === "All" ? "All Days" : idx === 1 ? `🚩 ${d}` : idx === dayTabs.length - 1 ? `🏁 ${d}` : `📅 ${d}`}
          </button>
        ))}
      </div>

      {conflicts.length > 0 && (
        <div className="alert section">
          <strong>{conflicts.length} schedule conflict{conflicts.length > 1 ? "s" : ""} detected</strong>
          <span>Two events overlap in the same location. Review before publishing.</span>
        </div>
      )}

      <div className="card panel section">
        {retreatDays.filter(d => day === "All" || matchesDay(d, day)).map(d => {
          const rows = filteredData.filter(e => matchesDay(e.day, d));
          if (rows.length === 0) return null;
          return (
            <div key={d}>
              <div className="day-head" style={{ fontWeight: 800, fontSize: "14px", color: "#1e293b", padding: "8px 0", borderBottom: "2px solid #e2e8f0", marginBottom: "10px" }}>
                {d}
              </div>
              {rows.map(e => (
                <div key={e.id} className="schedule-row">
                  <div className="time">{e.start}<br/><span className="small">{e.end}</span></div>
                  <div className="eventbox">
                    <b>{e.title}</b>
                    <div className="small">{e.location} · {e.team}</div>
                    <span className={`pill ${conflicts.some(x => x.id === e.id) ? "conflict" : e.status === "Ready" ? "ready" : "draft"}`}>
                      {conflicts.some(x => x.id === e.id) ? "Conflict" : e.status}
                    </span>
                  </div>
                  <div>
                    <button className="btn tiny" onClick={() => setEditEvent(e)}>Edit</button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        {filteredData.length === 0 && <div className="empty">No events for this day.</div>}
      </div>

      {showPrintModal && (
        <SchedulePrintModal
          events={data}
          inclusiveDays={inclusiveDays}
          eventInfo={event}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </>
  );
}
