/**
 * Aircraft type icon mapping and canvas-rendered icon generation.
 *
 * Uses the ICAO ADS-B emitter category codes from readsb:
 * - A0: No info
 * - A1: Light (< 15,500 lbs)
 * - A2: Small (15,500 - 75,000 lbs)
 * - A3: Large (75,000 - 300,000 lbs)
 * - A4: High vortex large (e.g. B757)
 * - A5: Heavy (> 300,000 lbs)
 * - A6: High performance (> 5g, > 400 kts)
 * - A7: Rotorcraft (helicopter)
 * - B0: No info
 * - B1: Glider/sailplane
 * - B2: Lighter-than-air
 * - B3: Skydiver
 * - B4: Ultralight/hang-glider/paraglider
 * - B5: Reserved
 * - B6: UAV
 * - B7: Space vehicle
 * - C1: Emergency vehicle
 * - C2: Service vehicle
 * - C3: Point obstacle
 */

export type AircraftIconType =
  | "jet"
  | "turboprop"
  | "helicopter"
  | "light"
  | "generic";

/**
 * Map readsb category code to an icon type.
 */
export function getIconTypeFromCategory(
  category: string | null
): AircraftIconType {
  if (!category) return "generic";

  switch (category) {
    // Heavy jets, large aircraft, high performance
    case "A3":
    case "A4":
    case "A5":
    case "A6":
      return "jet";

    // Medium/small aircraft (often turboprop)
    case "A2":
      return "turboprop";

    // Rotorcraft
    case "A7":
      return "helicopter";

    // Light aircraft
    case "A1":
    case "B1": // Glider
    case "B4": // Ultralight
      return "light";

    // Everything else: generic
    default:
      return "generic";
  }
}

/** All icon type names for registration */
export const AIRCRAFT_ICON_TYPES: AircraftIconType[] = [
  "jet",
  "turboprop",
  "helicopter",
  "light",
  "generic",
];

/**
 * Get the Mapbox image name for an icon type.
 */
export function getIconImageName(iconType: AircraftIconType): string {
  return `aircraft-${iconType}`;
}

/**
 * Draw a jet aircraft silhouette (swept wings, pointed nose).
 * Oriented pointing UP (north) at 0 degrees rotation.
 */
function drawJetIcon(ctx: CanvasRenderingContext2D, size: number) {
  const cx = size / 2;

  ctx.beginPath();
  // Nose (top point)
  ctx.moveTo(cx, 3);
  // Right fuselage to wing root
  ctx.lineTo(cx + 3, size * 0.3);
  // Right wing tip (swept back)
  ctx.lineTo(size - 4, size * 0.55);
  // Right wing trailing edge
  ctx.lineTo(cx + 4, size * 0.6);
  // Right body to tail
  ctx.lineTo(cx + 3, size * 0.78);
  // Right horizontal stabilizer
  ctx.lineTo(cx + 12, size * 0.88);
  // Right tail trailing edge
  ctx.lineTo(cx + 3, size * 0.9);
  // Tail point
  ctx.lineTo(cx, size - 4);
  // Left tail trailing edge
  ctx.lineTo(cx - 3, size * 0.9);
  // Left horizontal stabilizer
  ctx.lineTo(cx - 12, size * 0.88);
  // Left body from tail
  ctx.lineTo(cx - 3, size * 0.78);
  // Left wing trailing edge
  ctx.lineTo(cx - 4, size * 0.6);
  // Left wing tip (swept back)
  ctx.lineTo(4, size * 0.55);
  // Left fuselage from wing root
  ctx.lineTo(cx - 3, size * 0.3);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw a turboprop/propeller aircraft silhouette (straight wings, blunt nose).
 * Oriented pointing UP (north) at 0 degrees rotation.
 */
function drawTurbopropIcon(ctx: CanvasRenderingContext2D, size: number) {
  const cx = size / 2;

  ctx.beginPath();
  // Blunt nose (rounded top)
  ctx.moveTo(cx, 5);
  ctx.lineTo(cx + 3, 8);
  // Right fuselage to wing
  ctx.lineTo(cx + 3, size * 0.35);
  // Right wing tip (straight, not swept)
  ctx.lineTo(size - 3, size * 0.42);
  // Right wing trailing edge
  ctx.lineTo(size - 3, size * 0.48);
  // Right wing root trailing edge
  ctx.lineTo(cx + 4, size * 0.5);
  // Right body to tail
  ctx.lineTo(cx + 2.5, size * 0.78);
  // Right horizontal stabilizer
  ctx.lineTo(cx + 11, size * 0.85);
  // Right tail trailing edge
  ctx.lineTo(cx + 11, size * 0.9);
  // Right tail root
  ctx.lineTo(cx + 2.5, size * 0.88);
  // Tail
  ctx.lineTo(cx, size - 4);
  // Left tail root
  ctx.lineTo(cx - 2.5, size * 0.88);
  // Left tail trailing edge
  ctx.lineTo(cx - 11, size * 0.9);
  // Left horizontal stabilizer
  ctx.lineTo(cx - 11, size * 0.85);
  // Left body from tail
  ctx.lineTo(cx - 2.5, size * 0.78);
  // Left wing root trailing edge
  ctx.lineTo(cx - 4, size * 0.5);
  // Left wing trailing edge
  ctx.lineTo(3, size * 0.48);
  // Left wing tip
  ctx.lineTo(3, size * 0.42);
  // Left fuselage from wing
  ctx.lineTo(cx - 3, size * 0.35);
  // Left fuselage to nose
  ctx.lineTo(cx - 3, 8);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw a helicopter silhouette (round body, tail boom, rotor disk).
 * Oriented pointing UP (north) at 0 degrees rotation.
 */
function drawHelicopterIcon(ctx: CanvasRenderingContext2D, size: number) {
  const cx = size / 2;

  // Main rotor disk (circle)
  ctx.beginPath();
  ctx.arc(cx, size * 0.38, size * 0.32, 0, Math.PI * 2);
  ctx.fill();

  // Fuselage body (elongated ellipse)
  ctx.beginPath();
  ctx.ellipse(cx, size * 0.42, 6, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail boom
  ctx.beginPath();
  ctx.moveTo(cx - 2, size * 0.52);
  ctx.lineTo(cx + 2, size * 0.52);
  ctx.lineTo(cx + 1.5, size * 0.85);
  ctx.lineTo(cx - 1.5, size * 0.85);
  ctx.closePath();
  ctx.fill();

  // Tail rotor (small horizontal bar)
  ctx.beginPath();
  ctx.moveTo(cx - 7, size * 0.84);
  ctx.lineTo(cx + 7, size * 0.84);
  ctx.lineTo(cx + 7, size * 0.88);
  ctx.lineTo(cx - 7, size * 0.88);
  ctx.closePath();
  ctx.fill();

  // Tail fin (small vertical)
  ctx.beginPath();
  ctx.moveTo(cx - 1, size * 0.85);
  ctx.lineTo(cx + 1, size * 0.85);
  ctx.lineTo(cx + 1, size - 3);
  ctx.lineTo(cx - 1, size - 3);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw a light aircraft silhouette (high aspect ratio wings, compact body).
 * Oriented pointing UP (north) at 0 degrees rotation.
 */
function drawLightIcon(ctx: CanvasRenderingContext2D, size: number) {
  const cx = size / 2;

  ctx.beginPath();
  // Nose
  ctx.moveTo(cx, 6);
  // Right fuselage
  ctx.lineTo(cx + 2.5, 10);
  ctx.lineTo(cx + 2.5, size * 0.38);
  // Right wing (high aspect ratio, straight)
  ctx.lineTo(size - 4, size * 0.42);
  ctx.lineTo(size - 4, size * 0.47);
  ctx.lineTo(cx + 3, size * 0.46);
  // Right body continues
  ctx.lineTo(cx + 2, size * 0.76);
  // Right stabilizer
  ctx.lineTo(cx + 9, size * 0.83);
  ctx.lineTo(cx + 9, size * 0.87);
  ctx.lineTo(cx + 2, size * 0.86);
  // Tail
  ctx.lineTo(cx, size - 4);
  // Left stabilizer
  ctx.lineTo(cx - 2, size * 0.86);
  ctx.lineTo(cx - 9, size * 0.87);
  ctx.lineTo(cx - 9, size * 0.83);
  ctx.lineTo(cx - 2, size * 0.76);
  // Left body
  ctx.lineTo(cx - 3, size * 0.46);
  // Left wing
  ctx.lineTo(4, size * 0.47);
  ctx.lineTo(4, size * 0.42);
  ctx.lineTo(cx - 2.5, size * 0.38);
  // Left fuselage
  ctx.lineTo(cx - 2.5, 10);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw a generic aircraft silhouette (diamond/arrow shape).
 * This is the fallback icon for unknown categories.
 * Oriented pointing UP (north) at 0 degrees rotation.
 */
function drawGenericIcon(ctx: CanvasRenderingContext2D, size: number) {
  const cx = size / 2;

  ctx.beginPath();
  // Arrow/chevron shape pointing up
  ctx.moveTo(cx, 4);
  ctx.lineTo(size - 8, size - 8);
  ctx.lineTo(cx, size - 14);
  ctx.lineTo(8, size - 8);
  ctx.closePath();
  ctx.fill();
}

/** Draw function lookup */
const DRAW_FUNCTIONS: Record<
  AircraftIconType,
  (ctx: CanvasRenderingContext2D, size: number) => void
> = {
  jet: drawJetIcon,
  turboprop: drawTurbopropIcon,
  helicopter: drawHelicopterIcon,
  light: drawLightIcon,
  generic: drawGenericIcon,
};

/**
 * Render an aircraft icon to a canvas ImageData suitable for Mapbox addImage().
 * Uses SDF (signed distance field) rendering for dynamic coloring.
 *
 * @param iconType - The type of aircraft icon to draw
 * @param size - Canvas size in pixels (icons are square)
 * @returns ImageData to pass to map.addImage()
 */
export function renderAircraftIcon(
  iconType: AircraftIconType,
  size: number = 48
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas 2d context");
  }

  ctx.fillStyle = "#ffffff";
  DRAW_FUNCTIONS[iconType](ctx, size);

  return ctx.getImageData(0, 0, size, size);
}
