import { parseJson } from './http.js';

export function presentType(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    base_occupancy: Number(row.base_occupancy),
    max_occupancy: Number(row.max_occupancy),
    max_adults: Number(row.max_adults),
    max_children: Number(row.max_children),
    bed_config: row.bed_config,
    size_sqm: Number(row.size_sqm),
    base_rate: Number(row.base_rate),
    extra_adult_rate: Number(row.extra_adult_rate),
    extra_child_rate: Number(row.extra_child_rate),
    amenities: parseJson(row.amenities_json, []),
    photos: parseJson(row.photos_json, []),
    sort_order: row.sort_order,
    is_active: row.is_active,
  };
}
