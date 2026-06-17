import { useEffect, useRef } from "react";
import { scrollToSection } from "../utils/scroll.js";

export function Hero({ onNavigate }) {
  // CTA utama masuk ke aplikasi (/generate); CTA sekunder menggulir ke "Cara Kerja".
  const goRegister = () => (onNavigate ? onNavigate("generate") : scrollToSection("how-it-works"));
  const goLearn = () => scrollToSection("how-it-works");

  const videoRef = useRef(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Hormati prefers-reduced-motion: hentikan loop, biarkan poster diam.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      v.removeAttribute("autoplay");
      v.pause();
      return;
    }
    // Hemat kuota di HP: pakai versi 720p yang jauh lebih ringan.
    if (window.matchMedia("(max-width: 767px)").matches) {
      const source = v.querySelector("source");
      if (source && !source.src.includes("720")) {
        source.src = "/hero-cook-720.mp4";
        v.load();
        v.play().catch(() => {});
      }
    }
  }, []);

  return (
    <section className="relative isolate overflow-hidden hero-gradient pt-12 pb-16 md:pt-20 md:pb-32 md:min-h-[600px] flex items-center">
      {/* ---- Latar: video looping (poster sbagai fallback awal & reduced-motion) ---- */}
      <div className="absolute inset-0 -z-10">
        <video
          ref={videoRef}
          className="h-full w-full object-cover object-right"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/hero-poster.jpg"
          aria-hidden="true"
          tabIndex={-1}
        >
          <source src="/hero-cook.mp4" type="video/mp4" />
        </video>
        {/* Scrim agar teks di kiri tetap terbaca di atas video bergerak */}
        <div className="absolute inset-0 bg-gradient-to-r from-canvas-white via-canvas-white/85 to-transparent md:via-canvas-white/75"></div>
        <div className="absolute inset-0 bg-canvas-white/35 md:bg-transparent"></div>
      </div>

      {/* ---- Konten ---- */}
      <div className="relative z-10 w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
        <div className="max-w-xl space-y-6 md:space-y-8">
          <span className="inline-block px-4 py-1.5 bg-secondary-container text-on-secondary-container rounded-full font-label-sm text-label-sm uppercase tracking-wider font-semibold">
            Dapur Cerdas Dimulai di Sini
          </span>
          <h1 className="font-headline-xl text-headline-xl text-primary leading-tight">
            Plan It, Cook It, Waste Nothing.
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg">
            Susun menu mingguanmu, dapatkan daftar belanja otomatis, dan kurangi food waste mulai dari sekarang.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              onClick={goRegister}
              className="px-6 py-3 md:px-8 md:py-4 bg-primary text-on-primary rounded-full font-label-md text-label-md hover:shadow-lg active:scale-[0.98] transition cursor-pointer font-semibold"
            >
              Mulai Sekarang
            </button>
            <button
              onClick={goLearn}
              className="px-6 py-3 md:px-8 md:py-4 border-2 border-primary text-primary rounded-full font-label-md text-label-md hover:bg-primary/5 active:scale-[0.98] transition cursor-pointer font-semibold backdrop-blur-sm"
            >
              Pelajari Cara Kerja
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
