export interface GroupMember {
  id: string;
  name: string;
  role: "Adult" | "Youth" | "Child" | "Infant" | "Leader";
  age?: string | number;
  gender?: string;
  roomId?: string | null;
  roomName?: string | null;
  notes?: string;
}

export function parseMembers(membersJson: string | null | undefined): GroupMember[] {
  if (!membersJson) return [];
  try {
    const parsed = JSON.parse(membersJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function serializeMembers(members: GroupMember[]): string {
  if (!members || !Array.isArray(members)) return "[]";
  return JSON.stringify(members);
}

export function computeMemberCounts(members: GroupMember[], childAgeThreshold?: number) {
  let adults = 0;
  let children = 0;
  let nonPayingChildren = 0;

  for (const m of members) {
    if (m.role === "Adult" || m.role === "Leader") {
      adults++;
    } else if (m.role === "Infant") {
      nonPayingChildren++;
    } else {
      // Youth or Child
      children++;
    }
  }

  return { adults, children, nonPayingChildren };
}
