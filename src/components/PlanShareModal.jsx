import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import QRCode from "qrcode";
import { ModalSheet } from "./ModalSheet.jsx";
import { getSharedPlanByToken } from "../services/planService.js";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const MEAL_LABELS = { breakfast: "Sarapan", lunch: "Makan Siang", dinner: "Makan Malam" };

function extractPlanItems(plan, rawEntries) {
  const items = [];

  // 1. Ekstrak dari rawEntries jika ada (data resmi dari DB Supabase)
  if (Array.isArray(rawEntries) && rawEntries.length > 0) {
    for (const entry of rawEntries) {
      const title = typeof entry?.title === "string" ? entry.title.trim() : "";
      if (title.length > 0) {
        items.push({
          day: entry.day_of_week || entry.day || "Senin",
          mealType: entry.meal_type || "breakfast",
          mealLabel: MEAL_LABELS[entry.meal_type] || entry.meal_type || "Menu",
          title,
          calories: Number(entry.calories) || 0,
          imageUrl: entry.image_url || entry.imageUrl || "",
        });
      }
    }
    if (items.length > 0) return items;
  }

  // 2. Ekstrak dari object plan (state weeklyPlan)
  if (plan && typeof plan === "object") {
    for (const day of DAYS) {
      const slots = plan[day];
      if (!slots) continue;
      for (const mealType of ["breakfast", "lunch", "dinner"]) {
        const slot = slots[mealType];
        const title = typeof slot?.title === "string" ? slot.title.trim() : "";
        if (slot && title.length > 0) {
          items.push({
            day,
            mealType,
            mealLabel: MEAL_LABELS[mealType] || mealType,
            title,
            calories: Number(slot.calories) || 0,
            imageUrl: slot.imageUrl || "",
          });
        }
      }
    }
  }

  return items;
}

function groupDayMeals(dayMeals) {
  const b = dayMeals.find((i) => i.mealType === "breakfast");
  const l = dayMeals.find((i) => i.mealType === "lunch");
  const d = dayMeals.find((i) => i.mealType === "dinner");

  const tB = b?.title?.trim() || null;
  const tL = l?.title?.trim() || null;
  const tD = d?.title?.trim() || null;

  // Case 1: All 3 meals exist and have identical titles
  if (tB && tL && tD && tB.toLowerCase() === tL.toLowerCase() && tL.toLowerCase() === tD.toLowerCase()) {
    return [
      {
        label: "Seharian",
        title: b.title,
        imageUrl: b.imageUrl || l.imageUrl || d.imageUrl,
        isEmpty: false,
      },
    ];
  }

  // Case 2: 2 meals identical
  // 2a: Lunch & Dinner
  if (tL && tD && tL.toLowerCase() === tD.toLowerCase()) {
    const rows = [];
    if (b && tB) {
      rows.push({ label: MEAL_LABELS.breakfast, title: b.title, imageUrl: b.imageUrl, isEmpty: false });
    } else {
      rows.push({ label: MEAL_LABELS.breakfast, title: "(Kosong)", imageUrl: "", isEmpty: true });
    }
    rows.push({
      label: "Siang & Malam",
      title: l.title,
      imageUrl: l.imageUrl || d.imageUrl,
      isEmpty: false,
    });
    return rows;
  }

  // 2b: Breakfast & Lunch
  if (tB && tL && tB.toLowerCase() === tL.toLowerCase()) {
    const rows = [];
    rows.push({
      label: "Pagi & Siang",
      title: b.title,
      imageUrl: b.imageUrl || l.imageUrl,
      isEmpty: false,
    });
    if (d && tD) {
      rows.push({ label: MEAL_LABELS.dinner, title: d.title, imageUrl: d.imageUrl, isEmpty: false });
    } else {
      rows.push({ label: MEAL_LABELS.dinner, title: "(Kosong)", imageUrl: "", isEmpty: true });
    }
    return rows;
  }

  // 2c: Breakfast & Dinner
  if (tB && tD && tB.toLowerCase() === tD.toLowerCase()) {
    const rows = [];
    rows.push({
      label: "Pagi & Malam",
      title: b.title,
      imageUrl: b.imageUrl || d.imageUrl,
      isEmpty: false,
    });
    if (l && tL) {
      rows.push({ label: MEAL_LABELS.lunch, title: l.title, imageUrl: l.imageUrl, isEmpty: false });
    } else {
      rows.push({ label: MEAL_LABELS.lunch, title: "(Kosong)", imageUrl: "", isEmpty: true });
    }
    return rows;
  }

  // Case 3: No deduplication
  const rows = [];
  for (const mType of ["breakfast", "lunch", "dinner"]) {
    const item = dayMeals.find((i) => i.mealType === mType);
    if (item && item.title) {
      rows.push({
        label: MEAL_LABELS[mType],
        title: item.title,
        imageUrl: item.imageUrl,
        isEmpty: false,
      });
    } else {
      rows.push({
        label: MEAL_LABELS[mType],
        title: "(Kosong)",
        imageUrl: "",
        isEmpty: true,
      });
    }
  }
  return rows;
}

function formatWeekRange(startDateStr) {
  let start;
  if (startDateStr) {
    start = new Date(startDateStr + "T00:00:00");
  } else {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    start = new Date(now.setDate(diff));
  }

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];

  const startDay = start.getDate();
  const startMonth = months[start.getMonth()];

  const endDay = end.getDate();
  const endMonth = months[end.getMonth()];
  const year = end.getFullYear();

  if (startMonth === endMonth) {
    return `${startDay} - ${endDay} ${endMonth} ${year}`;
  }
  return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;
}

export function PlanShareModal({ shareToken, weeklyPlan, onClose, showToast }) {
  const [activeTab, setActiveTab] = useState("link"); // "link" | "card"
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [logoImg, setLogoImg] = useState(null);
  const [qrImg, setQrImg] = useState(null);
  const [asyncPlan, setAsyncPlan] = useState(null);
  const [asyncRawEntries, setAsyncRawEntries] = useState([]);
  const [asyncWeekStartDate, setAsyncWeekStartDate] = useState(null);
  const [loadedImages, setLoadedImages] = useState({});
  const canvasRef = useRef(null);

  const shareUrl = `${window.location.origin}/share/plan/${shareToken}`;

  // Pre-load logo CookPlan SVG resmi
  useEffect(() => {
    const img = new Image();
    img.src = "/cookplan-logo.svg";
    img.onload = () => setLogoImg(img);
  }, []);

  // Generate QR Code untuk shareUrl
  useEffect(() => {
    if (!shareUrl) return;
    let active = true;
    QRCode.toDataURL(shareUrl, {
      margin: 1,
      width: 240,
      color: {
        dark: "#0F281E",
        light: "#FFFFFF",
      },
    })
      .then((url) => {
        const img = new Image();
        img.src = url;
        img.onload = () => {
          if (active) setQrImg(img);
        };
      })
      .catch((err) => {
        console.error("Gagal membuat QR Code:", err);
      });
    return () => {
      active = false;
    };
  }, [shareUrl]);

  // Fetch plan resmi dari DB berdasarkan shareToken agar data selalu lengkap & mutakhir
  useEffect(() => {
    let active = true;
    if (shareToken) {
      getSharedPlanByToken(shareToken)
        .then((data) => {
          if (active) {
            if (data?.plan) setAsyncPlan(data.plan);
            if (data?.rawEntries) setAsyncRawEntries(data.rawEntries);
            if (data?.weekStartDate) setAsyncWeekStartDate(data.weekStartDate);
          }
        })
        .catch((err) => {
          console.error("Gagal memuat detail shared plan:", err);
        });
    }
    return () => { active = false; };
  }, [shareToken]);

  // Gunakan asyncPlan dari DB jika ada, atau fallback ke weeklyPlan dari props
  const effectivePlan = asyncPlan || weeklyPlan;

  // Ekstrak daftar menu masakan secara universal dari state atau raw entries
  const allMealItems = useMemo(() => {
    return extractPlanItems(effectivePlan, asyncRawEntries);
  }, [effectivePlan, asyncRawEntries]);

  // Preload foto resep asli agar ter-render sempurna di canvas 2D
  useEffect(() => {
    let active = true;
    const uniqueUrls = Array.from(new Set(allMealItems.map((i) => i.imageUrl).filter(Boolean)));
    if (uniqueUrls.length === 0) return;

    const imgMap = {};
    let loaded = 0;

    uniqueUrls.forEach((url) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      img.onload = () => {
        if (!active) return;
        imgMap[url] = img;
        loaded++;
        if (loaded === uniqueUrls.length) setLoadedImages({ ...imgMap });
      };
      img.onerror = () => {
        if (!active) return;
        loaded++;
        if (loaded === uniqueUrls.length) setLoadedImages({ ...imgMap });
      };
    });

    return () => { active = false; };
  }, [allMealItems]);

  // Hitung statistik dinamis sesuai isi planner aktual
  const totalMeals = allMealItems.length;
  const filledDaysCount = useMemo(() => {
    return new Set(allMealItems.map((item) => item.day)).size;
  }, [allMealItems]);

  const weekRangeText = useMemo(() => {
    return formatWeekRange(asyncWeekStartDate);
  }, [asyncWeekStartDate]);

  const daysText = `${filledDaysCount} Hari`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      if (showToast) showToast("Tautan berhasil disalin ke clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      if (showToast) showToast("Gagal menyalin tautan.", { variant: "error" });
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Rencana Masak Minggu Ini - CookPlan",
          text: `Cek rencana masak minggu ini yang kuatur di CookPlan! Terdiri dari ${totalMeals} hidangan lezat:`,
          url: shareUrl,
        });
      } catch (err) {
        if (err.name !== "AbortError" && showToast) {
          showToast("Gagal membagikan tautan.", { variant: "error" });
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleShareWhatsApp = () => {
    const message = encodeURIComponent(
      `*Rencana Masak Minggu Ini di CookPlan*\n` +
      `Aku mau bagikan daftar menu makan 7 hari nih (${totalMeals} menu)! Cek atau langsung impor ke jadwalmu di sini:\n\n` +
      `${shareUrl}`
    );
    window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
  };

  // Render Kartu IG Story 9:16 (540x960) dengan Grid 2 Kolom 7 Hari + Foto Resep & QR Code
  const drawStoryCard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = 540;
    const height = 960;
    canvas.width = width;
    canvas.height = height;

    // Background Gradient (Sleek Modern Forest & Cream Theme)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0F281E");
    bgGrad.addColorStop(0.5, "#1B4332");
    bgGrad.addColorStop(1, "#0A1B14");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Orbs
    ctx.fillStyle = "rgba(76, 175, 80, 0.15)";
    ctx.beginPath();
    ctx.arc(450, 140, 180, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 183, 77, 0.1)";
    ctx.beginPath();
    ctx.arc(80, 820, 200, 0, Math.PI * 2);
    ctx.fill();

    // Top Header - Branding dengan Capsule Putih di Belakang Logo CookPlan SVG
    if (logoImg) {
      const targetH = 32;
      let logoWidth;
      try {
        const aspect = (logoImg.naturalWidth && logoImg.naturalHeight)
          ? (logoImg.naturalWidth / logoImg.naturalHeight)
          : (1180 / 700);
        logoWidth = Math.round(targetH * aspect);
      } catch {
        logoWidth = 54;
      }

      const padX = 14;
      const padY = 6;
      const capX = 36;
      const capY = 24;
      const capW = logoWidth + (padX * 2);
      const capH = targetH + (padY * 2);
      const capRadius = capH / 2;

      // Draw rounded Cream/White capsule background behind logo
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = "#FFFFFF";
      if (ctx.roundRect) {
        ctx.roundRect(capX, capY, capW, capH, capRadius);
      } else {
        ctx.fillRect(capX, capY, capW, capH);
      }
      ctx.fill();

      // Draw dark olive vector SVG logo inside white capsule
      ctx.drawImage(logoImg, capX + padX, capY + padY, logoWidth, targetH);
      ctx.restore();

      ctx.fillStyle = "#E2E8F0";
      ctx.font = "500 13px sans-serif";
      ctx.fillText("Rencana Masak Minggu Ini", capX + capW + 14, capY + Math.round(capH / 2) + 4);
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = "#FFFFFF";
      if (ctx.roundRect) {
        ctx.roundRect(36, 24, 120, 44, 22);
      } else {
        ctx.fillRect(36, 24, 120, 44);
      }
      ctx.fill();

      ctx.fillStyle = "#2C3A1E";
      ctx.font = "900 18px sans-serif";
      ctx.fillText("CookPlan", 48, 52);
      ctx.restore();

      ctx.fillStyle = "#E2E8F0";
      ctx.font = "500 13px sans-serif";
      ctx.fillText("Rencana Masak Minggu Ini", 170, 52);
    }

    // Title Section (dengan Periode Tanggal Otomatis)
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText("Rencana Masak Minggu Ini", 36, 106);

    ctx.fillStyle = "#A3E635";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(`Periode: ${weekRangeText}`, 36, 130);

    ctx.fillStyle = "#FFB74D";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(`${daysText} • ${totalMeals} Menu Masakan`, 36, 152);

    // Stats Bar (Glassmorphism Pill - Tanpa Kalori)
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.roundRect ? ctx.roundRect(36, 172, 468, 54, 14) : ctx.fillRect(36, 172, 468, 54);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#A3E635";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(`${totalMeals} Menu Masakan`, 56, 205);

    ctx.fillStyle = "#FFB74D";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(daysText, 375, 205);

    // Helper: Gambar Foto Resep Rounded 26x26px
    const drawRecipePhoto = (x, y, url) => {
      const size = 26;
      const radius = 6;
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, size, size, radius);
      } else {
        ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
      }
      ctx.clip();

      const imgObj = url ? loadedImages[url] : null;
      if (imgObj) {
        try {
          ctx.drawImage(imgObj, x, y, size, size);
        } catch {
          ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
          ctx.fillRect(x, y, size, size);
        }
      } else {
        ctx.fillStyle = "rgba(163, 230, 53, 0.25)";
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = "#A3E635";
        ctx.font = "bold 10px sans-serif";
        ctx.fillText("•", x + 10, y + 16);
      }
      ctx.restore();
    };

    // Grid Layout 2 Kolom (Kolom Kiri: Senin-Kamis, Kolom Kanan: Jumat-Minggu + Card Ringkasan)
    const leftDays = ["Senin", "Selasa", "Rabu", "Kamis"];
    const rightDays = ["Jumat", "Sabtu", "Minggu"];

    const renderDayBlock = (dayName, colX, startY) => {
      const dayMeals = allMealItems.filter((i) => i.day === dayName);
      const blockHeight = 126;

      // Card Background Day Block
      ctx.beginPath();
      ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
      if (ctx.roundRect) {
        ctx.roundRect(colX, startY, 226, blockHeight, 12);
      } else {
        ctx.fillRect(colX, startY, 226, blockHeight);
      }
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Day Title Badge
      ctx.fillStyle = "#A3E635";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(dayName.toUpperCase(), colX + 10, startY + 18);

      // Smart Meal Deduplication
      const rows = groupDayMeals(dayMeals);

      let slotY = startY + 26;
      let rowGap = 31;
      if (rows.length === 1) {
        slotY = startY + 48;
        rowGap = 0;
      } else if (rows.length === 2) {
        slotY = startY + 34;
        rowGap = 36;
      }

      for (const row of rows) {
        if (!row.isEmpty) {
          drawRecipePhoto(colX + 8, slotY, row.imageUrl);

          ctx.fillStyle = "#A3E635";
          ctx.font = "bold 9px sans-serif";
          ctx.fillText(row.label, colX + 40, slotY + 10);

          ctx.fillStyle = "#FFFFFF";
          ctx.font = "bold 10px sans-serif";
          const maxLen = rows.length === 1 ? 22 : 18;
          const trunc = row.title.length > maxLen ? row.title.slice(0, maxLen) + "…" : row.title;
          ctx.fillText(trunc, colX + 40, slotY + 22);
        } else {
          ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
          ctx.font = "italic 9px sans-serif";
          ctx.fillText(`• ${row.label}: (Kosong)`, colX + 10, slotY + 16);
        }
        slotY += rowGap;
      }
    };

    // Render Kolom Kiri (Senin - Kamis)
    let leftY = 244;
    for (const d of leftDays) {
      renderDayBlock(d, 36, leftY);
      leftY += 134;
    }

    // Render Kolom Kanan (Jumat - Minggu)
    let rightY = 244;
    for (const d of rightDays) {
      renderDayBlock(d, 278, rightY);
      rightY += 134;
    }

    // Blok 4 Kolom Kanan: Card Ringkasan & Highlight
    ctx.beginPath();
    ctx.fillStyle = "rgba(163, 230, 53, 0.12)";
    if (ctx.roundRect) {
      ctx.roundRect(278, rightY, 226, 126, 12);
    } else {
      ctx.fillRect(278, rightY, 226, 126);
    }
    ctx.fill();
    ctx.strokeStyle = "rgba(163, 230, 53, 0.3)";
    ctx.stroke();

    ctx.fillStyle = "#A3E635";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("SALIN JADWAL", 290, rightY + 24);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText("Tinggal Pakai!", 290, rightY + 48);

    ctx.fillStyle = "#E2E8F0";
    ctx.font = "10px sans-serif";
    ctx.fillText("Scan QR Code untuk langsung", 290, rightY + 68);
    ctx.fillText("pasang jadwal di CookPlan.", 290, rightY + 84);

    // Bottom Footer Box (CTA + Link + QR Code)
    ctx.beginPath();
    ctx.fillStyle = "#A3E635";
    if (ctx.roundRect) {
      ctx.roundRect(36, 842, 468, 76, 18);
    } else {
      ctx.fillRect(36, 842, 468, 76);
    }
    ctx.fill();

    // Render QR Code di sebelah kanan footer box
    if (qrImg) {
      const qrSize = 60;
      const qrX = 434;
      const qrY = 850;

      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(qrX, qrY, qrSize, qrSize, 8);
      } else {
        ctx.fillRect(qrX, qrY, qrSize, qrSize);
      }
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.clip();
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      ctx.restore();
    }

    ctx.fillStyle = "#0F281E";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("Buka & Salin Rencana Ini:", 54, 872);

    ctx.font = "bold 12px monospace";
    const displayUrl = shareUrl.replace(/^https?:\/\//, "");
    const truncatedUrl = displayUrl.length > 28 ? displayUrl.slice(0, 28) + "…" : displayUrl;
    ctx.fillText(truncatedUrl, 54, 894);
  }, [shareUrl, totalMeals, daysText, weekRangeText, allMealItems, logoImg, loadedImages, qrImg]);

  useEffect(() => {
    if (activeTab === "card") {
      const timer = setTimeout(() => {
        drawStoryCard();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeTab, drawStoryCard, logoImg, allMealItems, loadedImages, qrImg]);

  const handleDownloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsGenerating(true);
    try {
      const link = document.createElement("a");
      link.download = `CookPlan-WeeklyPlan-${shareToken.slice(0, 6)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      if (showToast) showToast("Kartu visual berhasil diunduh!");
    } catch {
      if (showToast) showToast("Gagal mengunduh gambar.", { variant: "error" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ModalSheet onClose={onClose} labelledBy="modal-share-title" panelClassName="max-w-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 id="modal-share-title" className="font-headline-md text-headline-md text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-2xl">share</span>
          Bagikan Rencana Mingguan
        </h3>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-secondary-container/30 hover:bg-secondary-container text-on-surface flex items-center justify-center transition cursor-pointer"
          aria-label="Tutup modal"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-cream rounded-full p-1 mb-5">
        <button
          onClick={() => setActiveTab("link")}
          className={`flex-1 py-2 rounded-full font-bold text-xs md:text-sm transition cursor-pointer ${activeTab === "link" ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:text-on-surface"
            }`}
        >
          Bagikan Link
        </button>
        <button
          onClick={() => setActiveTab("card")}
          className={`flex-1 py-2 rounded-full font-bold text-xs md:text-sm transition cursor-pointer ${activeTab === "card" ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:text-on-surface"
            }`}
        >
          Kartu Story (IG/WA)
        </button>
      </div>

      {/* Tab 1: Link Sharing */}
      {activeTab === "link" && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Siapa pun yang menerima link ini (termasuk yang belum punya akun) dapat melihat preview menu 7 hari kamu, lalu menyalin dan menyesuaikannya langsung di CookPlan!
          </p>

          {/* Share URL Box */}
          <div className="flex items-center gap-2 p-2.5 bg-surface-cream/70 border border-outline-variant rounded-2xl">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-transparent text-xs font-mono text-on-surface px-2 outline-none truncate"
            />
            <button
              onClick={handleCopyLink}
              className="px-3.5 py-1.5 bg-primary text-white rounded-xl font-bold text-xs hover:bg-primary-container active:scale-95 transition shrink-0 cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">{copied ? "check" : "content_copy"}</span>
              {copied ? "Tersalin!" : "Salin"}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleShareWhatsApp}
              className="py-3 px-4 bg-[#25D366] text-white rounded-2xl font-bold text-xs md:text-sm hover:opacity-95 active:scale-95 transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984 0 1.764.459 3.487 1.333 5.006L2 22l5.127-1.344a9.924 9.924 0 004.885 1.28h.004c5.507 0 9.99-4.478 9.99-9.985 0-2.667-1.039-5.176-2.926-7.062A9.925 9.925 0 0012.012 2zm0 1.667c4.586 0 8.324 3.737 8.325 8.324 0 2.221-.865 4.31-2.438 5.882a8.27 8.27 0 01-5.887 2.436h-.003a8.267 8.267 0 01-4.103-1.096l-.294-.175-3.05.8.813-2.972-.191-.304a8.26 8.26 0 01-1.267-4.394c.001-4.587 3.739-8.325 8.325-8.325z" />
              </svg>
              WhatsApp
            </button>
            <button
              onClick={handleNativeShare}
              className="py-3 px-4 bg-secondary text-white rounded-2xl font-bold text-xs md:text-sm hover:bg-secondary/90 active:scale-95 transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">share</span>
              Bagikan Lainnya
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Visual Story Card */}
      {activeTab === "card" && (
        <div className="space-y-4 animate-fade-in text-center">
          <p className="text-xs text-on-surface-variant">
            Kartu visual 9:16 siap posting untuk Instagram Story, WhatsApp Status, atau TikTok!
          </p>

          <div className="relative max-w-[260px] mx-auto rounded-2xl overflow-hidden border border-outline-variant shadow-md bg-stone-900">
            <canvas ref={canvasRef} className="w-full h-auto block" />
          </div>

          <button
            onClick={handleDownloadCard}
            disabled={isGenerating}
            className="w-full py-3 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary-container active:scale-95 transition cursor-pointer flex items-center justify-center gap-2 shadow-md"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            {isGenerating ? "Menyiapkan Gambar…" : "Unduh Gambar Story (.PNG)"}
          </button>
        </div>
      )}
    </ModalSheet>
  );
}

