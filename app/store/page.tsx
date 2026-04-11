"use client";

import Link from "next/link";

interface Product {
  key: string;
  title: string;
  description: string;
  price_from: string;
  badge?: string;
  href?: string;
  coming_soon?: boolean;
  icon: string;
  color: string;       // tailwind gradient classes
}

const PRODUCTS: Product[] = [
  {
    key: "badge",
    title: "ID Badge",
    description: "Professional field rep ID card with your photo, name, title, and company branding. Fits any standard lanyard badge holder.",
    price_from: "From $7.99",
    href: "/store/badge",
    icon: "🪪",
    color: "from-blue-600/20 to-blue-900/10",
    badge: "Available now",
  },
  {
    key: "business_card",
    title: "Business Cards",
    description: "Branded business cards for reps — include your name, phone, QR code, and org logo.",
    price_from: "From $14.99 / 50ct",
    icon: "💼",
    color: "from-violet-600/20 to-violet-900/10",
    coming_soon: true,
  },
  {
    key: "door_hanger",
    title: "Door Hangers",
    description: "Custom door hangers to leave at homes after a knock — logo, offer, QR code, and rep contact info.",
    price_from: "From $39 / 100ct",
    icon: "🚪",
    color: "from-amber-600/20 to-amber-900/10",
    coming_soon: true,
  },
  {
    key: "vehicle_magnet",
    title: "Vehicle Magnets",
    description: "Branded door magnets for rep vehicles. Great for driving neighborhoods during canvas campaigns.",
    price_from: "From $29.99 / pair",
    icon: "🚗",
    color: "from-teal-600/20 to-teal-900/10",
    coming_soon: true,
  },
  {
    key: "yard_sign",
    title: "Yard Signs",
    description: "Leave-behind yard signs for customers who signed up. Social proof for the whole street.",
    price_from: "From $12 each",
    icon: "📍",
    color: "from-green-600/20 to-green-900/10",
    coming_soon: true,
  },
  {
    key: "team_gear",
    title: "Team Gear",
    description: "Branded T-shirts, hoodies, and hats for your sales team. Bulk pricing available.",
    price_from: "From $22 / shirt",
    icon: "👕",
    color: "from-rose-600/20 to-rose-900/10",
    coming_soon: true,
  },
];

export default function StorePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-mono text-blue-400 tracking-widest uppercase mb-1">Rouxte</p>
          <h1 className="text-4xl font-bold">Field Rep Store</h1>
          <p className="text-slate-400 mt-2 max-w-xl">
            Professional gear, printed materials, and branded tools designed for door-to-door sales teams.
            Everything ships directly to you or your org.
          </p>
        </div>

        {/* Product grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {PRODUCTS.map(p => (
            <div
              key={p.key}
              className={`relative rounded-2xl border bg-gradient-to-br p-6 flex flex-col ${p.color} ${
                p.coming_soon
                  ? "border-slate-800 opacity-70"
                  : "border-slate-700 hover:border-slate-500 transition-all hover:scale-[1.01]"
              }`}
            >
              {p.badge && (
                <span className="absolute top-4 right-4 bg-blue-600 text-white text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {p.badge}
                </span>
              )}
              {p.coming_soon && (
                <span className="absolute top-4 right-4 bg-slate-700 text-slate-400 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  Coming soon
                </span>
              )}

              <div className="text-4xl mb-4">{p.icon}</div>
              <h2 className="text-lg font-bold text-white mb-1">{p.title}</h2>
              <p className="text-slate-400 text-sm leading-relaxed flex-1">{p.description}</p>

              <div className="mt-5 flex items-center justify-between">
                <span className="text-blue-300 text-sm font-medium">{p.price_from}</span>
                {p.href && !p.coming_soon ? (
                  <Link
                    href={p.href}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    Order
                  </Link>
                ) : (
                  <button
                    disabled
                    className="bg-slate-700 text-slate-500 text-sm font-medium px-4 py-2 rounded-lg cursor-not-allowed"
                  >
                    {p.coming_soon ? "Soon" : "Order"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-10 text-center text-slate-600 text-xs">
          <p>All print orders fulfilled by our print partners and shipped directly to you.</p>
          <p className="mt-1">Questions? Email <span className="text-slate-400">support@rouxte.com</span></p>
        </div>
      </div>
    </div>
  );
}
