"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { BadgeCanvas, BadgeConfig } from "@/app/components/store/BadgeCanvas";
import { STORE_PRICES } from "@/lib/store-config";

interface MeData {
  full_name: string;
  avatar_url: string | null;
  org_name: string;
  role: string;
}

const ACCENT_COLORS = [
  { label: "Blue",   value: "#2563eb" },
  { label: "Indigo", value: "#4f46e5" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Rose",   value: "#e11d48" },
  { label: "Amber",  value: "#d97706" },
  { label: "Teal",   value: "#0d9488" },
  { label: "Green",  value: "#16a34a" },
];

const PRODUCTS = [
  { key: "badge_digital",    label: "Digital Download",       sub: "Print-ready PDF — instant delivery", price: "$7.99",  icon: "⬇️", physical: false },
  { key: "badge_physical_1", label: "1 Physical Badge",       sub: "Mailed to you, ~5-7 days",           price: "$14.99", icon: "🪪", physical: true  },
  { key: "badge_physical_5", label: "5-Pack Badges",          sub: "Mailed to org address",              price: "$34.99", icon: "📦", physical: true  },
  { key: "badge_org_25",     label: "Org Pack — 25 Badges",   sub: "Bulk order, best per-badge rate",    price: "$119",   icon: "🏢", physical: true  },
] as const;

type ProductKey = (typeof PRODUCTS)[number]["key"];

const EMPTY_ADDR = { name: "", address1: "", address2: "", city: "", state: "", zip: "", country: "US", email: "" };

export default function BadgePage() {
  const [me, setMe]           = useState<MeData | null>(null);
  const [config, setConfig]   = useState<BadgeConfig>({
    full_name: "",
    title: "Sales Representative",
    org_name: "",
    avatar_url: null,
    accent_color: "#2563eb",
    bg_color: "#0f172a",
    badge_number: "",
  });
  const [product, setProduct] = useState<ProductKey>("badge_digital");
  const [address, setAddress] = useState(EMPTY_ADDR);
  const [loading, setLoading] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [cancelMsg, setCancelMsg] = useState(false);

  const isPhysical = PRODUCTS.find(p => p.key === product)?.physical ?? false;

  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then(({ data }) => {
      if (!data) return;
      setMe(data);
      setConfig(c => ({
        ...c,
        full_name:  data.full_name ?? "",
        org_name:   data.org_name  ?? "",
        avatar_url: data.avatar_url ?? null,
        title: roleTitle(data.role),
      }));
      setAddress(a => ({ ...a, name: data.full_name ?? "" }));
    });
    if (new URLSearchParams(window.location.search).get("cancelled")) setCancelMsg(true);
  }, []);

  const handleImageReady = useCallback((url: string) => setImageDataUrl(url), []);

  async function handleOrder() {
    if (!imageDataUrl) return;
    setLoading(true);
    try {
      // Upload the badge PNG so Printful can fetch it (for physical orders)
      // For digital, we use a data URL trigger — upload to Supabase Storage
      const res = await fetch("/api/store/badge/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_data_url: imageDataUrl }),
      });
      const { url: printUrl } = await res.json();

      const body = {
        product_key:    product,
        badge_config:   { ...config, print_url: printUrl },
        shipping_address: isPhysical ? address : undefined,
        quantity: 1,
      };

      const orderRes = await fetch("/api/store/badge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const { checkout_url } = await orderRes.json();
      if (checkout_url) window.location.href = checkout_url;
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function downloadPdf() {
    if (!imageDataUrl) return;
    const a    = document.createElement("a");
    a.href     = imageDataUrl;
    a.download = `${config.full_name.replace(/\s+/g, "_")}_badge.png`;
    a.click();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-1">Rouxte Store</p>
          <h1 className="text-3xl font-bold">ID Badge Designer</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Create a professional field rep ID badge. Download or order physical cards.
          </p>
        </div>

        {cancelMsg && (
          <div className="mb-6 bg-red-900/30 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
            Order was cancelled — no charge was made.
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_380px] gap-8">

          {/* ── Left: Preview ── */}
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Badge Preview</p>
              <div className="flex justify-center overflow-x-auto">
                <BadgeCanvas config={config} onImageReady={handleImageReady} scale={0.48} />
              </div>
              <p className="text-center text-xs text-slate-600 mt-3">
                CR80 badge card (3.5" × 2.1") — fits standard lanyard badge holders
              </p>
            </div>

            {/* Customization */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 space-y-4">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Customize</p>

              <Field label="Full Name">
                <input
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  value={config.full_name}
                  onChange={e => setConfig(c => ({ ...c, full_name: e.target.value }))}
                />
              </Field>

              <Field label="Title / Role">
                <input
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  value={config.title}
                  onChange={e => setConfig(c => ({ ...c, title: e.target.value }))}
                />
              </Field>

              <Field label="Organization">
                <input
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  value={config.org_name}
                  onChange={e => setConfig(c => ({ ...c, org_name: e.target.value }))}
                />
              </Field>

              <Field label="Badge Number (optional)">
                <input
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g. 0042"
                  value={config.badge_number ?? ""}
                  onChange={e => setConfig(c => ({ ...c, badge_number: e.target.value }))}
                />
              </Field>

              <Field label="Photo URL (or upload avatar in Settings)">
                <input
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="https://..."
                  value={config.avatar_url ?? ""}
                  onChange={e => setConfig(c => ({ ...c, avatar_url: e.target.value || null }))}
                />
              </Field>

              <Field label="Accent Color">
                <div className="flex gap-2 flex-wrap">
                  {ACCENT_COLORS.map(ac => (
                    <button
                      key={ac.value}
                      title={ac.label}
                      onClick={() => setConfig(c => ({ ...c, accent_color: ac.value }))}
                      className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: ac.value,
                        borderColor: config.accent_color === ac.value ? "#fff" : "transparent",
                      }}
                    />
                  ))}
                </div>
              </Field>
            </div>
          </div>

          {/* ── Right: Order panel ── */}
          <div className="space-y-4">

            {/* Product selector */}
            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">Choose Option</p>
              <div className="space-y-2">
                {PRODUCTS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setProduct(p.key)}
                    className={`w-full text-left rounded-xl px-4 py-3 border transition-all ${
                      product === p.key
                        ? "bg-blue-600/20 border-blue-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{p.icon}</span>
                        <div>
                          <div className="font-medium text-sm">{p.label}</div>
                          <div className="text-xs text-slate-400">{p.sub}</div>
                        </div>
                      </div>
                      <span className="font-bold text-sm text-blue-300">{p.price}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Shipping address (physical only) */}
            {isPhysical && (
              <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 space-y-3">
                <p className="text-xs text-slate-500 uppercase tracking-widest">Shipping Address</p>
                {(["name", "address1", "address2", "city", "state", "zip", "email"] as const).map(field => (
                  <input
                    key={field}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder={fieldPlaceholder(field)}
                    value={address[field]}
                    onChange={e => setAddress(a => ({ ...a, [field]: e.target.value }))}
                  />
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={handleOrder}
                disabled={loading || !config.full_name.trim()}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm transition-colors"
              >
                {loading ? "Redirecting to checkout..." : product === "badge_digital"
                  ? "Buy & Download — $7.99"
                  : `Order Now — ${PRODUCTS.find(p => p.key === product)?.price}`}
              </button>

              {product === "badge_digital" && imageDataUrl && (
                <button
                  onClick={downloadPdf}
                  className="w-full py-3 rounded-xl border border-slate-700 text-slate-300 hover:border-slate-500 text-sm transition-colors"
                >
                  Preview Download (watermarked)
                </button>
              )}
            </div>

            {/* Trust / info */}
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 text-xs text-slate-400 space-y-1">
              <div className="flex gap-2"><span>🔒</span><span>Secure checkout via Stripe</span></div>
              <div className="flex gap-2"><span>🖨️</span><span>Physical badges printed on CR80 PVC card stock</span></div>
              <div className="flex gap-2"><span>📬</span><span>Mailed USPS First Class (5-7 business days)</span></div>
              <div className="flex gap-2"><span>↩️</span><span>Unhappy? Email support@rouxte.com within 14 days</span></div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function roleTitle(role: string) {
  const map: Record<string, string> = {
    sales_rep:     "Sales Representative",
    team_lead:     "Team Lead",
    sales_manager: "Sales Manager",
    admin:         "Account Administrator",
  };
  return map[role] ?? "Sales Representative";
}

function fieldPlaceholder(field: string) {
  const m: Record<string, string> = {
    name: "Recipient Name", address1: "Street Address", address2: "Apt / Suite (optional)",
    city: "City", state: "State (e.g. TX)", zip: "ZIP Code", email: "Email (for tracking)",
  };
  return m[field] ?? field;
}
