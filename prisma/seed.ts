import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clear existing records to ensure clean seed
  await prisma.notification.deleteMany();
  await prisma.volunteer.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.room.deleteMany();
  await prisma.building.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.family.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  // 1. Create Default Admin User
  const defaultAdmin = await prisma.user.create({
    data: {
      id: "user-admin-1",
      name: "Admin User",
      email: "admin@retreatflow.com",
      password: "password",
      role: "ADMIN",
    },
  });

  // 2. Create Exercise Event for Default Admin
  const seedEvent = await prisma.event.create({
    data: {
      id: "seed-event-1",
      userId: defaultAdmin.id,
      name: "2026 Family Summer Retreat",
      date: "July 24–26, 2026",
      location: "Camp Hope",
      capacity: 90,
      registrationDeadline: "July 12, 2026",
    },
  });

  // 3. Families
  const familiesData = [
    { id: "f1", eventId: seedEvent.id, name: "Abebe Family", leader: "Dawit Abebe", email: "abebe@example.com", phone: "555-0101", adults: 2, children: 2, roomPref: "Near chapel", access: "None", status: "Confirmed", notes: "Vegetarian meals" },
    { id: "f2", eventId: seedEvent.id, name: "Tekle Family", leader: "Marta Tekle", email: "tekle@example.com", phone: "555-0102", adults: 2, children: 4, roomPref: "Ground floor", access: "Limited stairs", status: "Confirmed", notes: "Ground-floor requested" },
    { id: "f3", eventId: seedEvent.id, name: "Getachew Family", leader: "Daniel Getachew", email: "getachew@example.com", phone: "555-0103", adults: 2, children: 1, roomPref: "Any", access: "None", status: "Pending", notes: "Waiver pending" },
    { id: "f4", eventId: seedEvent.id, name: "Michael Family", leader: "John Michael", email: "michael@example.com", phone: "555-0104", adults: 2, children: 0, roomPref: "Any", access: "None", status: "Confirmed", notes: "" },
    { id: "f5", eventId: seedEvent.id, name: "Samuel Family", leader: "Samuel Bekele", email: "samuel@example.com", phone: "555-0105", adults: 2, children: 1, roomPref: "Near dining", access: "None", status: "Confirmed", notes: "Late arrival" },
    { id: "f6", eventId: seedEvent.id, name: "Mekonnen Family", leader: "Ruth Mekonnen", email: "mekonnen@example.com", phone: "555-0106", adults: 2, children: 2, roomPref: "Full room", access: "None", status: "Waitlist", notes: "Full room preferred" },
    { id: "f7", eventId: seedEvent.id, name: "Youth Group", leader: "Pastor Daniel", email: "youth@example.com", phone: "555-0107", adults: 1, children: 4, roomPref: "Near leaders", access: "None", status: "Confirmed", notes: "Two waivers missing" }
  ];

  for (const fam of familiesData) {
    await prisma.family.create({ data: fam });
  }

  // Registrations
  const registrationsData = [
    { familyId: "f1", submitted: "Jun 18", status: "Confirmed", source: "Website", completeness: 100, waiver: true, balance: 0, note: "Vegetarian meals" },
    { familyId: "f2", submitted: "Jun 20", status: "Confirmed", source: "Church Link", completeness: 100, waiver: true, balance: 0, note: "Needs ground-floor room" },
    { familyId: "f3", submitted: "Jun 22", status: "Pending", source: "QR Code", completeness: 82, waiver: false, balance: 120, note: "Waiting for waiver" },
    { familyId: "f4", submitted: "Jun 25", status: "Confirmed", source: "Church Link", completeness: 100, waiver: true, balance: 0, note: "" },
    { familyId: "f5", submitted: "Jun 27", status: "Confirmed", source: "Website", completeness: 100, waiver: true, balance: 0, note: "Late arrival Friday" },
    { familyId: "f6", submitted: "Jun 29", status: "Waitlist", source: "QR Code", completeness: 76, waiver: false, balance: 240, note: "Requested full room" },
    { familyId: "f7", submitted: "Jul 1", status: "Confirmed", source: "Church Link", completeness: 92, waiver: false, balance: 60, note: "2 youth waivers missing" }
  ];

  for (const reg of registrationsData) {
    await prisma.registration.create({ data: reg });
  }

  // Buildings and Rooms
  const buildingsData = [
    { id: "b1", eventId: seedEvent.id, name: "Pine Building", rooms: [
      { number: "101", capacity: 4, accessible: false, familyId: "f1" },
      { number: "102", capacity: 4, accessible: true, familyId: "f3" },
      { number: "103", capacity: 2, accessible: false, familyId: null },
      { number: "104", capacity: 4, accessible: true, familyId: "f5" },
      { number: "105", capacity: 6, accessible: false, familyId: null },
      { number: "106", capacity: 4, accessible: false, familyId: "f7" }
    ]},
    { id: "b2", eventId: seedEvent.id, name: "Cedar Lodge", rooms: [
      { number: "201", capacity: 8, accessible: true, familyId: "f2" },
      { number: "202", capacity: 6, accessible: false, familyId: null },
      { number: "203", capacity: 4, accessible: false, familyId: null },
      { number: "204", capacity: 4, accessible: false, familyId: "f4" },
      { number: "205", capacity: 2, accessible: false, familyId: null }
    ]},
    { id: "b3", eventId: seedEvent.id, name: "Family Center", rooms: [
      { number: "301", capacity: 10, accessible: true, familyId: null },
      { number: "302", capacity: 8, accessible: false, familyId: null },
      { number: "303", capacity: 6, accessible: true, familyId: null },
      { number: "304", capacity: 4, accessible: false, familyId: null }
    ]},
    { id: "b4", eventId: seedEvent.id, name: "Guest House", rooms: [
      { number: "401", capacity: 2, accessible: false, familyId: null },
      { number: "402", capacity: 2, accessible: false, familyId: null },
      { number: "403", capacity: 3, accessible: false, familyId: null },
      { number: "404", capacity: 4, accessible: true, familyId: null }
    ]}
  ];

  for (const building of buildingsData) {
    const createdBuilding = await prisma.building.create({
      data: {
        id: building.id,
        eventId: building.eventId,
        name: building.name,
      }
    });

    for (const room of building.rooms) {
      const createdRoom = await prisma.room.create({
        data: {
          number: room.number,
          capacity: room.capacity,
          accessible: room.accessible,
          buildingId: createdBuilding.id,
        }
      });
      if (room.familyId) {
        await prisma.family.update({
          where: { id: room.familyId },
          data: { roomId: createdRoom.id }
        }).catch(() => {});
      }
    }
  }

  // Payments
  const paymentsData = [
    { familyId: "f1", amount: 480, status: "Paid", due: "Jun 19", method: "Card" },
    { familyId: "f2", amount: 720, status: "Paid", due: "Jun 21", method: "ACH" },
    { familyId: "f3", amount: 360, status: "Partial", due: "Jul 5", method: "Card" },
    { familyId: "f4", amount: 240, status: "Paid", due: "Jun 25", method: "Check" },
    { familyId: "f5", amount: 360, status: "Paid", due: "Jun 27", method: "Card" },
    { familyId: "f6", amount: 480, status: "Overdue", due: "Jun 30", method: "None" },
    { familyId: "f7", amount: 600, status: "Partial", due: "Jul 5", method: "Card" }
  ];

  for (const pay of paymentsData) {
    await prisma.payment.create({ data: pay });
  }

  // Attendance
  const attendanceData = [
    { familyId: "f1", checkin: "Present", worship: "Present", dinner: "Present" },
    { familyId: "f2", checkin: "Present", worship: "Present", dinner: "Present" },
    { familyId: "f3", checkin: "Present", worship: "Absent", dinner: "Present" },
    { familyId: "f4", checkin: "Present", worship: "Present", dinner: "Present" },
    { familyId: "f5", checkin: "Present", worship: "Present", dinner: "Present" },
    { familyId: "f6", checkin: "Pending", worship: "Pending", dinner: "Pending" },
    { familyId: "f7", checkin: "Present", worship: "Present", dinner: "Present" }
  ];

  for (const att of attendanceData) {
    await prisma.attendance.create({ data: att });
  }

  // Schedule
  const scheduleData = [
    { eventId: seedEvent.id, day: "Friday", start: "2:00 PM", end: "5:00 PM", title: "Registration & Check-in", location: "Welcome Center", team: "Registration", status: "Ready" },
    { eventId: seedEvent.id, day: "Friday", start: "5:30 PM", end: "6:30 PM", title: "Dinner", location: "Dining Hall", team: "Hospitality", status: "Ready" },
    { eventId: seedEvent.id, day: "Friday", start: "7:00 PM", end: "8:30 PM", title: "Opening Worship", location: "Main Chapel", team: "Worship", status: "Ready" },
    { eventId: seedEvent.id, day: "Saturday", start: "8:00 AM", end: "9:00 AM", title: "Breakfast", location: "Dining Hall", team: "Kitchen", status: "Ready" },
    { eventId: seedEvent.id, day: "Saturday", start: "10:00 AM", end: "11:30 AM", title: "Family Workshops", location: "Family Center", team: "Program", status: "Draft" },
    { eventId: seedEvent.id, day: "Saturday", start: "1:00 PM", end: "3:00 PM", title: "Outdoor Activities", location: "Camp Grounds", team: "Activities", status: "Ready" },
    { eventId: seedEvent.id, day: "Saturday", start: "6:00 PM", end: "7:30 PM", title: "Community Dinner", location: "Dining Hall", team: "Hospitality", status: "Ready" },
    { eventId: seedEvent.id, day: "Sunday", start: "9:30 AM", end: "11:00 AM", title: "Sunday Worship", location: "Main Chapel", team: "Worship", status: "Ready" },
    { eventId: seedEvent.id, day: "Sunday", start: "12:00 PM", end: "1:00 PM", title: "Lunch & Checkout", location: "Dining Hall", team: "All Teams", status: "Ready" }
  ];

  for (const sched of scheduleData) {
    await prisma.schedule.create({ data: sched });
  }

  // Volunteers
  const volunteersData = [
    { eventId: seedEvent.id, name: "Daniel Bekele", role: "Registration", shift: "Fri 2–5 PM", date: "Fri Jul 24", status: "Confirmed", skills: "Welcome desk" },
    { eventId: seedEvent.id, name: "Ruth Abebe", role: "Hospitality", shift: "Fri 4–8 PM", date: "Fri Jul 24", status: "Confirmed", skills: "Food service" },
    { eventId: seedEvent.id, name: "Marta Tekle", role: "Kitchen", shift: "Sat 7–11 AM", date: "Sat Jul 25", status: "Confirmed", skills: "Kitchen" },
    { eventId: seedEvent.id, name: "Samuel John", role: "Transportation", shift: "Fri 3–6 PM", date: "Fri Jul 24", status: "Pending", skills: "Van driver" },
    { eventId: seedEvent.id, name: "Helen Michael", role: "Children", shift: "Sat 9 AM–12 PM", date: "Sat Jul 25", status: "Confirmed", skills: "Children" },
    { eventId: seedEvent.id, name: "Dawit Getachew", role: "AV / Media", shift: "Fri–Sun", date: "All weekend", status: "Confirmed", skills: "Audio / video" },
    { eventId: seedEvent.id, name: "Mimi Tesfaye", role: "Hospitality", shift: "Sat 4–8 PM", date: "Sat Jul 25", status: "Confirmed", skills: "Welcome" },
    { eventId: seedEvent.id, name: "Rachel John", role: "Children", shift: "Sun 9 AM–12 PM", date: "Sun Jul 26", status: "Pending", skills: "Children" }
  ];

  for (const vol of volunteersData) {
    await prisma.volunteer.create({ data: vol });
  }

  // Notifications
  const notificationsData = [
    { eventId: seedEvent.id, type: "warning", title: "3 registration records need attention", detail: "Missing waivers or incomplete information", view: "registration" },
    { eventId: seedEvent.id, type: "danger", title: "$720 in balances need follow-up", detail: "1 overdue and 2 partial payments", view: "payments" },
    { eventId: seedEvent.id, type: "warning", title: "2 volunteer shifts need coverage", detail: "Transportation and Sunday children", view: "volunteers" },
    { eventId: seedEvent.id, type: "info", title: "1 waitlisted family", detail: "Mekonnen Family", view: "registration" }
  ];

  for (const notif of notificationsData) {
    await prisma.notification.create({ data: notif });
  }

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
