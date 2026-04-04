"use client";

import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import { QRCode as QRCodeType } from "@/lib/types";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

const ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "";

function optOutUrl(code: string) {
  return `${ORIGIN}/optout/${code}`;
}

function QRImage({ code }: { code: string }) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(optOutUrl(code), { width: 200, margin: 1 }).then(setDataUrl);
  }, [code]);

  if (!dataUrl) return <div className="w-[72px] h-[72px] bg-gray-100 rounded animate-pulse" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dataUrl} alt={`QR for ${code}`} className="w-[72px] h-[72px] rounded" />
  );
}

export default function CompliancePanel() {
  const [qrCodes, setQrCodes] = useState<QRCodeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/qr-codes");
      const d = await res.json();
      setQrCodes(d.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/qr-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign: campaign.trim() || null }),
      });
      if (res.ok) {
        setCampaign("");
        setModalOpen(false);
        await fetchCodes();
      }
    } finally {
      setCreating(false);
    }
  }

  function copyUrl(code: string) {
    navigator.clipboard.writeText(optOutUrl(code));
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  async function downloadQR(code: string, label: string) {
    const dataUrl = await QRCode.toDataURL(optOutUrl(code), { width: 400, margin: 2 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `optout-qr-${label || code}.png`;
    a.click();
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Compliance — Opt-Out QR Codes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Print these QR codes and leave them at doors. Homeowners scan to opt out of visits.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>New QR Code</Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : qrCodes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
          <p className="text-sm text-gray-500 mb-3">No QR codes yet. Create one to get started.</p>
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Create your first QR code
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {qrCodes.map((qr) => (
            <div
              key={qr.id}
              className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white shadow-sm p-4"
            >
              <QRImage code={qr.code} />

              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">
                  {qr.campaign ?? "General opt-out"}
                </p>
                <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">
                  {optOutUrl(qr.code)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Created {new Date(qr.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => copyUrl(qr.code)}
                  className="rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors"
                >
                  {copied === qr.code ? "Copied!" : "Copy URL"}
                </button>
                <button
                  onClick={() => downloadQR(qr.code, qr.campaign ?? "")}
                  className="rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors"
                >
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New QR Code">
        <div className="flex flex-col gap-4">
          <Input
            label="Campaign / Label (optional)"
            value={campaign}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCampaign(e.target.value)}
            placeholder="e.g. Summer canvass — North Austin"
          />
          <p className="text-xs text-gray-400">
            A unique opt-out URL will be generated. Leave blank for a general code.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={creating} onClick={handleCreate}>Generate</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
