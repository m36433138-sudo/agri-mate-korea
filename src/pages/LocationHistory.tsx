import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Clock, User, LogIn, LogOut, RefreshCw, Calendar } from "lucide-react";

const TECH_COLORS: Record<string, string> = {
  유호상: "#3b82f6",
  마성수: "#10b981",
  김영일: "#f59e0b",
  이재현: "#8b5cf6",
  이동진: "#f43f5e",
  주희로: "#06b6d4",
};

interface LocationRecord {
  id: string;
  technician_name: string;
  action: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  created_at: string;
}

function useLocationHistory(techFilter: string, dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["location-history", techFilter, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("technician_locations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (techFilter && techFilter !== "all") {
        query = query.eq("technician_name", techFilter);
      }
      if (dateFrom) {
        query = query.gte("created_at", `${dateFrom}T00:00:00`);
      }
      if (dateTo) {
        query = query.lte("created_at", `${dateTo}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as LocationRecord[];
    },
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function createMarkerIcon(color: string, action: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="34" viewBox="0 0 24 34">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 22 12 22s12-13 12-22C24 5.37 18.63 0 12 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
    ${action === "출근" ? '<circle cx="12" cy="12" r="2.5" fill="#22c55e"/>' : '<circle cx="12" cy="12" r="2.5" fill="#ef4444"/>'}
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [24, 34],
    iconAnchor: [12, 34],
    popupAnchor: [0, -34],
  });
}

function HistoryMap({ records }: { records: LocationRecord[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([34.98, 126.91], 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 18,
      }).addTo(mapInstance.current);
    }

    const map = mapInstance.current;
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    const bounds: L.LatLngExpression[] = [];

    records.forEach((rec) => {
      const color = TECH_COLORS[rec.technician_name] || "#6b7280";
      const icon = createMarkerIcon(color, rec.action);
      const marker = L.marker([rec.latitude, rec.longitude], { icon }).addTo(map);
      marker.bindPopup(
        `<div style="font-size:12px;line-height:1.5">
          <strong>${rec.technician_name}</strong><br/>
          ${rec.action === "출근" ? "🟢 출근" : "🔴 퇴근"}<br/>
          ${formatDateTime(rec.created_at)}
          ${rec.accuracy ? `<br/>정확도: ±${Math.round(rec.accuracy)}m` : ""}
        </div>`
      );
      bounds.push([rec.latitude, rec.longitude]);
    });

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 14 });
    }

    return () => {};
  }, [records]);

  useEffect(() => {
    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  return <div ref={mapRef} className="h-[400px] w-full rounded-lg" />;
}

export default function LocationHistory() {
  const today = new Date().toISOString().slice(0, 10);
  const [techFilter, setTechFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const { data: records, isLoading, refetch } = useLocationHistory(techFilter, dateFrom, dateTo);

  const techNames = useMemo(() => {
    if (!records) return [];
    return [...new Set(records.map((r) => r.technician_name))];
  }, [records]);

  const stats = useMemo(() => {
    if (!records) return { total: 0, clockIn: 0, clockOut: 0, techCount: 0 };
    return {
      total: records.length,
      clockIn: records.filter((r) => r.action === "출근").length,
      clockOut: records.filter((r) => r.action === "퇴근").length,
      techCount: new Set(records.map((r) => r.technician_name)).size,
    };
  }, [records]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="h-6 w-6" />
          출퇴근 위치 이력
        </h1>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">기사</label>
              <Select value={techFilter} onValueChange={setTechFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {Object.keys(TECH_COLORS).map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> 시작일
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> 종료일
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "총 기록", value: stats.total, icon: Clock, color: "text-primary" },
          { label: "출근", value: stats.clockIn, icon: LogIn, color: "text-emerald-600" },
          { label: "퇴근", value: stats.clockOut, icon: LogOut, color: "text-rose-600" },
          { label: "기사 수", value: stats.techCount, icon: User, color: "text-primary" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Map */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">지도</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden rounded-b-lg">
          {isLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : (
            <HistoryMap records={records || []} />
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">상세 기록</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">기사명</th>
                    <th className="text-left py-2 px-3 font-medium">구분</th>
                    <th className="text-left py-2 px-3 font-medium">일시</th>
                    <th className="text-right py-2 px-3 font-medium">위도</th>
                    <th className="text-right py-2 px-3 font-medium">경도</th>
                    <th className="text-right py-2 px-3 font-medium">정확도</th>
                  </tr>
                </thead>
                <tbody>
                  {records && records.length > 0 ? (
                    records.map((r) => (
                      <tr key={r.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: TECH_COLORS[r.technician_name] || "#6b7280" }}
                            />
                            {r.technician_name}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={r.action === "출근" ? "default" : "secondary"}>
                            {r.action === "출근" ? (
                              <><LogIn className="h-3 w-3 mr-1" />출근</>
                            ) : (
                              <><LogOut className="h-3 w-3 mr-1" />퇴근</>
                            )}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 font-mono text-xs">{formatDateTime(r.created_at)}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{r.latitude.toFixed(5)}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">{r.longitude.toFixed(5)}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs">
                          {r.accuracy ? `±${Math.round(r.accuracy)}m` : "-"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        해당 조건에 맞는 기록이 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
