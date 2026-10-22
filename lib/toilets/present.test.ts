import { describe, expect, test } from "vitest";

import { directionsUrl, formatDistance } from "@/lib/toilets";

describe("formatDistance", () => {
  test("1km 미만은 미터 단위로 반올림한다", () => {
    expect(formatDistance(123.4)).toBe("123m");
    expect(formatDistance(999.4)).toBe("999m");
  });

  test("1km 이상은 소수 첫째 자리 킬로미터로 보여준다", () => {
    expect(formatDistance(1000)).toBe("1.0km");
    expect(formatDistance(2349)).toBe("2.3km");
  });
});

describe("directionsUrl", () => {
  test("이름과 좌표로 외부 지도 앱의 길찾기 주소를 만든다", () => {
    expect(directionsUrl({ name: "시청 앞 화장실", lat: 37.5665, lng: 126.978 })).toBe(
      "https://map.kakao.com/link/to/%EC%8B%9C%EC%B2%AD%20%EC%95%9E%20%ED%99%94%EC%9E%A5%EC%8B%A4,37.5665,126.978"
    );
  });

  test("이름의 쉼표는 좌표 구분자와 섞이지 않게 바꾼다", () => {
    expect(directionsUrl({ name: "A,B", lat: 1, lng: 2 })).toBe(
      "https://map.kakao.com/link/to/A%20B,1,2"
    );
  });
});
