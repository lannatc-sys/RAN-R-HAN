/**
 * Service Area Map UI Scaffold — Types Contract
 *
 * Designed to align with the PostGIS/GeoJSON database contract:
 * - shops.service_area_polygon geography(Polygon, 4326)
 * - shops.rider_work_area_polygon geography(Polygon, 4326)
 * - parse_area_polygon(p_geojson jsonb) -> geography
 * - is_point_in_shop_area(polygon, lng, lat, radius, shop_lng, shop_lat)
 *
 * NOTE: UI-only types. No Supabase, DB models, or network calls are imported.
 */

/**
 * Type of service area boundary.
 * - 'customer': Delivery ordering boundary for customers
 * - 'rider': Operational service boundary for riders
 */
export type AreaKind = 'customer' | 'rider';

/**
 * Coordinate tuple strictly ordered as [longitude, latitude]
 * in compliance with GeoJSON RFC 7946 and PostGIS WGS84 (EPSG:4326).
 *
 * index 0: Longitude (X axis, e.g. 97.9680)
 * index 1: Latitude  (Y axis, e.g. 19.3020)
 */
export type LngLat = [longitude: number, latitude: number];

/**
 * Current drawing/editing state of a polygon draft.
 * - 'empty': No coordinates added yet
 * - 'drawing': Polygon is open, points are being added
 * - 'closed': Ring is closed (first point equals last point), ready for validation
 */
export type DraftStatus = 'empty' | 'drawing' | 'closed';

/**
 * GeoJSON RFC 7946 Polygon geometry representation.
 * Coordinates is an array of linear rings (first ring is exterior boundary).
 */
export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: LngLat[][];
}

/**
 * In-memory representation of an editable polygon draft.
 * Contains sufficient state to serialize into a valid GeoJSON Polygon.
 */
export interface PolygonDraft {
  id: string;
  kind: AreaKind;
  /**
   * List of vertices ordered as [lng, lat].
   * When status is 'closed', coordinates[0] === coordinates[coordinates.length - 1].
   */
  coordinates: LngLat[];
  status: DraftStatus;
  /**
   * Radius in meters currently used as fallback on production.
   * When this polygon is closed and enabled, it takes precedence over this radius.
   */
  fallbackRadiusMeters: number;
  /** Label describing the target entity */
  label: string;
  /** ISO timestamp of last modification in UI */
  updatedAt?: string;
}

/**
 * Checks if a coordinate sequence forms a closed linear ring:
 * 1. Has at least 4 positions (3 unique vertices + 1 closing vertex)
 * 2. The first coordinate equals the last coordinate [lng, lat]
 */
export function isClosedRing(coordinates: LngLat[]): boolean {
  if (coordinates.length < 4) return false;
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  return (
    Math.abs(first[0] - last[0]) < 1e-7 &&
    Math.abs(first[1] - last[1]) < 1e-7
  );
}

/**
 * Signed area of a ring via the shoelace formula.
 * Negative is counter-clockwise, positive is clockwise, in [lng, lat] order.
 */
function signedRingArea(coordinates: LngLat[]): number {
  let sum = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = coordinates[i];
    const b = coordinates[i + 1];
    sum += (b[0] - a[0]) * (b[1] + a[1]);
  }
  return sum;
}

/**
 * Forces an exterior ring counter-clockwise, as RFC 7946 specifies.
 *
 * Correction to an earlier comment here: this does NOT prevent an inverted
 * service area. Tested against this project's PostGIS 3.3.7 on 2026-09-14,
 * ST_Covers returns the same answers for a clockwise ring as a
 * counter-clockwise one, and ST_Area reports the small area either way, so a
 * ring drawn clockwise is not rejected and does not select the wrong side.
 *
 * It is kept because RFC 7946 says exterior rings wind counter-clockwise, and
 * anything else consuming this GeoJSON — another library, an export, a tool
 * that is stricter than PostGIS — is entitled to rely on that.
 */
export function toCounterClockwise(coordinates: LngLat[]): LngLat[] {
  return signedRingArea(coordinates) > 0
    ? [...coordinates].reverse()
    : coordinates;
}

/**
 * Emits a valid GeoJSON Polygon from a closed draft, or null if not closed.
 * The exterior ring is normalised counter-clockwise.
 */
export function polygonDraftToGeoJson(draft: PolygonDraft): GeoJsonPolygon | null {
  if (draft.status !== 'closed' || !isClosedRing(draft.coordinates)) {
    return null;
  }
  return {
    type: 'Polygon',
    coordinates: [toCounterClockwise(draft.coordinates)],
  };
}

/**
 * Rebuilds an editable draft from a stored GeoJSON Polygon.
 *
 * The inverse of polygonDraftToGeoJson, so a shop's saved area comes back as
 * something the editor can show and change rather than starting from the demo
 * fixture every time the page loads.
 *
 * Returns null for anything that is not a usable exterior ring. Holes are
 * dropped on purpose: the editor cannot draw them, and silently keeping a hole
 * that the next save would discard is worse than showing only what can be
 * edited.
 */
export function geoJsonToPolygonDraft(
  geojson: unknown,
  kind: AreaKind,
  base: Pick<PolygonDraft, 'id' | 'fallbackRadiusMeters' | 'label'>
): PolygonDraft | null {
  const candidate = geojson as GeoJsonPolygon | null;
  if (!candidate || candidate.type !== 'Polygon') return null;

  const ring = candidate.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length < 4) return null;

  const coordinates: LngLat[] = [];
  for (const point of ring) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const [lng, lat] = point;
    if (typeof lng !== 'number' || typeof lat !== 'number') return null;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    coordinates.push([lng, lat]);
  }

  if (!isClosedRing(coordinates)) return null;

  return {
    ...base,
    kind,
    coordinates,
    status: 'closed',
  };
}

/**
 * Props any map canvas must accept, whether it is the offline placeholder or a
 * real tile-backed map. Declaring it here keeps the scaffold free of map
 * libraries while letting a caller inject one.
 */
export interface MapCanvasRenderProps {
  draft: PolygonDraft;
  activeKind: AreaKind;
  onAddPoint?: (kind: AreaKind, point: LngLat) => void;
  disabled?: boolean;
}

/**
 * State for the Service Area Map Editor Shell
 */
export interface ServiceAreaMapEditorState {
  activeAreaKind: AreaKind;
  customerDraft: PolygonDraft;
  riderDraft: PolygonDraft;
  readOnly?: boolean;
}

/**
 * Action callbacks for editor user interactions
 */
export interface ServiceAreaMapEditorActions {
  onSelectAreaKind: (kind: AreaKind) => void;
  onAddPoint?: (kind: AreaKind, point: LngLat) => void;
  onUndoPoint?: (kind: AreaKind) => void;
  onResetDraft?: (kind: AreaKind) => void;
  onCloseRing?: (kind: AreaKind) => void;
  onSavePlaceholder?: (kind: AreaKind) => void;
}
