"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GroupMember, computeMemberCounts } from "@/lib/members";

export default function NewRegistration() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [eventPricing, setEventPricing] = useState({ pricePerAdult: 120, pricePerChild: 60, childAgeThreshold: 12 });
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);

  // Registration Type: "group" | "family"
  const [regType, setRegType] = useState<"group" | "family">("group");

  const [form, setForm] = useState({
    name: "",
    leader: "",
    email: "",
    phone: "",
    adults: 1,
    children: 0,
    nonPayingChildren: 0,
    roomPref: "Any",
    access: "",
    waiver: "yes",
    notes: "",
  });

  // Group Members Roster
  const [members, setMembers] = useState<GroupMember[]>([
    { id: "m_1", name: "", role: "Leader", roomId: "", roomName: "", notes: "" },
  ]);

  useEffect(() => {
    // Fetch retreat pricing and event details
    fetch("/api/event")
      .then(res => res.json())
      .then(data => {
        if (data) {
          setEventPricing({
            pricePerAdult: data.pricePerAdult ?? 120,
            pricePerChild: data.pricePerChild ?? 60,
            childAgeThreshold: data.childAgeThreshold ?? 12,
          });
        }
      })
      .catch(() => {});

    // Fetch buildings and rooms for member room assignment
    fetch("/api/buildings")
      .then(res => res.json())
      .then(buildings => {
        if (Array.isArray(buildings)) {
          const rooms = buildings.flatMap((b: any) =>
            (b.rooms || []).map((r: any) => ({
              id: r.id,
              number: r.number,
              bname: b.name,
              capacity: r.capacity,
              accessible: r.accessible,
            }))
          );
          setAvailableRooms(rooms);
        }
      })
      .catch(() => {});
  }, []);

  const handleSwitchRegType = (type: "group" | "family") => {
    setRegType(type);
    if (type === "group") {
      const leaderMember: GroupMember = {
        id: members[0]?.id || "m_leader",
        name: form.leader || members[0]?.name || "",
        role: "Leader",
        roomId: members[0]?.roomId || "",
        roomName: members[0]?.roomName || "",
        notes: members[0]?.notes || "",
      };
      const newMembers = members.length > 0
        ? [leaderMember, ...members.slice(1)]
        : [leaderMember];
      setMembers(newMembers);
      const counts = computeMemberCounts(newMembers, eventPricing.childAgeThreshold);
      setForm(prev => ({ ...prev, ...counts }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "leader") {
      let updatedMembers: GroupMember[] = [];
      setMembers(prevM => {
        if (prevM.length === 0) {
          updatedMembers = [{ id: "m_leader", name: value, role: "Leader", roomId: "", roomName: "", notes: "" }];
        } else {
          updatedMembers = [...prevM];
          updatedMembers[0] = { ...updatedMembers[0], name: value, role: "Leader" };
        }
        return updatedMembers;
      });

      const effectiveMembers = members.length > 0
        ? [{ ...members[0], name: value, role: "Leader" as const }, ...members.slice(1)]
        : [{ id: "m_leader", name: value, role: "Leader" as const, roomId: "", roomName: "", notes: "" }];
      const counts = computeMemberCounts(effectiveMembers, eventPricing.childAgeThreshold);

      setForm(prev => ({
        ...prev,
        leader: value,
        adults: counts.adults,
        children: counts.children,
        nonPayingChildren: counts.nonPayingChildren,
      }));
      return;
    }

    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Group Member Management
  const handleAddMember = () => {
    const newId = `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newMember: GroupMember = {
      id: newId,
      name: "",
      role: "Adult",
      roomId: "",
      roomName: "",
      notes: "",
    };
    const updated = [...members, newMember];
    setMembers(updated);
    if (regType === "group") {
      const counts = computeMemberCounts(updated, eventPricing.childAgeThreshold);
      setForm(prev => ({ ...prev, ...counts }));
    }
  };

  const handleUpdateMember = (id: string, field: keyof GroupMember, value: any) => {
    const updated = members.map(m => {
      if (m.id !== id) return m;
      const mod = { ...m, [field]: value };
      if (field === "roomId") {
        const foundRoom = availableRooms.find(r => r.id === value);
        mod.roomName = foundRoom ? `${foundRoom.bname} - Room ${foundRoom.number}` : "";
      }
      return mod;
    });
    setMembers(updated);

    // If first member (leader) name changes, sync form.leader
    const isFirstMember = members[0]?.id === id;
    if (isFirstMember && field === "name") {
      setForm(prev => ({ ...prev, leader: value }));
    }

    if (regType === "group") {
      const counts = computeMemberCounts(updated, eventPricing.childAgeThreshold);
      setForm(prev => ({ ...prev, ...counts }));
    }
  };

  const handleRemoveMember = (id: string) => {
    if (members.length <= 1) {
      showToast("Group must have at least one member (the leader).");
      return;
    }
    const updated = members.filter(m => m.id !== id);
    setMembers(updated);
    if (regType === "group") {
      const counts = computeMemberCounts(updated, eventPricing.childAgeThreshold);
      setForm(prev => ({ ...prev, ...counts }));
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const validateStep1 = () => {
    if (!form.name.trim()) {
      showToast(regType === "group" ? "Please enter a group name." : "Please enter a family name.");
      return false;
    }
    if (regType === "group") {
      const emptyNames = members.filter(m => !m.name.trim());
      if (emptyNames.length > 0) {
        showToast("Please write a name for each group member.");
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (loading) return;
    if (!form.name.trim()) {
      showToast("Please enter a family or group name.");
      return;
    }

    setLoading(true);

    const validMembers = members.filter(m => m.name.trim().length > 0);
    const payload = {
      ...form,
      adults: Number(form.adults) || 1,
      children: Number(form.children) || 0,
      nonPayingChildren: Number(form.nonPayingChildren) || 0,
      members: validMembers,
      // If all members share a room or the first member has a room, set primary roomId
      roomId: validMembers.find(m => m.roomId)?.roomId || null,
    };

    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(`${regType === "group" ? "Group" : "Family"} registration created successfully!`);
        router.push("/registration");
        router.refresh();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to create registration.");
        setLoading(false);
      }
    } catch {
      showToast("Failed to create registration.");
      setLoading(false);
    }
  };

  const totalParticipants = Number(form.adults) + Number(form.children) + Number(form.nonPayingChildren);
  const estimatedBalance = (Number(form.adults) * eventPricing.pricePerAdult) + (Number(form.children) * eventPricing.pricePerChild);

  return (
    <>
      {toast && <div className="toast show">{toast}</div>}

      <div className="top">
        <div>
          <h1>New Registration</h1>
          <div className="sub">Register family units or youth/church groups with individual member rosters and room assignments.</div>
        </div>
      </div>

      <div className="card panel" style={{ maxWidth: "780px", margin: "0 auto" }}>
        {/* Stepper */}
        <div className="stepper">
          <span className={step === 1 ? "on" : ""}>1 {regType === "group" ? "Group & Members" : "Household Info"}</span>
          <span className={step === 2 ? "on" : ""}>2 Housing & Waivers</span>
          <span className={step === 3 ? "on" : ""}>3 Review & Submit</span>
        </div>

        <div className="form" style={{ marginTop: "22px" }}>
          {step === 1 && (
            <>
              {/* Type Switcher */}
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 750, fontSize: "13px" }}>
                  Registration Type:
                </label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setRegType("group")}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: regType === "group" ? "2px solid #5b5bd6" : "1px solid #d0d5dd",
                      background: regType === "group" ? "#f0f2fe" : "#ffffff",
                      color: regType === "group" ? "#4747b8" : "#344054",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    <span>👥</span>
                    <span>Church Group / Ministry</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegType("family")}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: regType === "family" ? "2px solid #5b5bd6" : "1px solid #d0d5dd",
                      background: regType === "family" ? "#f0f2fe" : "#ffffff",
                      color: regType === "family" ? "#4747b8" : "#344054",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    <span>👨‍👩‍👧</span>
                    <span>Family Household</span>
                  </button>
                </div>
              </div>

              {/* Primary Header Info */}
              <label>
                {regType === "group" ? "Group / Ministry Name *" : "Family Household Name *"}
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder={regType === "group" ? "e.g. Grace Youth Group / College Ministry" : "e.g. Johnson Family"}
                  required
                />
              </label>

              <div className="formgrid">
                <label>
                  Group Leader / Primary Contact *
                  <input
                    name="leader"
                    value={form.leader}
                    onChange={handleChange}
                    placeholder="e.g. Sarah Miller"
                    required
                  />
                </label>
                <label>
                  Contact Email *
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="leader@example.com"
                    required
                  />
                </label>
              </div>

              <div className="formgrid">
                <label>
                  Contact Phone
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="555-0199"
                  />
                </label>
                <label>
                  General Room Preference
                  <select name="roomPref" value={form.roomPref} onChange={handleChange}>
                    <option>Any</option>
                    <option>Ground floor</option>
                    <option>Near chapel</option>
                    <option>Near dining</option>
                    <option>Near leaders</option>
                    <option>Full room / Cabin</option>
                  </select>
                </label>
              </div>

              {/* GROUP MEMBERS & ROOM ASSIGNMENTS ROSTER */}
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #e4e7ec" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#172033" }}>
                      👥 Individual Group Members ({members.length})
                    </h3>
                    <div style={{ fontSize: "12px", color: "#667085" }}>
                      Member #1 is the Group Leader (Adult paying). Add other attendees and select rooms.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMember}
                    className="btn"
                    style={{ fontSize: "12px", padding: "6px 12px", background: "#f0f2fe", color: "#4747b8", borderColor: "#c7d2fe", fontWeight: 700 }}
                  >
                    + Add Member
                  </button>
                </div>

                <div style={{ display: "grid", gap: "10px" }}>
                  {members.map((member, index) => (
                    <div
                      key={member.id}
                      style={{
                        background: index === 0 ? "#f8faff" : "#f8fafc",
                        border: index === 0 ? "1.5px solid #c7d2fe" : "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 800, color: index === 0 ? "#4338ca" : "#64748b", width: "24px" }}>
                            #{index + 1}
                          </span>
                          {index === 0 && (
                            <span style={{ fontSize: "10px", fontWeight: 800, color: "#4338ca", background: "#e0e7ff", padding: "2px 6px", borderRadius: "4px" }}>
                              👑 LEADER
                            </span>
                          )}
                        </div>

                        {/* Name Input */}
                        <div style={{ flex: "2", minWidth: "160px" }}>
                          <input
                            className="input"
                            value={member.name}
                            onChange={(e) => handleUpdateMember(member.id, "name", e.target.value)}
                            placeholder={index === 0 ? "Group Leader Full Name *" : "Full Name (e.g. David Kim)"}
                            style={{
                              width: "100%",
                              padding: "7px 10px",
                              fontSize: "13px",
                              borderColor: index === 0 && !member.name.trim() ? "#fca5a5" : undefined,
                            }}
                          />
                        </div>

                        {/* Role Select */}
                        <div style={{ flex: "1.4", minWidth: "150px" }}>
                          <select
                            className="select"
                            value={member.role}
                            onChange={(e) => handleUpdateMember(member.id, "role", e.target.value)}
                            style={{ width: "100%", padding: "7px 10px", fontSize: "13px" }}
                          >
                            <option value="Leader">👑 Leader (Adult Paying - ${eventPricing.pricePerAdult})</option>
                            <option value="Adult">Adult (${eventPricing.pricePerAdult})</option>
                            <option value="Youth">Youth (${eventPricing.pricePerChild})</option>
                            <option value="Child">Child (${eventPricing.pricePerChild})</option>
                            <option value="Infant">Infant (Free)</option>
                          </select>
                        </div>

                        {/* Room Assignment Select */}
                        <div style={{ flex: "2", minWidth: "170px" }}>
                          <select
                            className="select"
                            value={member.roomId || ""}
                            onChange={(e) => handleUpdateMember(member.id, "roomId", e.target.value)}
                            style={{ width: "100%", padding: "7px 10px", fontSize: "13px", color: member.roomId ? "#16a34a" : "#64748b" }}
                          >
                            <option value="">🚪 Room: Assign Later / Any</option>
                            {availableRooms.map(r => (
                              <option key={r.id} value={r.id}>
                                🏠 {r.bname} - Room {r.number} (Cap: {r.capacity}) {r.accessible ? "[♿]" : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Remove Member - disable removing the leader */}
                        {index > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.id)}
                            style={{
                              border: 0,
                              background: "transparent",
                              color: "#ef4444",
                              fontSize: "16px",
                              cursor: "pointer",
                              padding: "4px 8px",
                            }}
                            title="Remove member"
                          >
                            ✕
                          </button>
                        ) : (
                          <span style={{ fontSize: "11px", color: "#94a3b8", padding: "4px 6px" }} title="Primary leader cannot be removed">
                            🔒
                          </span>
                        )}
                      </div>

                      {/* Optional Notes for this member */}
                      <div style={{ marginTop: "6px", display: "flex", gap: "10px" }}>
                        <input
                          className="input"
                          value={member.notes || ""}
                          onChange={(e) => handleUpdateMember(member.id, "notes", e.target.value)}
                          placeholder="Optional notes: dietary, allergies, roommate request..."
                          style={{ width: "100%", padding: "5px 8px", fontSize: "11px", background: "#ffffff", borderColor: "#e2e8f0" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Counts & Estimated Total Summary Bar */}
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    marginTop: "16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 800, color: "#166534" }}>
                        👥 {totalParticipants} Total Participants
                      </span>
                      <span style={{ fontSize: "11px", background: "#dcfce7", color: "#15803d", padding: "2px 7px", borderRadius: "4px", fontWeight: 700 }}>
                        👑 Leader included as Adult paying
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#15803d", marginTop: "3px" }}>
                      <b>{form.adults}</b> Adults (incl. Leader) @ ${eventPricing.pricePerAdult} · <b>{form.children}</b> Youth/Children @ ${eventPricing.pricePerChild} {form.nonPayingChildren > 0 ? `· ${form.nonPayingChildren} Free` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "11px", color: "#166534", fontWeight: 600 }}>Estimated Total</div>
                    <div style={{ fontSize: "18px", fontWeight: 900, color: "#15803d" }}>
                      ${estimatedBalance.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: "20px" }}>
                <Link href="/registration" className="btn">Cancel</Link>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    if (validateStep1()) setStep(2);
                  }}
                >
                  Continue to Requirements →
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <label>Accessibility / Medical Needs
                <input
                  name="access"
                  value={form.access}
                  onChange={handleChange}
                  placeholder="None / ground floor only / wheelchair accessible"
                />
              </label>

              <label>Waiver Status
                <select name="waiver" value={form.waiver} onChange={handleChange}>
                  <option value="yes">Completed & Signed</option>
                  <option value="no">Pending / Missing</option>
                </select>
              </label>

              <label>Special Instructions & Group Notes
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Dietary requirements, estimated arrival time, vehicle count, chaperone notes..."
                ></textarea>
              </label>

              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setStep(1)}>← Back to Members</button>
                <button type="button" className="btn primary" onClick={() => setStep(3)}>Review Registration →</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="alert" style={{ background: "#f8fafc", border: "1px solid #cbd5e1" }}>
                <strong style={{ fontSize: "16px", color: "#0f172a" }}>
                  {regType === "group" ? "👥 Group:" : "👨‍👩‍👧 Family:"} {form.name}
                </strong>
                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                  Leader: <b>{form.leader}</b> ({form.email || "no email"}) · {totalParticipants} Participants
                </div>
              </div>

              {/* Members Roster Summary */}
              <div style={{ margin: "16px 0", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px" }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: 800, color: "#172033" }}>
                  Group Members Roster ({members.length})
                </h4>
                <div className="tablewrap">
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                        <th style={{ padding: "6px 8px" }}>#</th>
                        <th style={{ padding: "6px 8px" }}>Name</th>
                        <th style={{ padding: "6px 8px" }}>Role</th>
                        <th style={{ padding: "6px 8px" }}>Assigned Room</th>
                        <th style={{ padding: "6px 8px" }}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m, idx) => (
                        <tr key={m.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "6px 8px", color: "#64748b" }}>{idx + 1}</td>
                          <td style={{ padding: "6px 8px", fontWeight: 700, color: "#0f172a" }}>{m.name || "—"}</td>
                          <td style={{ padding: "6px 8px" }}>
                            <span className={`pill ${m.role === "Leader" ? "complete" : m.role === "Infant" ? "info" : "available"}`}>
                              {m.role}
                            </span>
                          </td>
                          <td style={{ padding: "6px 8px", fontWeight: m.roomId ? 700 : 400, color: m.roomId ? "#16a34a" : "#64748b" }}>
                            {m.roomName ? `🏠 ${m.roomName}` : "Unassigned"}
                          </td>
                          <td style={{ padding: "6px 8px", color: "#64748b", fontSize: "11px" }}>{m.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pricing Breakdown Card */}
              <div style={{ margin: "16px 0", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px" }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: 800, color: "#172033" }}>
                  Estimated Balance Breakdown
                </h4>
                <div style={{ display: "grid", gap: "6px", fontSize: "13px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#1e293b" }}>
                    <span>👑 Group Leader ({form.leader || "Primary"} - Adult paying):</span>
                    <span style={{ fontWeight: 700 }}>1 × ${eventPricing.pricePerAdult} = ${eventPricing.pricePerAdult}</span>
                  </div>
                  {Number(form.adults) > 1 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#1e293b" }}>
                      <span>Additional Adults:</span>
                      <span style={{ fontWeight: 700 }}>{Number(form.adults) - 1} × ${eventPricing.pricePerAdult} = ${(Number(form.adults) - 1) * eventPricing.pricePerAdult}</span>
                    </div>
                  )}
                  {Number(form.children) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#1e293b" }}>
                      <span>Youth & Children:</span>
                      <span style={{ fontWeight: 700 }}>{form.children} × ${eventPricing.pricePerChild} = {Number(form.children) * eventPricing.pricePerChild}</span>
                    </div>
                  )}
                  {Number(form.nonPayingChildren) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                      <span>Non-paying Infants:</span>
                      <span>{form.nonPayingChildren} × $0 = $0</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #cbd5e1", paddingTop: "8px", marginTop: "4px", fontSize: "15px" }}>
                    <span style={{ fontWeight: 800, color: "#0f172a" }}>Total Estimated Balance:</span>
                    <span style={{ fontWeight: 900, color: "#4f46e5" }}>${estimatedBalance.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: "8px", padding: "6px 0", fontSize: "13px" }}>
                <div><b>General Room Preference:</b> {form.roomPref}</div>
                <div><b>Waiver Status:</b> {form.waiver === "yes" ? "✅ Complete & Signed" : "⚠️ Missing / Pending"}</div>
                <div><b>Accessibility:</b> {form.access || "None"}</div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setStep(2)}>← Back</button>
                <button 
                  type="button"
                  className="btn primary" 
                  onClick={handleSave} 
                  disabled={loading}
                  style={{
                    pointerEvents: loading ? "none" : "auto",
                    opacity: loading ? 0.6 : 1,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Creating Registration..." : "Confirm & Create Registration"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
