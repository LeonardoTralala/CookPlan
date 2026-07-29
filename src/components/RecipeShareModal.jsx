import { useState, useRef, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import { ModalSheet } from "./ModalSheet.jsx";
import { usePlan } from "../hooks/usePlan.js";

function drawImageCover(ctx, img, x, y, w, h) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const targetRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > targetRatio) {
    sh = img.naturalHeight;
    sw = sh * targetRatio;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    sw = img.naturalWidth;
    sh = sw / targetRatio;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

export function RecipeShareModal({ recipe, onClose }) {
  const { showToast } = usePlan();
  const canvasRef = useRef(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [generatingCanvas, setGeneratingCanvas] = useState(false);

  const shareUrl = `${window.location.origin}/share/recipe/${recipe.id}`;

  // Generate QR Code untuk canvas & interactive UI
  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(shareUrl, {
      width: 300,
      margin: 1,
      color: {
        dark: "#1B2813",
        light: "#FFFFFF",
      },
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => console.error("Gagal membuat QR Code resep:", err));

    return () => {
      isMounted = false;
    };
  }, [shareUrl]);

  // Render 9:16 Canvas Story Card Generator (1080 x 1920 px)
  const drawCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setGeneratingCanvas(true);

    // 1. Background Fill (#1B2813 theme)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 1920);
    bgGrad.addColorStop(0, "#131E0D");
    bgGrad.addColorStop(0.5, "#1B2813");
    bgGrad.addColorStop(1, "#0D1509");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. Hero Image (Top 55% -> 1056 px) with Vignetting Gradient
    const heroH = 1056;
    if (recipe.imageUrl) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve; // Fallback jika CORS / offline
          img.src = recipe.imageUrl;
        });

        if (img.complete && img.naturalWidth !== 0) {
          drawImageCover(ctx, img, 0, 0, 1080, heroH);
        }
      } catch (err) {
        console.error("Gagal memuat foto resep untuk canvas:", err);
      }
    }

    // Top Vignette gradient for top bar readability
    const topVignette = ctx.createLinearGradient(0, 0, 0, 240);
    topVignette.addColorStop(0, "rgba(13, 21, 9, 0.7)");
    topVignette.addColorStop(1, "rgba(13, 21, 9, 0)");
    ctx.fillStyle = topVignette;
    ctx.fillRect(0, 0, 1080, 240);

    // Hero Dark Vignetting Mask blending seamlessly into #1B2813
    const heroVignette = ctx.createLinearGradient(0, 350, 0, heroH);
    heroVignette.addColorStop(0, "rgba(27, 40, 19, 0)");
    heroVignette.addColorStop(0.65, "rgba(27, 40, 19, 0.85)");
    heroVignette.addColorStop(1, "#1B2813");
    ctx.fillStyle = heroVignette;
    ctx.fillRect(0, 350, 1080, heroH - 350);

    // 3. Floating CookPlan Brand Capsule (Top Left)
    ctx.save();
    const capX = 60;
    const capY = 90;
    const capW = 420;
    const capH = 72;
    const capR = 36;

    ctx.beginPath();
    ctx.fillStyle = "rgba(27, 40, 19, 0.85)";
    ctx.roundRect(capX, capY, capW, capH, capR);
    ctx.fill();
    ctx.strokeStyle = "rgba(142, 217, 54, 0.6)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#8ED936";
    ctx.font = "bold 32px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("CookPlan", capX + 32, capY + 46);

    ctx.fillStyle = "#F7FAF2";
    ctx.font = "bold 26px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("• Resep Spesial", capX + 180, capY + 46);
    ctx.restore();

    // 4. Recipe Title (Plus Jakarta Sans ExtraBold + Drop Shadow)
    ctx.save();
    ctx.fillStyle = "#F7FAF2";
    ctx.font = "800 58px 'Plus Jakarta Sans', sans-serif";
    ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 4;

    const titleText = recipe.title || "Resep Lezat CookPlan";
    const words = titleText.split(" ");
    let line = "";
    let lineY = 880;
    const maxTextW = 960;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxTextW && n > 0) {
        ctx.fillText(line.trim(), 60, lineY);
        line = words[n] + " ";
        lineY += 72;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), 60, lineY);
    ctx.restore();

    // 5. Metadata Pills: Porsi, Waktu Masak, & Tag Bahan Utama
    const pillsY = lineY + 38;
    ctx.save();

    const drawPill = (x, y, w, h, text, textColor, borderColor = "rgba(255, 255, 255, 0.25)") => {
      ctx.beginPath();
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.font = "bold 24px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText(text, x + 24, y + 36);
    };

    // Pill 1: Porsi
    drawPill(60, pillsY, 230, 56, `🍽️ ${recipe.baseServings || 2} Porsi`, "#8ED936");

    // Pill 2: Waktu Masak
    if (recipe.readyInMinutes) {
      drawPill(310, pillsY, 250, 56, `⏱️ ${recipe.readyInMinutes} Menit`, "#F46B2A");
    }

    // Pill 3: Tag Bahan Utama
    const tagX = recipe.readyInMinutes ? 580 : 310;
    const tagW = recipe.readyInMinutes ? 440 : 710;
    const firstIng = recipe.ingredients?.[0]?.name;
    const mainIng = firstIng
      ? (firstIng.length > 18 ? firstIng.slice(0, 18) + "…" : firstIng)
      : "Bahan Pilihan";

    drawPill(tagX, pillsY, tagW, 56, `🥩 ${mainIng}`, "#60A5FA");
    ctx.restore();

    // 6. Ingredients Highlights Bar
    const ingY = pillsY + 95;
    ctx.save();
    ctx.fillStyle = "#AFBAA8";
    ctx.font = "600 22px 'Inter', sans-serif";
    ctx.fillText("BAHAN-BAHAN UTAMA:", 60, ingY);

    const ingList = (recipe.ingredients || []).slice(0, 5).map((i) => i.name).join(" • ");
    ctx.fillStyle = "#F7FAF2";
    ctx.font = "500 26px 'Inter', sans-serif";
    const displayIngList = ingList.length > 60 ? ingList.slice(0, 60) + "…" : ingList;
    ctx.fillText(displayIngList || "Bahan-bahan segar pilihan & bumbu dapur", 60, ingY + 40);
    ctx.restore();

    // 7. Bottom Card dengan QR Code + Teks CTA
    const cardY = 1500;
    const cardH = 260;
    const cardW = 960;
    ctx.save();

    // Card background
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.roundRect(60, cardY, cardW, cardH, 32);
    ctx.fill();
    ctx.strokeStyle = "rgba(142, 217, 54, 0.5)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // CTA Text inside bottom card
    ctx.fillStyle = "#8ED936";
    ctx.font = "bold 36px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("Masak Resep Ini?", 100, cardY + 70);

    ctx.fillStyle = "#F7FAF2";
    ctx.font = "500 24px 'Inter', sans-serif";
    ctx.fillText("Scan QR Code untuk resep lengkap", 100, cardY + 120);

    ctx.fillStyle = "#AFBAA8";
    ctx.fillText("& pesan bahan di CookPlan!", 100, cardY + 160);

    ctx.fillStyle = "#8ED936";
    ctx.font = "bold 22px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("cookplan.app", 100, cardY + 210);

    // QR Code Container & Image on right side
    if (qrDataUrl) {
      try {
        const qrSize = 210;
        const qrBoxX = 730;
        const qrBoxY = cardY + 25;

        // White background box for QR Code high contrast
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.roundRect(qrBoxX - 10, qrBoxY - 10, qrSize + 20, qrSize + 20, 20);
        ctx.fill();

        const qrImg = new Image();
        await new Promise((resolve) => {
          qrImg.onload = resolve;
          qrImg.onerror = resolve;
          qrImg.src = qrDataUrl;
        });
        if (qrImg.complete && qrImg.naturalWidth !== 0) {
          ctx.drawImage(qrImg, qrBoxX, qrBoxY, qrSize, qrSize);
        }
      } catch (err) {
        console.error("Gagal menggambar QR Code pada canvas:", err);
      }
    }
    ctx.restore();

    setGeneratingCanvas(false);
  }, [recipe, qrDataUrl]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast("Tautan resep berhasil disalin ke papan klip! 📋", { variant: "success" });
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Gagal menyalin tautan:", err);
      showToast("Gagal menyalin tautan.", { variant: "error" });
    }
  };

  const handleDownloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const link = document.createElement("a");
      const safeTitle = (recipe.title || "Resep").replace(/[^\w\s-]/gi, "").replace(/\s+/g, "-");
      link.download = `CookPlan-Story-${safeTitle}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      showToast("Story card resep (9:16) berhasil diunduh! 📸", { variant: "success" });
    } catch (err) {
      console.error("Gagal mengunduh story card:", err);
      showToast("Gagal mengunduh story card.", { variant: "error" });
    }
  };

  const handleWhatsAppShare = () => {
    const timeText = recipe.readyInMinutes ?? 30;
    const waText = `🍳 *${recipe.title}* di CookPlan!\n\nCobain resep lezat ini deh! Praktis banget, cuma butuh waktu ±${timeText} menit dan bahannya gampang dicari.\n\n💡 *Bisa langsung klik buat simpan resep + otomatis bikin daftar belanjaannya:*\n👉 ${shareUrl}\n\n(Dikirim via CookPlan - Perencana Menu & Masak Hemat)`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <ModalSheet
      onClose={onClose}
      labelledBy="modal-share-recipe-title"
      panelClassName="max-w-lg overflow-hidden flex flex-col max-h-[90dvh]"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-outline-variant/60 shrink-0">
        <div>
          <h3
            id="modal-share-recipe-title"
            className="font-headline-sm text-headline-sm text-primary flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-primary text-xl">share</span>
            Bagikan Resep
          </h3>
          <p className="text-xs text-on-surface-variant">
            Bagikan resep lezat ini ke teman, keluarga, atau media sosial.
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-surface-container-high text-on-surface hover:bg-outline-variant flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Tutup modal share"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      <div className="p-5 overflow-y-auto custom-scrollbar space-y-6 flex-1">
        {/* Story Card Canvas Preview (9:16 Aspect Ratio) */}
        <div className="relative rounded-2xl overflow-hidden shadow-md bg-[#131E0D] border border-outline-variant/40 flex flex-col items-center p-3">
          <canvas
            ref={canvasRef}
            width={1080}
            height={1920}
            className="w-full max-w-[250px] h-auto rounded-xl object-contain shadow-inner"
          />
          {generatingCanvas && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold gap-2">
              <span className="material-symbols-outlined animate-spin text-lg">sync</span>
              Membuat Story Card...
            </div>
          )}
        </div>

        {/* Tombol Unduh Story Card (9:16) */}
        <button
          type="button"
          onClick={handleDownloadCard}
          className="w-full py-3 bg-primary text-white hover:bg-primary-container font-bold text-sm rounded-2xl transition cursor-pointer flex items-center justify-center gap-2 shadow-md active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-lg">download</span>
          Unduh Story Card (9:16)
        </button>

        {/* Tampilan QR Code Interaktif di UI Modal */}
        <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/60 flex items-center gap-4">
          <div className="p-2 bg-white rounded-xl shadow-xs shrink-0 border border-outline-variant/40">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code Resep"
                className="w-24 h-24 object-contain"
              />
            ) : (
              <div className="w-24 h-24 bg-surface-container-high rounded flex items-center justify-center">
                <span className="material-symbols-outlined animate-spin text-primary">sync</span>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">qr_code_2</span>
              Scan QR Code Resep
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Arahkan kamera HP untuk membuka resep lengkap & pesan bahan di CookPlan secara instant!
            </p>
          </div>
        </div>

        {/* Opsi Berbagi Cepat */}
        <div className="space-y-3 pt-2 border-t border-outline-variant/40">
          <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Pilihan Berbagi
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tombol Bagikan ke WhatsApp */}
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="py-3 px-4 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/40 text-[#128C7E] font-bold text-sm rounded-2xl transition cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <svg className="w-5 h-5 fill-[#25D366]" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984 0 1.764.459 3.487 1.333 5.006L2 22l5.127-1.344a9.924 9.924 0 004.885 1.28h.004c5.507 0 9.99-4.478 9.99-9.985 0-2.667-1.039-5.176-2.926-7.062A9.925 9.925 0 0012.012 2zm0 1.667c4.586 0 8.324 3.737 8.325 8.324 0 2.221-.865 4.31-2.438 5.882a8.27 8.27 0 01-5.887 2.436h-.003a8.267 8.267 0 01-4.103-1.096l-.294-.175-3.05.8.813-2.972-.191-.304a8.26 8.26 0 01-1.267-4.394c.001-4.587 3.739-8.325 8.325-8.325z" />
              </svg>
              Bagikan ke WhatsApp
            </button>

            {/* Tombol Salin Tautan */}
            <button
              type="button"
              onClick={handleCopyLink}
              className={`py-3 px-4 font-bold text-sm rounded-2xl transition cursor-pointer flex items-center justify-center gap-2 border active:scale-[0.98] ${
                copied
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-surface-container-low hover:bg-surface-container-high border-outline-variant text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                {copied ? "check_circle" : "content_copy"}
              </span>
              {copied ? "Tersalin!" : "Salin Tautan"}
            </button>
          </div>
        </div>

        {/* Link Input Field */}
        <div className="flex items-center gap-2 bg-surface-container-low p-2 rounded-2xl border border-outline-variant/60">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 bg-transparent px-3 py-1 text-xs text-on-surface-variant font-mono outline-none truncate"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-container transition cursor-pointer shrink-0"
          >
            Salin
          </button>
        </div>
      </div>
    </ModalSheet>
  );
}
