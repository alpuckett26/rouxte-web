"use client";

import { useEffect, useRef, useState } from "react";

/* ════════════════════════════════════════════════════════════════════════ */
/*  Counter — counts up from 0 → `to` when scrolled into view               */
/* ════════════════════════════════════════════════════════════════════════ */
export function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const duration = 1400; // ms
          const animate = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
            setVal(Math.round(to * eased));
            if (t < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);

  return <span ref={ref}>{val}{suffix}</span>;
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  GlowCard — cursor-tracking spotlight + 3D tilt + scroll fade-up         */
/* ════════════════════════════════════════════════════════════════════════ */
export function GlowCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          setTimeout(() => setVisible(true), delay);
          io.disconnect();
        }
      }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--glow-x", `${x}%`);
    el.style.setProperty("--glow-y", `${y}%`);

    // 3D tilt
    const tiltX = (y - 50) / 18; // up to ~2.8deg
    const tiltY = (x - 50) / -18;
    el.style.setProperty("--rx", `${tiltX}deg`);
    el.style.setProperty("--ry", `${tiltY}deg`);
  }

  function onMouseLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        transform: "perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))",
        transition: "transform 200ms ease-out, opacity 700ms ease-out, translate 700ms ease-out",
        opacity: visible ? 1 : 0,
        translate: visible ? "0 0" : "0 28px",
      }}
      className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.015] p-6 backdrop-blur-sm overflow-hidden will-change-transform"
    >
      {/* Cursor spotlight glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            "radial-gradient(450px circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(56, 189, 248, 0.16), transparent 40%)",
        }}
      />

      {/* Animated border on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
           style={{
             background:
               "linear-gradient(120deg, transparent 30%, rgba(99,102,241,0.35), transparent 70%)",
             mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
             maskComposite: "exclude",
             WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
             WebkitMaskComposite: "xor",
             padding: "1px",
             borderRadius: "1rem",
           }}
      />

      <div className="relative">{children}</div>
    </div>
  );
}

