import { readFileSync } from "node:fs";

export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** CSV 파일을 읽어 { header, rows }로 돌려준다. 공공데이터 CSV는 CP949인 경우가 많아, UTF-8이 깨지면 CP949로 읽는다. */
export function readCsv(path) {
  const bytes = readFileSync(path);
  let text = new TextDecoder("utf-8").decode(bytes);
  if (text.includes("�")) text = new TextDecoder("euc-kr").decode(bytes);

  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ""));
  return { header, rows: rows.filter((r) => r.length === header.length) };
}

/** 헤더 이름으로 열 번호를 찾는 함수를 만든다. 없는 컬럼이면 던진다. */
export function columns(header, path) {
  return (name) => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`${path}에 '${name}' 컬럼이 없습니다.`);
    return index;
  };
}
