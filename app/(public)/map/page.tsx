"use client";

import dynamic from "next/dynamic";

const MapClient = dynamic(() => import("./map-client"), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-900">
      <div className="text-white text-lg font-medium">Loading map\u2026</div>
    </div>
  ),
});

export default function MapPage() {
  return <MapClient />;
}
