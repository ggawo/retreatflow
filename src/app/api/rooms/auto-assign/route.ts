import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";

export async function POST() {
  try {
    const activeEvent = await getActiveEvent();

    const families = await prisma.family.findMany({
      where: { 
        eventId: activeEvent.id, 
        status: "Confirmed" 
      },
      orderBy: [{ access: "desc" }, { adults: "desc" }],
    });

    const rooms = await prisma.room.findMany({
      where: { 
        building: { eventId: activeEvent.id } 
      },
      include: { families: true, building: true },
      orderBy: [{ accessible: "desc" }, { capacity: "asc" }],
    });

    if (rooms.length === 0) {
      return NextResponse.json({ error: "No rooms available in event. Please add buildings and rooms first." }, { status: 400 });
    }

    // Map room ID -> room state (room object, buildingId, occupants count)
    const roomStateMap = new Map<string, { room: any; buildingId: string; occupants: number }>();
    rooms.forEach(r => {
      const occ = r.families.reduce((s, f) => s + f.adults + f.children + (f.nonPayingChildren || 0), 0);
      roomStateMap.set(r.id, { room: r, buildingId: r.buildingId, occupants: occ });
    });

    const getFamilySize = (f: any) => f.adults + f.children + (f.nonPayingChildren || 0);

    const unassignedFamilies = families.filter(f => !f.roomId);
    let assignedCount = 0;
    let buddyPairsMatched = 0;

    // Helper: Find buddy family for a given family
    const findBuddyFamily = (targetFam: any) => {
      if (!targetFam.buddyRequest || !targetFam.buddyRequest.trim()) return null;
      const term = targetFam.buddyRequest.trim().toLowerCase();
      return families.find(f => 
        f.id !== targetFam.id && 
        (f.name.toLowerCase().includes(term) || f.leader.toLowerCase().includes(term) || f.id === term)
      );
    };

    // Tracker for assigned families during auto-assign
    const assignedFamilyRoomMap = new Map<string, string>(); // familyId -> roomId
    families.filter(f => f.roomId).forEach(f => assignedFamilyRoomMap.set(f.id, f.roomId!));

    // --- PHASE 1: PAIR UNASSIGNED FAMILIES WITH THEIR BUDDY REQUESTS ---
    for (const family of unassignedFamilies) {
      if (assignedFamilyRoomMap.has(family.id)) continue; // already assigned in earlier iteration

      const familySize = getFamilySize(family);
      const requiresAccessible = family.access && family.access !== "None";
      const buddyFam = findBuddyFamily(family);

      let targetRoomId: string | null = null;

      // Case A: Buddy family is ALREADY assigned to a room
      if (buddyFam && assignedFamilyRoomMap.has(buddyFam.id)) {
        const buddyRoomId = assignedFamilyRoomMap.get(buddyFam.id)!;
        const buddyRoomState = roomStateMap.get(buddyRoomId);

        if (buddyRoomState) {
          const remainingInBuddyRoom = buddyRoomState.room.capacity - buddyRoomState.occupants;

          // A1: Can we fit in the EXACT SAME room as the buddy?
          if (remainingInBuddyRoom >= familySize) {
            targetRoomId = buddyRoomId;
            buddyPairsMatched++;
          } else {
            // A2: Try another room in the SAME BUILDING as the buddy
            for (const [rId, rState] of roomStateMap.entries()) {
              if (rState.buildingId === buddyRoomState.buildingId) {
                const remaining = rState.room.capacity - rState.occupants;
                if (remaining >= familySize && (!requiresAccessible || rState.room.accessible)) {
                  targetRoomId = rId;
                  buddyPairsMatched++;
                  break;
                }
              }
            }
          }
        }
      }

      // Case B: Buddy family is ALSO UNASSIGNED - try to place BOTH together
      if (!targetRoomId && buddyFam && !assignedFamilyRoomMap.has(buddyFam.id)) {
        const buddySize = getFamilySize(buddyFam);
        const combinedSize = familySize + buddySize;

        // B1: Try placing BOTH families in the SAME room
        for (const [rId, rState] of roomStateMap.entries()) {
          const remaining = rState.room.capacity - rState.occupants;
          if (remaining >= combinedSize) {
            // Assign target family
            targetRoomId = rId;

            // Assign buddy family to same room
            await prisma.family.update({ where: { id: buddyFam.id }, data: { roomId: rId } });
            assignedFamilyRoomMap.set(buddyFam.id, rId);
            rState.occupants += buddySize;
            assignedCount++;
            buddyPairsMatched++;
            break;
          }
        }

        // B2: If can't fit in one room, try placing in two rooms in the SAME BUILDING
        if (!targetRoomId) {
          for (const [rId1, rState1] of roomStateMap.entries()) {
            if (rState1.room.capacity - rState1.occupants >= familySize) {
              // Find second room in same building for buddy
              for (const [rId2, rState2] of roomStateMap.entries()) {
                if (rState1.buildingId === rState2.buildingId && rId1 !== rId2 && (rState2.room.capacity - rState2.occupants >= buddySize)) {
                  targetRoomId = rId1;
                  await prisma.family.update({ where: { id: buddyFam.id }, data: { roomId: rId2 } });
                  assignedFamilyRoomMap.set(buddyFam.id, rId2);
                  rState2.occupants += buddySize;
                  assignedCount++;
                  buddyPairsMatched++;
                  break;
                }
              }
              if (targetRoomId) break;
            }
          }
        }
      }

      // --- PHASE 2: STANDARD ALLOCATION (IF NO BUDDY MATCH WAS MADE) ---
      if (!targetRoomId) {
        // Try accessible room first if required
        for (const [rId, rState] of roomStateMap.entries()) {
          const remaining = rState.room.capacity - rState.occupants;
          if (remaining >= familySize && (!requiresAccessible || rState.room.accessible)) {
            targetRoomId = rId;
            break;
          }
        }

        // Fallback to any room with capacity
        if (!targetRoomId) {
          for (const [rId, rState] of roomStateMap.entries()) {
            const remaining = rState.room.capacity - rState.occupants;
            if (remaining >= familySize) {
              targetRoomId = rId;
              break;
            }
          }
        }
      }

      // Execute assignment if a valid room was found
      if (targetRoomId) {
        await prisma.family.update({
          where: { id: family.id },
          data: { roomId: targetRoomId },
        });

        assignedFamilyRoomMap.set(family.id, targetRoomId);
        const rState = roomStateMap.get(targetRoomId)!;
        rState.occupants += familySize;
        assignedCount++;
      }
    }

    revalidatePath("/");
    revalidatePath("/rooms");
    revalidatePath("/families");

    return NextResponse.json({
      success: true,
      count: assignedCount,
      buddyPairsMatched,
      message: `Auto-assigned ${assignedCount} families (${buddyPairsMatched} buddy request pairings matched)!`
    });
  } catch (err) {
    console.error("Auto-assign error:", err);
    return NextResponse.json({ error: "Auto-assignment failed" }, { status: 500 });
  }
}
