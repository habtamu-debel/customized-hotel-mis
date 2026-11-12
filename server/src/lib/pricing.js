import { HttpError, money } from './http.js';
import { asDate, eachNight, nightsBetween, weekday } from './dates.js';

function planFor(plans, typeId, date) {
  const matches = plans.filter((plan) => (
    Number(plan.room_type_id) === Number(typeId)
    && plan.is_active !== 0
    && date >= asDate(plan.start_date)
    && date <= asDate(plan.end_date)
  ));
  if (!matches.length) return null;
  matches.sort((a, b) => Number(b.id) - Number(a.id));
  return matches[0];
}

export function nightlyRate(type, plans, date, weekendPercent) {
  const plan = planFor(plans, type.id, date);
  if (plan) return money(plan.price);
  const base = Number(type.base_rate);
  const day = weekday(date);
  if (day === 0 || day === 6) return money(base * (1 + Number(weekendPercent || 0) / 100));
  return money(base);
}

export function assignGuests(items, adults, children) {
  const rooms = [];
  for (const item of items) {
    const qty = Number(item.quantity || 1);
    for (let i = 0; i < qty; i += 1) {
      rooms.push({ type: item.type, adults: 0, children: 0 });
    }
  }
  if (!rooms.length) throw new HttpError(400, 'Choose at least one room.');

  let leftAdults = Number(adults || 0);
  let leftChildren = Number(children || 0);
  if (leftAdults < 1) throw new HttpError(400, 'At least one adult is required.');

  for (const room of rooms) {
    if (leftAdults <= 0) break;
    room.adults += 1;
    leftAdults -= 1;
  }

  for (const room of rooms) {
    while (
      leftAdults > 0
      && room.adults < Number(room.type.max_adults)
      && room.adults + room.children < Number(room.type.max_occupancy)
    ) {
      room.adults += 1;
      leftAdults -= 1;
    }
  }

  for (const room of rooms) {
    while (
      leftChildren > 0
      && room.children < Number(room.type.max_children)
      && room.adults + room.children < Number(room.type.max_occupancy)
    ) {
      room.children += 1;
      leftChildren -= 1;
    }
  }

  if (leftAdults > 0 || leftChildren > 0) {
    throw new HttpError(400, 'Guest count exceeds the capacity of the selected rooms.');
  }
  if (rooms.some((room) => room.adults < 1)) {
    throw new HttpError(400, 'Each room needs at least one adult.');
  }
  return rooms;
}

export function quoteStay({ rooms, plans, checkIn, checkOut, promo, settings }) {
  const nights = nightsBetween(checkIn, checkOut);
  if (!Number.isFinite(nights) || nights < 1 || nights > 60) {
    throw new HttpError(400, 'Stay must be between 1 and 60 nights.');
  }
  const dates = eachNight(checkIn, nights);
  const weekendPercent = Number(settings.weekend_percent || 0);
  let minStay = 1;

  for (const room of rooms) {
    for (const date of dates) {
      const plan = planFor(plans, room.type.id, date);
      if (plan?.min_stay) minStay = Math.max(minStay, Number(plan.min_stay));
    }
  }
  if (nights < minStay) {
    throw new HttpError(400, `Minimum stay for these dates is ${minStay} nights.`);
  }

  const lines = rooms.map((room) => {
    const nightly = dates.map((date) => ({
      date,
      rate: nightlyRate(room.type, plans, date, weekendPercent),
    }));
    const roomSum = money(nightly.reduce((sum, night) => sum + night.rate, 0));
    const extraAdults = Math.max(0, room.adults - Number(room.type.base_occupancy));
    const extraAdult = money(extraAdults * Number(room.type.extra_adult_rate) * nights);
    const extraChild = money(room.children * Number(room.type.extra_child_rate) * nights);
    return {
      room_type_id: room.type.id,
      name: room.type.name,
      slug: room.type.slug,
      adults: room.adults,
      children: room.children,
      nights,
      nightly,
      rate_per_night: money(roomSum / nights),
      extra_adult: extraAdult,
      extra_child: extraChild,
      each_total: money(roomSum + extraAdult + extraChild),
    };
  });

  const subtotal = money(lines.reduce((sum, line) => sum + line.each_total, 0));
  let discount = 0;
  if (promo) {
    discount = promo.type === 'percent'
      ? money(subtotal * Number(promo.value) / 100)
      : money(Math.min(subtotal, Number(promo.value)));
  }
  const net = money(Math.max(0, subtotal - discount));
  const service = money(net * Number(settings.service_charge_rate || 0) / 100);
  const vat = money((net + service) * Number(settings.vat_rate || 0) / 100);
  return {
    nights,
    check_in: checkIn,
    check_out: checkOut,
    lines,
    subtotal,
    discount,
    service_charge: service,
    vat,
    total: money(net + service + vat),
    currency: settings.currency || 'ETB',
    promo: promo ? { code: promo.code, description: promo.description, type: promo.type, value: Number(promo.value) } : null,
    vat_rate: Number(settings.vat_rate || 0),
    service_charge_rate: Number(settings.service_charge_rate || 0),
  };
}
