import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { ToiletFinder } from "@/components/toilet-finder";

// Leaflet은 jsdom에서 그려지지 않으므로, 지도가 받는 값만 확인한다.
vi.mock("@/components/toilet-finder/toilet-map", () => ({
  default: (props: { selectedId: string | null; toilets: { id: string }[] }) => (
    <div
      data-testid="map"
      data-selected={props.selectedId ?? ""}
      data-count={props.toilets.length}
    />
  ),
}));

const nearby = {
  baseDate: "2026-10-22",
  toilets: [
    { id: "a", name: "시청 앞 공중화장실", address: "서울 중구 세종대로 110", openingHours: "상시", lat: 37.5675, lng: 126.978, distanceM: 112 },
    { id: "b", name: "덕수궁 화장실", address: "서울 중구 세종대로 99", openingHours: "09:00~18:00", lat: 37.5655, lng: 126.975, distanceM: 1340 },
  ],
};

function allowLocation() {
  vi.stubGlobal("navigator", {
    geolocation: {
      getCurrentPosition: (ok: PositionCallback) =>
        ok({ coords: { latitude: 37.5665, longitude: 126.978 } } as GeolocationPosition),
    },
  });
}

function denyLocation(code: number) {
  vi.stubGlobal("navigator", {
    geolocation: {
      getCurrentPosition: (_ok: PositionCallback, fail: PositionErrorCallback) =>
        fail({ code, PERMISSION_DENIED: 1 } as GeolocationPositionError),
    },
  });
}

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("위치를 허용하면 기본 반경 500m로 조회해 가까운 순 목록을 보여준다", async () => {
  allowLocation();
  const fetchMock = stubFetch(nearby);

  render(<ToiletFinder />);

  const items = await screen.findAllByRole("listitem");
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent("시청 앞 공중화장실");
  expect(items[0]).toHaveTextContent("112m");
  expect(items[0]).toHaveTextContent("서울 중구 세종대로 110");
  expect(items[0]).toHaveTextContent("상시");
  expect(items[1]).toHaveTextContent("1.3km");

  const url = new URL(fetchMock.mock.calls[0][0], "http://localhost");
  expect(url.pathname).toBe("/api/toilets");
  expect(url.searchParams.get("lat")).toBe("37.5665");
  expect(url.searchParams.get("lng")).toBe("126.978");
  expect(url.searchParams.get("radius")).toBe("500");

  expect(screen.getByTestId("map")).toHaveAttribute("data-count", "2");
  expect(screen.getByText(/데이터 기준일/)).toHaveTextContent("2026-10-22");
});

test("각 항목의 길찾기는 외부 지도 앱을 새 탭으로 연다", async () => {
  allowLocation();
  stubFetch(nearby);

  render(<ToiletFinder />);

  const links = await screen.findAllByRole("link", { name: /길찾기/ });
  expect(links[0]).toHaveAttribute(
    "href",
    expect.stringMatching(/^https:\/\/map\.kakao\.com\/link\/to\/.+,37\.5675,126\.978$/)
  );
  expect(links[0]).toHaveAttribute("target", "_blank");
  expect(links[0]).toHaveAttribute("rel", expect.stringContaining("noopener"));
});

test("목록 항목을 고르면 지도의 해당 핀이 강조된다", async () => {
  allowLocation();
  stubFetch(nearby);

  render(<ToiletFinder />);

  fireEvent.click(await screen.findByRole("button", { name: /덕수궁 화장실/ }));

  expect(screen.getByTestId("map")).toHaveAttribute("data-selected", "b");
});

test("반경을 바꾸면 새 반경으로 다시 조회한다", async () => {
  allowLocation();
  const fetchMock = stubFetch(nearby);

  render(<ToiletFinder />);
  await screen.findAllByRole("listitem");

  // jsdom에는 레이아웃이 없어 슬라이더 손잡이가 숨김 상태로 그려진다.
  const slider = screen.getByRole("slider", { hidden: true });
  expect(slider).toHaveAttribute("min", "100");
  expect(slider).toHaveAttribute("max", "5000");
  await act(async () => {
    fireEvent.change(slider, { target: { value: "2000" } });
  });

  await waitFor(() => {
    const last = new URL(fetchMock.mock.calls.at(-1)![0], "http://localhost");
    expect(last.searchParams.get("radius")).toBe("2000");
  });
});

test("반경 안에 화장실이 없으면 없다고 알리고 반경을 넓히도록 안내한다", async () => {
  allowLocation();
  stubFetch({ baseDate: "2026-10-22", supported: true, toilets: [] });

  render(<ToiletFinder />);

  expect(await screen.findByText(/반경 안에 공공화장실이 없습니다/)).toBeInTheDocument();
  expect(screen.getByText(/반경을 넓혀/)).toBeInTheDocument();
});

test("데이터가 없는 지역이면 반경 안내가 아니라 지원하지 않는 지역이라고 알린다", async () => {
  allowLocation();
  stubFetch({ baseDate: "2026-10-22", supported: false, toilets: [] });

  render(<ToiletFinder />);

  expect(await screen.findByText(/아직 지원하지 않는 지역입니다/)).toBeInTheDocument();
  expect(screen.queryByText(/반경 안에 공공화장실이 없습니다/)).not.toBeInTheDocument();
});

test("위치 권한을 거부하면 이유와 다시 허용하는 방법을 안내하고 조회하지 않는다", async () => {
  denyLocation(1);
  const fetchMock = stubFetch(nearby);

  render(<ToiletFinder />);

  expect(await screen.findByText(/위치 권한이 꺼져 있습니다/)).toBeInTheDocument();
  expect(screen.getByText(/브라우저 설정에서 위치 권한을 허용/)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("위치를 얻지 못하면 안내하고 다시 시도할 수 있다", async () => {
  denyLocation(2);

  render(<ToiletFinder />);

  expect(await screen.findByText(/현재 위치를 확인하지 못했습니다/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
});

test("목록을 불러오지 못하면 오류를 알리고 다시 시도할 수 있다", async () => {
  allowLocation();
  stubFetch({ error: "data-unavailable" }, 503);

  render(<ToiletFinder />);

  expect(await screen.findByText(/화장실 목록을 불러오지 못했습니다/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
});
