"use client";

import { useState, useEffect } from "react";
import Logo from "@/components/Logo";
import { parseMembers } from "@/lib/members";

interface RoomAssignmentPrintModalProps {
  buildings: any[];
  allFamilies: any[];
  eventName?: string;
  onClose: () => void;
}

export default function RoomAssignmentPrintModal({
  buildings,
  allFamilies,
  eventName = "2026 Family Summer Retreat",
  onClose,
}: RoomAssignmentPrintModalProps) {
  const [filterMode, setFilterMode] = useState<"all" | "assigned" | "unassigned">("all");

  const familySize = (f: any) =>
    f ? f.adults + f.children + (f.nonPayingChildren || 0) : 0;

  // Flatten all rooms with building info
  const allRooms = buildings.flatMap((b) =>
    (b.rooms || []).map((r: any) => ({ ...r, bid: b.id, bname: b.name }))
  );

  // Group assigned families/members by building and room
  const buildingAssignments = buildings.map((b) => {
    const roomsWithFamilies = (b.rooms || []).map((r: any) => {
      const famList: any[] = [];
      allFamilies.forEach((f: any) => {
        if (f.status !== "Confirmed") return;
        const members = parseMembers(f.membersJson);
        if (members.length > 0) {
          const inThisRoom = members.filter((m: any) => m.roomId === r.id);
          if (inThisRoom.length > 0) {
            famList.push({
              ...f,
              assignedMembers: inThisRoom,
              countInRoom: inThisRoom.length,
            });
          } else if (f.roomId === r.id && members.every((m: any) => !m.roomId)) {
            famList.push({
              ...f,
              assignedMembers: members,
              countInRoom: members.length,
            });
          }
        } else {
          if (f.roomId === r.id) {
            famList.push({
              ...f,
              assignedMembers: [],
              countInRoom: familySize(f),
            });
          }
        }
      });

      // Also check r.families if present
      if (r.families) {
        r.families.forEach((rf: any) => {
          if (!famList.some((item: any) => item.id === rf.id)) {
            const members = parseMembers(rf.membersJson);
            famList.push({
              ...rf,
              assignedMembers: members,
              countInRoom: members.length > 0 ? members.length : familySize(rf),
            });
          }
        });
      }

      const occ = famList.reduce((sum: number, f: any) => sum + f.countInRoom, 0);
      return {
        ...r,
        families: famList,
        occupancy: occ,
        isFull: occ >= r.capacity,
        isAvailable: occ === 0,
      };
    });

    const assignedCount = roomsWithFamilies.reduce(
      (sum: number, r: any) => sum + r.families.length,
      0
    );

    return {
      ...b,
      rooms: roomsWithFamilies,
      assignedCount,
    };
  });

  // Unassigned families and group members
  const unassignedFamilies = allFamilies.filter((f) => {
    if (f.status !== "Confirmed") return false;
    const members = parseMembers(f.membersJson);
    if (members.length > 0) {
      return members.some((m: any) => !m.roomId || !allRooms.some((r) => r.id === m.roomId));
    }
    return !f.roomId || !allRooms.some((r) => r.id === f.roomId);
  }).map((f) => {
    const members = parseMembers(f.membersJson);
    if (members.length > 0) {
      const unassignedMems = members.filter((m: any) => !m.roomId || !allRooms.some((r) => r.id === m.roomId));
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

  const totalAssignedFamilies = allFamilies.filter(
    (f: any) => f.status === "Confirmed" && f.roomId && allRooms.some((r: any) => r.id === f.roomId)
  ).length;

  const totalConfirmedFamilies = allFamilies.filter((f: any) => f.status === "Confirmed").length;
  const totalCapacity = allRooms.reduce((sum: number, r: any) => sum + (r.capacity || 0), 0);
  const totalOccupants = allRooms.reduce((sum: number, r: any) => {
    const fams = allFamilies.filter((f: any) => f.roomId === r.id);
    return sum + fams.reduce((fs: number, f: any) => fs + familySize(f), 0);
  }, 0);

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
        className="modal-content room-print-modal"
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

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Logo size={50} showText={false} glow />
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
                ROOM ASSIGNMENT ROSTER & PRINT
              </div>
              <h2 style={{ margin: "2px 0 0 0", fontSize: "19px", fontWeight: 800, color: "#fff" }}>
                Housing Roster ({eventName})
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
                onClick={() => setFilterMode("all")}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 700,
                  border: 0,
                  borderRadius: "6px",
                  cursor: "pointer",
                  background: filterMode === "all" ? "#6366f1" : "transparent",
                  color: filterMode === "all" ? "#ffffff" : "#94a3b8",
                }}
              >
                All ({totalConfirmedFamilies})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("assigned")}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 700,
                  border: 0,
                  borderRadius: "6px",
                  cursor: "pointer",
                  background: filterMode === "assigned" ? "#16a34a" : "transparent",
                  color: filterMode === "assigned" ? "#ffffff" : "#94a3b8",
                }}
              >
                Assigned ({totalAssignedFamilies})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("unassigned")}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 700,
                  border: 0,
                  borderRadius: "6px",
                  cursor: "pointer",
                  background: filterMode === "unassigned" ? "#b76e00" : "transparent",
                  color: filterMode === "unassigned" ? "#ffffff" : "#94a3b8",
                }}
              >
                Unassigned ({unassignedFamilies.length})
              </button>
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
              🖨️ Print Roster
            </button>
          </div>
        </div>

        {/* Printable Roster Sheet */}
        <div
          className="printable-roster-area"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "28px",
            background: "#ffffff",
            color: "#172033",
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
              marginBottom: "20px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                <Logo size={28} showText={false} />
                <span style={{ fontSize: "13px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "#4f46e5" }}>
                  RetreatFlow Lodging & Accommodations
                </span>
              </div>
              <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "4px 0", color: "#0f172a" }}>
                {eventName} — Housing & Room Assignment Roster
              </h1>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Report Generated on: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
              </div>
            </div>

            <div
              style={{
                textAlign: "right",
                background: "#f8fafc",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                fontSize: "12px",
              }}
            >
              <div><strong>Total Confirmed:</strong> {totalConfirmedFamilies} families</div>
              <div style={{ color: "#16a34a" }}><strong>Assigned:</strong> {totalAssignedFamilies} families ({totalOccupants}/{totalCapacity} beds)</div>
              <div style={{ color: "#b76e00" }}><strong>Unassigned:</strong> {unassignedFamilies.length} families</div>
            </div>
          </div>

          {/* Section 1: Assigned Rooms */}
          {(filterMode === "all" || filterMode === "assigned") && (
            <div style={{ marginBottom: "32px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#f1f5f9",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  marginBottom: "12px",
                  borderLeft: "4px solid #16a34a",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                  🏢 Assigned Rooms by Building ({totalAssignedFamilies} Families Assigned)
                </h3>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#16a34a" }}>
                  Occupancy: {totalCapacity ? Math.round((totalOccupants / totalCapacity) * 100) : 0}%
                </span>
              </div>

              {buildingAssignments.length === 0 ? (
                <div style={{ padding: "16px", color: "#64748b", fontStyle: "italic" }}>No buildings configured.</div>
              ) : (
                buildingAssignments.map((b) => {
                  const assignedRooms = b.rooms.filter((r: any) => r.families && r.families.length > 0);
                  if (filterMode === "assigned" && assignedRooms.length === 0) return null;

                  return (
                    <div key={b.id} style={{ marginBottom: "20px", breakInside: "avoid" }}>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 800,
                          color: "#1e293b",
                          padding: "6px 0",
                          borderBottom: "1px solid #cbd5e1",
                          marginBottom: "8px",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>🏛️ {b.name}</span>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>
                          {assignedRooms.length} room(s) occupied · {b.rooms.reduce((s: number, r: any) => s + r.occupancy, 0)}/{b.rooms.reduce((s: number, r: any) => s + r.capacity, 0)} spaces
                        </span>
                      </div>

                      {assignedRooms.length === 0 ? (
                        <div style={{ fontSize: "12px", color: "#94a3b8", padding: "8px 0", fontStyle: "italic" }}>
                          No families currently assigned in this building.
                        </div>
                      ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", marginBottom: "10px" }}>
                          <thead>
                            <tr style={{ background: "#f8fafc", textAlign: "left", borderBottom: "1px solid #cbd5e1" }}>
                              <th style={{ padding: "6px 8px", width: "80px" }}>Room</th>
                              <th style={{ padding: "6px 8px", width: "70px" }}>Cap / Occ</th>
                              <th style={{ padding: "6px 8px" }}>Assigned Family / Leader</th>
                              <th style={{ padding: "6px 8px", width: "120px" }}>Members</th>
                              <th style={{ padding: "6px 8px", width: "140px" }}>Contact</th>
                              <th style={{ padding: "6px 8px" }}>Notes / Special Needs</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assignedRooms.map((r: any) => (
                              <tr key={r.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                                <td style={{ padding: "6px 8px", fontWeight: 800, color: "#0f172a" }}>
                                  Room {r.number}
                                  {r.accessible && <span style={{ marginLeft: "4px" }} title="Accessible">♿</span>}
                                </td>
                                <td style={{ padding: "6px 8px", color: r.isFull ? "#16a34a" : "#64748b" }}>
                                  {r.occupancy} / {r.capacity}
                                </td>
                                <td style={{ padding: "6px 8px" }}>
                                  {r.families.map((f: any, idx: number) => (
                                    <div key={f.id || idx} style={{ marginBottom: idx > 0 ? "4px" : "0" }}>
                                      <strong style={{ color: "#0f172a" }}>{f.name}</strong>
                                      {f.leader && f.leader !== f.name && (
                                        <span style={{ color: "#64748b", marginLeft: "4px" }}>({f.leader})</span>
                                      )}
                                    </div>
                                  ))}
                                </td>
                                <td style={{ padding: "6px 8px" }}>
                                  {r.families.map((f: any, idx: number) => (
                                    <div key={f.id || idx}>
                                      {f.assignedMembers && f.assignedMembers.length > 0 ? (
                                        <div>
                                          <b style={{ color: "#0f172a" }}>{f.assignedMembers.length} member(s):</b>
                                          <div style={{ fontSize: "11px", color: "#334155" }}>
                                            {f.assignedMembers.map((m: any) => `${m.name || "Member"} (${m.role})`).join(", ")}
                                          </div>
                                        </div>
                                      ) : (
                                        <div>
                                          {f.adults}A, {f.children}C {f.nonPayingChildren ? `(${f.nonPayingChildren} Free)` : ""}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </td>
                                <td style={{ padding: "6px 8px", color: "#475569" }}>
                                  {r.families.map((f: any, idx: number) => (
                                    <div key={f.id || idx}>
                                      {f.phone || f.email || "—"}
                                    </div>
                                  ))}
                                </td>
                                <td style={{ padding: "6px 8px", color: "#64748b", fontSize: "11px" }}>
                                  {r.families.map((f: any, idx: number) => (
                                    <div key={f.id || idx}>
                                      {f.access !== "None" && <span style={{ color: "#b76e00", fontWeight: 700 }}>[{f.access}] </span>}
                                      {f.roomPref && f.roomPref !== "Any" && <span>Pref: {f.roomPref} </span>}
                                      {f.notes || ""}
                                    </div>
                                  ))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Section 2: Unassigned Families */}
          {(filterMode === "all" || filterMode === "unassigned") && (
            <div style={{ marginBottom: "20px", breakInside: "avoid" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#fef3c7",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  marginBottom: "12px",
                  borderLeft: "4px solid #b76e00",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#92400e" }}>
                  ⚠️ Unassigned Families Awaiting Room Placement ({unassignedFamilies.length} Families)
                </h3>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#b76e00" }}>
                  Action Needed
                </span>
              </div>

              {unassignedFamilies.length === 0 ? (
                <div
                  style={{
                    padding: "16px",
                    background: "#f0fdf4",
                    borderRadius: "8px",
                    color: "#16a34a",
                    fontWeight: 700,
                    textAlign: "center",
                    border: "1px solid #bbf7d0",
                  }}
                >
                  🎉 All confirmed families have been assigned rooms!
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left", borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ padding: "6px 8px" }}>Family / Group Name</th>
                      <th style={{ padding: "6px 8px" }}>Leader</th>
                      <th style={{ padding: "6px 8px", width: "90px" }}>Size</th>
                      <th style={{ padding: "6px 8px", width: "130px" }}>Contact</th>
                      <th style={{ padding: "6px 8px" }}>Room Preference</th>
                      <th style={{ padding: "6px 8px" }}>Accessibility & Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unassignedFamilies.map((f: any) => (
                      <tr key={f.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "6px 8px", fontWeight: 800, color: "#0f172a" }}>
                          {f.name}
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          {f.leader}
                        </td>
                        <td style={{ padding: "6px 8px", fontWeight: 700, color: "#4f46e5" }}>
                          {f.unassignedMembers && f.unassignedMembers.length > 0 ? (
                            <div>
                              <div>{f.unassignedCount} unassigned</div>
                              <div style={{ fontSize: "11px", fontWeight: 400, color: "#64748b" }}>
                                {f.unassignedMembers.map((m: any) => `${m.name || "Member"} [${m.role}]`).join(", ")}
                              </div>
                            </div>
                          ) : (
                            <div>{familySize(f)} total ({f.adults}A, {f.children}C)</div>
                          )}
                        </td>
                        <td style={{ padding: "6px 8px", color: "#475569" }}>
                          {f.phone || f.email || "—"}
                        </td>
                        <td style={{ padding: "6px 8px", color: "#0f172a" }}>
                          {f.roomPref || "Any"}
                        </td>
                        <td style={{ padding: "6px 8px", color: "#64748b" }}>
                          {f.access !== "None" && (
                            <span style={{ color: "#b76e00", fontWeight: 700 }}>♿ {f.access} · </span>
                          )}
                          {f.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Roster Document Footer */}
          <div
            style={{
              marginTop: "24px",
              paddingTop: "12px",
              borderTop: "1px solid #e2e8f0",
              fontSize: "11px",
              color: "#94a3b8",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>RetreatFlow Event Operations · Confidential Event Document</span>
            <span>Printed Roster</span>
          </div>
        </div>

      </div>
    </div>
  );
}
