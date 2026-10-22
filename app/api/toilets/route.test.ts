import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { GET } from "@/app/api/toilets/route";

const dataset = {
  baseDate: "2026-10-22",
  toilets: [
    { id: "a", name: "가까운 화장실", address: "서울 중구 1", openingHours: "상시", lat: 37.5675, lng: 126.978 },
    { id: "b", name: "먼 화장실", address: "서울 중구 2", openingHours: "09:00~18:00", lat: 37.576, lng: 126.978 },
    { id: "c", name: "아주 먼 화장실", address: "부산 1", openingHours: "상시", lat: 35.1796, lng: 129.0756 },
  ],
};

function request(query: string) {
  return GET(new Request(`http://localhost/api/toilets?${query}`));
}

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), "toilets-"));
  const file = join(dir, "toilets.json");
  writeFileSync(file, JSON.stringify(dataset));
  process.env.TOILETS_DATA_PATH = file;
});

afterEach(() => {
  delete process.env.TOILETS_DATA_PATH;
});

describe("GET /api/toilets", () => {
  test("현재 위치 반경 안의 화장실을 가까운 순으로, 데이터 기준일과 함께 돌려준다", async () => {
    const res = await request("lat=37.5665&lng=126.978&radius=500");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.baseDate).toBe("2026-10-22");
    expect(body.toilets.map((t: { id: string }) => t.id)).toEqual(["a"]);
    expect(body.toilets[0].distanceM).toBeGreaterThan(100);
  });

  test("반경을 넓히면 더 먼 곳까지 포함한다", async () => {
    const res = await request("lat=37.5665&lng=126.978&radius=5000");
    const body = await res.json();

    expect(body.toilets.map((t: { id: string }) => t.id)).toEqual(["a", "b"]);
  });

  test("지원 지역인데 반경 안에 없으면 빈 목록과 지원 지역 표시를 돌려준다", async () => {
    // 가장 가까운 화장실이 약 111m 떨어져 있고, 반경은 100m다.
    const res = await request("lat=37.5665&lng=126.978&radius=100");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ baseDate: "2026-10-22", supported: true, toilets: [] });
  });

  test("데이터가 없는 지역이면 지원하지 않는 지역이라고 알린다", async () => {
    const res = await request("lat=33.5&lng=126.5&radius=5000");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ baseDate: "2026-10-22", supported: false, toilets: [] });
  });

  test.each([
    ["위치가 없음", "radius=500"],
    ["위도가 숫자가 아님", "lat=abc&lng=126.9&radius=500"],
    ["반경이 100m 미만", "lat=37.5&lng=127&radius=50"],
    ["반경이 5km 초과", "lat=37.5&lng=127&radius=6000"],
  ])("잘못된 요청은 400을 돌려준다: %s", async (_name, query) => {
    const res = await request(query);

    expect(res.status).toBe(400);
  });

  test("데이터 파일이 없으면 503을 돌려준다", async () => {
    process.env.TOILETS_DATA_PATH = join(tmpdir(), "does-not-exist.json");

    const res = await request("lat=37.5665&lng=126.978&radius=500");

    expect(res.status).toBe(503);
  });
});
