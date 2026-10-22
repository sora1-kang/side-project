import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Toilet } from "./nearby";

export type ToiletDataset = {
  /** 공공데이터를 가져와 좌표로 변환해 둔 날(YYYY-MM-DD). */
  baseDate: string;
  toilets: Toilet[];
};

const DEFAULT_PATH = join(process.cwd(), "data", "toilets.json");

const cache = new Map<string, Promise<ToiletDataset>>();

/** 사전 변환해 둔 화장실 데이터를 읽는다. 파일이 없거나 깨졌으면 던진다. */
export function loadDataset(): Promise<ToiletDataset> {
  const path = process.env.TOILETS_DATA_PATH ?? DEFAULT_PATH;
  let loaded = cache.get(path);

  if (!loaded) {
    // 경로가 동적이라 프로젝트 전체가 추적되지 않게 막는다. 데이터 파일은 next.config.ts에서 직접 포함한다.
    loaded = readFile(/*turbopackIgnore: true*/ path, "utf8").then((text) => JSON.parse(text));
    // 실패한 읽기는 저장하지 않아, 파일이 생기면 다음 요청에서 다시 읽는다.
    loaded.catch(() => cache.delete(path));
    cache.set(path, loaded);
  }

  return loaded;
}
