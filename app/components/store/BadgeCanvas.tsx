"use client";

import { useEffect, useRef, useCallback } from "react";

export interface BadgeConfig {
  full_name: string;
  title: string;
  org_name: string;
  badge_number?: string;
  avatar_url?: string | null;
  org_logo_url?: string | null;
  accent_color?: string;      // hex, default #2563eb (blue-600)
  bg_color?: string;          // hex, default #0f172a (slate-900)
  qr_url?: string | null;
}

interface Props {
  config: BadgeConfig;
  onImageReady?: (dataUrl: string) => void;
  scale?: number;
}

const W = 1050; // 3.5" × 300dpi
const H = 630;  // 2.1" × 300dpi

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function BadgeCanvas({ config, onImageReady, scale = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { accent_color = "#2563eb", bg_color = "#0f172a" } = config;

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = W;
    canvas.height = H;

    // ── Background ────────────────────────────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, bg_color);
    bgGrad.addColorStop(1, shiftColor(bg_color, 20));
    ctx.fillStyle = bgGrad;
    roundRect(ctx, 0, 0, W, H, 32);
    ctx.fill();

    // ── Accent bar (left side) ────────────────────────────────────────────
    const accentGrad = ctx.createLinearGradient(0, 0, 0, H);
    accentGrad.addColorStop(0, accent_color);
    accentGrad.addColorStop(1, shiftColor(accent_color, -30));
    ctx.fillStyle = accentGrad;
    roundRect(ctx, 0, 0, 12, H, 4);
    ctx.fill();

    // ── Subtle grid texture ───────────────────────────────────────────────
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // ── Avatar circle ─────────────────────────────────────────────────────
    const avatarR = 120;
    const avatarX = 160;
    const avatarY = H / 2;

    // Glowing ring
    ctx.save();
    ctx.shadowColor = accent_color;
    ctx.shadowBlur  = 24;
    ctx.strokeStyle = accent_color;
    ctx.lineWidth   = 4;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Clip for photo
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.clip();

    if (config.avatar_url) {
      try {
        const img = await loadImg(config.avatar_url);
        // Cover-fit into circle
        const s  = (avatarR * 2) / Math.min(img.width, img.height);
        const iw = img.width  * s;
        const ih = img.height * s;
        ctx.drawImage(img, avatarX - iw / 2, avatarY - ih / 2, iw, ih);
      } catch {
        drawLetterAvatar(ctx, config.full_name, avatarX, avatarY, avatarR, accent_color);
      }
    } else {
      drawLetterAvatar(ctx, config.full_name, avatarX, avatarY, avatarR, accent_color);
    }
    ctx.restore();

    // ── Name & title ──────────────────────────────────────────────────────
    const textX = avatarX + avatarR + 50;
    const textMaxW = W - textX - 40;

    ctx.fillStyle = "#ffffff";
    ctx.font      = "bold 64px -apple-system, 'Segoe UI', Arial, sans-serif";
    ctx.textBaseline = "top";

    // Shrink name to fit
    let nameFontSize = 64;
    while (ctx.measureText(config.full_name).width > textMaxW && nameFontSize > 32) {
      nameFontSize -= 2;
      ctx.font = `bold ${nameFontSize}px -apple-system, 'Segoe UI', Arial, sans-serif`;
    }
    ctx.fillText(config.full_name, textX, avatarY - 145);

    // Accent line under name
    const nameWidth = Math.min(ctx.measureText(config.full_name).width, textMaxW);
    const lineGrad  = ctx.createLinearGradient(textX, 0, textX + nameWidth, 0);
    lineGrad.addColorStop(0, accent_color);
    lineGrad.addColorStop(1, "transparent");
    ctx.fillStyle = lineGrad;
    ctx.fillRect(textX, avatarY - 145 + nameFontSize + 8, nameWidth, 3);

    // Title
    ctx.fillStyle = "#94a3b8";
    ctx.font      = `500 36px -apple-system, 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(config.title || "Sales Representative", textX, avatarY - 145 + nameFontSize + 22);

    // Org name
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font      = `400 28px -apple-system, 'Segoe UI', Arial, sans-serif`;
    ctx.fillText(config.org_name, textX, avatarY - 145 + nameFontSize + 72);

    // ── Badge number (bottom right) ───────────────────────────────────────
    if (config.badge_number) {
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.font      = "500 22px monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(`#${config.badge_number}`, W - 32, H - 24);
    }

    // ── Lanyard hole indicator ────────────────────────────────────────────
    ctx.fillStyle   = "rgba(255,255,255,0.15)";
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(W / 2, 22, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const dataUrl = canvas.toDataURL("image/png");
    onImageReady?.(dataUrl);
  }, [config, accent_color, bg_color, onImageReady]);

  useEffect(() => { draw(); }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: W * scale, height: H * scale, borderRadius: 12 }}
    />
  );
}

function drawLetterAvatar(
  ctx: CanvasRenderingContext2D,
  name: string,
  cx: number, cy: number, r: number,
  accent: string
) {
  ctx.fillStyle = shiftColor(accent, -40);
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${r}px -apple-system, 'Segoe UI', Arial, sans-serif`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((name?.[0] ?? "?").toUpperCase(), cx, cy);
}

/** Lighten (+) or darken (−) a hex color by `amount` (0-255). */
function shiftColor(hex: string, amount: number): string {
  const n  = parseInt(hex.replace("#", ""), 16);
  const r  = Math.min(255, Math.max(0, (n >> 16) + amount));
  const g  = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount));
  const b  = Math.min(255, Math.max(0, (n & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
