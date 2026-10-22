export type Toilet = {
  id: string;
  name: string;
  address: string;
  openingHours: string;
  lat: number;
  lng: number;
};

export type NearbyToilet = Toilet & { distanceM: number };

export type Coordinates = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

/** 두 좌표 사이의 대원 거리(미터). */
export function distanceMeters(a: Coordinates, b: Coordinates) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export const DEFAULT_LIMIT = 20;

/** 가장 가까운 데이터가 이보다 멀면, 그 위치는 데이터가 준비되지 않은 지역으로 본다. */
export const COVERAGE_RANGE_M = 10_000;

export function isCovered(toilets: readonly Toilet[], origin: Coordinates) {
  return toilets.some((toilet) => distanceMeters(origin, toilet) <= COVERAGE_RANGE_M);
}

/** 반경(미터) 안의 화장실을 가까운 순으로, 최대 `limit`곳 돌려준다. */
export function findNearby(
  toilets: readonly Toilet[],
  origin: Coordinates,
  radiusM: number,
  limit = DEFAULT_LIMIT
): NearbyToilet[] {
  return toilets
    .map((toilet) => ({ ...toilet, distanceM: distanceMeters(origin, toilet) }))
    .filter((toilet) => toilet.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}
