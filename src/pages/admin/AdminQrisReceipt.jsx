import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { checkIsAdmin } from '../../services/adminService.js';
import { usePlan } from '../../hooks/usePlan.js';
import { QrisReceiptCard } from '../../components/QrisReceiptCard.jsx';
import {
  QRIS_BANK_OPTIONS,
  formatQrisDate,
  getLocalDatetimeInputValue,
  getLocalDateOnlyInputValue,
  generatePackageRandomDate,
  generateSameDayRandomDate,
  generateRandomSuffix,
  generateTxNumbers,
  DEFAULT_NMID,
  getRandomBank,
  formatReceiptRupiah,
  exportQrisToPng,
  ensureSuffixEndsWithId,
} from '../../utils/qrisReceipt.js';

const SUBSCRIPTION_PRESETS = [
  { label: 'Lite 1 Bln', val: 11000 },
  { label: 'Pro 1 Bln', val: 29000 },
  { label: 'Lite 3 Bln', val: 29700 },
  { label: 'Pro 3 Bln', val: 74700 },
  { label: 'Lite 6 Bln', val: 52800 },
  { label: 'Pro 6 Bln', val: 119400 },
];

const PACKAGE_PRESETS = [50000, 75000, 100000, 150000, 200000, 250000, 300000];

export function AdminQrisReceipt() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = usePlan();

  const [allowed, setAllowed] = useState(null); // null = checking
  const cardRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  // Parameter dari URL bila dibuka dari rincian order / langganan
  const paramAmount = searchParams.get('amount');
  const paramDate = searchParams.get('date');
  const paramOrderCode = searchParams.get('orderId');
  const paramType = searchParams.get('type');

  // Kategori transaksi: 'package' (Paket Belanja Bahan) | 'subscription' (Langganan Bulanan CookPass)
  const [transactionType, setTransactionType] = useState(() => {
    if (paramType === 'subscription' || paramOrderCode?.startsWith('SUB-')) {
      return 'subscription';
    }
    return 'package';
  });
  const isSubscription = transactionType === 'subscription';

  // State nilai yang dapat diatur oleh King
  const [amount, setAmount] = useState(() => {
    if (paramAmount) {
      const parsed = Number(paramAmount);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    const isSub = paramType === 'subscription' || paramOrderCode?.startsWith('SUB-');
    return isSub ? 29000 : 200000;
  });

  // 1. Hari Pemesanan Paket / Langganan (Tanggal rujukan)
  const [orderDate, setOrderDate] = useState(() => {
    if (paramDate) {
      const d = new Date(paramDate);
      if (!isNaN(d.getTime())) return getLocalDateOnlyInputValue(d);
    }
    return getLocalDateOnlyInputValue(new Date());
  });

  // 2. Tanggal & Jam Transaksi Struk QRIS:
  // - Langganan CookPass: Hari-H pemesanan (< 20:00)
  // - Paket Bahan: H-1 atau H-2 (< 20:00)
  const [dateTimeLocal, setDateTimeLocal] = useState(() => {
    const base = paramDate ? new Date(paramDate) : new Date();
    const isSub = paramType === 'subscription' || paramOrderCode?.startsWith('SUB-');
    const targetDate = isSub
      ? generateSameDayRandomDate(base)
      : generatePackageRandomDate(base);
    return getLocalDatetimeInputValue(targetDate);
  });

  const [bank, setBank] = useState('Mandiri');
  const [qrType, setQrType] = useState('QR statis');
  const [storeName, setStoreName] = useState('CookPlan');

  // State nilai yang di-generate secara acak
  const [randomSuffix, setRandomSuffix] = useState(() => generateRandomSuffix(6));
  const [txNumbers, setTxNumbers] = useState(() => {
    const isSub = paramType === 'subscription' || paramOrderCode?.startsWith('SUB-');
    const d = dateTimeLocal
      ? new Date(dateTimeLocal)
      : (isSub
          ? generateSameDayRandomDate(paramDate ? new Date(paramDate) : new Date())
          : generatePackageRandomDate(paramDate ? new Date(paramDate) : new Date()));
    return generateTxNumbers(d);
  });
  const [nmid, setNmid] = useState(DEFAULT_NMID);

  useEffect(() => {
    let active = true;
    checkIsAdmin().then((ok) => {
      if (active) setAllowed(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  // Switcher Kategori Transaksi
  const handleSelectTransactionType = (newType) => {
    if (newType === transactionType) return;
    setTransactionType(newType);
    const base = orderDate ? new Date(orderDate) : new Date();
    if (newType === 'subscription') {
      if (amount >= 50000 || amount === 200000) {
        setAmount(29000);
      }
      const newTxDate = generateSameDayRandomDate(base);
      setDateTimeLocal(getLocalDatetimeInputValue(newTxDate));
      setTxNumbers(generateTxNumbers(newTxDate));
      showToast('Mode: Penjualan Langganan Bulanan (Hari-H) 👑');
    } else {
      if ([11000, 29000, 29700, 74700, 52800, 119400].includes(amount)) {
        setAmount(200000);
      }
      const newTxDate = generatePackageRandomDate(base);
      setDateTimeLocal(getLocalDatetimeInputValue(newTxDate));
      setTxNumbers(generateTxNumbers(newTxDate));
      showToast('Mode: Paket Belanja Bahan Makanan (H-1 / H-2) 🛒');
    }
  };

  // Handler Master: 1 tombol untuk mengacak SEMUA variabel yang diperbolehkan diacak
  // (Waktu transaksi < 20:00: Hari-H untuk Langganan, H-1/H-2 untuk Paket, Bank Sumber, Suffix ID, & Nomor Transaksi)
  // Menjaga NMID tetap ID1026539688444, nominal tetap, dan nama toko tetap.
  const handleRandomizeAll = () => {
    const base = orderDate ? new Date(orderDate) : new Date();
    const newTxDate = isSubscription
      ? generateSameDayRandomDate(base)
      : generatePackageRandomDate(base); // Acak H-1 atau H-2
    const newDateTimeVal = getLocalDatetimeInputValue(newTxDate);
    setDateTimeLocal(newDateTimeVal);

    const newBank = getRandomBank();
    setBank(newBank);

    const newSuffix = generateRandomSuffix(6);
    setRandomSuffix(newSuffix);

    const newTx = generateTxNumbers(newTxDate);
    setTxNumbers(newTx);

    setNmid(DEFAULT_NMID);

    const formattedShortDate = `${newTxDate.getDate()}/${newTxDate.getMonth() + 1}`;
    const formattedShortTime = `${String(newTxDate.getHours()).padStart(2, '0')}:${String(newTxDate.getMinutes()).padStart(2, '0')}`;
    const modeLabel = isSubscription ? 'Hari-H' : 'H-1/H-2';
    showToast(`Semua variabel diacak! (${modeLabel}: ${formattedShortDate} pk ${formattedShortTime}, ${newBank}) 🎲`);
  };

  // Handler jika hari pemesanan diubah langsung di input date
  const handleOrderDateChange = (newOrderDateStr) => {
    setOrderDate(newOrderDateStr);
    if (newOrderDateStr) {
      const base = new Date(newOrderDateStr);
      const newTxDate = isSubscription
        ? generateSameDayRandomDate(base)
        : generatePackageRandomDate(base);
      setDateTimeLocal(getLocalDatetimeInputValue(newTxDate));
      setTxNumbers(generateTxNumbers(newTxDate));
      const syncMsg = isSubscription
        ? 'Waktu transaksi disinkronkan ke Hari-H pemesanan langganan! 📅'
        : 'Waktu transaksi disinkronkan ke H-1/H-2 paket belanja! 📅';
      showToast(syncMsg);
    }
  };

  // Handler set spesifik H-1 atau H-2 untuk paket belanja bahan
  const handleSetPackageDaysBack = (daysBack) => {
    const base = orderDate ? new Date(orderDate) : new Date();
    const newTxDate = generatePackageRandomDate(base, daysBack);
    setDateTimeLocal(getLocalDatetimeInputValue(newTxDate));
    setTxNumbers(generateTxNumbers(newTxDate));
    showToast(`Waktu transaksi diatur ke H-${daysBack} (< 20:00)! 📅`);
  };

  // Handler acak khusus kode alfanumerik, nomor transaksi, dan bank sumber
  const handleRandomizeCodes = () => {
    handleRandomizeAll();
  };

  // Handler acak bank sumber secara mandiri
  const handleRandomizeBank = () => {
    const newBank = getRandomBank();
    setBank(newBank);
    showToast(`Bank sumber diacak: ${newBank} 🏦`);
  };

  // Handler acak jam transaksi
  const handleRandomizeDateTime = () => {
    const base = orderDate ? new Date(orderDate) : new Date();
    const newDate = isSubscription
      ? generateSameDayRandomDate(base)
      : generatePackageRandomDate(base);
    const val = getLocalDatetimeInputValue(newDate);
    setDateTimeLocal(val);
    setTxNumbers(generateTxNumbers(newDate));
    showToast(`Jam transaksi diacak ulang di bawah 20:00 (${isSubscription ? 'Hari-H' : 'H-1/H-2'})! ⏰`);
  };

  // Handler salin nomor transaksi
  const handleCopyTx = async () => {
    try {
      await navigator.clipboard.writeText(txNumbers.fullCode);
      showToast('Nomor transaksi berhasil disalin! 📋');
    } catch {
      showToast('Gagal menyalin nomor transaksi.', { variant: 'error' });
    }
  };

  // Handler download PNG
  const handleDownloadPng = async () => {
    if (downloading || !cardRef.current) return;
    setDownloading(true);
    try {
      const filename = `Struk-QRIS-${txNumbers.part1}.png`;
      await exportQrisToPng(cardRef.current, filename);
      showToast(`Struk QRIS berhasil diunduh (${filename})! 📥`);
    } catch (err) {
      console.error('Gagal unduh struk PNG:', err);
      showToast('Gagal mengunduh gambar struk. Coba lagi.', { variant: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  if (allowed === null) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-3">
          progress_activity
        </span>
        <p className="text-sm">Memeriksa hak akses admin…</p>
      </div>
    );
  }

  if (allowed === false) {
    return (
      <div className="max-w-md mx-auto px-5 py-20 text-center">
        <span className="material-symbols-outlined text-5xl text-error mb-3">lock</span>
        <h1 className="font-headline-md text-headline-md text-on-surface mb-2">Akses Ditolak</h1>
        <p className="text-on-surface-variant text-sm mb-6">
          Halaman ini khusus untuk administrator CookPlan.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 bg-primary text-on-primary rounded-full font-semibold text-sm cursor-pointer"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  const formattedAmount = formatReceiptRupiah(amount);
  const formattedDate = formatQrisDate(dateTimeLocal);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-8 animate-fade-in">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/40 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase tracking-wider">
              Khusus Admin
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                isSubscription
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-primary/10 text-primary border border-primary/20'
              }`}
            >
              {isSubscription ? '👑 Langganan CookPass' : '🛒 Paket Belanja Bahan'}
            </span>
            {paramOrderCode && (
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[11px] font-mono font-semibold">
                Ref: {paramOrderCode}
              </span>
            )}
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-3xl">qr_code_2</span>
            Generator Struk Transaksi QRIS
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Atur nominal dan tanggal transaksi sesuai kebutuhanmu, acak nomor transaksi dengan satu klik, dan unduh sebagai file PNG proporsional.
          </p>
        </div>

        {/* Action Header Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleRandomizeAll}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-full text-sm font-semibold transition-all cursor-pointer active:scale-95 shadow-xs"
            title={`Acak semua variabel transaksi (${isSubscription ? 'Hari-H < 20:00' : 'H-1/H-2 < 20:00'}, bank sumber, & nomor transaksi)`}
          >
            <span className="material-symbols-outlined text-[18px]">casino</span>
            Acak Semua Variabel
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary rounded-full text-sm font-semibold transition-all cursor-pointer active:scale-95 shadow-md disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-[18px] ${downloading ? 'animate-spin' : ''}`}>
              {downloading ? 'progress_activity' : 'download'}
            </span>
            {downloading ? 'Menyimpan...' : 'Download PNG'}
          </button>
        </div>
      </div>

      {/* Grid: Form Kontrol (Kiri) & Live Preview (Kanan) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Kolom Form Kontrol */}
        <div className="lg:col-span-6 space-y-6">
          {/* Card Pemilih Kategori Transaksi */}
          <div className="bg-white border border-outline-variant/60 rounded-3xl p-3 sm:p-3.5 shadow-xs">
            <div className="flex bg-surface-container-low p-1 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => handleSelectTransactionType('package')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  !isSubscription
                    ? 'bg-white text-primary shadow-xs border border-outline-variant/40'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">shopping_bag</span>
                Paket Belanja (H-1 / H-2)
              </button>
              <button
                type="button"
                onClick={() => handleSelectTransactionType('subscription')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isSubscription
                    ? 'bg-white text-primary shadow-xs border border-outline-variant/40'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
                Langganan Bulanan (Hari-H)
              </button>
            </div>
          </div>

          {/* Card Atur Nominal */}
          <div className="bg-white border border-outline-variant/60 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 pb-2 border-b border-outline-variant/30">
              <span className="material-symbols-outlined text-primary text-[20px]">payments</span>
              <h2 className="text-base font-bold text-on-surface">1. Pengaturan Nominal Transaksi</h2>
            </div>

            <div>
              <label htmlFor="amount-input" className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                Nominal Pembayaran (Rp)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-on-surface-variant">
                  Rp
                </span>
                <input
                  id="amount-input"
                  type="number"
                  min="0"
                  step="1000"
                  value={amount}
                  onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="200000"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-outline-variant text-base font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </div>
              <p className="text-[12px] text-on-surface-variant mt-1.5 font-medium">
                Tampilan pada struk: <span className="text-[#00880d] font-bold">{formattedAmount}</span>
              </p>
            </div>

            {/* Quick Chips Nominal Sesuai Mode */}
            {isSubscription ? (
              <div>
                <span className="block text-[11px] font-semibold text-on-surface-variant mb-2">
                  Pilih Cepat Paket Langganan CookPass:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SUBSCRIPTION_PRESETS.map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setAmount(item.val)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                        amount === item.val
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface-container-lowest text-on-surface border-outline-variant hover:border-primary/50'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className={`text-[10px] font-normal ${amount === item.val ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>
                        ({formatReceiptRupiah(item.val)})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <span className="block text-[11px] font-semibold text-on-surface-variant mb-2">
                  Pilih Cepat Nominal Belanja:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PACKAGE_PRESETS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmount(val)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                        amount === val
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface-container-lowest text-on-surface border-outline-variant hover:border-primary/50'
                      }`}
                    >
                      {formatReceiptRupiah(val)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Card Atur Waktu & Metode */}
          <div className="bg-white border border-outline-variant/60 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 pb-2 border-b border-outline-variant/30">
              <span className="material-symbols-outlined text-primary text-[20px]">calendar_clock</span>
              <h2 className="text-base font-bold text-on-surface">2. Waktu & Sumber Pembayaran</h2>
            </div>

            {/* Quick 1-Click Randomize Banner */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-[22px]">auto_awesome</span>
                <div>
                  <p className="text-xs font-bold text-on-surface">Generator Otomatis 1-Klik</p>
                  <p className="text-[11px] text-on-surface-variant">
                    Acak waktu transaksi ({isSubscription ? 'Hari-H < 20:00' : 'H-1 / H-2 < 20:00'}), bank sumber, &amp; no. transaksi sekaligus
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRandomizeAll}
                className="shrink-0 px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary/90 transition active:scale-95 cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                title="Acak semua variabel transaksi sekaligus"
              >
                <span className="material-symbols-outlined text-[16px]">casino</span>
                Acak Semua Variabel
              </button>
            </div>

            {/* Input Hari Pemesanan */}
            <div>
              <label htmlFor="order-date-input" className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                {isSubscription ? 'Hari Pemesanan Langganan CookPass (Hari-H)' : 'Hari Pengantaran / Pemesanan Paket (Rujukan H-1 / H-2)'}
              </label>
              <input
                id="order-date-input"
                type="date"
                value={orderDate}
                onChange={(e) => handleOrderDateChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
              <p className="text-[11px] text-on-surface-variant mt-1">
                {isSubscription
                  ? 'Struk pembayaran QRIS langganan bulanan dihitung pada Hari-H pemesanan ini dengan jam acak di bawah pukul 20:00 (08:00 - 19:59).'
                  : 'Struk pembayaran QRIS belanja bahan dihitung H-1 atau H-2 sebelum tanggal pengantaran dengan jam acak di bawah pukul 20:00 (08:00 - 19:59).'}
              </p>
            </div>

            {/* Input Tanggal & Jam Transaksi Struk */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                <label htmlFor="datetime-input" className="block text-xs font-semibold text-on-surface-variant">
                  Tanggal &amp; Jam Transaksi Struk {isSubscription ? '(Hari-H)' : '(H-1 / H-2)'}
                </label>
                <div className="flex items-center gap-1.5">
                  {!isSubscription && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSetPackageDaysBack(1)}
                        className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/60 cursor-pointer active:scale-95 transition"
                        title="Set tanggal transaksi ke H-1"
                      >
                        Set H-1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetPackageDaysBack(2)}
                        className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/60 cursor-pointer active:scale-95 transition"
                        title="Set tanggal transaksi ke H-2"
                      >
                        Set H-2
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleRandomizeDateTime}
                    className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                    title="Acak ulang waktu transaksi (< 20:00)"
                  >
                    <span className="material-symbols-outlined text-[13px]">schedule</span>
                    Acak Jam (&lt; 20:00)
                  </button>
                </div>
              </div>
              <input
                id="datetime-input"
                type="datetime-local"
                value={dateTimeLocal}
                onChange={(e) => setDateTimeLocal(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
              <p className="text-[12px] text-on-surface-variant mt-1.5">
                Tampilan pada struk: <span className="font-semibold text-on-surface">{formattedDate}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="bank-select" className="block text-xs font-semibold text-on-surface-variant">
                    Dibayar Dari (Bank / E-Wallet)
                  </label>
                  <button
                    type="button"
                    onClick={handleRandomizeBank}
                    className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                    title="Pilih bank/e-wallet acak"
                  >
                    <span className="material-symbols-outlined text-[13px]">shuffle</span>
                    Acak Bank
                  </button>
                </div>
                <select
                  id="bank-select"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant text-sm font-medium text-on-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary cursor-pointer"
                >
                  {QRIS_BANK_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="qr-type-select" className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                  Jenis QR
                </label>
                <select
                  id="qr-type-select"
                  value={qrType}
                  onChange={(e) => setQrType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant text-sm font-medium text-on-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary cursor-pointer"
                >
                  <option value="QR statis">QR statis</option>
                  <option value="QR dinamis">QR dinamis</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="store-input" className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                  Nama Toko (Merchant)
                </label>
                <input
                  id="store-input"
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </div>

              <div>
                <label htmlFor="nmid-input" className="block text-xs font-semibold text-on-surface-variant mb-1.5">
                  NMID Toko
                </label>
                <input
                  id="nmid-input"
                  type="text"
                  value={nmid}
                  onChange={(e) => setNmid(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant text-sm font-medium font-mono text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Card Rincian ID Transaksi Ter-generate */}
          <div className="bg-surface-container-low/60 border border-outline-variant/50 rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wide flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">tag</span>
                ID & Kode Transaksi Acak
              </span>
              <button
                type="button"
                onClick={handleRandomizeCodes}
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Acak Ulang
              </button>
            </div>

            <div className="bg-white rounded-2xl p-3.5 border border-outline-variant/40 space-y-3 text-xs">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="suffix-input" className="text-on-surface-variant font-medium">
                    Kode Suffix (Bawah Nominal):
                  </label>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold">
                    Pasti Akhiran ID
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-on-surface-variant font-semibold">
                    QRIS -
                  </span>
                  <input
                    id="suffix-input"
                    type="text"
                    value={randomSuffix}
                    onChange={(e) => setRandomSuffix(ensureSuffixEndsWithId(e.target.value))}
                    className="w-full pl-16 pr-3 py-1.5 rounded-xl border border-outline-variant font-mono font-bold text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-1 border-t border-outline-variant/30">
                <span className="text-on-surface-variant">No. Transaksi (Baris 1):</span>
                <span className="font-mono font-semibold text-on-surface">{txNumbers.part1}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">No. Transaksi (Baris 2):</span>
                <span className="font-mono font-semibold text-on-surface">
                  {txNumbers.part2}
                  <span className="text-primary font-bold">{txNumbers.part3}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Live Preview (Kanan) */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-3 px-1 max-w-[420px]">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-primary">visibility</span>
              Live Preview Struk
            </span>
            <span className="text-[11px] text-on-surface-variant/80 font-medium">
              Ukuran download: ~840px (pixelRatio: 2)
            </span>
          </div>

          {/* Kartu Struk QRIS yang dirender */}
          <div className="w-full flex justify-center py-2 px-1">
            <QrisReceiptCard
              ref={cardRef}
              amountText={formattedAmount}
              randomSuffix={randomSuffix}
              txPart1={txNumbers.part1}
              txPart2={txNumbers.part2}
              txPart3={txNumbers.part3}
              dateText={formattedDate}
              bank={bank}
              qrType={qrType}
              nmid={nmid}
              storeName={storeName}
              onCopyTx={handleCopyTx}
              onBackClick={() => showToast('Navigasi kembali (preview)')}
              onHelpClick={() => showToast('Bantuan transaksi QRIS CookPlan')}
            />
          </div>

          {/* Tombol Aksi di Bawah Preview */}
          <div className="w-full max-w-[420px] mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleRandomizeCodes}
              className="flex-1 py-3 px-4 border border-outline-variant bg-white hover:bg-surface-container-low text-on-surface rounded-full text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">casino</span>
              Acak Kode & ID
            </button>
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={downloading}
              className="flex-1 py-3 px-4 bg-primary hover:bg-primary/90 text-on-primary rounded-full text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95 disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-[18px] ${downloading ? 'animate-spin' : ''}`}>
                {downloading ? 'progress_activity' : 'download'}
              </span>
              {downloading ? 'Memproses...' : 'Download PNG'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
