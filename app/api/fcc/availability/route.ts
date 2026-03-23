import { NextRequest, NextResponse } from "next/server";

const FCC_BASE = "https://broadbandmap.fcc.gov/api/public/map";

export interface FCCProvider {
  brand_name: string;
  technology: number;
  max_advertised_download_speed: number;
  max_advertised_upload_speed: number;
  low_latency: boolean;
  business_residential_code: string;
}

export interface FCCAvailabilityResult {
  lat: number;
  lng: number;
  providers: FCCProvider[];
  att_available: boolean;
  att_max_down: number | null;
  att_max_up: number | null;
  competitors: string[];
  max_down_mbps: number | null;
  max_up_mbps: number | null;
  tech_codes: string[];
}

// Technology code → human-readable label
const TECH_LABELS: Record<number, string> = {
  10: "DSL",
  11: "ADSL2+",
  12: "VDSL",
  40: "Cable",
  41: "Cable (DOCSIS 3.1)",
  50: "Fiber",
  60: "Satellite",
  61: "LBF Satellite",
  70: "LTE",
  300: "LTE",
  301: "5G-NR",
  0: "Other",
};

// AT&T brand name patterns
const ATT_PATTERNS = ["at&t", "att ", "at & t", "southwestern bell", "u-verse", "att internet"];

function isATT(brand: string): boolean {
  const lower = brand.toLowerCase();
  return ATT_PATTERNS.some((p) => lower.includes(p));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);

  if (isNaN(latNum) || isNaN(lngNum)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  try {
    const url = new URL(`${FCC_BASE}/listAvailability`);
    url.searchParams.set("latitude", latNum.toFixed(6));
    url.searchParams.set("longitude", lngNum.toFixed(6));
    url.searchParams.set("unit", "location");
    url.searchParams.set("category", "all");
    url.searchParams.set("limit", "25");
    url.searchParams.set("offset", "0");

    const res = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Rouxte/1.0",
      },
      next: { revalidate: 86400 }, // cache FCC results for 24h
    });

    if (!res.ok) {
      // FCC API returned an error — return empty availability
      return NextResponse.json(buildEmpty(latNum, lngNum));
    }

    const json = await res.json();
    const providers: FCCProvider[] = json?.availability ?? json?.results ?? [];

    const attProviders = providers.filter((p) => isATT(p.brand_name));
    const attAvailable = attProviders.length > 0;
    const attMaxDown = attProviders.length
      ? Math.max(...attProviders.map((p) => p.max_advertised_download_speed))
      : null;
    const attMaxUp = attProviders.length
      ? Math.max(...attProviders.map((p) => p.max_advertised_upload_speed))
      : null;

    const allMaxDown = providers.length
      ? Math.max(...providers.map((p) => p.max_advertised_download_speed))
      : null;
    const allMaxUp = providers.length
      ? Math.max(...providers.map((p) => p.max_advertised_upload_speed))
      : null;

    const competitors = [
      ...new Set(
        providers
          .filter((p) => !isATT(p.brand_name))
          .map((p) => p.brand_name)
      ),
    ].slice(0, 5);

    const techCodes = [
      ...new Set(providers.map((p) => TECH_LABELS[p.technology] ?? String(p.technology))),
    ];

    const result: FCCAvailabilityResult = {
      lat: latNum,
      lng: lngNum,
      providers,
      att_available: attAvailable,
      att_max_down: attMaxDown,
      att_max_up: attMaxUp,
      competitors,
      max_down_mbps: allMaxDown,
      max_up_mbps: allMaxUp,
      tech_codes: techCodes,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(buildEmpty(latNum, lngNum));
  }
}

function buildEmpty(lat: number, lng: number): FCCAvailabilityResult {
  return {
    lat,
    lng,
    providers: [],
    att_available: false,
    att_max_down: null,
    att_max_up: null,
    competitors: [],
    max_down_mbps: null,
    max_up_mbps: null,
    tech_codes: [],
  };
}
