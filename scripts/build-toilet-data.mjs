// 공공화장실 데이터를 모아 data/toilets.json을 만든다. (일회성 작업)
//
//   node --env-file=.env.local scripts/build-toilet-data.mjs --regional <지역 파일 폴더> [--national <전국 CSV>]
//
// 출처는 두 가지다.
//  - 지역 파일(서울, 경기, 제주시): 좌표가 이미 있어 바로 쓴다.
//  - 전국 CSV: 좌표가 없다. 1) 주소 -> 행정구역코드 등(주소정보 검색 API)  2) 코드 -> 좌표(좌표제공 검색 API)로
//    좌표를 붙이고, 지역 파일과 같은 주소의 건은 지역 파일 쪽을 쓴다. 2단계는 좌표제공 키가 있어야 한다.
// 전국 CSV 단계의 결과는 data/.cache에 저장해, 중단돼도 이어서 실행한다.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import proj4 from "proj4";

import { readCsv, columns } from "./csv.mjs";
import { addressKey, readRegional } from "./regional-sources.mjs";

const { values: args } = parseArgs({
  options: {
    regional: { type: "string" },
    national: { type: "string" },
    limit: { type: "string" },
    out: { type: "string", default: "data/toilets.json" },
  },
});

if (!args.regional && !args.national) {
  throw new Error("--regional <폴더> 또는 --national <전국 CSV> 중 하나는 필요합니다.");
}

const ADDRESS_API = "https://business.juso.go.kr/addrlink/addrLinkApi.do";
const COORD_API = "https://business.juso.go.kr/addrlink/addrCoordApi.do";
const CACHE_DIR = join("data", ".cache");
const CODES_CACHE = join(CACHE_DIR, "codes.json");
const COORDS_CACHE = join(CACHE_DIR, "coords.json");
const REQUEST_GAP_MS = 120;
const SAVE_EVERY = 200;
const CONCURRENCY = 4;

// 좌표제공 API의 좌표계는 ITRF2000/GRS80 투영좌표(국토지리정보원 통합 기준, EPSG:5179)로 본다.
// 실제 응답으로 한국 안에 떨어지는지 확인한 뒤 쓴다.
const UTMK =
  "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs";

const EXCLUDED_KINDS = new Set(["간이화장실", "이동화장실"]);

function readNational(csvPath) {
  const { header, rows } = readCsv(csvPath);
  const col = columns(header, csvPath);
  const c = {
    id: col("관리번호"), kind: col("구분명"), name: col("화장실명"),
    road: col("소재지도로명주소"), jibun: col("소재지지번주소"),
    hours: col("개방시간"), hoursDetail: col("개방시간상세"),
  };

  return rows
    .filter((r) => !EXCLUDED_KINDS.has(r[c.kind]) && r[c.hours] !== "미개방")
    .map((r) => ({
      id: r[c.id],
      name: r[c.name],
      road: r[c.road],
      jibun: r[c.jibun],
      openingHours: describeHours(r[c.hours], r[c.hoursDetail]),
    }))
    .filter((t) => t.id && (t.road || t.jibun));
}

function describeHours(hours, detail) {
  if (hours === "정시") return detail || "정시";
  if (hours === "") return detail || "정보 없음";
  return detail ? `${hours} (${detail})` : hours;
}

/** 검색어 후보를 순서대로 만든다. 도로명주소 원문, 괄호와 쉼표 뒤를 뗀 도로명주소, 지번주소 순이다. */
function toKeywords(toilet) {
  const keywords = [];
  if (toilet.road) {
    keywords.push(toilet.road);
    keywords.push(toilet.road.replace(/\(.*?\)/g, "").split(",")[0].trim());
  }
  if (toilet.jibun) {
    keywords.push(
      toilet.jibun
        .replace(/(\d+)번지\s*(\d+)호/, "$1-$2")
        .replace(/번지/g, "")
        .replace(/산\s+(\d)/, "산$1")
    );
  }
  return [...new Set(keywords)].filter(Boolean);
}

function loadCache(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
}

function saveCache(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callApi(url, params) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${url}?${new URLSearchParams(params)}`);
    const { results } = await res.json();
    const { errorCode, errorMessage } = results.common;
    // 짧은 시간에 요청이 몰렸다는 응답이면 잠시 쉬고 다시 보낸다.
    if (errorCode === "E0007") { await sleep(5000 * (attempt + 1)); continue; }
    if (errorCode !== "0") throw new Error(`${errorCode} ${errorMessage}`);
    return results;
  }
  throw new Error("요청이 계속 몰려 중단합니다(E0007).");
}

function pickMatch(candidates, keyword) {
  if (!candidates?.length) return null;
  const [sido, sigungu] = keyword.split(/\s+/);
  const sameArea = (j) => `${j.roadAddr} ${j.jibunAddr}`.includes(sigungu ?? "") && `${j.roadAddr} ${j.jibunAddr}`.includes(sido?.slice(0, 2) ?? "");
  return candidates.find(sameArea) ?? null;
}

async function resolveCodes(toilets) {
  const key = process.env.JUSO_ADDRESS_API_KEY;
  if (!key) throw new Error("JUSO_ADDRESS_API_KEY가 없습니다. .env.local을 확인하세요.");

  const cache = loadCache(CODES_CACHE);
  const todo = toilets.filter((t) => !(t.id in cache));
  console.log(`1단계 주소 -> 코드: ${toilets.length}건 중 ${todo.length}건 남음`);

  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < todo.length) {
      const toilet = todo[next++];
      try {
        let match = null;
        for (const keyword of toKeywords(toilet)) {
          const results = await callApi(ADDRESS_API, {
            confmKey: key, currentPage: "1", countPerPage: "10", keyword, resultType: "json",
          });
          match = pickMatch(results.juso, keyword);
          await sleep(REQUEST_GAP_MS);
          if (match) break;
        }
        cache[toilet.id] = match && {
          admCd: match.admCd, rnMgtSn: match.rnMgtSn, udrtYn: match.udrtYn,
          buldMnnm: match.buldMnnm, buldSlno: match.buldSlno,
        };
      } catch (error) {
        // 키 문제(E0001, E0014)와 호출 폭주는 중단하고, 검색어가 거절된 건만 건너뛴다.
        if (/^(E0001|E0014|E0007)|요청이 계속/.test(error.message) || !/^E\d{4}/.test(error.message)) throw error;
        cache[toilet.id] = null;
      }
      if (++done % SAVE_EVERY === 0) { saveCache(CODES_CACHE, cache); console.log(`  ${done}/${todo.length}`); }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  saveCache(CODES_CACHE, cache);
  return cache;
}

async function resolveCoords(codes) {
  const key = process.env.JUSO_COORD_API_KEY;
  if (!key) {
    console.log("2단계 코드 -> 좌표: JUSO_COORD_API_KEY가 없어 건너뜁니다.");
    return null;
  }

  const cache = loadCache(COORDS_CACHE);
  const todo = Object.entries(codes).filter(([id, c]) => c && !(id in cache));
  console.log(`2단계 코드 -> 좌표: ${todo.length}건 남음`);

  let done = 0;
  for (const [id, code] of todo) {
    const results = await callApi(COORD_API, {
      confmKey: key, admCd: code.admCd, rnMgtSn: code.rnMgtSn, udrtYn: code.udrtYn,
      buldMnnm: code.buldMnnm, buldSlno: code.buldSlno, resultType: "json",
    });
    const hit = results.juso?.[0];
    cache[id] = hit ? { x: Number(hit.entX), y: Number(hit.entY) } : null;
    if (++done % SAVE_EVERY === 0) { saveCache(COORDS_CACHE, cache); console.log(`  ${done}/${todo.length}`); }
    await sleep(REQUEST_GAP_MS);
  }
  saveCache(COORDS_CACHE, cache);
  return cache;
}

function assemble(toilets, coords) {
  const result = [];
  for (const toilet of toilets) {
    const point = coords[toilet.id];
    if (!point) continue;
    const [lng, lat] = proj4(UTMK, "WGS84", [point.x, point.y]);
    // 한국 밖으로 떨어지면 좌표계 가정이 틀린 것이다.
    if (!(lat > 32 && lat < 39.5 && lng > 123 && lng < 132.5)) {
      throw new Error(`좌표가 한국 밖입니다(${toilet.id}: ${lat}, ${lng}). 좌표계를 확인하세요.`);
    }
    result.push({
      id: toilet.id,
      name: toilet.name,
      address: toilet.road || toilet.jibun,
      openingHours: toilet.openingHours,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
    });
  }
  return result;
}

const baseDate = new Date().toISOString().slice(0, 10);
const regional = args.regional ? readRegional(args.regional) : [];
let output = regional;

if (args.national) {
  const all = readNational(args.national);
  // 시험 실행용: 전국에서 고르게 --limit건만 뽑는다.
  const stride = args.limit ? Math.max(1, Math.floor(all.length / Number(args.limit))) : 1;
  const toilets = args.limit ? all.filter((_, i) => i % stride === 0).slice(0, Number(args.limit)) : all;
  console.log(`전국 CSV 대상 ${toilets.length}건 (제외 후, 전체 ${all.length}건)`);

  const codes = await resolveCodes(toilets);
  const matched = toilets.filter((t) => codes[t.id]).length;
  console.log(`코드 매칭: ${matched}/${toilets.length}건`);

  const coords = await resolveCoords(Object.fromEntries(toilets.map((t) => [t.id, codes[t.id]])));
  if (coords) {
    // 지역 파일에 이미 있는 주소는 지역 파일 쪽을 쓴다.
    const known = new Set(regional.map((t) => addressKey(t.address)));
    const added = assemble(toilets, coords).filter((t) => !known.has(addressKey(t.address)));
    console.log(`전국 CSV에서 ${added.length}건 추가`);
    output = [...regional, ...added];
  } else if (!args.regional) {
    process.exit(0);
  } else {
    console.log("전국 CSV는 좌표가 없어 이번 결과에 넣지 않았습니다.");
  }
}

mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, JSON.stringify({ baseDate, toilets: output }));
console.log(`${args.out}: ${output.length}건 저장 (기준일 ${baseDate})`);
