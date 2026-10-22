// 좌표가 이미 들어 있는 지역별 공개 파일(서울, 경기, 제주시)을 앱 데이터 형식으로 바꾼다.
import { join } from "node:path";
import { columns, readCsv } from "./csv.mjs";

const EXCLUDED_KINDS = new Set(["간이화장실", "이동화장실"]);

// 지역 파일에 섞여 있는 잘못된 좌표를 걸러내는 대략의 범위다.
const BOUNDS = {
  seoul: { lat: [37.4, 37.72], lng: [126.7, 127.2] },
  gyeonggi: { lat: [36.8, 38.4], lng: [126.3, 127.9] },
  jeju: { lat: [33.0, 34.1], lng: [126.1, 127.0] },
};

const NO_HOURS = new Set(["", ":~:", "정시", "불규칙", "기타", "정시(영업시작~종료)"]);

function cleanHours(raw) {
  // 서울 파일은 '기타|05:00~24:00|05:00~24:00|'처럼 구분자로 이어 붙이고 같은 값을 되풀이한다.
  const parts = [...new Set(raw.split("|").map((p) => p.replace(/\s+/g, " ").trim()))].filter(
    (p) => !NO_HOURS.has(p)
  );
  return parts.length ? parts.join(" / ") : "정보 없음";
}

function within(bounds, lat, lng) {
  return lat >= bounds.lat[0] && lat <= bounds.lat[1] && lng >= bounds.lng[0] && lng <= bounds.lng[1];
}

function readSeoul(path) {
  const { header, rows } = readCsv(path);
  const c = columns(header, path);
  // 이 파일의 'x 좌표'는 경도, 'y 좌표'는 위도다.
  return rows.map((r) => ({
    id: `seoul-${r[c("연번")]}`,
    name: r[c("건물명")].trim() || r[c("도로명주소")],
    address: r[c("도로명주소")] || r[c("지번주소")],
    jibun: r[c("지번주소")],
    openingHours: cleanHours(r[c("개방시간")]),
    lat: Number(r[c("y 좌표")]),
    lng: Number(r[c("x 좌표")]),
    bounds: BOUNDS.seoul,
  }));
}

function readGyeonggi(path) {
  const { header, rows } = readCsv(path);
  const c = columns(header, path);
  return rows
    .filter((r) => !EXCLUDED_KINDS.has(r[c("구분")]))
    .map((r, i) => ({
      // 이 파일에는 식별번호가 없어 줄 번호로 만든다. 파일이 바뀌면 번호도 바뀔 수 있다.
      id: `gyeonggi-${i + 1}`,
      name: r[c("화장실명")],
      address: r[c("소재지도로명주소")] || r[c("소재지지번주소")],
      jibun: r[c("소재지지번주소")],
      openingHours: cleanHours(r[c("개방시간")]),
      lat: Number(r[c("위도")]),
      lng: Number(r[c("경도")]),
      bounds: BOUNDS.gyeonggi,
    }));
}

function readJeju(path) {
  const { header, rows } = readCsv(path);
  const c = columns(header, path);
  return rows
    .filter((r) => !EXCLUDED_KINDS.has(r[c("구분 명")]))
    .map((r) => ({
      id: `jeju-${r[c("데이터 코드")]}`,
      name: r[c("화장실 명")],
      address: r[c("도로명 주소")] || r[c("지번 주소")],
      jibun: r[c("지번 주소")],
      openingHours: cleanHours(r[c("개방 시간 정보")]),
      lat: Number(r[c("위도 좌표")]),
      lng: Number(r[c("경도 좌표")]),
      bounds: BOUNDS.jeju,
    }));
}

const SOURCES = [
  { label: "서울", file: "서울시 공중화장실 위치정보.csv", read: readSeoul },
  { label: "경기", file: "공중화장실현황(제공표준).csv", read: readGyeonggi },
  { label: "제주시", file: "제주특별자치도 제주시_공중화장실_20251231.csv", read: readJeju },
];

/** 폴더 안의 지역 파일을 모두 읽어, 좌표가 있고 범위 안인 건만 돌려준다. */
export function readRegional(dir) {
  const result = [];

  for (const source of SOURCES) {
    const records = source.read(join(dir, source.file));
    const valid = records.filter(
      (t) => t.name && t.address && Number.isFinite(t.lat) && Number.isFinite(t.lng) && within(t.bounds, t.lat, t.lng)
    );
    console.log(`${source.label}: ${records.length}건 중 ${valid.length}건 사용 (좌표 없음 또는 범위 밖 ${records.length - valid.length}건 제외)`);
    result.push(
      ...valid.map((t) => ({
        id: t.id,
        name: t.name,
        address: t.address,
        openingHours: t.openingHours,
        lat: t.lat,
        lng: t.lng,
      }))
    );
  }

  return result;
}

/** 같은 장소를 가리키는 두 출처의 건을 가려내기 위한 주소 키. */
export function addressKey(address) {
  return address.replace(/\(.*?\)/g, "").replace(/\s+/g, "");
}
