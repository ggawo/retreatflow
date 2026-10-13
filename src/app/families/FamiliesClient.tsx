"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import QRCodeModal from "@/components/QRCodeModal";
import ActionDropdown, { ActionDropdownItem } from "@/components/ActionDropdown";
import { GroupMember, parseMembers, serializeMembers, computeMemberCounts } from "@/lib/members";

function parseCSV(text: string) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const parseLine = (line: string) => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim().replace(/^"(.*)"$/, "$1"));
        cur = "";
      } else {
        cur += char;
      }
    }
    result.push(cur.trim().replace(/^"(.*)"$/, "$1"));
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  
  const records: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    if (vals.length < 2) continue;

    const getVal = (keys: string[], defaultVal: string = "") => {
      for (const k of keys) {
        const idx = headers.findIndex(h => h.includes(k));
        if (idx !== -1 && vals[idx] !== undefined && vals[idx] !== "") return vals[idx];
      }
      return defaultVal;
    };

    const name = getVal(["name", "family", "group"], "");
    const leader = getVal(["leader", "contact", "primary"], "");
    const email = getVal(["email", "mail"], "");

    if (!name && !leader && !email) continue;

    records.push({
      name: name || `Family ${i}`,
      leader: leader || name || `Leader ${i}`,
      email: email || `contact${i}@example.com`,
      phone: getVal(["phone", "mobile", "cell"], ""),
      adults: Number(getVal(["adults", "adult"], "1")) || 1,
      children: Number(getVal(["payingchildren", "children", "child"], "0")) || 0,
      nonPayingChildren: Number(getVal(["nonpayingchildren", "freechildren", "infant"], "0")) || 0,
      roomPref: getVal(["roompreference", "roompref", "room"], "Any"),
      access: getVal(["accessibility", "access", "needs"], "None"),
      status: getVal(["status"], "Confirmed") || "Confirmed",
      notes: getVal(["notes", "note", "dietary"], ""),
    });
  }

  return records;
}

export default function FamiliesClient({ initialData, buildings = [] }: { initialData: any[]; buildings?: any[] }) {
  const [families, setFamilies] = useState(initialData);
  const [buildingsList, setBuildingsList] = useState(buildings);

  useEffect(() => {
    setFamilies(initialData);
  }, [initialData]);

  useEffect(() => {
    if (buildings && buildings.length > 0) {
      setBuildingsList(buildings);
    } else {
      fetch("/api/buildings")
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setBuildingsList(data); })
        .catch(() => {});
    }
  }, [buildings]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<any | null>(null);
  const [editFamily, setEditFamily] = useState<any | null>(null);
  const [qrFamilyModal, setQrFamilyModal] = useState<any | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();

  // Registration Type for Add
  const [registrationType, setRegistrationType] = useState<"family" | "group">("family");
  const [addMembers, setAddMembers] = useState<GroupMember[]>([]);

  // Edit Members state
  const [editMembers, setEditMembers] = useState<GroupMember[]>([]);
  const [editIsGroup, setEditIsGroup] = useState<boolean>(false);

  // Single Add Form state
  const [name, setName] = useState("");
  const [leader, setLeader] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [adults, setAdults] = useState("1");
  const [children, setChildren] = useState("0");
  const [nonPayingChildren, setNonPayingChildren] = useState("0");
  const [childAgeThreshold, setChildAgeThreshold] = useState(12);
  const [roomPref, setRoomPref] = useState("Any");
  const [access, setAccess] = useState("None");
  const [buddyRequest, setBuddyRequest] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Confirmed");

  // Bulk Import state
  const [bulkFileName, setBulkFileName] = useState("");
  const [parsedBulkData, setParsedBulkData] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/event")
      .then(res => res.json())
      .then(data => {
        if (data && data.childAgeThreshold !== undefined) {
          setChildAgeThreshold(data.childAgeThreshold);
        }
      })
      .catch(() => {});
  }, []);

  const allRooms = (buildingsList || []).flatMap((b: any) =>
    (b.rooms || []).map((r: any) => ({ ...r, bid: b.id, bname: b.name }))
  );

  const handleAddGroupMemberToAdd = () => {
    const newMember: GroupMember = {
      id: `m-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: "",
      role: "Adult",
    };
    const updated = [...addMembers, newMember];
    setAddMembers(updated);
    const counts = computeMemberCounts(updated, childAgeThreshold);
    setAdults(String(counts.adults));
    setChildren(String(counts.children));
    setNonPayingChildren(String(counts.nonPayingChildren));
  };

  const handleUpdateAddMember = (index: number, updates: Partial<GroupMember>) => {
    const updated = [...addMembers];
    updated[index] = { ...updated[index], ...updates };
    setAddMembers(updated);
    const counts = computeMemberCounts(updated, childAgeThreshold);
    setAdults(String(counts.adults));
    setChildren(String(counts.children));
    setNonPayingChildren(String(counts.nonPayingChildren));
  };

  const handleRemoveAddMember = (index: number) => {
    const updated = addMembers.filter((_, i) => i !== index);
    setAddMembers(updated);
    const counts = computeMemberCounts(updated, childAgeThreshold);
    setAdults(String(counts.adults));
    setChildren(String(counts.children));
    setNonPayingChildren(String(counts.nonPayingChildren));
  };

  const handleOpenEdit = (f: any) => {
    const parsed = parseMembers(f.membersJson);
    setEditFamily(f);
    setEditMembers(parsed);
    setEditIsGroup(parsed.length > 0);
  };

  const handleAddMemberToEdit = () => {
    const newMember: GroupMember = {
      id: `m-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: "",
      role: "Adult",
    };
    const updated = [...editMembers, newMember];
    setEditMembers(updated);
    const counts = computeMemberCounts(updated, childAgeThreshold);
    setEditFamily((prev: any) => ({
      ...prev,
      adults: counts.adults,
      children: counts.children,
      nonPayingChildren: counts.nonPayingChildren,
    }));
  };

  const handleUpdateEditMember = (index: number, updates: Partial<GroupMember>) => {
    const updated = [...editMembers];
    updated[index] = { ...updated[index], ...updates };
    setEditMembers(updated);
    const counts = computeMemberCounts(updated, childAgeThreshold);
    setEditFamily((prev: any) => ({
      ...prev,
      adults: counts.adults,
      children: counts.children,
      nonPayingChildren: counts.nonPayingChildren,
    }));
  };

  const handleRemoveEditMember = (index: number) => {
    const updated = editMembers.filter((_, i) => i !== index);
    setEditMembers(updated);
    const counts = computeMemberCounts(updated, childAgeThreshold);
    setEditFamily((prev: any) => ({
      ...prev,
      adults: counts.adults,
      children: counts.children,
      nonPayingChildren: counts.nonPayingChildren,
    }));
  };

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const filteredData = families.filter((f) => {
    const hay = `${f.name} ${f.leader} ${f.email}`.toLowerCase();
    const matchesQuery = !query || hay.includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || f.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const handleAddFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isGroup = registrationType === "group";
      const counts = isGroup && addMembers.length > 0
        ? computeMemberCounts(addMembers, childAgeThreshold)
        : { adults: Number(adults), children: Number(children), nonPayingChildren: Number(nonPayingChildren) };

      const primaryRoomId = isGroup
        ? (addMembers.find(m => m.roomId)?.roomId || null)
        : null;

      const res = await fetch("/api/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          leader,
          email,
          phone,
          adults: counts.adults,
          children: counts.children,
          nonPayingChildren: counts.nonPayingChildren,
          roomPref,
          access,
          buddyRequest,
          notes,
          status,
          members: isGroup ? addMembers : undefined,
          roomId: primaryRoomId,
        }),
      });

      if (res.ok) {
        const newFam = await res.json();
        setFamilies((prev) => [newFam, ...prev]);
        setShowAddModal(false);
        showToastMsg(`${isGroup ? "Group" : "Family"} "${name}" added successfully!`);
        setName(""); setLeader(""); setEmail(""); setPhone(""); setBuddyRequest(""); setNotes("");
        setAddMembers([]);
        setRegistrationType("family");
        router.refresh();
      } else {
        const err = await res.json();
        showToastMsg(err.error || "Failed to add family.");
      }
    } catch {
      showToastMsg("Error submitting form.");
    }
  };

  const handleUpdateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFamily) return;
    try {
      const counts = editMembers.length > 0
        ? computeMemberCounts(editMembers, childAgeThreshold)
        : { adults: Number(editFamily.adults), children: Number(editFamily.children), nonPayingChildren: Number(editFamily.nonPayingChildren || 0) };

      const primaryRoomId = editMembers.find(m => m.roomId)?.roomId || editFamily.roomId || null;

      const payload = {
        ...editFamily,
        adults: counts.adults,
        children: counts.children,
        nonPayingChildren: counts.nonPayingChildren,
        members: editMembers.length > 0 ? editMembers : undefined,
        roomId: primaryRoomId,
      };

      const res = await fetch(`/api/families/${editFamily.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updated = await res.json();
        setFamilies((prev) => prev.map(f => f.id === editFamily.id ? { ...f, ...updated } : f));
        if (selectedFamily?.id === editFamily.id) {
          setSelectedFamily((prev: any) => ({ ...prev, ...updated }));
        }
        setEditFamily(null);
        showToastMsg(`Record "${editFamily.name}" updated successfully!`);
        router.refresh();
      } else {
        const err = await res.json();
        showToastMsg(err.error || "Failed to update family.");
      }
    } catch {
      showToastMsg("Error updating family.");
    }
  };

  const handleQuickStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/families/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setFamilies(prev => prev.map(f => f.id === id ? { ...f, status: newStatus } : f));
        if (selectedFamily?.id === id) {
          setSelectedFamily((prev: any) => ({ ...prev, status: newStatus }));
        }
        showToastMsg(`Status changed to "${newStatus}"!`);
        router.refresh();
      } else {
        const err = await res.json();
        showToastMsg(err.error || "Failed to update status.");
      }
    } catch {
      showToastMsg("Error updating status.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const records = parseCSV(text);
        setParsedBulkData(records);
        if (records.length === 0) {
          showToastMsg("Could not parse valid family records from CSV.");
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSaveBulk = async () => {
    if (parsedBulkData.length === 0) {
      showToastMsg("No parsed family records to upload.");
      return;
    }
    try {
      const res = await fetch("/api/families/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedBulkData),
      });

      if (res.ok) {
        const result = await res.json();
        showToastMsg(`${result.count} families registered successfully via bulk import!`);
        setShowBulkModal(false);
        setParsedBulkData([]);
        setBulkFileName("");
        if (result.families) {
          setFamilies(prev => [...result.families, ...prev]);
        }
        router.refresh();
      } else {
        const err = await res.json();
        showToastMsg(err.error || "Failed bulk registration.");
      }
    } catch {
      showToastMsg("Error performing bulk registration.");
    }
  };

  const handleDownloadTemplate = () => {
    const template = "Name,Leader,Email,Phone,Adults,PayingChildren,NonPayingChildren,RoomPreference,Accessibility,Status,Notes\n" +
      '"Johnson Family","Mark Johnson","mark@example.com","555-0199",2,1,0,"Ground floor","None","Confirmed","Vegetarian meals"\n' +
      '"Grace Youth Group","Sarah Miller","sarah@example.com","555-0244",4,2,1,"Near chapel","Wheelchair access","Pending","Late arrival on Friday"';
    
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + template);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "retreatflow_bulk_registration_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToastMsg("Downloaded CSV template!");
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Name", "Leader", "Email", "Phone", "Adults", "Paying Children", "Non-Paying Children", "Room Preference", "Access Needs", "Status", "Notes"];
    const rows = filteredData.map(f => [
      f.id,
      `"${f.name}"`,
      `"${f.leader}"`,
      `"${f.email}"`,
      `"${f.phone || ""}"`,
      f.adults,
      f.children,
      f.nonPayingChildren || 0,
      `"${f.roomPref || ""}"`,
      `"${f.access || ""}"`,
      f.status,
      `"${(f.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `retreatflow_families_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToastMsg("Families CSV exported!");
  };

  const handleDeleteFamily = async (id: string, famName: string) => {
    if (!confirm(`Are you sure you want to delete ${famName}?`)) return;
    try {
      const res = await fetch(`/api/families/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFamilies((prev) => prev.filter((f) => f.id !== id));
        setSelectedFamily(null);
        showToastMsg(`Deleted ${famName}.`);
        router.refresh();
      } else {
        showToastMsg("Failed to delete family.");
      }
    } catch {
      showToastMsg("Error deleting family.");
    }
  };

  const familyActions: ActionDropdownItem[] = [
    {
      id: "bulk-csv",
      label: "Bulk Import Families (CSV)",
      icon: "📁",
      onClick: () => setShowBulkModal(true),
      description: "Import multiple families at once from CSV",
    },
    {
      id: "download-template",
      label: "Download CSV Template",
      icon: "📥",
      onClick: handleDownloadTemplate,
      description: "Sample headers and formatting guide",
    },
    {
      id: "div-1",
      divider: true,
      label: "",
    },
    {
      id: "export-csv",
      label: "Export Families CSV",
      icon: "📊",
      onClick: handleExportCSV,
      description: "Download current group records as CSV",
    },
  ];

  return (
    <>
      {toast && <div className="toast show">{toast}</div>}

      <div className="top">
        <div>
          <h1>Families & Groups</h1>
          <div className="sub">Household/group records for rooms, payments, attendance, and communications.</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setShowAddModal(true)}>+ Add Family / Group</button>
          <ActionDropdown label="Actions" items={familyActions} />
        </div>
      </div>

      <div className="card toolbar">
        <input 
          className="input wide" 
          value={query} 
          placeholder="Search family, leader, email..." 
          onChange={(e) => setQuery(e.target.value)} 
        />
        <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All groups</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Pending">Pending</option>
          <option value="Waitlist">Waitlist</option>
        </select>
      </div>

      <div className="card panel section">
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th>Family / Group</th>
                <th>Leader</th>
                <th>Contact</th>
                <th>People</th>
                <th>Room preference</th>
                <th>Access</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(f => {
                const members = parseMembers(f.membersJson);
                const isGroup = members.length > 0;
                return (
                  <tr key={f.id}>
                    <td>
                      <b>{f.name}</b>
                      {isGroup && (
                        <div style={{ marginTop: "3px" }}>
                          <span className="pill info" style={{ fontSize: "10px", padding: "1px 6px" }}>
                            👥 Group ({members.length} members)
                          </span>
                        </div>
                      )}
                    </td>
                    <td>{f.leader}</td>
                    <td>{f.email}<br/><span className="small">{f.phone}</span></td>
                    <td>
                      {f.adults + f.children + (f.nonPayingChildren || 0)}{" "}
                      <span className="small">({f.adults}A, {f.children} Paying C, {f.nonPayingChildren || 0} Free C)</span>
                      {isGroup && (
                        <div className="small" style={{ color: "#64748b", fontSize: "11px", marginTop: "3px" }}>
                          <b>Members:</b> {members.map(m => m.name || "Unnamed").join(", ")}
                        </div>
                      )}
                    </td>
                    <td>
                      {f.room?.number ? (
                        <div>
                          <span className="pill green" style={{ fontSize: "11px" }}>Room {f.room.number}</span>
                          {f.room.building?.name && <span className="small"> ({f.room.building.name})</span>}
                        </div>
                      ) : (
                        <span>{f.roomPref || "Any"}</span>
                      )}
                      {f.buddyRequest && (
                        <div className="small" style={{ color: "#6366f1", fontWeight: "600" }}>🤝 Buddy: {f.buddyRequest}</div>
                      )}
                    </td>
                    <td>
                      <select
                        className="select"
                        value={f.status}
                        onChange={(e) => handleQuickStatusChange(f.id, e.target.value)}
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          fontWeight: 700,
                          borderRadius: "14px",
                          border: "1px solid var(--border)",
                          background: f.status === "Confirmed" ? "#ecfdf5" : f.status === "Pending" ? "#fef3c7" : "#f1f5f9",
                          color: f.status === "Confirmed" ? "#047857" : f.status === "Pending" ? "#b45309" : "#475569",
                          cursor: "pointer",
                        }}
                      >
                        <option value="Confirmed">Confirmed</option>
                        <option value="Pending">Pending</option>
                        <option value="Waitlist">Waitlist</option>
                      </select>
                    </td>
                    <td className="actions-cell">
                      {f.status === "Confirmed" && (
                        <button className="btn tiny" onClick={() => setQrFamilyModal(f)} title="View & Print QR Pass">🎫 Pass</button>
                      )}
                      {f.status !== "Confirmed" && (
                        <button className="btn tiny primary" onClick={() => handleQuickStatusChange(f.id, "Confirmed")}>✓ Confirm</button>
                      )}
                      <button className="btn tiny" onClick={() => setSelectedFamily(f)}>Details</button>
                      <button className="btn tiny" onClick={() => handleOpenEdit(f)}>Edit</button>
                    </td>
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">No families match your filter criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Family / Group Modal */}
      {showAddModal && (
        <div className="modalbg show" onClick={() => setShowAddModal(false)}>
          <div className="modal" style={{ maxWidth: registrationType === "group" ? "820px" : "640px" }} onClick={(e) => e.stopPropagation()}>
            <h2>Add New Family or Group</h2>
            <p>Register a household or church ministry/group into RetreatFlow.</p>

            {/* Registration Type Selector */}
            <div style={{ display: "flex", gap: "10px", margin: "16px 0", background: "#f1f5f9", padding: "4px", borderRadius: "8px" }}>
              <button
                type="button"
                className={`btn ${registrationType === "family" ? "primary" : ""}`}
                style={{ flex: 1, padding: "8px 12px" }}
                onClick={() => setRegistrationType("family")}
              >
                🏠 Household / Family
              </button>
              <button
                type="button"
                className={`btn ${registrationType === "group" ? "primary" : ""}`}
                style={{ flex: 1, padding: "8px 12px" }}
                onClick={() => {
                  setRegistrationType("group");
                  if (addMembers.length === 0) {
                    setAddMembers([
                      { id: `m-1`, name: leader || "", role: "Leader" },
                      { id: `m-2`, name: "", role: "Adult" },
                    ]);
                  }
                }}
              >
                👥 Group / Ministry / Organization
              </button>
            </div>

            <form onSubmit={handleAddFamily} className="form">
              <div className="formgrid">
                <div>
                  <label>{registrationType === "group" ? "Group / Ministry Name *" : "Family Name *"}</label>
                  <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder={registrationType === "group" ? "e.g. Grace Youth Group" : "e.g. Abebe Family"} />
                </div>
                <div>
                  <label>{registrationType === "group" ? "Group Leader Name *" : "Family Head / Leader *"}</label>
                  <input 
                    className="input" 
                    required 
                    value={leader} 
                    onChange={(e) => {
                      setLeader(e.target.value);
                      if (registrationType === "group" && addMembers.length > 0 && addMembers[0].role === "Leader") {
                        handleUpdateAddMember(0, { name: e.target.value });
                      }
                    }} 
                    placeholder="e.g. Dawit Abebe" 
                  />
                </div>
              </div>

              <div className="formgrid">
                <div>
                  <label>Primary Email Address *</label>
                  <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@example.com" />
                </div>
                <div>
                  <label>Phone Number</label>
                  <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="555-0101" />
                </div>
              </div>

              {/* Group Member Roster Builder */}
              {registrationType === "group" ? (
                <div style={{ marginTop: "12px", marginBottom: "16px", padding: "14px", border: "1px solid var(--border)", borderRadius: "10px", background: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div>
                      <strong style={{ fontSize: "14px", color: "#1e293b" }}>👥 Group Member Roster & Room Placements</strong>
                      <div className="small" style={{ color: "#64748b" }}>Add names of all group attendees and optionally assign their lodging rooms.</div>
                    </div>
                    <button type="button" className="btn tiny primary" onClick={handleAddGroupMemberToAdd}>
                      + Add Member
                    </button>
                  </div>

                  <div style={{ maxHeight: "240px", overflowY: "auto", border: "1px solid var(--line)", borderRadius: "6px" }}>
                    <table className="table" style={{ fontSize: "12px", margin: 0 }}>
                      <thead>
                        <tr style={{ background: "#edf2f7" }}>
                          <th style={{ width: "30px" }}>#</th>
                          <th style={{ width: "180px" }}>Member Full Name *</th>
                          <th style={{ width: "120px" }}>Category</th>
                          <th style={{ width: "200px" }}>Assigned Room</th>
                          <th>Notes</th>
                          <th style={{ width: "40px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {addMembers.map((m, idx) => (
                          <tr key={m.id || idx}>
                            <td style={{ color: "#94a3b8" }}>{idx + 1}</td>
                            <td>
                              <input
                                className="input"
                                style={{ padding: "4px 8px", fontSize: "12px" }}
                                required
                                value={m.name}
                                onChange={(e) => handleUpdateAddMember(idx, { name: e.target.value })}
                                placeholder="Full Name"
                              />
                            </td>
                            <td>
                              <select
                                className="select"
                                style={{ padding: "4px 6px", fontSize: "12px" }}
                                value={m.role}
                                onChange={(e) => handleUpdateAddMember(idx, { role: e.target.value as any })}
                              >
                                <option value="Leader">Leader</option>
                                <option value="Adult">Adult</option>
                                <option value="Youth">Youth</option>
                                <option value="Child">Child (&lt;{childAgeThreshold})</option>
                                <option value="Infant">Infant (Free)</option>
                              </select>
                            </td>
                            <td>
                              <select
                                className="select"
                                style={{ padding: "4px 6px", fontSize: "12px" }}
                                value={m.roomId || ""}
                                onChange={(e) => {
                                  const selectedRoom = allRooms.find(r => r.id === e.target.value);
                                  handleUpdateAddMember(idx, {
                                    roomId: e.target.value || undefined,
                                    roomName: selectedRoom ? `${selectedRoom.bname} - Room ${selectedRoom.number}` : undefined
                                  });
                                }}
                              >
                                <option value="">Unassigned / Later</option>
                                {allRooms.map((r: any) => (
                                  <option key={r.id} value={r.id}>
                                    {r.bname} - Room {r.number} (Cap: {r.capacity})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                className="input"
                                style={{ padding: "4px 8px", fontSize: "12px" }}
                                value={m.notes || ""}
                                onChange={(e) => handleUpdateAddMember(idx, { notes: e.target.value })}
                                placeholder="Dietary/roommate"
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn tiny danger"
                                style={{ padding: "2px 6px" }}
                                onClick={() => handleRemoveAddMember(idx)}
                                title="Remove member"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: "8px", fontSize: "12px", color: "#475569" }}>
                    Total Group Count: <b>{addMembers.length}</b> ({adults} Adults/Youth, {children} Paying Children, {nonPayingChildren} Free Infants)
                  </div>
                </div>
              ) : (
                <>
                  <div className="formgrid">
                    <div>
                      <label>Adults</label>
                      <input className="input" type="number" min="0" value={adults} onChange={(e) => setAdults(e.target.value)} />
                    </div>
                    <div>
                      <label>Paying Children (Under age {childAgeThreshold})</label>
                      <input className="input" type="number" min="0" value={children} onChange={(e) => setChildren(e.target.value)} />
                    </div>
                  </div>

                  <div>
                    <label>Non-Paying Children (Infants/toddlers free - $0)</label>
                    <input className="input" type="number" min="0" value={nonPayingChildren} onChange={(e) => setNonPayingChildren(e.target.value)} />
                  </div>
                </>
              )}

              <div className="formgrid">
                <div>
                  <label>Room Preference</label>
                  <select className="select" value={roomPref} onChange={(e) => setRoomPref(e.target.value)}>
                    <option value="Any">Any Room</option>
                    <option value="Ground floor">Ground Floor</option>
                    <option value="Near chapel">Near Chapel</option>
                    <option value="Near dining">Near Dining Hall</option>
                    <option value="Full room">Full Room</option>
                  </select>
                </div>
                <div>
                  <label>Accessibility / Special Needs</label>
                  <select className="select" value={access} onChange={(e) => setAccess(e.target.value)}>
                    <option value="None">None</option>
                    <option value="Limited stairs">Limited Stairs</option>
                    <option value="Wheelchair access">Wheelchair Access</option>
                    <option value="Dietary needs">Dietary Needs</option>
                  </select>
                </div>
              </div>

              <div>
                <label>🤝 Buddy Request / Preferred Neighbors</label>
                <input className="input" value={buddyRequest} onChange={(e) => setBuddyRequest(e.target.value)} placeholder="e.g. Smith Family or Johnson" />
              </div>

              <div>
                <label>Status</label>
                <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Pending">Pending</option>
                  <option value="Waitlist">Waitlist</option>
                </select>
              </div>

              <div>
                <label>Notes / Dietary Restrictions</label>
                <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Vegetarian meals, late arrival, etc." />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save {registrationType === "group" ? "Group" : "Family"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Edit Family Modal */}
      {editFamily && (
        <div className="modalbg show" onClick={() => setEditFamily(null)}>
          <div className="modal" style={{ maxWidth: (editIsGroup || editMembers.length > 0) ? "820px" : "640px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>Edit Information: {editFamily.name}</h2>
              <button
                type="button"
                className={`btn tiny ${editIsGroup ? "primary" : ""}`}
                onClick={() => {
                  const toggled = !editIsGroup;
                  setEditIsGroup(toggled);
                  if (toggled && editMembers.length === 0) {
                    setEditMembers([
                      { id: `m-1`, name: editFamily.leader || "", role: "Leader" },
                      { id: `m-2`, name: "", role: "Adult" },
                    ]);
                  }
                }}
              >
                {editIsGroup ? "✓ Group Mode Active" : "👥 Manage as Group"}
              </button>
            </div>
            <p>Update registration, contact details, member names, room assignments, or status.</p>
            <form onSubmit={handleUpdateFamily} className="form">
              <div className="formgrid">
                <div>
                  <label>Family / Group Name *</label>
                  <input className="input" required value={editFamily.name} onChange={(e) => setEditFamily((p: any) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label>Leader Name *</label>
                  <input className="input" required value={editFamily.leader} onChange={(e) => setEditFamily((p: any) => ({ ...p, leader: e.target.value }))} />
                </div>
              </div>

              <div className="formgrid">
                <div>
                  <label>Email Address *</label>
                  <input className="input" type="email" required value={editFamily.email} onChange={(e) => setEditFamily((p: any) => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <label>Phone Number</label>
                  <input className="input" value={editFamily.phone || ""} onChange={(e) => setEditFamily((p: any) => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>

              {/* Group Members Section in Edit Modal */}
              {(editIsGroup || editMembers.length > 0) ? (
                <div style={{ marginTop: "12px", marginBottom: "16px", padding: "14px", border: "1px solid var(--border)", borderRadius: "10px", background: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div>
                      <strong style={{ fontSize: "14px", color: "#1e293b" }}>👥 Group Members Roster & Room Assignments</strong>
                      <div className="small" style={{ color: "#64748b" }}>Update attendee names and assign or change specific rooms for each member.</div>
                    </div>
                    <button type="button" className="btn tiny primary" onClick={handleAddMemberToEdit}>
                      + Add Member
                    </button>
                  </div>

                  <div style={{ maxHeight: "240px", overflowY: "auto", border: "1px solid var(--line)", borderRadius: "6px" }}>
                    <table className="table" style={{ fontSize: "12px", margin: 0 }}>
                      <thead>
                        <tr style={{ background: "#edf2f7" }}>
                          <th style={{ width: "30px" }}>#</th>
                          <th style={{ width: "180px" }}>Member Name</th>
                          <th style={{ width: "120px" }}>Category</th>
                          <th style={{ width: "200px" }}>Assigned Room</th>
                          <th>Notes</th>
                          <th style={{ width: "40px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {editMembers.map((m, idx) => (
                          <tr key={m.id || idx}>
                            <td style={{ color: "#94a3b8" }}>{idx + 1}</td>
                            <td>
                              <input
                                className="input"
                                style={{ padding: "4px 8px", fontSize: "12px" }}
                                required
                                value={m.name}
                                onChange={(e) => handleUpdateEditMember(idx, { name: e.target.value })}
                                placeholder="Full Name"
                              />
                            </td>
                            <td>
                              <select
                                className="select"
                                style={{ padding: "4px 6px", fontSize: "12px" }}
                                value={m.role}
                                onChange={(e) => handleUpdateEditMember(idx, { role: e.target.value as any })}
                              >
                                <option value="Leader">Leader</option>
                                <option value="Adult">Adult</option>
                                <option value="Youth">Youth</option>
                                <option value="Child">Child (&lt;{childAgeThreshold})</option>
                                <option value="Infant">Infant (Free)</option>
                              </select>
                            </td>
                            <td>
                              <select
                                className="select"
                                style={{ padding: "4px 6px", fontSize: "12px" }}
                                value={m.roomId || ""}
                                onChange={(e) => {
                                  const selectedRoom = allRooms.find(r => r.id === e.target.value);
                                  handleUpdateEditMember(idx, {
                                    roomId: e.target.value || undefined,
                                    roomName: selectedRoom ? `${selectedRoom.bname} - Room ${selectedRoom.number}` : undefined
                                  });
                                }}
                              >
                                <option value="">Unassigned / Later</option>
                                {allRooms.map((r: any) => (
                                  <option key={r.id} value={r.id}>
                                    {r.bname} - Room {r.number} (Cap: {r.capacity})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                className="input"
                                style={{ padding: "4px 8px", fontSize: "12px" }}
                                value={m.notes || ""}
                                onChange={(e) => handleUpdateEditMember(idx, { notes: e.target.value })}
                                placeholder="Dietary/roommate"
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn tiny danger"
                                style={{ padding: "2px 6px" }}
                                onClick={() => handleRemoveEditMember(idx)}
                                title="Remove member"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: "8px", fontSize: "12px", color: "#475569" }}>
                    Total Group Count: <b>{editMembers.length}</b> ({editFamily.adults} Adults/Youth, {editFamily.children} Paying Children, {editFamily.nonPayingChildren || 0} Free Infants)
                  </div>
                </div>
              ) : (
                <>
                  <div className="formgrid">
                    <div>
                      <label>Adults</label>
                      <input className="input" type="number" min="0" value={editFamily.adults} onChange={(e) => setEditFamily((p: any) => ({ ...p, adults: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <label>Paying Children (Under age {childAgeThreshold})</label>
                      <input className="input" type="number" min="0" value={editFamily.children} onChange={(e) => setEditFamily((p: any) => ({ ...p, children: Number(e.target.value) }))} />
                    </div>
                  </div>

                  <div>
                    <label>Non-Paying Children (Free - $0)</label>
                    <input className="input" type="number" min="0" value={editFamily.nonPayingChildren || 0} onChange={(e) => setEditFamily((p: any) => ({ ...p, nonPayingChildren: Number(e.target.value) }))} />
                  </div>
                </>
              )}

              <div className="formgrid">
                <div>
                  <label>Room Preference</label>
                  <select className="select" value={editFamily.roomPref || "Any"} onChange={(e) => setEditFamily((p: any) => ({ ...p, roomPref: e.target.value }))}>
                    <option value="Any">Any Room</option>
                    <option value="Ground floor">Ground Floor</option>
                    <option value="Near chapel">Near Chapel</option>
                    <option value="Near dining">Near Dining Hall</option>
                    <option value="Full room">Full Room</option>
                  </select>
                </div>
                <div>
                  <label>Accessibility / Special Needs</label>
                  <select className="select" value={editFamily.access || "None"} onChange={(e) => setEditFamily((p: any) => ({ ...p, access: e.target.value }))}>
                    <option value="None">None</option>
                    <option value="Limited stairs">Limited Stairs</option>
                    <option value="Wheelchair access">Wheelchair Access</option>
                    <option value="Dietary needs">Dietary Needs</option>
                  </select>
                </div>
              </div>

              <div>
                <label>🤝 Buddy Request / Preferred Neighbors</label>
                <input className="input" value={editFamily.buddyRequest || ""} onChange={(e) => setEditFamily((p: any) => ({ ...p, buddyRequest: e.target.value }))} placeholder="e.g. Smith Family or Johnson" />
              </div>

              <div>
                <label>Status</label>
                <select className="select" value={editFamily.status} onChange={(e) => setEditFamily((p: any) => ({ ...p, status: e.target.value }))}>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Pending">Pending</option>
                  <option value="Waitlist">Waitlist</option>
                </select>
              </div>

              <div>
                <label>Notes / Dietary Restrictions</label>
                <textarea className="textarea" value={editFamily.notes || ""} onChange={(e) => setEditFamily((p: any) => ({ ...p, notes: e.target.value }))} />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setEditFamily(null)}>Cancel</button>
                <button type="submit" className="btn primary">Update Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Registration Modal */}
      {showBulkModal && (
        <div className="modalbg show" onClick={() => setShowBulkModal(false)}>
          <div className="modal" style={{ maxWidth: "720px" }} onClick={(e) => e.stopPropagation()}>
            <h2>Bulk Register Families (CSV Upload)</h2>
            <p>Upload a CSV file formatted with standard RetreatFlow headers to import multiple family records at once.</p>
            
            <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
              <button className="btn" onClick={handleDownloadTemplate}>📥 Download CSV Template</button>
            </div>

            <div style={{ padding: "16px", border: "2px dashed var(--border)", borderRadius: "8px", textAlign: "center", marginBottom: "15px" }}>
              <label style={{ cursor: "pointer", display: "block" }}>
                <span className="btn primary" style={{ display: "inline-block" }}>Choose CSV File</span>
                <input type="file" accept=".csv,.txt" onChange={handleFileUpload} style={{ display: "none" }} />
              </label>
              {bulkFileName && <div style={{ marginTop: "8px", fontWeight: "bold" }}>Selected File: {bulkFileName}</div>}
            </div>

            {parsedBulkData.length > 0 && (
              <div style={{ maxHeight: "250px", overflowY: "auto", marginBottom: "15px" }}>
                <div style={{ marginBottom: "6px", fontWeight: "bold" }}>Preview Parsed Families ({parsedBulkData.length}):</div>
                <table className="table" style={{ fontSize: "12px" }}>
                  <thead>
                    <tr><th>Name</th><th>Leader</th><th>Email</th><th>Adults</th><th>Paying C</th><th>Free C</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {parsedBulkData.map((r, i) => (
                      <tr key={i}>
                        <td>{r.name}</td>
                        <td>{r.leader}</td>
                        <td>{r.email}</td>
                        <td>{r.adults}</td>
                        <td>{r.children}</td>
                        <td>{r.nonPayingChildren}</td>
                        <td><span className={`pill ${r.status.toLowerCase()}`}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => { setShowBulkModal(false); setParsedBulkData([]); setBulkFileName(""); }}>Cancel</button>
              <button type="button" className="btn primary" disabled={parsedBulkData.length === 0} onClick={handleSaveBulk}>
                Import {parsedBulkData.length} Families
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Side Drawer */}
      {selectedFamily && (
        <div className="modalbg show" onClick={() => setSelectedFamily(null)}>
          <div className="modal" style={{ maxWidth: "780px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>{selectedFamily.name} Details</h2>
              <div style={{ display: "flex", gap: "6px" }}>
                {selectedFamily.status !== "Confirmed" ? (
                  <button className="btn tiny primary" onClick={() => handleQuickStatusChange(selectedFamily.id, "Confirmed")}>✓ Confirm Record</button>
                ) : (
                  <button className="btn tiny" onClick={() => handleQuickStatusChange(selectedFamily.id, "Pending")}>Mark as Pending</button>
                )}
                <button className="btn tiny" onClick={() => { const f = selectedFamily; setSelectedFamily(null); handleOpenEdit(f); }}>Edit Record</button>
                <button className="btn tiny danger" onClick={() => handleDeleteFamily(selectedFamily.id, selectedFamily.name)}>Delete</button>
              </div>
            </div>
            <p style={{ marginTop: "4px" }}>
              Status: <span className={`pill ${selectedFamily.status.toLowerCase()}`}>{selectedFamily.status}</span> · Leader: <b>{selectedFamily.leader}</b> · Email: {selectedFamily.email} {selectedFamily.phone ? `· Phone: ${selectedFamily.phone}` : ""}
            </p>
            
            <div style={{ marginTop: "15px" }} className="grid cards2">
              <div className="alert">
                <strong>Participants</strong>
                <span>{selectedFamily.adults} Adults, {selectedFamily.children} Paying Children, {selectedFamily.nonPayingChildren || 0} Free Children (Total: {selectedFamily.adults + selectedFamily.children + (selectedFamily.nonPayingChildren || 0)})</span>
              </div>
              <div className="alert">
                <strong>Room & Accessibility</strong>
                <span>Preference: {selectedFamily.roomPref || "None"} | Needs: {selectedFamily.access || "None"} {selectedFamily.buddyRequest ? `| 🤝 Buddy Request: ${selectedFamily.buddyRequest}` : ""}</span>
              </div>
            </div>

            {/* If group members exist, render the full members roster */}
            {(() => {
              const members = parseMembers(selectedFamily.membersJson);
              if (members.length === 0) return null;
              return (
                <div style={{ marginTop: "16px" }}>
                  <div style={{ fontWeight: 800, fontSize: "14px", color: "#1e293b", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>👥 Group Roster & Room Assignments ({members.length} Members)</span>
                  </div>
                  <div style={{ border: "1px solid var(--line)", borderRadius: "8px", overflow: "hidden" }}>
                    <table className="table" style={{ fontSize: "12px", margin: 0 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th style={{ width: "30px" }}>#</th>
                          <th>Name</th>
                          <th>Category</th>
                          <th>Assigned Room</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m, i) => (
                          <tr key={m.id || i}>
                            <td style={{ color: "#94a3b8" }}>{i + 1}</td>
                            <td>
                              <strong>{m.name || "Unnamed"}</strong>
                              {m.role === "Leader" && <span className="pill info" style={{ marginLeft: "6px", fontSize: "10px" }}>Leader</span>}
                            </td>
                            <td><span className="pill neutral" style={{ fontSize: "11px" }}>{m.role}</span></td>
                            <td>
                              {m.roomId ? (
                                <span className="pill green" style={{ fontSize: "11px" }}>
                                  🚪 {m.roomName || `Room: ${m.roomId.slice(0, 6)}`}
                                </span>
                              ) : (
                                <span className="pill orange" style={{ fontSize: "11px" }}>⚠️ Unassigned</span>
                              )}
                            </td>
                            <td style={{ color: "#64748b" }}>{m.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            <div style={{ marginTop: "10px" }} className="alert">
              <strong>Notes & Special Requirements</strong>
              <span>{selectedFamily.notes || "No special notes recorded."}</span>
            </div>

            <div className="modal-actions">
              {selectedFamily.status === "Confirmed" && (
                <button className="btn primary" onClick={() => setQrFamilyModal(selectedFamily)}>🎫 View QR Pass</button>
              )}
              <button className="btn" onClick={() => setSelectedFamily(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {qrFamilyModal && (
        <QRCodeModal family={qrFamilyModal} onClose={() => setQrFamilyModal(null)} />
      )}
    </>
  );
}
