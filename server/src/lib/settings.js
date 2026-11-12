import pool from '../config/database.js';

export const DEFAULTS = {
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

export async function getSettings(db = pool) {
  const [rows] = await db.query('SELECT skey, svalue FROM settings');
  const map = { ...DEFAULTS };
  for (const row of rows) map[row.skey] = row.svalue;
  return map;
}

export function publicSettings(settings) {
  const keys = [
    'hotel_name', 'tagline', 'address', 'city', 'country', 'phone', 'email', 'tin',
    'description', 'check_in_time', 'check_out_time', 'currency', 'vat_rate',
    'service_charge_rate', 'weekend_percent', 'cancel_hours', 'cancellation_policy', 'about',
  ];
  return Object.fromEntries(keys.map((key) => [key, settings[key]]));
}
