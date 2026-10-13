"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ActionDropdown, { ActionDropdownItem } from "@/components/ActionDropdown";
import RoomAssignmentPrintModal from "@/components/RoomAssignmentPrintModal";
import { parseMembers } from "@/lib/members";

export default function RoomsClient({ buildings: initialBuildings, allFamilies: initialFamilies }: { buildings: any[], allFamilies: any[] }) {
  const [buildings, setBuildings] = useState(initialBuildings);
  const [allFamilies, setAllFamilies] = useState(initialFamilies);
  
  useEffect(() => {
    setBuildings(initialBuildings);
  }, [initialBuildings]);

  useEffect(() => {
    setAllFamilies(initialFamilies);
  }, [initialFamilies]);

  const [bf, setBf] = useState("all");
  const [sf, setSf] = useState("all");
  const [q, setQ] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [toast, setToast] = useState<string | null>(null);

  // Drag and Drop State
  const [draggedFamily, setDraggedFamily] = useState<any | null>(null);
  const [dragOverRoomId, setDragOverRoomId] = useState<string | null>(null);
  const [isOverUnassigned, setIsOverUnassigned] = useState(false);

  // Modals state
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [assigningFamily, setAssigningFamily] = useState<any | null>(null);
  const [moveGroupState, setMoveGroupState] = useState<{ family: any, sourceRoom: any } | null>(null);
  const [targetMoveRoomId, setTargetMoveRoomId] = useState<string>("");
  const [showAddBuildingModal, setShowAddBuildingModal] = useState(false);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Forms
  const [buildingName, setBuildingName] = useState("");
  const [newRoomBuildingId, setNewRoomBuildingId] = useState(buildings[0]?.id || "");
  const [newRoomNumber, setNewRoomNumber] = useState("");
  const [newRoomCapacity, setNewRoomCapacity] = useState("4");
  const [newRoomAccessible, setNewRoomAccessible] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const refreshData = async () => {
    try {
      const [bRes, fRes] = await Promise.all([
        fetch("/api/buildings"),
        fetch("/api/families")
      ]);
      if (bRes.ok && fRes.ok) {
        const [bData, fData] = await Promise.all([bRes.json(), fRes.json()]);
        setBuildings(bData);
        setAllFamilies(fData);
      }
    } catch {}
    router.refresh();
  };

  const allRooms = buildings.flatMap(b => b.rooms.map((r: any) => ({ ...r, bid: b.id, bname: b.name })));

  const familySize = (f: any) => f ? (f.adults + f.children + (f.nonPayingChildren || 0)) : 0;

  const roomFamilies = (r: any) => {
    const list: any[] = [];
    allFamilies.forEach(f => {
      const members = parseMembers(f.membersJson);
      if (members.length > 0) {
        const assignedToThisRoom = members.filter(m => m.roomId === r.id);
        if (assignedToThisRoom.length > 0) {
          list.push({
            ...f,
            assignedMembers: assignedToThisRoom,
            roomSpecificCount: assignedToThisRoom.length,
            isGroupSubset: true,
          });
        } else if (f.roomId === r.id && members.every(m => !m.roomId)) {
          list.push({
            ...f,
            assignedMembers: members,
            roomSpecificCount: members.length,
            isGroupSubset: false,
          });
        }
      } else {
        if (f.roomId === r.id) {
          list.push({
            ...f,
            assignedMembers: [],
            roomSpecificCount: familySize(f),
            isGroupSubset: false,
          });
        }
      }
    });

    // Also include any families directly listed on r.families if not already in list
    if (r.families) {
      r.families.forEach((rf: any) => {
        if (!list.some(item => item.id === rf.id)) {
          const members = parseMembers(rf.membersJson);
          list.push({
            ...rf,
            assignedMembers: members,
            roomSpecificCount: members.length > 0 ? members.length : familySize(rf),
            isGroupSubset: false,
          });
        }
      });
    }

    return list;
  };

  const roomOcc = (r: any) => {
    const fams = roomFamilies(r);
    return fams.reduce((s: number, f: any) => s + (f.roomSpecificCount ?? familySize(f)), 0);
  };

  const roomAvail = (r: any) => Math.max(0, r.capacity - roomOcc(r));

  const roomStatus = (r: any) => {
    const occ = roomOcc(r);
    if (occ === 0) return "available";
    return occ >= r.capacity ? "full" : "partial";
  };

  const unassigned = allFamilies.filter(f => {
    if (f.status !== "Confirmed") return false;
    const members = parseMembers(f.membersJson);
    if (members.length > 0) {
      return members.some(m => !m.roomId || !allRooms.some(r => r.id === m.roomId));
    }
    return !f.roomId || !allRooms.some(r => r.id === f.roomId);
  }).map(f => {
    const members = parseMembers(f.membersJson);
    if (members.length > 0) {
      const unassignedMems = members.filter(m => !m.roomId || !allRooms.some(r => r.id === m.roomId));
      return {
        ...f,
        unassignedMembers: unassignedMems,
        unassignedCount: unassignedMems.length,
      };
    }
    return {
      ...f,
      unassignedMembers: [],
      unassignedCount: familySize(f),
    };
  });

  const totalRooms = allRooms.length;
  const occupiedSpaces = allRooms.reduce((s, r) => s + roomOcc(r), 0);
  const openSpaces = allRooms.reduce((s, r) => s + roomAvail(r), 0);

  const getDragState = (room: any) => {
    if (!draggedFamily || dragOverRoomId !== room.id) return "";
    const fSize = draggedFamily.unassignedCount ?? familySize(draggedFamily);
    const isAlreadyInRoom = roomFamilies(room).some((f: any) => f.id === draggedFamily.id);
    const availableCap = isAlreadyInRoom ? roomAvail(room) + fSize : roomAvail(room);
    
    if (fSize > availableCap) return "drag-invalid";
    if (draggedFamily.access === "Ground floor" || draggedFamily.access === "Wheelchair access") {
      if (!room.accessible) return "drag-warning";
    }
    return "drag-valid";
  };

  const handleAutoAssign = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/rooms/auto-assign", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        showToastMsg(`Auto-assigned ${data.count} families to rooms!`);
        await refreshData();
      } else {
        const err = await res.json();
        showToastMsg(err.error || "Auto-assignment encountered an issue.");
      }
    } catch {
      showToastMsg("Auto-assignment failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssignRoom = async (roomId: string, familyId: string, action?: "unassign") => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/rooms/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, familyId, action }),
      });
      if (res.ok) {
        showToastMsg(action === "unassign" ? "Family unassigned from room!" : "Family assigned to room!");
        setSelectedRoom(null);
        setAssigningFamily(null);
        setMoveGroupState(null);
        await refreshData();
      } else {
        const err = await res.json();
        showToastMsg(err.error || "Assignment failed.");
      }
    } catch {
      showToastMsg("Room assignment failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnassignFamily = async (familyId: string) => {
    handleAssignRoom("", familyId, "unassign");
  };

  const handleSwapRooms = async (room1Id: string, room2Id: string, family1Id?: string, family2Id?: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/rooms/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room1Id, room2Id, family1Id, family2Id }),
      });
      if (res.ok) {
        showToastMsg("Rooms swapped successfully!");
        setMoveGroupState(null);
        setSelectedRoom(null);
        await refreshData();
      } else {
        const err = await res.json();
        showToastMsg(err.error || "Swap failed.");
      }
    } catch {
      showToastMsg("Error swapping rooms.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDropOnRoom = (targetRoom: any) => {
    if (!draggedFamily) return;

    if (draggedFamily.status !== "Confirmed") {
      showToastMsg(`Cannot assign ${draggedFamily.name}. Only Confirmed families are eligible for room assignment.`);
      setDragOverRoomId(null);
      setDraggedFamily(null);
      return;
    }

    const fSize = familySize(draggedFamily);
    const targetFams = roomFamilies(targetRoom);
    const availableCap = targetFams.some((f: any) => f.id === draggedFamily.id)
      ? roomAvail(targetRoom) + fSize
      : roomAvail(targetRoom);

    if (fSize > availableCap) {
      showToastMsg(`Cannot add ${draggedFamily.name} (${fSize} members). Room ${targetRoom.number} has only ${availableCap} space(s) available.`);
      setDragOverRoomId(null);
      setDraggedFamily(null);
      return;
    }

    handleAssignRoom(targetRoom.id, draggedFamily.id);
    setDragOverRoomId(null);
    setDraggedFamily(null);
  };

  const handleDropOnUnassigned = () => {
    if (!draggedFamily) return;
    if (draggedFamily.roomId) {
      handleUnassignFamily(draggedFamily.id);
    }
    setIsOverUnassigned(false);
    setDraggedFamily(null);
  };

  const handleExecuteMove = () => {
    if (!moveGroupState || !targetMoveRoomId) return;
    const { family, sourceRoom } = moveGroupState;
    const targetRoom = allRooms.find(r => r.id === targetMoveRoomId);
    if (!targetRoom) return;

    const fSize = familySize(family);
    const avail = roomAvail(targetRoom);
    const targetFams = roomFamilies(targetRoom);

    if (fSize > avail && targetFams.length > 0) {
      // Swap with first family in target room if capacity exceeded
      const targetFamily = targetFams[0];
      handleSwapRooms(sourceRoom.id, targetRoom.id, family.id, targetFamily.id);
    } else {
      handleAssignRoom(targetRoom.id, family.id);
    }
  };

  const handleCreateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buildingName.trim()) return;
    try {
      const res = await fetch("/api/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: buildingName }),
      });
      if (res.ok) {
        const newB = await res.json();
        setShowAddBuildingModal(false);
        setBuildingName("");
        showToastMsg(`Building "${newB.name}" created!`);
        await refreshData();
      } else {
        const err = await res.json();
        showToastMsg(err.error || "Failed to create building.");
      }
    } catch {
      showToastMsg("Error creating building.");
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomBuildingId || !newRoomNumber.trim()) return;
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buildingId: newRoomBuildingId,
          number: newRoomNumber,
          capacity: Number(newRoomCapacity),
          accessible: newRoomAccessible,
        }),
      });
      if (res.ok) {
        setShowAddRoomModal(false);
        setNewRoomNumber("");
        showToastMsg("New room created successfully!");
        await refreshData();
      } else {
        const err = await res.json();
        showToastMsg(err.error || "Failed to create room.");
      }
    } catch {
      showToastMsg("Error creating room.");
    }
  };

  const roomActions: ActionDropdownItem[] = [
    {
      id: "print-roster",
      label: "Bulk Print Room Roster",
      icon: "🖨️",
      onClick: () => setShowPrintModal(true),
      description: "Print assigned rooms & unassigned families roster",
    },
    {
      id: "div-1",
      divider: true,
      label: "",
    },
    {
      id: "add-building",
      label: "Add Building",
      icon: "🏢",
      onClick: () => setShowAddBuildingModal(true),
      description: "Create a new lodge or housing block",
    },
    {
      id: "add-room",
      label: "Add Room",
      icon: "🚪",
      onClick: () => setShowAddRoomModal(true),
      description: "Add room with capacity and accessible option",
    },
    {
      id: "div-2",
      divider: true,
      label: "",
    },
    {
      id: "review-families",
      label: "Review Families & Groups",
      icon: "👥",
      href: "/families",
      description: "View full list of attendees and groups",
    },
  ];

  return (
    <>
      {toast && <div className="toast show">{toast}</div>}

      <div className="top">
        <div>
          <h1>Housing & Room Allocator</h1>
          <div className="sub">Multi-family room housing, visual floor plans, drag-and-drop allocation, capacity checks, and auto-housing.</div>
        </div>
        <div className="actions">
          <div className="segment">
            <button className={viewMode === "grid" ? "active" : ""} onClick={() => setViewMode("grid")}>🎨 Visual Grid</button>
            <button className={viewMode === "table" ? "active" : ""} onClick={() => setViewMode("table")}>📋 Audit Table</button>
          </div>
          <button className="btn primary" onClick={handleAutoAssign} disabled={isProcessing}>
            {isProcessing ? "Processing..." : "⚡ Auto-assign Open Families"}
          </button>
          <ActionDropdown label="Manage & Print" icon="⚙️" items={roomActions} />
        </div>
      </div>

      <div className="grid cards4">
        <div className="card metric">
          <div className="label">Total Rooms</div>
          <div className="value">{totalRooms}</div>
        </div>
        <div className="card metric">
          <div className="label">Occupied Spaces</div>
          <div className="value green">{occupiedSpaces}</div>
        </div>
        <div className="card metric">
          <div className="label">Open Spaces</div>
          <div className="value blue">{openSpaces}</div>
        </div>
        <div className="card metric">
          <div className="label">Unassigned Families</div>
          <div className="value orange">{unassigned.length}</div>
        </div>
      </div>

      <div className="card toolbar section">
        <select className="select" value={bf} onChange={(e) => setBf(e.target.value)}>
          <option value="all">All buildings</option>
          {buildings.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select className="select" value={sf} onChange={(e) => setSf(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="available">Available / Vacant</option>
          <option value="partial">Partial (Spaces Available)</option>
          <option value="full">Full (At Capacity)</option>
        </select>
        <input 
          className="input wide" 
          value={q} 
          placeholder="Search room number, building, family..." 
          onChange={(e) => setQ(e.target.value)} 
        />
      </div>

      {viewMode === "grid" ? (
        <div className="split section">
          <div>
            {unassigned.length > 0 && (
              <a 
                href="#unassigned-section" 
                className="btn tiny orange mobile-only-unassigned-jump"
                style={{ display: "none", alignItems: "center", gap: "6px", marginBottom: "14px", textDecoration: "none", padding: "8px 12px", borderRadius: "8px", background: "var(--orangebg)", color: "var(--orange)", border: "1px solid #fde68a" }}
              >
                ⚠️ <b>{unassigned.length} Families Unassigned</b> — Tap to allocate ↓
              </a>
            )}
            {buildings.filter(b => bf === "all" || b.id === bf).map(b => {
              const rr = b.rooms.filter((r: any) => {
                const status = roomStatus(r);
                const fams = roomFamilies(r);
                const famNames = fams.map((f: any) => f.name).join(" ");
                const hay = `${b.name} ${r.number} ${famNames}`.toLowerCase();
                const matchesStatus = sf === "all" || status === sf;
                const matchesQuery = !q || hay.includes(q.toLowerCase());
                return matchesStatus && matchesQuery;
              });

              if (!rr.length) return null;

              const bCap = rr.reduce((s: number, r: any) => s + r.capacity, 0);
              const bOcc = rr.reduce((s: number, r: any) => s + roomOcc(r), 0);

              return (
                <section key={b.id} className="building">
                  <div className="building-head">
                    <div>
                      <div className="building-name">🏢 {b.name}</div>
                      <div className="building-meta">{rr.length} rooms · {bOcc}/{bCap} occupants</div>
                    </div>
                  </div>
                  <div className="room-grid">
                    {rr.map((r: any) => {
                      const status = roomStatus(r);
                      const occ = roomOcc(r);
                      const avail = roomAvail(r);
                      const dragState = getDragState(r);
                      const famList = roomFamilies(r);

                      return (
                        <div 
                          key={r.id} 
                          className={`card room ${status} ${dragState}`}
                          onClick={() => setSelectedRoom({ ...r, bname: b.name })}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverRoomId(r.id);
                          }}
                          onDragLeave={() => setDragOverRoomId(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleDropOnRoom(r);
                          }}
                        >
                          <div className="roomtitle">Room {r.number}</div>
                          <div className="small">Cap: {r.capacity} {r.accessible ? "· ♿ Ground" : ""}</div>
                          
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                            <span className={`pill ${status}`}>
                              {status === 'available' ? 'Vacant' : status === 'partial' ? `${avail} Space(s) Open` : 'Full'}
                            </span>
                            <span className="small" style={{ fontWeight: "bold" }}>{occ}/{r.capacity}</span>
                          </div>

                          <div style={{ marginTop: "8px" }}>
                            <div className="progress" style={{ height: "6px" }}>
                              <i style={{ width: `${Math.min(100, (occ / r.capacity) * 100)}%` }}></i>
                            </div>
                          </div>

                          <div className="small" style={{ marginTop: "8px", display: "grid", gap: "4px" }}>
                            {famList.length > 0 ? (
                              famList.map((f: any) => (
                                <div 
                                  key={f.id}
                                  className="draggable-family" 
                                  draggable
                                  onDragStart={(e) => { e.stopPropagation(); setDraggedFamily(f); }}
                                  onDragEnd={() => { setDraggedFamily(null); setDragOverRoomId(null); }}
                                  style={{ 
                                    background: "#edf2ff", 
                                    padding: "3px 6px", 
                                    borderRadius: "6px", 
                                    fontWeight: "bold",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center"
                                  }}
                                >
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "4px" }}>
                                    🖐️ {f.name}
                                    {f.assignedMembers && f.assignedMembers.length > 0
                                      ? `: ${f.assignedMembers.map((m: any) => m.name || m.role).join(", ")} (${f.roomSpecificCount}p)`
                                      : ` (${familySize(f)}p)`}
                                  </span>
                                  <button 
                                    className="btn tiny" 
                                    style={{ padding: "1px 4px", fontSize: "9px", flexShrink: 0 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMoveGroupState({ family: f, sourceRoom: { ...r, bname: b.name } });
                                    }}
                                  >
                                    ⇄ Move
                                  </button>
                                </div>
                              ))
                            ) : (
                              <span style={{ fontStyle: "italic", color: "var(--muted)" }}>Drop family here</span>
                            )}
                          </div>

                          {/* Hover Tooltip */}
                          <div className="tooltip">
                            <strong>{b.name} · Room {r.number}</strong>
                            <div>Capacity: {r.capacity} people</div>
                            <div>Occupants: {occ} / {r.capacity}</div>
                            <div>Available Space: {avail} people</div>
                            <div>
                              Assigned Groups ({famList.length}):{" "}
                              {famList
                                .map((f: any) =>
                                  f.assignedMembers && f.assignedMembers.length > 0
                                    ? `${f.name} (${f.assignedMembers.map((m: any) => m.name || m.role).join(", ")})`
                                    : f.name
                                )
                                .join("; ") || "None"}
                            </div>
                            <div>Accessibility: {r.accessible ? "Yes (Ground floor/Wheelchair) ✓" : "Standard"}</div>
                            <div style={{ marginTop: "4px", color: "#a5b4fc" }}>💡 Drag families here to add up to room capacity!</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <div>
            <div 
              id="unassigned-section"
              className={`card panel unassigned-dropzone ${isOverUnassigned ? "drag-active" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setIsOverUnassigned(true); }}
              onDragLeave={() => setIsOverUnassigned(false)}
              onDrop={(e) => { e.preventDefault(); handleDropOnUnassigned(); }}
            >
              <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Unassigned ({unassigned.length})</span>
                <span className="small">Drag to room or drop here to unassign</span>
              </div>
              
              {unassigned.length > 0 ? (
                <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
                  {unassigned.map(f => (
                    <div 
                      key={f.id} 
                      className="listitem draggable-family"
                      draggable
                      onDragStart={() => setDraggedFamily(f)}
                      onDragEnd={() => { setDraggedFamily(null); setIsOverUnassigned(false); }}
                      style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid var(--line)" }}
                    >
                      <span>
                        <b>🖐️ {f.name}</b>{" "}
                        <span className="pill info" style={{ fontSize: "10px" }}>
                          {f.unassignedCount} {f.unassignedCount === 1 ? "person" : "people"} unassigned
                        </span>{" "}
                        {f.status && <span className={`pill ${f.status.toLowerCase()}`} style={{ fontSize: "10px" }}>{f.status}</span>}
                        <br/>
                        {f.unassignedMembers && f.unassignedMembers.length > 0 && (
                          <div className="small" style={{ color: "#4f46e5", fontWeight: 600, marginTop: "2px" }}>
                            Unassigned members: {f.unassignedMembers.map((m: any) => m.name || m.role).join(", ")}
                          </div>
                        )}
                        <span className="small">Pref: {f.roomPref || "Any"} {f.access !== "None" ? `· Needs: ${f.access}` : ""}</span>
                        {f.buddyRequest && (
                          <div style={{ fontSize: "11px", fontWeight: "600", color: "#6366f1", marginTop: "2px" }}>
                            🤝 Buddy Request: {f.buddyRequest}
                          </div>
                        )}
                      </span>
                      <button className="btn tiny primary" onClick={() => setAssigningFamily(f)}>Assign</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty">All active attendees have rooms assigned! 🎉</div>
              )}
            </div>

            <div className="card panel section">
              <div className="section-title">💡 Multi-Family Room Rules</div>
              <div className="small" style={{ display: "grid", gap: "6px" }}>
                <div>• <b>Multiple Families Per Room</b>: Large rooms can house multiple families up to the room's total capacity.</div>
                <div>• <b>Drag & Drop</b>: Drag any family into a room with open space.</div>
                <div>• <b>Move / Swap</b>: Click '⇄ Move' on any family card to transfer them to another room.</div>
                <div>• <b>Unassign</b>: Drag a family card back to the unassigned panel to remove them from a room.</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Audit Table View */
        <div className="card panel section">
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Building</th><th>Room #</th><th>Capacity</th><th>Occupants</th><th>Assigned Families / Groups</th><th>Accessibility</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allRooms.map(r => {
                  const status = roomStatus(r);
                  const occ = roomOcc(r);
                  const avail = roomAvail(r);
                  const famList = roomFamilies(r);
                  return (
                    <tr key={r.id}>
                      <td><b>{r.bname}</b></td>
                      <td>Room {r.number}</td>
                      <td>{r.capacity} people</td>
                      <td><b>{occ} / {r.capacity}</b> ({avail} open)</td>
                      <td>
                        {famList.length > 0 ? (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                            {famList.map((f: any) => (
                              <span key={f.id} className="pill info" style={{ fontSize: "11px" }}>
                                {f.name}
                                {f.assignedMembers && f.assignedMembers.length > 0
                                  ? `: ${f.assignedMembers.map((m: any) => m.name || m.role).join(", ")} (${f.roomSpecificCount}p)`
                                  : ` (${familySize(f)}p)`}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="small">Vacant</span>
                        )}
                      </td>
                      <td>{r.accessible ? <span className="pill info">Ground Floor ♿</span> : "Standard"}</td>
                      <td><span className={`pill ${status}`}>{status === 'available' ? 'Vacant' : status === 'partial' ? `${avail} Open` : 'Full'}</span></td>
                      <td className="actions-cell">
                        <button className="btn tiny" onClick={() => setSelectedRoom(r)}>Manage Room</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Move / Transfer Group Modal */}
      {moveGroupState && (
        <div className="modalbg show" onClick={() => setMoveGroupState(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Move Group: {moveGroupState.family.name}</h2>
            <p>
              Current Room: <b>{moveGroupState.sourceRoom.bname} - Room {moveGroupState.sourceRoom.number}</b> | 
              Group Size: <b>{familySize(moveGroupState.family)} Members ({moveGroupState.family.adults}A, {moveGroupState.family.children}C)</b>
            </p>

            <div className="form" style={{ marginTop: "15px" }}>
              <label>Select Destination Room:</label>
              <select 
                className="select" 
                value={targetMoveRoomId}
                onChange={(e) => setTargetMoveRoomId(e.target.value)}
              >
                <option value="">-- Select Target Room --</option>
                {allRooms
                  .filter(r => r.id !== moveGroupState.sourceRoom.id)
                  .map(r => {
                    const fSize = familySize(moveGroupState.family);
                    const avail = roomAvail(r);
                    const isOverCap = fSize > avail;
                    const fams = roomFamilies(r);
                    const hasFamilies = fams.length > 0;
                    return (
                      <option key={r.id} value={r.id} disabled={isOverCap && !hasFamilies}>
                        {r.bname} - Room {r.number} (Cap: {r.capacity}, Open: {avail}) {r.accessible ? "[♿ Accessible]" : ""} {isOverCap && hasFamilies ? `⇄ [Swap]` : `[${avail >= fSize ? 'Space Available' : 'Full'}]`}
                      </option>
                    );
                  })}
              </select>
            </div>

            {targetMoveRoomId && (() => {
              const targetRoom = allRooms.find(r => r.id === targetMoveRoomId);
              if (!targetRoom) return null;
              const fSize = familySize(moveGroupState.family);
              const avail = roomAvail(targetRoom);
              const targetFams = roomFamilies(targetRoom);

              if (fSize <= avail) {
                return (
                  <div className="alert green" style={{ marginTop: "12px" }}>
                    <strong>✓ Room Placement Ready</strong>
                    <span>Room {targetRoom.number} has {avail} available space(s). <b>{moveGroupState.family.name}</b> ({fSize} members) will be added to <b>{targetRoom.bname} - Room {targetRoom.number}</b>.</span>
                  </div>
                );
              }
              return (
                <div className="alert orange" style={{ marginTop: "12px" }}>
                  <strong>⇄ Room Swap Required</strong>
                  <span>Target Room {targetRoom.number} has insufficient space ({avail} open). Confirming will swap <b>{moveGroupState.family.name}</b> with <b>{targetFams[0]?.name}</b>.</span>
                </div>
              );
            })()}

            <div className="modal-actions">
              <button className="btn" onClick={() => setMoveGroupState(null)}>Cancel</button>
              <button 
                className="btn primary" 
                disabled={!targetMoveRoomId || isProcessing}
                onClick={handleExecuteMove}
              >
                {isProcessing ? "Transferring..." : "Confirm Move / Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Building Modal */}
      {showAddBuildingModal && (
        <div className="modalbg show" onClick={() => setShowAddBuildingModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add New Building</h2>
            <p>Create a housing building or lodge for the retreat grounds.</p>
            <form onSubmit={handleCreateBuilding} className="form">
              <div>
                <label>Building Name *</label>
                <input 
                  className="input" 
                  required 
                  value={buildingName} 
                  onChange={(e) => setBuildingName(e.target.value)} 
                  placeholder="e.g. Pine Lodge / Main Hall" 
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setShowAddBuildingModal(false)}>Cancel</button>
                <button type="submit" className="btn primary">Create Building</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Room Modal */}
      {showAddRoomModal && (
        <div className="modalbg show" onClick={() => setShowAddRoomModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add New Room</h2>
            <p>Create a room in an existing retreat building.</p>
            <form onSubmit={handleCreateRoom} className="form">
              <div>
                <label>Building *</label>
                <select 
                  className="select" 
                  value={newRoomBuildingId} 
                  onChange={(e) => setNewRoomBuildingId(e.target.value)}
                >
                  {buildings.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="formgrid">
                <div>
                  <label>Room Number *</label>
                  <input 
                    className="input" 
                    required 
                    value={newRoomNumber} 
                    onChange={(e) => setNewRoomNumber(e.target.value)} 
                    placeholder="e.g. 101, 204B" 
                  />
                </div>
                <div>
                  <label>Capacity (People) *</label>
                  <input 
                    className="input" 
                    type="number" 
                    min="1" 
                    required 
                    value={newRoomCapacity} 
                    onChange={(e) => setNewRoomCapacity(e.target.value)} 
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={newRoomAccessible} 
                    onChange={(e) => setNewRoomAccessible(e.target.checked)} 
                  />
                  Ground floor / Wheelchair accessible room
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setShowAddRoomModal(false)}>Cancel</button>
                <button type="submit" className="btn primary">Add Room</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room Details & Management Modal */}
      {selectedRoom && (() => {
        const famList = roomFamilies(selectedRoom);
        const occ = roomOcc(selectedRoom);
        const avail = roomAvail(selectedRoom);
        return (
          <div className="modalbg show" onClick={() => setSelectedRoom(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Room {selectedRoom.bname} - {selectedRoom.number}</h2>
              <p>Capacity: {selectedRoom.capacity} people | Occupants: {occ} / {selectedRoom.capacity} | Open Space: {avail} people | Accessible: {selectedRoom.accessible ? "Yes (Ground floor)" : "No"}</p>
              
              <div style={{ marginTop: "15px" }}>
                <label>Currently Assigned Families / Groups ({famList.length}):</label>
                <div style={{ margin: "10px 0", display: "grid", gap: "8px" }}>
                  {famList.length > 0 ? (
                    famList.map((f: any) => (
                      <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                        <div>
                          <b>{f.name}</b> ({f.roomSpecificCount ?? familySize(f)} occupants)
                          {f.assignedMembers && f.assignedMembers.length > 0 && (
                            <div style={{ fontSize: "12px", color: "#4f46e5", marginTop: "2px" }}>
                              Members in room: {f.assignedMembers.map((m: any) => `${m.name || "Member"} (${m.role})`).join(", ")}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button 
                            className="btn tiny primary" 
                            onClick={() => {
                              const room = selectedRoom;
                              setSelectedRoom(null);
                              setMoveGroupState({ family: f, sourceRoom: room });
                            }}
                          >
                            ⇄ Move
                          </button>
                          <button 
                            className="btn tiny danger" 
                            onClick={() => handleUnassignFamily(f.id)}
                          >
                            ✕ Unassign
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="pill info">Vacant / Unassigned</span>
                  )}
                </div>
              </div>

              {avail > 0 && (
                <div className="form" style={{ marginTop: "15px" }}>
                  <label>Add Another Family to Room ({avail} spaces remaining):</label>
                  <select 
                    className="select"
                    onChange={(e) => {
                      if (e.target.value) handleAssignRoom(selectedRoom.id, e.target.value);
                    }}
                  >
                    <option value="">-- Select Unassigned Family --</option>
                    {unassigned.map(f => (
                      <option key={f.id} value={f.id} disabled={familySize(f) > avail}>
                        {f.name} ({familySize(f)} people) {familySize(f) > avail ? `- Exceeds available space (${avail})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="modal-actions">
                <button className="btn" onClick={() => setSelectedRoom(null)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Assign Family Modal */}
      {assigningFamily && (
        <div className="modalbg show" onClick={() => setAssigningFamily(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Assign Room for {assigningFamily.name}</h2>
            <p>Family Size: {familySize(assigningFamily)} people | Pref: {assigningFamily.roomPref} | Needs: {assigningFamily.access}</p>

            <div className="form" style={{ marginTop: "15px" }}>
              <label>Select Room with Available Space:</label>
              <select 
                className="select"
                onChange={(e) => {
                  if (e.target.value) handleAssignRoom(e.target.value, assigningFamily.id);
                }}
              >
                <option value="">-- Choose a Room --</option>
                {allRooms
                  .filter(r => roomAvail(r) >= familySize(assigningFamily))
                  .map(r => (
                    <option key={r.id} value={r.id}>
                      {r.bname} - Room {r.number} (Cap: {r.capacity}, Open: {roomAvail(r)}) {r.accessible ? "[Accessible]" : ""}
                    </option>
                  ))}
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setAssigningFamily(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showPrintModal && (
        <RoomAssignmentPrintModal
          buildings={buildings}
          allFamilies={allFamilies}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </>
  );
}
