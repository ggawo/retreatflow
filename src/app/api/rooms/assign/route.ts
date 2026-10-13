import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { parseMembers, serializeMembers } from "@/lib/members";

export async function POST(req: NextRequest) {
  try {
    const { familyId, roomId, memberId, action } = await req.json();

    if (!familyId) {
      return NextResponse.json({ error: "Family ID is required" }, { status: 400 });
    }

    const family = await prisma.family.findUnique({ where: { id: familyId } });
    if (!family) return NextResponse.json({ error: "Family not found" }, { status: 404 });

    const members = parseMembers(family.membersJson);

    // Case 1: Member-specific room assignment or unassignment
    if (memberId && members.length > 0) {
      const targetMemberIdx = members.findIndex(m => m.id === memberId);
      if (targetMemberIdx === -1) {
        return NextResponse.json({ error: "Group member not found" }, { status: 404 });
      }

      if (action === "unassign" || !roomId) {
        members[targetMemberIdx].roomId = undefined;
        members[targetMemberIdx].roomName = undefined;

        // Check if any members still have a room assigned
        const remainingAssigned = members.find(m => m.roomId);
        const newPrimaryRoomId = remainingAssigned ? remainingAssigned.roomId : null;

        const updated = await prisma.family.update({
          where: { id: familyId },
          data: {
            membersJson: serializeMembers(members),
            roomId: newPrimaryRoomId,
          },
        });

        revalidatePath("/");
        revalidatePath("/rooms");
        revalidatePath("/families");
        return NextResponse.json(updated);
      }

      // Assigning member to target room
      const targetRoom = await prisma.room.findUnique({
        where: { id: roomId },
        include: { families: true },
      });
      if (!targetRoom) return NextResponse.json({ error: "Room not found" }, { status: 404 });

      members[targetMemberIdx].roomId = targetRoom.id;
      members[targetMemberIdx].roomName = targetRoom.number;

      const updated = await prisma.family.update({
        where: { id: familyId },
        data: {
          membersJson: serializeMembers(members),
          roomId: family.roomId || targetRoom.id,
        },
      });

      revalidatePath("/");
      revalidatePath("/rooms");
      revalidatePath("/families");
      return NextResponse.json(updated);
    }

    // Case 2: Whole Family / Group unassign
    if (action === "unassign" || !roomId) {
      let updatedMembersJson = family.membersJson;
      if (members.length > 0) {
        const clearedMembers = members.map(m => ({ ...m, roomId: undefined, roomName: undefined }));
        updatedMembersJson = serializeMembers(clearedMembers);
      }

      const updatedFamily = await prisma.family.update({
        where: { id: familyId },
        data: {
          roomId: null,
          membersJson: updatedMembersJson,
        },
      });
      revalidatePath("/");
      revalidatePath("/rooms");
      revalidatePath("/families");
      return NextResponse.json(updatedFamily);
    }

    // Only allow room assignment for Confirmed families
    if (family.status !== "Confirmed") {
      return NextResponse.json({ 
        error: `Cannot assign room to ${family.name}. Registration status is "${family.status}". Room assignments are restricted to Confirmed families.` 
      }, { status: 400 });
    }

    // Check target room remaining capacity
    const targetRoom = await prisma.room.findUnique({
      where: { id: roomId },
      include: { families: true },
    });
    if (!targetRoom) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    // Sum members of existing families in target room (excluding family being assigned if re-assigning)
    const existingOccupants = targetRoom.families
      .filter(f => f.id !== familyId)
      .reduce((sum, f) => sum + f.adults + f.children + (f.nonPayingChildren || 0), 0);

    const familySize = family.adults + family.children + (family.nonPayingChildren || 0);

    if (existingOccupants + familySize > targetRoom.capacity) {
      return NextResponse.json({ 
        error: `Cannot assign ${family.name} (${familySize} members). Room ${targetRoom.number} has only ${Math.max(0, targetRoom.capacity - existingOccupants)} space(s) available (Capacity ${targetRoom.capacity}).` 
      }, { status: 400 });
    }

    // Update members if present to point to new room
    let updatedMembersJson = family.membersJson;
    if (members.length > 0) {
      const updatedMembers = members.map(m => ({
        ...m,
        roomId: targetRoom.id,
        roomName: targetRoom.number,
      }));
      updatedMembersJson = serializeMembers(updatedMembers);
    }

    // Assign family to target room
    const updatedFamily = await prisma.family.update({
      where: { id: familyId },
      data: {
        roomId,
        membersJson: updatedMembersJson,
      },
    });

    revalidatePath("/");
    revalidatePath("/rooms");
    revalidatePath("/families");

    return NextResponse.json(updatedFamily);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to assign room" }, { status: 500 });
  }
}
