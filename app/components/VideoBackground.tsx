"use client";

import { useEffect, useRef, useState } from "react";

const VIDEOS = [
  "/videos/field-sales.mp4",
  "/videos/celebration.mp4",
];

const DISPLAY_DURATION = 8000; // ms each video shows
const FADE_DURATION = 1200;    // ms crossfade

export default function VideoBackground() {
  const [current, setCurrent] = useState(0);
  const [fading, setFading] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Preload and play all videos (muted, so autoplay works)
    videoRefs.current.forEach((v) => {
      if (v) {
        v.muted = true;
        v.play().catch(() => {});
      }
    });

    function cycle() {
      setFading(true);
      timerRef.current = setTimeout(() => {
        setCurrent((prev) => (prev + 1) % VIDEOS.length);
        setFading(false);
        timerRef.current = setTimeout(cycle, DISPLAY_DURATION);
      }, FADE_DURATION);
    }

    timerRef.current = setTimeout(cycle, DISPLAY_DURATION);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {VIDEOS.map((src, i) => (
        <video
          key={src}
          ref={(el) => { videoRefs.current[i] = el; }}
          src={src}
          loop
          muted
          playsInline
          autoPlay
          className="absolute inset-0 h-full w-full object-cover transition-opacity"
          style={{
            opacity: i === current ? (fading ? 0 : 1) : (i === (current + 1) % VIDEOS.length && fading ? 1 : 0),
            transitionDuration: `${FADE_DURATION}ms`,
          }}
        />
      ))}

      {/* Dark gradient overlay — keeps text readable */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1e]/70 via-[#0a0f1e]/50 to-[#0a0f1e]/80" />
      {/* Subtle vignette edges */}
      <div className="absolute inset-0 bg-radial-gradient" style={{
        background: "radial-gradient(ellipse at center, transparent 40%, #0a0f1e 100%)"
      }} />
    </div>
  );
}
