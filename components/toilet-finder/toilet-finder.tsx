"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { MapPinIcon, MapPinOffIcon, NavigationIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  directionsUrl,
  formatDistance,
  type Coordinates,
  type NearbyToilet,
} from "@/lib/toilets";

const ToiletMap = dynamic(() => import("./toilet-map"), {
  ssr: false,
  loading: () => <Skeleton className="size-full" />,
});

const MIN_RADIUS_M = 100;
const MAX_RADIUS_M = 5000;
const DEFAULT_RADIUS_M = 500;
const RADIUS_STEP_M = 100;
const RADIUS_DEBOUNCE_MS = 300;

type Location =
  | { status: "locating" }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "ready"; origin: Coordinates };

type Result =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; toilets: NearbyToilet[]; baseDate: string; supported: boolean };

// 어떤 조회의 결과인지 함께 들고 있어, 조회 조건이 바뀌면 곧바로 "불러오는 중"으로 본다.
type Settled = { key: string; result: Exclude<Result, { status: "loading" }> };

function useLocation() {
  const [location, setLocation] = useState<Location>({ status: "locating" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      queueMicrotask(() => setLocation({ status: "unavailable" }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        setLocation({
          status: "ready",
          origin: { lat: coords.latitude, lng: coords.longitude },
        }),
      (error) =>
        setLocation({
          status: error.code === 1 ? "denied" : "unavailable",
        }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 }
    );
  }, [attempt]);

  const retry = () => {
    setLocation({ status: "locating" });
    setAttempt((n) => n + 1);
  };

  return { location, retry };
}

function useNearbyToilets(origin: Coordinates | null, radiusM: number) {
  const [settled, setSettled] = useState<Settled | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = origin ? `${origin.lat},${origin.lng},${radiusM},${attempt}` : null;

  useEffect(() => {
    if (!origin || !key) return;

    const controller = new AbortController();

    const query = new URLSearchParams({
      lat: String(origin.lat),
      lng: String(origin.lng),
      radius: String(radiusM),
    });

    fetch(`/api/toilets?${query}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((body) =>
        setSettled({
          key,
          result: {
            status: "ready",
            toilets: body.toilets,
            baseDate: body.baseDate,
            supported: body.supported,
          },
        })
      )
      .catch((error) => {
        if (error?.name !== "AbortError") {
          setSettled({ key, result: { status: "error" } });
        }
      });

    return () => controller.abort();
  }, [origin, radiusM, key]);

  const result: Result =
    settled && settled.key === key ? settled.result : { status: "loading" };

  return { result, retry: () => setAttempt((n) => n + 1) };
}

export function ToiletFinder() {
  const { location, retry: retryLocation } = useLocation();
  const origin = location.status === "ready" ? location.origin : null;

  // 슬라이더 값은 바로 보여주고, 조회는 손을 멈춘 뒤에 한 번만 한다.
  const [radiusM, setRadiusM] = useState(DEFAULT_RADIUS_M);
  const [queryRadiusM, setQueryRadiusM] = useState(DEFAULT_RADIUS_M);
  useEffect(() => {
    const timer = setTimeout(() => setQueryRadiusM(radiusM), RADIUS_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [radiusM]);

  const { result, retry: retryFetch } = useNearbyToilets(origin, queryRadiusM);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const select = useCallback((id: string) => setSelectedId(id), []);

  if (location.status === "locating") {
    return <Skeleton className="h-96 w-full" aria-label="현재 위치를 확인하는 중" />;
  }

  if (location.status === "denied") {
    return (
      <Alert variant="destructive">
        <MapPinOffIcon />
        <AlertTitle>위치 권한이 꺼져 있습니다</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          내 주변 화장실을 찾으려면 현재 위치가 필요합니다. 브라우저 설정에서 위치 권한을
          허용한 뒤 다시 시도해 주세요.
          <Button variant="outline" onClick={retryLocation}>
            다시 시도
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (location.status === "unavailable") {
    return (
      <Alert variant="destructive">
        <MapPinOffIcon />
        <AlertTitle>현재 위치를 확인하지 못했습니다</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          기기의 위치 서비스가 켜져 있는지 확인한 뒤 다시 시도해 주세요.
          <Button variant="outline" onClick={retryLocation}>
            다시 시도
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const toilets = result.status === "ready" ? result.toilets : [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span id="radius-label" className="text-sm font-medium">
              탐색 반경
            </span>
            <span className="text-sm text-muted-foreground">{formatDistance(radiusM)}</span>
          </div>
          <Slider
            aria-labelledby="radius-label"
            min={MIN_RADIUS_M}
            max={MAX_RADIUS_M}
            step={RADIUS_STEP_M}
            value={[radiusM]}
            onValueChange={(value) =>
              setRadiusM(Array.isArray(value) ? value[0] : value)
            }
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-[50vh] min-h-72 overflow-hidden rounded-lg border lg:h-[32rem]">
          {origin && (
            <ToiletMap
              origin={origin}
              toilets={toilets}
              selectedId={selectedId}
              onSelect={select}
            />
          )}
        </div>

        <div className="flex flex-col gap-3">
          {result.status === "loading" && (
            <div className="flex flex-col gap-3" aria-label="화장실을 찾는 중">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {result.status === "error" && (
            <Alert variant="destructive">
              <MapPinOffIcon />
              <AlertTitle>화장실 목록을 불러오지 못했습니다</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-3">
                잠시 후 다시 시도해 주세요.
                <Button variant="outline" onClick={retryFetch}>
                  다시 시도
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {result.status === "ready" && !result.supported && (
            <Alert>
              <MapPinOffIcon />
              <AlertTitle>아직 지원하지 않는 지역입니다</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-3">
                지금은 서울, 경기, 제주시의 화장실만 찾을 수 있습니다. 다른 지역은 준비 중입니다.
              </AlertDescription>
            </Alert>
          )}

          {result.status === "ready" && result.supported && toilets.length === 0 && (
            <Alert>
              <MapPinIcon />
              <AlertTitle>반경 안에 공공화장실이 없습니다</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-3">
                위의 탐색 반경을 넓혀 다시 찾아보세요.
              </AlertDescription>
            </Alert>
          )}

          {result.status === "ready" && toilets.length > 0 && (
            <ul className="flex flex-col gap-3">
              {toilets.map((toilet) => (
                <li key={toilet.id}>
                  <Card
                    className={
                      toilet.id === selectedId ? "ring-2 ring-primary" : undefined
                    }
                  >
                    <CardContent className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="text-left font-medium underline-offset-4 hover:underline"
                          aria-pressed={toilet.id === selectedId}
                          onClick={() => select(toilet.id)}
                        >
                          {toilet.name}
                        </button>
                        <Badge variant="secondary">{formatDistance(toilet.distanceM)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{toilet.address}</p>
                      <p className="text-sm">개방시간 {toilet.openingHours}</p>
                      <a
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                        href={directionsUrl(toilet)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <NavigationIcon data-icon="inline-start" />
                        길찾기
                      </a>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {result.status === "ready" && (
            <p className="text-xs text-muted-foreground">
              데이터 기준일 {result.baseDate}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
