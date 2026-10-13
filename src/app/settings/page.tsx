import { getActiveEvent } from "@/lib/events";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const event = await getActiveEvent();
  return <SettingsClient event={event} />;
}
