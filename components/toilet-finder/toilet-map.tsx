"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { Coordinates, NearbyToilet } from "@/lib/toilets";

type Props = {
  origin: Coordinates;
  toilets: NearbyToilet[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

// Leaflet은 문자열 툴팁을 HTML로 해석하므로, 이름은 텍스트 노드로 넘긴다.
function textNode(text: string) {
  const el = document.createElement("span");
  el.textContent = text;
  return el;
}

export default function ToiletMap({ origin, toilets, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fittedKey = useRef<string>("");

  useEffect(() => {
    const map = L.map(containerRef.current!, { zoomControl: true }).setView(
      [origin.lat, origin.lng],
      16
    );
    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // 지도는 한 번만 만들고, 이후 변경은 아래 효과에서 반영한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    L.circleMarker([origin.lat, origin.lng], {
      radius: 8,
      color: "#ffffff",
      weight: 2,
      fillColor: "#2563eb",
      fillOpacity: 1,
    })
      .bindTooltip("현재 위치")
      .addTo(layer);

    for (const toilet of toilets) {
      const selected = toilet.id === selectedId;
      const marker = L.circleMarker([toilet.lat, toilet.lng], {
        radius: selected ? 12 : 8,
        color: "#ffffff",
        weight: 2,
        fillColor: selected ? "#dc2626" : "#16a34a",
        fillOpacity: 1,
      })
        // 선택된 핀은 이름을 항상 보여줘서 목록에서 골라도 지도에서 바로 찾을 수 있다.
        .bindTooltip(textNode(toilet.name), { permanent: selected })
        .on("click", () => onSelect(toilet.id))
        .addTo(layer);

      if (selected) {
        marker.bringToFront();
        // 선택한 핀이 지도 밖에 있으면 화면 안으로 옮긴다.
        if (!map.getBounds().contains(marker.getLatLng())) {
          map.panTo(marker.getLatLng());
        }
      }
    }

    // 조회 결과가 바뀔 때만 화면을 맞추고, 핀을 고를 때는 움직이지 않는다.
    const key = `${origin.lat},${origin.lng}:${toilets.map((t) => t.id).join(",")}`;
    if (key !== fittedKey.current) {
      fittedKey.current = key;
      const points: L.LatLngTuple[] = [
        [origin.lat, origin.lng],
        ...toilets.map((t): L.LatLngTuple => [t.lat, t.lng]),
      ];
      map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 17 });
    }
  }, [origin, toilets, selectedId, onSelect]);

  return <div ref={containerRef} className="size-full" aria-label="주변 화장실 지도" />;
}
