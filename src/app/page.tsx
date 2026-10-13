import Link from "next/link";
import prisma from "@/lib/prisma";
import { getActiveEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const event = await getActiveEvent();

  const families = await prisma.family.findMany({
    where: { eventId: event.id },
  });

  const registrations = await prisma.registration.findMany({
    where: { family: { eventId: event.id } },
    include: { family: true },
  });

  const payments = await prisma.payment.findMany({
    where: { family: { eventId: event.id } },
  });

  const rooms = await prisma.room.findMany({
    where: { building: { eventId: event.id } },
    include: { families: true },
  });

  const schedule = await prisma.schedule.findMany({
    where: { eventId: event.id },
    take: 5,
  });

  const notifications = await prisma.notification.findMany({
    where: { eventId: event.id },
  });

  // Compute metrics
  const totalParticipants = families.reduce((sum, f) => sum + f.adults + f.children + (f.nonPayingChildren || 0), 0);
  const confirmedParticipants = families.filter(f => f.status === "Confirmed").reduce((sum, f) => sum + f.adults + f.children + (f.nonPayingChildren || 0), 0);
  
  const attentionReg = registrations.filter(r => r.completeness < 100 || !r.waiver || r.status === "Waitlist").length;
  const avgCompleteness = registrations.length ? Math.round(registrations.reduce((s, r) => s + r.completeness, 0) / registrations.length) : 0;
  
  const pricePerAdult = event?.pricePerAdult ?? 120;
  const pricePerChild = event?.pricePerChild ?? 60;
  const totalExpected = families.reduce((s, f) => s + (f.adults * pricePerAdult) + (f.children * pricePerChild), 0);
  
  const paid = payments.filter(p => p.status === "Paid").reduce((s, p) => s + p.amount, 0);
  const outstanding = Math.max(0, totalExpected - paid);

  const totalCapacity = rooms.reduce((s, r) => s + r.capacity, 0);
  const totalOccupants = rooms.reduce((s, r) => s + r.families.reduce((fs, f) => fs + f.adults + f.children + (f.nonPayingChildren || 0), 0), 0);
  const utilization = totalCapacity ? Math.round((totalOccupants / totalCapacity) * 100) : 0;

  // Funnel
  const started = registrations.length;
  const complete = registrations.filter(r => r.completeness === 100).length;
  const confirmed = registrations.filter(r => r.status === "Confirmed").length;

  return (
    <>
      <div className="top">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">{event?.name} · {event?.date} · {event?.location}</div>
        </div>
        <div className="actions">
          <Link href="/registration/new" className="btn primary">
            + New Registration
          </Link>
          <Link href="/communications" className="btn">Send Update</Link>
        </div>
      </div>

      <div className="grid cards4">
        <div className="card metric">
          <div className="label">Registered Participants</div>
          <div className="value">{totalParticipants}</div>
          <div className="delta green">{confirmedParticipants} confirmed</div>
        </div>
        <div className="card metric">
          <div className="label">Registration Completion</div>
          <div className="value">{avgCompleteness}%</div>
          <div className="delta orange">{attentionReg} records need attention</div>
        </div>
        <div className="card metric">
          <div className="label">Collected</div>
          <div className="value">${paid.toLocaleString()}</div>
          <div className="delta red">${outstanding.toLocaleString()} outstanding</div>
        </div>
        <div className="card metric">
          <div className="label">Room Utilization</div>
          <div className="value">{utilization}%</div>
          <div className="delta green">{totalCapacity - totalOccupants} open spaces</div>
        </div>
      </div>

      <div className="section quick">
        <Link href="/registration/new">
          <b>New registration</b>
          <span>Capture family + attendees</span>
        </Link>
        <Link href="/rooms">
          <b>Auto-assign rooms</b>
          <span>Resolve unassigned families</span>
        </Link>
        <Link href="/payments">
          <b>Record payment</b>
          <span>Card, check, ACH or cash</span>
        </Link>
        <Link href="/attendance">
          <b>Quick check-in</b>
          <span>Fast on-site attendance</span>
        </Link>
      </div>

      <div className="grid cards3 section">
        <div className="card panel">
          <div className="section-title">Needs Attention</div>
          {notifications.length > 0 ? notifications.map(n => (
            <div key={n.id} className="alert">
              <strong>{n.title}</strong>
              <span>{n.detail}</span>
              <Link href={`/${n.view}`} className="btn tiny" style={{ marginTop: "7px" }}>
                Resolve
              </Link>
            </div>
          )) : <div className="empty">No alert items requiring attention.</div>}
        </div>
        
        <div className="card panel">
          <div className="section-title">Registration Funnel</div>
          <div className="barlabel">
            <span>Started</span>
            <b>{started}</b>
          </div>
          <div className="progress">
            <i style={{ width: `${started ? 100 : 0}%` }}></i>
          </div>
          <div className="barlabel">
            <span>Complete</span>
            <b>{complete}</b>
          </div>
          <div className="progress">
            <i style={{ width: `${started ? (complete/started)*100 : 0}%` }}></i>
          </div>
          <div className="barlabel">
            <span>Confirmed</span>
            <b>{confirmed}</b>
          </div>
          <div className="progress">
            <i style={{ width: `${started ? (confirmed/started)*100 : 0}%` }}></i>
          </div>
        </div>
        
        <div className="card panel">
          <div className="section-title">Upcoming Schedule</div>
          {schedule.length > 0 ? schedule.map(s => (
            <div key={s.id} className="listitem">
              <span>
                <b>{s.title}</b><br/>
                <span className="small">{s.day} {s.start} · {s.location}</span>
              </span>
              <span className={`pill ${s.status === 'Ready' ? 'ready' : 'draft'}`}>{s.status}</span>
            </div>
          )) : <div className="empty">No schedule events created yet.</div>}
        </div>
      </div>
    </>
  );
}
