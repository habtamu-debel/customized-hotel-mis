export async function availabilityForTypes(db, { checkIn, checkOut, typeIds = null, ignoreReservationId = null }) {
  const scoped = Array.isArray(typeIds) && typeIds.length > 0;
  const [rows] = await db.query(
    `SELECT rt.id,
        (SELECT COUNT(*) FROM rooms r
          WHERE r.room_type_id = rt.id AND r.is_active = 1) AS total_rooms,
        (SELECT COUNT(*) FROM rooms r
          WHERE r.room_type_id = rt.id AND r.is_active = 1
            AND r.status IN ('out_of_order', 'maintenance')) AS blocked,
        (SELECT COUNT(*) FROM reservation_rooms rr
          JOIN reservations res ON res.id = rr.reservation_id
          WHERE rr.room_type_id = rt.id
            AND res.status IN ('pending', 'confirmed', 'checked_in')
            AND res.check_in < ? AND res.check_out > ?
            AND (? IS NULL OR res.id <> ?)) AS sold
     FROM room_types rt
     WHERE rt.is_active = 1
       AND (? = 0 OR rt.id IN (?))`,
    [checkOut, checkIn, ignoreReservationId, ignoreReservationId, scoped ? 1 : 0, scoped ? typeIds : [0]]
  );

  const map = {};
  for (const row of rows) {
    const total = Number(row.total_rooms);
    const blocked = Number(row.blocked);
    const sold = Number(row.sold);
    map[row.id] = {
      total,
      blocked,
      sold,
      available: Math.max(0, total - blocked - sold),
    };
  }
  return map;
}
