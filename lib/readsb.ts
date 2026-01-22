// Fetch aircraft data from readsb/tar1090 JSON endpoint

export interface Aircraft {
  hex: string; // ICAO hex address
  type?: string; // Aircraft type (adsb_icao, etc.)
  flight?: string; // Callsign
  r?: string; // Registration
  t?: string; // Aircraft type code
  alt_baro?: number; // Barometric altitude (feet)
  alt_geom?: number; // Geometric altitude (feet)
  gs?: number; // Ground speed (knots)
  track?: number; // Track angle (degrees)
  baro_rate?: number; // Vertical rate (ft/min)
  squawk?: string; // Squawk code
  category?: string; // Aircraft category
  lat?: number; // Latitude
  lon?: number; // Longitude
  seen?: number; // Seconds since last message
  seen_pos?: number; // Seconds since last position
  messages?: number; // Message count
  rssi?: number; // Signal strength
}

export interface AircraftJson {
  now: number;
  messages: number;
  aircraft: Aircraft[];
}

const READSB_JSON_URL =
  process.env.READSB_JSON_URL || "http://localhost:8080/data/aircraft.json";

export async function fetchAircraftData(): Promise<AircraftJson | null> {
  try {
    const response = await fetch(READSB_JSON_URL, {
      next: { revalidate: 1 }, // Revalidate every second
    });

    if (!response.ok) {
      console.error(`Failed to fetch aircraft data: ${response.status}`);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching aircraft data:", error);
    return null;
  }
}

export async function getAircraftCount(): Promise<number> {
  const data = await fetchAircraftData();
  return data?.aircraft?.length ?? 0;
}

export async function getMessageRate(): Promise<number> {
  const data = await fetchAircraftData();
  return data?.messages ?? 0;
}
