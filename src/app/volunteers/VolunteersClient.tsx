"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { getInclusiveRetreatDays } from "@/lib/dates";

export default function VolunteersClient({ initialData, event }: { initialData: any[]; event?: any }) {
  const router = useRouter();
  const inclusiveDays = getInclusiveRetreatDays(event?.startDate, event?.endDate);
  const defaultDate = inclusiveDays[0]?.fullLabel || "Oct 9, 2026 (Friday)";

  const [data, setData] = useState(initialData);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [toast, setToast] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newVol, setNewVol] = useState({ name: "", role: "Hospitality", date: defaultDate, shift: "9 AM–12 PM", skills: "" });

  const confirmed = data.filter(v => v.status === "Confirmed").length;
  const open = data.filter(v => v.status !== "Confirmed");
  const roles = Array.from(new Set(data.map(v => v.role)));

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  const filteredData = data.filter((v) => {
    const hay = `${v.name} ${v.role} ${v.skills || ""}`.toLowerCase();
    const matchesQuery = !query || hay.includes(query.toLowerCase());
    const matchesRole = roleFilter === "all" || v.role === roleFilter;
    return matchesQuery && matchesRole;
  });

  const handleConfirm = async (id: string, name: string) => {
    const res = await fetch(`/api/volunteers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm" }),
    });
    if (res.ok) {
      setData(prev => prev.map(v => v.id === id ? { ...v, status: "Confirmed" } : v));
      showToast(`${name}'s shift confirmed.`);
      router.refresh();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete volunteer ${name}?`)) return;
    const res = await fetch(`/api/volunteers/${id}`, { method: "DELETE" });
    if (res.ok) {
      setData(prev => prev.filter(v => v.id !== id));
      showToast(`Removed ${name}.`);
      router.refresh();
    }
  };

  const handleAddVolunteer = async () => {
    if (!newVol.name.trim()) { showToast("Enter volunteer name."); return; }
    const res = await fetch("/api/volunteers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newVol),
    });
    if (res.ok) {
      const vol = await res.json();
      setData(prev => [vol, ...prev]);
      setShowModal(false);
      setNewVol({ name: "", role: "Hospitality", date: "Sat Jul 25", shift: "9 AM–12 PM", skills: "" });
      showToast("Volunteer added.");
      router.refresh();
    }
  };

  return (
    <>
      {toast && <div className="toast show">{toast}</div>}

      {showModal && (
        <div className="modalbg show" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2>Add Volunteer</h2>
            <div className="form">
              <label>Name *<input className="input" value={newVol.name} onChange={e => setNewVol(p => ({...p, name: e.target.value}))} placeholder="e.g. Daniel Bekele" /></label>
              <div className="formgrid">
                <label>Role
                  <input className="input" value={newVol.role} onChange={e => setNewVol(p => ({...p, role: e.target.value}))} placeholder="Hospitality / Kitchen" />
                </label>
                <label>Date
                  <select 
                    className="select" 
                    value={newVol.date} 
                    onChange={e => setNewVol(p => ({...p, date: e.target.value}))}
                  >
                    {inclusiveDays.map(d => (
                      <option key={d.fullLabel} value={d.fullLabel}>
                        {d.isStart ? `🚩 Start Date: ` : d.isEnd ? `🏁 End Date: ` : `📅 Day ${d.dayNumber}: `}{d.fullLabel}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>Shift<input className="input" value={newVol.shift} onChange={e => setNewVol(p => ({...p, shift: e.target.value}))} placeholder="9 AM–12 PM" /></label>
              <label>Skills<input className="input" value={newVol.skills} onChange={e => setNewVol(p => ({...p, skills: e.target.value}))} placeholder="Welcome / kitchen / AV" /></label>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn primary" onClick={handleAddVolunteer}>Add Volunteer</button>
            </div>
          </div>
        </div>
      )}

      <div className="top">
        <div>
          <h1>Volunteers</h1>
          <div className="sub">Role/shift matching with coverage status and conflict visibility.</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setShowModal(true)}>+ Add Volunteer</button>
          <Link href="/communications" className="btn">Message Volunteers</Link>
        </div>
      </div>

      <div className="grid cards3">
        <div className="card metric"><div className="label">Confirmed</div><div className="value">{confirmed}</div></div>
        <div className="card metric"><div className="label">Needs Coverage</div><div className="value">{open.length}</div></div>
        <div className="card metric"><div className="label">Distinct Roles</div><div className="value">{roles.length}</div></div>
      </div>

      <div className="card toolbar section">
        <input 
          className="input wide" 
          value={query} 
          placeholder="Search volunteer name, role, skills..." 
          onChange={(e) => setQuery(e.target.value)} 
        />
        <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All roles</option>
          {roles.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div className="grid cards2 section">
        <div className="card panel">
          <div className="section-title">Open Shifts ({open.length})</div>
          {open.length > 0 ? open.map(v => (
            <div key={v.id} className="alert">
              <strong>{v.role} · {v.date}</strong>
              <span>{v.shift} · {v.name} ({v.skills || "General"})</span>
              <button className="btn tiny primary" style={{ marginTop: "7px" }} onClick={() => handleConfirm(v.id, v.name)}>
                Confirm {v.name}
              </button>
            </div>
          )) : <div className="empty">All shifts are covered! 🎉</div>}
        </div>
        <div className="card panel">
          <div className="section-title">Coverage by Role</div>
          {roles.map(role => {
            const a = data.filter(v => v.role === role);
            const n = a.filter(v => v.status === "Confirmed").length;
            return (
              <div key={role} style={{ marginBottom: "10px" }}>
                <div className="barlabel"><span>{role}</span><b>{n}/{a.length}</b></div>
                <div className="progress"><i style={{ width: `${(n / a.length) * 100}%` }}></i></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card panel section">
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr><th>Volunteer</th><th>Role</th><th>Shift</th><th>Date</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filteredData.map(v => (
                <tr key={v.id}>
                  <td><b>{v.name}</b></td>
                  <td>{v.role}</td>
                  <td>{v.shift}</td>
                  <td>{v.date}</td>
                  <td><span className={`pill ${v.status.toLowerCase()}`}>{v.status}</span></td>
                  <td className="actions-cell">
                    {v.status !== "Confirmed" && <button className="btn tiny" onClick={() => handleConfirm(v.id, v.name)}>Confirm</button>}
                    <button className="btn tiny danger" onClick={() => handleDelete(v.id, v.name)}>Remove</button>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">No volunteers match your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
