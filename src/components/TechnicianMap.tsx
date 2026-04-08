import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, AlertTriangle } from "lucide-react";
import { useTechnicianLocations, type TechnicianLocation } from "@/hooks/useTechnicianLocations";

const TECH_MARKER_COLORS: Record<string, string> = {
  유호상: "#3b82f6",
  마성수: "#10b981",
  김영일: "#f59e0b",
  이재현: "#8b5cf6",
  이동진: "#f43f5e",
  주희로: "#06b6d4",
};

function createMarkerIcon(color: string, action: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
    ${action === "출근" ? '<circle cx="14" cy="14" r="3" fill="#22c55e"/>' : '<circle cx="14" cy="14" r="3" fill="#ef4444"/>'}
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -40],
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TechnicianMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const { data: locations, isLoading, isError } = useTechnicianLocations();

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    mapInstance.current = L.map(mapRef.current).setView([34.98, 126.91], 10);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 18,
    }).addTo(mapInstance.current);

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !locations?.length) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    const bounds: L.LatLngExpression[] = [];

    locations.forEach((loc: TechnicianLocation) => {
      const color = TECH_MARKER_COLORS[loc.technician_name] || "#6b7280";
      const icon = createMarkerIcon(color, loc.action);
      const marker = L.marker([loc.latitude, loc.longitude], { icon }).addTo(map);
      marker.bindPopup(
        `<div style="font-size:13px;line-height:1.6">
          <strong>${loc.technician_name}</strong><br/>
          ${loc.action === "출근" ? "🟢 출근" : "🔴 퇴근"}<br/>
          <span style="color:#666">${formatTime(loc.created_at)}</span>
          ${loc.accuracy ? `<br/><span style="color:#999;font-size:11px">정확도: ±${Math.round(loc.accuracy)}m</span>` : ""}
        </div>`
      );
      bounds.push([loc.latitude, loc.longitude]);
    });

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 13 });
    }
  }, [locations]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" /> 기사 위치
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="p-5 flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" /> 위치 데이터를 불러올 수 없습니다
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="h-5 w-5" /> 기사 최근 위치
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden rounded-b-lg">
        <div ref={mapRef} className="h-[400px] w-full" />
        {locations && locations.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            아직 기록된 위치 정보가 없습니다
          </div>
        )}
        {locations && locations.length > 0 && (
          <div className="flex flex-wrap gap-3 p-3 border-t">
            {locations.map((loc) => (
              <div key={loc.technician_name} className="flex items-center gap-1.5 text-xs">
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ backgroundColor: TECH_MARKER_COLORS[loc.technician_name] || "#6b7280" }}
                />
                <span className="font-medium">{loc.technician_name}</span>
                <span className="text-muted-foreground">
                  {loc.action === "출근" ? "🟢" : "🔴"} {formatTime(loc.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
