import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '../../database/schema.sql');

const photo = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=80`;

const roomTypes = [
  {
    slug: 'standard',
    name: 'Standard',
    tagline: 'A calm room for two, with a proper desk and blackout linen.',
    description: 'Twenty-eight square metres on the garden side. A king bed, a rainfall shower, and enough quiet to work or sleep.',
    base_occupancy: 2, max_occupancy: 2, max_adults: 2, max_children: 1,
    bed_config: 'King bed', size_sqm: 28, base_rate: 4500, extra_adult_rate: 0, extra_child_rate: 600,
    amenities: ['King bed', 'Rain shower', 'Work desk', 'Blackout linen', 'Tea & coffee', 'Wifi'],
    photos: [photo('photo-1631049307264-da0ec9d70304'), photo('photo-1618773928121-c32242e63f39')],
  },
  {
    slug: 'deluxe',
    name: 'Deluxe',
    tagline: 'A wider room, a city view, and space to stay in for the afternoon.',
    description: 'Thirty-six square metres looking toward Bole. A seating corner, a deeper bath, and evening light across the bed.',
    base_occupancy: 2, max_occupancy: 3, max_adults: 3, max_children: 1,
    bed_config: 'King bed or twin', size_sqm: 36, base_rate: 7200, extra_adult_rate: 1200, extra_child_rate: 700,
    amenities: ['City view', 'Seating corner', 'King or twin', 'Soaking tub', 'Nespresso', 'Wifi'],
    photos: [photo('photo-1611892440504-42a792e24d32'), photo('photo-1590490360182-c33d57733427')],
  },
  {
    slug: 'family',
    name: 'Family',
    tagline: 'Two rooms that connect, so everyone can close a door.',
    description: 'A king room and a twin room with a shared sitting space. Built for parents who still want a conversation after nine.',
    base_occupancy: 3, max_occupancy: 5, max_adults: 3, max_children: 3,
    bed_config: 'King + twins', size_sqm: 52, base_rate: 9800, extra_adult_rate: 1000, extra_child_rate: 500,
    amenities: ['Connecting rooms', 'Two bathrooms', 'Sitting space', 'Blackout linen', 'Mini fridge', 'Wifi'],
    photos: [photo('photo-1566665797739-1674de7a421a'), photo('photo-1595576508898-0ad5c879a061')],
  },
  {
    slug: 'suite',
    name: 'Suite',
    tagline: 'A separate lounge, a long bath, and the quiet of the fifth floor.',
    description: 'Forty-eight square metres with a door between the lounge and the bedroom. The suite is where longer stays settle.',
    base_occupancy: 2, max_occupancy: 3, max_adults: 3, max_children: 2,
    bed_config: 'King bed', size_sqm: 48, base_rate: 14500, extra_adult_rate: 1800, extra_child_rate: 800,
    amenities: ['Separate lounge', 'Soaking tub', 'City view', 'Evening turndown', 'Nespresso', 'Wifi'],
    photos: [photo('photo-1582719478250-c89cae4dc85b'), photo('photo-1578683010236-d716f9a3f461')],
  },
  {
    slug: 'palace',
    name: 'Palace Suite',
    tagline: 'The signature room. A dining table, a dressing room, and the whole city.',
    description: 'Seventy-two square metres on the top floor. A table for four, a dressing room, and a bath that faces the skyline.',
    base_occupancy: 2, max_occupancy: 4, max_adults: 3, max_children: 2,
    bed_config: 'King bed', size_sqm: 72, base_rate: 22000, extra_adult_rate: 2500, extra_child_rate: 1000,
    amenities: ['Dining table', 'Dressing room', 'Panorama', 'Butler on call', 'Bar cabinet', 'Wifi'],
    photos: [photo('photo-1591088398332-8a7791972843'), photo('photo-1560448204-e02f11c3d0e2')],
  },
  {
    slug: 'residence',
    name: 'Residence',
    tagline: 'A one-bedroom residence for a week that turns into a month.',
    description: 'A kitchenette, a laundry cupboard, and a living room that does not feel like a hotel corridor. Minimum stays apply in high season.',
    base_occupancy: 2, max_occupancy: 4, max_adults: 3, max_children: 2,
    bed_config: 'King bed + sofa bed', size_sqm: 64, base_rate: 18500, extra_adult_rate: 1500, extra_child_rate: 800,
    amenities: ['Kitchenette', 'Washer', 'Living room', 'Weekly housekeeping', 'Work table', 'Wifi'],
    photos: [photo('photo-1502672260266-1c1ef2d93688'), photo('photo-1560185007-cde436f6a4d0')],
  },
];

const rooms = [
  ...[201, 202, 203, 204, 205, 206, 207, 208].map((n) => ({ type: 'standard', number: String(n), floor: 2, view: n % 2 ? 'Garden' : 'Courtyard' })),
  ...[301, 302, 303, 304, 305, 306].map((n) => ({ type: 'deluxe', number: String(n), floor: 3, view: 'City' })),
  ...[401, 402, 403, 404].map((n) => ({ type: 'family', number: String(n), floor: 4, view: 'Garden' })),
  ...[501, 502, 503].map((n) => ({ type: 'suite', number: String(n), floor: 5, view: 'City' })),
  { type: 'palace', number: '601', floor: 6, view: 'Panorama' },
  { type: 'residence', number: '602', floor: 6, view: 'City' },
];

async function main() {
  const admin = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await admin.query(schema);
  await admin.end();
  console.log('Schema ready.');

  const { default: pool } = await import('./config/database.js');
  const { addDays, todayISO } = await import('./lib/dates.js');
  const { createReservation, checkIn, addPayment, addCharge, cancelReservation } = await import('./lib/booking.js');

  const password = await bcrypt.hash('Palace@2026', 10);
  const staff = [
    ['Meron Bekele', 'owner@fidelpalace.com', 'owner'],
    ['Samuel Tadesse', 'manager@fidelpalace.com', 'manager'],
    ['Helen Girma', 'desk@fidelpalace.com', 'front_desk'],
    ['Dawit Alemu', 'house@fidelpalace.com', 'housekeeping'],
  ];
  for (const [name, email, role] of staff) {
    await pool.query('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)', [name, email, password, role]);
  }

  const typeIds = {};
  for (const [index, type] of roomTypes.entries()) {
    const [result] = await pool.query(
      `INSERT INTO room_types
        (slug, name, tagline, description, base_occupancy, max_occupancy, max_adults, max_children, bed_config, size_sqm,
         base_rate, extra_adult_rate, extra_child_rate, amenities_json, photos_json, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        type.slug, type.name, type.tagline, type.description, type.base_occupancy, type.max_occupancy, type.max_adults,
        type.max_children, type.bed_config, type.size_sqm, type.base_rate, type.extra_adult_rate, type.extra_child_rate,
        JSON.stringify(type.amenities), JSON.stringify(type.photos), index + 1,
      ]
    );
    typeIds[type.slug] = result.insertId;
  }

  for (const room of rooms) {
    const accessible = room.number === '201' ? 1 : 0;
    await pool.query(
      `INSERT INTO rooms (room_type_id, room_number, floor, status, view_type, is_accessible)
       VALUES (?, ?, ?, 'inspected', ?, ?)`,
      [typeIds[room.type], room.number, room.floor, room.view, accessible]
    );
  }

  await pool.query(
    `INSERT INTO rate_plans (room_type_id, name, start_date, end_date, price, min_stay)
     VALUES (?,?,?,?,?,?), (?,?,?,?,?,?), (?,?,?,?,?,?), (?,?,?,?,?,?)`,
    [
      typeIds.standard, 'Timket & New Year', '2026-12-20', '2027-01-10', 6200, 2,
      typeIds.deluxe, 'Timket & New Year', '2026-12-20', '2027-01-10', 9800, 2,
      typeIds.suite, 'Timket & New Year', '2026-12-20', '2027-01-10', 18500, 2,
      typeIds.palace, 'Timket & New Year', '2026-12-20', '2027-01-10', 28000, 2,
    ]
  );

  await pool.query(
    `INSERT INTO promotions (code, description, type, value, valid_from, valid_to, usage_limit)
     VALUES (?,?,?,?,?,?,?), (?,?,?,?,?,?,?), (?,?,?,?,?,?,?)`,
    [
      'WELCOME10', 'Ten percent off a first stay booked on the website.', 'percent', 10, '2026-01-01', '2026-12-31', 200,
      'STAY3', 'Eight percent off stays of three nights or more. Ask the desk to apply it.', 'percent', 8, '2026-01-01', '2027-06-30', 100,
      'HONEYMOON', 'A fixed ETB 2,000 courtesy on suite bookings.', 'fixed', 2000, '2026-01-01', '2027-06-30', 40,
    ]
  );

  const settings = {
    hotel_name: 'Fidel Palace',
    tagline: 'Beyond borders. Beyond luxury.',
    address: 'Cameroon Street, Bole',
    city: 'Addis Ababa',
    country: 'Ethiopia',
    phone: '+251 11 667 2400',
    email: 'stay@fidelpalace.com',
    tin: '0019876543',
    description: 'A quiet grand hotel in Bole, made for unhurried stays in Addis Ababa.',
    check_in_time: '14:00',
    check_out_time: '12:00',
    currency: 'ETB',
    vat_rate: '15',
    service_charge_rate: '10',
    weekend_percent: '15',
    cancel_hours: '48',
    cancellation_policy: 'Cancel free of charge up to 48 hours before arrival. Later cancellations and no-shows are charged one night.',
    about: 'Fidel Palace is an independent hotel on Cameroon Street. Rooms are calm, the kitchen cooks from the market, and the front desk still answers the phone.',
  };
  for (const [key, value] of Object.entries(settings)) {
    await pool.query('INSERT INTO settings (skey, svalue) VALUES (?, ?)', [key, value]);
  }

  const [[desk]] = await pool.query(`SELECT id FROM users WHERE email = 'desk@fidelpalace.com'`);
  const today = todayISO();

  const inHouse = await createReservation({
    check_in: addDays(today, -1),
    check_out: addDays(today, 2),
    adults: 2,
    children: 0,
    rooms: [{ room_type_id: typeIds.suite, quantity: 1 }],
    source: 'phone',
    payment_preference: 'pay_at_hotel',
    special_requests: 'High floor. Late dinner on arrival night.',
    guest: {
      first_name: 'Jonas', last_name: 'Bekele', email: 'jonas.bekele@example.com', phone: '+251 91 220 1188',
      nationality: 'Ethiopian', id_type: 'Passport', id_number: 'EP448211',
    },
  }, { userId: desk.id });
  await checkIn(inHouse.id, { userId: desk.id });
  await addCharge(inHouse.id, { description: 'Minibar — water and wine', amount: 680, quantity: 1, item_type: 'minibar' }, desk.id);
  await addPayment(inHouse.id, { amount: 10000, method: 'card', reference: 'POS-19442', note: 'Deposit on arrival' }, desk.id);
  await pool.query('UPDATE guests SET is_vip = 1, notes = ? WHERE email = ?', ['Prefers a quiet room and Ethiopian coffee at 7.', 'jonas.bekele@example.com']);

  const departing = await createReservation({
    check_in: addDays(today, -2),
    check_out: today,
    adults: 1,
    children: 0,
    rooms: [{ room_type_id: typeIds.standard, quantity: 1 }],
    source: 'walk_in',
    payment_preference: 'pay_at_hotel',
    guest: {
      first_name: 'Hana', last_name: 'Tadesse', email: 'hana.tadesse@example.com', phone: '+251 91 555 0144',
      nationality: 'Ethiopian', id_type: 'National ID', id_number: 'AA-229184',
    },
  }, { userId: desk.id });
  await checkIn(departing.id, { userId: desk.id });
  await addCharge(departing.id, { description: 'Kaffa restaurant — dinner', amount: 1450, quantity: 1, item_type: 'restaurant' }, desk.id);

  await createReservation({
    check_in: today,
    check_out: addDays(today, 2),
    adults: 2,
    children: 1,
    rooms: [{ room_type_id: typeIds.deluxe, quantity: 1 }],
    source: 'website',
    payment_preference: 'pay_at_hotel',
    special_requests: 'Extra bed for a child, if the room allows.',
    guest: {
      first_name: 'Sara', last_name: 'Mekonnen', email: 'sara.mekonnen@example.com', phone: '+251 92 333 6701',
      nationality: 'Ethiopian',
    },
  }, { userId: null });

  await createReservation({
    check_in: addDays(today, 5),
    check_out: addDays(today, 8),
    adults: 2,
    children: 0,
    rooms: [{ room_type_id: typeIds.standard, quantity: 1 }],
    source: 'website',
    payment_preference: 'pay_now',
    promo_code: 'WELCOME10',
    special_requests: 'Arriving on Ethiopian Airlines after 21:00.',
    guest: {
      first_name: 'Liya', last_name: 'Assefa', email: 'liya.assefa@example.com', phone: '+44 7700 900218',
      nationality: 'British',
    },
  });

  await createReservation({
    check_in: addDays(today, 3),
    check_out: addDays(today, 6),
    adults: 2,
    children: 2,
    rooms: [{ room_type_id: typeIds.family, quantity: 1 }],
    source: 'website',
    payment_preference: 'request',
    status: 'pending',
    special_requests: 'Please call before confirming. Travelling with two children.',
    guest: {
      first_name: 'Omar', last_name: 'Hassan', email: 'omar.hassan@example.com', phone: '+251 91 808 4410',
      nationality: 'Djiboutian', company_name: 'Red Sea Trading',
    },
  });

  const cancelled = await createReservation({
    check_in: addDays(today, 9),
    check_out: addDays(today, 11),
    adults: 2,
    children: 0,
    rooms: [{ room_type_id: typeIds.deluxe, quantity: 1 }],
    source: 'phone',
    payment_preference: 'pay_at_hotel',
    guest: {
      first_name: 'Marta', last_name: 'Girma', email: 'marta.girma@example.com', phone: '+251 93 100 2288',
      nationality: 'Ethiopian',
    },
  }, { userId: desk.id });
  await cancelReservation(cancelled.id, { userId: desk.id, reason: 'Guest changed travel dates.' });

  await pool.query(
    `INSERT INTO guests (first_name, last_name, email, phone, nationality, is_blacklisted, blacklist_reason)
     VALUES ('Kebede', 'Worku', 'kebede.worku@example.com', '+251 91 000 0001', 'Ethiopian', 1, 'Unpaid city-ledger invoice from March.')`
  );

  await pool.query(`UPDATE rooms SET status = 'dirty' WHERE room_number IN ('202','203') AND status <> 'occupied'`);
  await pool.query(
    `UPDATE rooms SET status = 'maintenance', ooo_reason = 'Bathroom tap replacement', ooo_until = ? WHERE room_number = '208'`,
    [addDays(today, 2)]
  );
  await pool.query(
    `INSERT INTO messages (name, email, phone, topic, body) VALUES (?,?,?,?,?)`,
    ['Selam Tesfaye', 'selam.tesfaye@example.com', '+251 91 444 9090', 'Celebration', 'We would like the Palace Suite next month for an anniversary. Is the dining table available for a private dinner?']
  );

  console.log('Seed complete.');
  console.log('Staff password for every account: Palace@2026');
  console.log('owner@fidelpalace.com  manager@fidelpalace.com  desk@fidelpalace.com  house@fidelpalace.com');
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
