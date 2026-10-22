import type { Coordinates } from "./nearby";

export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)}m`;

  return `${(meters / 1000).toFixed(1)}km`;
}

/** 외부 지도 앱(카카오맵)에서 현재 위치로부터 이 장소까지의 길찾기를 여는 주소. */
export function directionsUrl({
  name,
  lat,
  lng,
}: Coordinates & { name: string }) {
  // 쉼표는 이름과 좌표를 가르는 구분자라 이름 안에서는 공백으로 바꾼다.
  const label = encodeURIComponent(name.replaceAll(",", " "));

  return `https://map.kakao.com/link/to/${label},${lat},${lng}`;
}
