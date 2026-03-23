"use client";

interface FCCProvider {
  brand_name: string;
  technology: number;
  max_advertised_download_speed: number;
  max_advertised_upload_speed: number;
}

interface Info {
  lat: number;
  lng: number;
  address?: string;
  fccData?: {
    att_available: boolean;
    att_max_down: number | null;
    att_max_up: number | null;
    competitors: string[];
    max_down_mbps: number | null;
    max_up_mbps: number | null;
    tech_codes: string[];
    providers: FCCProvider[];
  } | null;
}

interface Props {
  info: Info;
  onClose: () => void;
  onCaptureLeadClick: () => void;
}

export default function FCCPopup({ info, onClose, onCaptureLeadClick }: Props) {
  const fcc = info.fccData;
  const hasData = fcc && fcc.providers.length > 0;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[340px] max-w-[calc(100vw-2rem)]">
      <div className="rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 mb-0.5">FCC Broadband Check</p>
            <p className="text-sm font-medium text-gray-900 truncate">
              {info.address ?? `${info.lat.toFixed(5)}, ${info.lng.toFixed(5)}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* FCC data */}
        <div className="px-4 py-3">
          {!hasData ? (
            <p className="text-sm text-gray-400 text-center py-2">
              No FCC broadband data at this location.
            </p>
          ) : (
            <>
              {/* AT&T availability banner */}
              <div className={`rounded-xl px-3 py-2 mb-3 flex items-center gap-2 ${
                fcc.att_available
                  ? "bg-green-50 border border-green-200"
                  : "bg-gray-50 border border-gray-200"
              }`}>
                <span className={`text-lg ${fcc.att_available ? "text-green-600" : "text-gray-400"}`}>
                  {fcc.att_available ? "✓" : "✗"}
                </span>
                <div>
                  <p className={`text-sm font-semibold ${fcc.att_available ? "text-green-700" : "text-gray-600"}`}>
                    AT&T {fcc.att_available ? "Available" : "Not Available"}
                  </p>
                  {fcc.att_available && fcc.att_max_down && (
                    <p className="text-xs text-green-600">
                      Up to {fcc.att_max_down} Mbps down / {fcc.att_max_up} Mbps up
                    </p>
                  )}
                </div>
              </div>

              {/* Speed & tech */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <p className="text-xs text-gray-500">Best Speed</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {fcc.max_down_mbps ? `${fcc.max_down_mbps} Mbps` : "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2">
                  <p className="text-xs text-gray-500">Technology</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {fcc.tech_codes.slice(0, 2).join(", ") || "—"}
                  </p>
                </div>
              </div>

              {/* Providers */}
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1.5">
                  {fcc.providers.length} provider{fcc.providers.length !== 1 ? "s" : ""} at this location
                </p>
                <div className="flex flex-wrap gap-1">
                  {fcc.providers.slice(0, 6).map((p, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                    >
                      {p.brand_name}
                    </span>
                  ))}
                  {fcc.providers.length > 6 && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      +{fcc.providers.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={onCaptureLeadClick}
            className="flex-1 rounded-xl bg-blue-600 text-white py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Capture Lead Here
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 text-gray-600 px-3 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
