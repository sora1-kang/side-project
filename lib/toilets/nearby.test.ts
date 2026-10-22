import { describe, expect, test } from "vitest";

import { findNearby, isCovered, type Toilet } from "@/lib/toilets";

const origin = { lat: 37.5665, lng: 126.978 };

// 위도 1도는 약 111.2km이므로 0.001도는 약 111m다.
function toiletAt(id: string, dLat: number, dLng = 0): Toilet {
  return {
    id,
    name: `화장실 ${id}`,
    address: `주소 ${id}`,
    openingHours: "상시",
    lat: origin.lat + dLat,
    lng: origin.lng + dLng,
  };
}

describe("findNearby", () => {
  test("반경 안의 화장실만 가까운 순으로 거리와 함께 돌려준다", () => {
    const toilets = [
      toiletAt("far", 0.004),
      toiletAt("mid", 0.002),
      toiletAt("near", 0.001),
      toiletAt("out", 0.02),
    ];

    const result = findNearby(toilets, origin, 500);

    expect(result.map((t) => t.id)).toEqual(["near", "mid", "far"]);
    expect(result[0].distanceM).toBeGreaterThan(100);
    expect(result[0].distanceM).toBeLessThan(120);
  });

  test("반경 경계 밖은 제외한다", () => {
    const toilets = [toiletAt("a", 0.0008), toiletAt("b", 0.0011)];

    expect(findNearby(toilets, origin, 100).map((t) => t.id)).toEqual(["a"]);
  });

  test("기본으로 최대 20곳만 돌려주고, 상한을 바꿀 수 있다", () => {
    const toilets = Array.from({ length: 30 }, (_, i) =>
      toiletAt(String(i), 0.0001 * (i + 1))
    );

    expect(findNearby(toilets, origin, 5000)).toHaveLength(20);
    expect(findNearby(toilets, origin, 5000, 5)).toHaveLength(5);
  });

  test("반경 안에 없으면 빈 배열을 돌려준다", () => {
    expect(findNearby([toiletAt("x", 0.05)], origin, 500)).toEqual([]);
  });
});

describe("isCovered", () => {
  test("10km 안에 데이터가 있는 위치는 지원 지역으로 본다", () => {
    expect(isCovered([toiletAt("a", 0.08)], origin)).toBe(true);
  });

  test("가장 가까운 데이터가 10km보다 멀면 지원하지 않는 지역으로 본다", () => {
    expect(isCovered([toiletAt("a", 0.1)], origin)).toBe(false);
  });

  test("데이터가 하나도 없으면 지원하지 않는 지역이다", () => {
    expect(isCovered([], origin)).toBe(false);
  });
});
