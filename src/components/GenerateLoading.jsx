import { useState, useEffect } from 'react';

const TRIVIA_LIST = [
  {
    icon: 'lightbulb',
    title: 'Tahukah Kamu?',
    text: 'Menambahkan sedikit garam pada air mendidih membuat pasta atau sayuran matang lebih cepat dan mempertahankan warna segarnya.',
  },
  {
    icon: 'tips_and_updates',
    title: 'Trik Simpan Bahan',
    text: 'Menyimpan kentang bersama buah apel dalam satu wadah dapat mencegah kentang cepat bertunas berkat gas etilen alami dari apel.',
  },
  {
    icon: 'nutrition',
    title: 'Tips Nutrisi',
    text: 'Bawang putih cincang sebaiknya didiamkan selama 10 menit sebelum dimasak untuk mengaktifkan zat alisin, senyawa anti-radang alami.',
  },
  {
    icon: 'eco',
    title: 'Cegah Food Waste',
    text: 'CookPlan dirancang untuk membantumu mengurangi sisa makanan hingga 30% dengan menyusun belanja yang pas sesuai porsi!',
  },
  {
    icon: 'restaurant',
    title: 'Tips Memasak',
    text: 'Memotong wortel secara miring (diagonal) akan memperluas area permukaan potongan, membuatnya lebih cepat empuk saat ditumis atau direbus.',
  },
  {
    icon: 'opacity',
    title: 'Tips Minyak Zaitun',
    text: 'Minyak zaitun (extra virgin olive oil) memiliki titik asap rendah. Lebih baik digunakan sebagai dressing mentah dibanding untuk menggoreng.',
  },
  {
    icon: 'home_storage',
    title: 'Sayur Tetap Segar',
    text: 'Bungkus sayuran hijau dengan tisu dapur sebelum disimpan di dalam wadah kedap udara di kulkas untuk menyerap kelembapan berlebih.',
  }
];

const AI_STEPS = [
  { id: 1, label: 'Menganalisis profil & preferensi dietmu...' },
  { id: 2, label: 'Mengurasi resep bergizi & hemat budget...' },
  { id: 3, label: 'Mengalkulasi porsi & efisiensi bahan...' },
  { id: 4, label: 'Menyelaraskan dengan sisa bahan di pantry-mu...' },
  { id: 5, label: 'Meramu instruksi persiapan (FoodPrep) praktis...' }
];

export function GenerateLoading() {
  const [currentStep, setCurrentStep] = useState(0);
  const [triviaIndex, setTriviaIndex] = useState(0);
  const [stirCount, setStirCount] = useState(0);
  const [isWobbling, setIsWobbling] = useState(false);
  const [isStirring, setIsStirring] = useState(false);
  const [heat, setHeat] = useState(25); // initial heat
  const [particles, setParticles] = useState([]);
  const [combos, setCombos] = useState([]);

  const isSuperHeat = heat >= 100;

  // 1. Simulasi Progres AI (Step by step setiap 3.2 detik)
  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < AI_STEPS.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 3200);

    return () => clearInterval(stepInterval);
  }, []);

  // 2. Rotasi Trivia "Tahukah Kamu?" (Setiap 4.5 detik)
  useEffect(() => {
    const triviaInterval = setInterval(() => {
      setTriviaIndex((prev) => (prev + 1) % TRIVIA_LIST.length);
    }, 4500);

    return () => clearInterval(triviaInterval);
  }, []);

  // 3. Efek pengurangan panas alami (decay) setiap 100ms dengan kesulitan dinamis
  useEffect(() => {
    const decayInterval = setInterval(() => {
      setHeat((prev) => {
        if (prev <= 0) return 0;
        // Dynamic decay rate: semakin tinggi panas, semakin cepat menyusut!
        const decayFactor = 0.5 + (prev * 0.03);
        return Math.max(0, prev - decayFactor);
      });
    }, 100);

    return () => clearInterval(decayInterval);
  }, []);

  // 4. Efek cleanup partikel & kombo komik yang expired
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setParticles((prev) => prev.filter((p) => now - p.createdAt < 1000));
      setCombos((prev) => prev.filter((c) => now - c.createdAt < 1200));
    }, 400);

    return () => clearInterval(cleanupInterval);
  }, []);

  // Reset status goyang & aduk spatula
  useEffect(() => {
    if (isWobbling) {
      const timer = setTimeout(() => setIsWobbling(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isWobbling]);

  useEffect(() => {
    if (isStirring) {
      const timer = setTimeout(() => setIsStirring(false), 150);
      return () => clearTimeout(timer);
    }
  }, [isStirring]);

  // Kombo kata letupan komik dengan ikon Material Symbols
  const COMBO_TEXTS = [
    { text: 'SENSASIONAL', icon: 'bolt' },
    { text: 'KOKI LEGENDA', icon: 'restaurant' },
    { text: 'SANGAT PANAS', icon: 'local_fire_department' },
    { text: 'WANGI JUARA', icon: 'soup_kitchen' },
    { text: 'CHEF BINTANG 5', icon: 'star' },
    { text: 'GURIH MANTAP', icon: 'nutrition' },
    { text: 'KULINER MAJESTIK', icon: 'grade' },
    { text: 'PANAS GOKIL', icon: 'bolt' }
  ];

  const triggerComicPop = () => {
    const selectedCombo = COMBO_TEXTS[Math.floor(Math.random() * COMBO_TEXTS.length)];
    const newCombo = {
      id: Math.random(),
      text: selectedCombo.text,
      icon: selectedCombo.icon,
      x: Math.random() * 60 - 30, // x offset
      y: Math.random() * 40 - 65, // y offset di atas wajan
      createdAt: Date.now()
    };
    setCombos((prev) => [...prev, newCombo]);
  };

  // Aksi mengaduk masakan
  const handleStir = () => {
    setStirCount((prev) => prev + 1);
    setIsWobbling(true);
    setIsStirring(true);
    
    // Tambah panas (tambah 6% per adukan, diseimbangkan agar menantang tapi tetap bisa dicapai!)
    const heatGain = 6;
    setHeat((prev) => {
      const nextHeat = Math.min(100, prev + heatGain);
      
      // Pemicu wow effect kombo teks saat baru mencapai 100% atau diklik berulang saat superheat
      if (prev < 100 && nextHeat >= 100) {
        triggerComicPop();
      } else if (nextHeat >= 100 && Math.random() < 0.45) {
        triggerComicPop();
      }
      
      return nextHeat;
    });

    // Pemicu partikel cipratan berbasis Material Symbols
    const iconNames = isSuperHeat 
      ? ['local_fire_department', 'bolt', 'star', 'eco', 'nutrition'] 
      : ['eco', 'egg', 'nutrition', 'restaurant', 'cookie', 'bakery_dining', 'local_pizza', 'grain'];

    const count = isSuperHeat ? 6 : 4;
    const newParticles = Array.from({ length: count }).map(() => {
      // Arah menyebar ke atas (sudut 210 hingga 330 derajat)
      const angleDeg = Math.random() * 120 + 210;
      const angleRad = angleDeg * (Math.PI / 180);
      const distance = Math.random() * 80 + 50; // Jarak terbang
      const tx = Math.cos(angleRad) * distance;
      const ty = Math.sin(angleRad) * distance - 15; // Dorong vertikal lebih tinggi
      const rot = Math.random() * 360 - 180; // Sudut putar

      return {
        id: Math.random(),
        icon: iconNames[Math.floor(Math.random() * iconNames.length)],
        tx,
        ty,
        rot,
        createdAt: Date.now()
      };
    });

    setParticles((prev) => [...prev, ...newParticles]);
  };

  // Pesan interaktif berdasarkan jumlah adukan
  const getStirMessage = () => {
    if (isSuperHeat) return 'PANAS MAKSIMAL! Masakan mendidih sempurna!';
    if (stirCount === 0) return 'Goyang wajannya! Klik di wajan atau tombol di bawah.';
    if (stirCount <= 5) return 'Adukanmu wangi sekali!';
    if (stirCount <= 12) return 'Masakan diaduk merata! Mantap!';
    if (stirCount <= 22) return 'Wah, kamu calon chef bintang lima nih!';
    if (stirCount <= 35) return 'Luar biasa semangatmu! Panci mendidih!';
    return 'Waduh, wajannya hampir jebol saking cepatnya!';
  };

  const activeTrivia = TRIVIA_LIST[triviaIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas-white/85 backdrop-blur-md transition-all duration-300">
      {/* Efek Lingkaran Gradient di Latar Belakang */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl animate-spin-slow pointer-events-none -z-10 transition-colors duration-500 ${
        isSuperHeat ? 'bg-red-500/20' : 'bg-gradient-to-tr from-primary/10 to-secondary-container/30'
      }`} />

      <div className={`bg-white border p-6 sm:p-8 max-w-md w-full rounded-panel shadow-2xl text-center relative overflow-hidden flex flex-col items-center transition-colors duration-300 ${
        isSuperHeat ? 'border-red-500/30' : 'border-outline-variant/60'
      }`}>
        
        {/* Magic Wand / AI Header */}
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4 transition-all duration-300 ${
          isSuperHeat 
            ? 'bg-red-500/10 text-red-600 animate-pulse' 
            : 'bg-primary/10 text-primary animate-pulse'
        }`}>
          <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
          {isSuperHeat ? 'SUPER HEAT ACTIVE' : 'AI Chef Sedang Memasak'}
        </div>

        {/* Zona Animasi Masak Interaktif */}
        <div className="relative w-56 h-48 mb-2 flex items-center justify-center select-none">
          
          {/* Dudukan Kompor / Burner */}
          <div className={`absolute bottom-3 w-36 h-6 rounded-full blur-sm transition-colors duration-300 ${
            isSuperHeat ? 'bg-red-600/90' : 'bg-neutral-800/60'
          }`} />

          {/* Uap Panas Mengepul */}
          <div className="absolute top-12 left-[38%] flex gap-2 pointer-events-none z-10">
            <span className={`material-symbols-outlined text-xl animate-steam-1 ${
              isSuperHeat ? 'text-red-500/50' : 'text-primary/30'
            }`}>
              waves
            </span>
            <span className={`material-symbols-outlined text-xl animate-steam-2 ${
              isSuperHeat ? 'text-orange-500/50' : 'text-primary/30'
            }`}>
              waves
            </span>
          </div>

          {/* Partikel Efek Cipratan Makanan */}
          {particles.map((p) => (
            <span
              key={p.id}
              className={`absolute animate-particle material-symbols-outlined text-lg pointer-events-none select-none z-20 transition-colors ${
                isSuperHeat ? 'text-orange-500 font-bold' : 'text-primary/70'
              }`}
              style={{
                '--tx': `${p.tx}px`,
                '--ty': `${p.ty}px`,
                '--rot': `${p.rot}deg`,
                left: '50%',
                top: '55%',
              }}
            >
              {p.icon}
            </span>
          ))}

          {/* Kombo Teks Komik Melayang */}
          {combos.map((c) => (
            <div
              key={c.id}
              className="absolute animate-comic-pop z-30 pointer-events-none select-none"
              style={{
                left: `calc(50% + ${c.x}px)`,
                top: `calc(40% + ${c.y}px)`,
              }}
            >
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider text-white border-2 border-black bg-gradient-to-r from-amber-500 to-red-600 shadow-[2px_2px_0px_0px_#000] rotate-[-5deg]">
                <span className="material-symbols-outlined text-[13px] shrink-0 font-black">{c.icon}</span>
                <span>{c.text}</span>
              </span>
            </div>
          ))}

          {/* Wajan/Panci Masak AI Generated Image */}
          <button
            type="button"
            onClick={handleStir}
            className={`relative z-10 cursor-pointer focus:outline-none transition-transform active:scale-95 ${
              isWobbling ? 'animate-wobble-pan' : 'hover:scale-[1.03]'
            }`}
            aria-label="Aduk masakan"
          >
            <img
              src="/img/cooking_wok.png"
              alt="Wajan CookPlan"
              className="w-36 h-36 object-contain select-none pointer-events-none"
            />
          </button>

          {/* Spatula Kayu AI Generated Image */}
          <img
            src="/img/wooden_spatula.png"
            alt="Spatula"
            className="absolute w-24 h-24 object-contain pointer-events-none select-none z-15 origin-bottom-left transition-all duration-150"
            style={{
              left: '42%',
              top: '8%',
              transform: isStirring 
                ? 'rotate(45deg) translate(-8px, -18px) scale(1.05)' 
                : 'rotate(15deg) translate(8px, 0px)',
            }}
          />

          {/* Bubbles di dalam panci saat bergoyang */}
          {isWobbling && (
            <div className="absolute bottom-14 flex gap-1 pointer-events-none z-20">
              <div className="w-1.5 h-1.5 bg-amber-200 rounded-full animate-ping" />
              <div className="w-2.5 h-2.5 bg-orange-400/30 rounded-full animate-bounce" />
            </div>
          )}
        </div>

        {/* Heat Meter (Pengukur Panas Kompor) */}
        <div className="w-full max-w-[240px] mb-4">
          <div className="flex justify-between items-center text-[10px] font-bold text-on-surface-variant mb-1">
            <span>SUHU KOMPOR</span>
            <span className={isSuperHeat ? 'text-red-600 font-extrabold animate-pulse' : 'text-primary'}>
              {isSuperHeat ? 'SUPER HEAT!' : `${Math.round(heat)}%`}
            </span>
          </div>
          <div className={`w-full h-2.5 bg-surface-container rounded-full overflow-hidden border transition-all ${
            isSuperHeat ? 'animate-super-heat border-red-500/50' : 'border-outline-variant/20'
          }`}>
            <div 
              className={`h-full transition-all duration-75 ease-out bg-gradient-to-r ${
                isSuperHeat 
                  ? 'from-amber-400 via-orange-500 to-red-600' 
                  : 'from-amber-400 to-orange-500'
              }`}
              style={{ width: `${heat}%` }}
            />
          </div>
        </div>

        {/* Status Goyang Wajan */}
        <div className="mb-4">
          <p className="text-xs text-on-surface-variant font-medium min-h-8 max-w-[300px] leading-relaxed">
            {getStirMessage()}
          </p>
          {stirCount > 0 && (
            <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded transition-all duration-300 ${
              isSuperHeat ? 'bg-red-500/10 text-red-600' : 'bg-surface-container-high text-primary'
            }`}>
              Adukan: {stirCount}×
            </span>
          )}
        </div>

        {/* Tombol Interaktif "Aduk Masakan" (Alternatif dari klik wajan langsung) */}
        <button
          onClick={handleStir}
          className={`mb-5 px-5 py-2.5 rounded-full font-bold text-xs shadow transition-all active:scale-95 cursor-pointer inline-flex items-center justify-center gap-1.5 ${
            isSuperHeat 
              ? 'bg-red-600 hover:bg-red-700 text-white animate-bounce' 
              : 'bg-primary hover:bg-primary-container text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[15px] shrink-0">
            {isSuperHeat ? 'local_fire_department' : 'soup_kitchen'}
          </span>
          <span>{isSuperHeat ? 'ADUK SUPER CEPAT!' : 'Aduk Masakan'}</span>
        </button>

        {/* Divider tipis */}
        <div className="w-full h-px bg-outline-variant/40 mb-4" />

        {/* AI Agent Status Tracker (Checklist) */}
        <div className="w-full space-y-2 text-left mb-5">
          {AI_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isActive = idx === currentStep;

            return (
              <div 
                key={step.id} 
                className={`flex items-center gap-2.5 text-xs transition-opacity duration-300 ${
                  isActive ? 'text-primary font-semibold' : isCompleted ? 'text-on-surface-variant/75' : 'text-on-surface-variant/40'
                }`}
              >
                {isCompleted ? (
                  <span className="material-symbols-outlined text-success-green text-[18px] shrink-0 font-bold">
                    check_circle
                  </span>
                ) : isActive ? (
                  <span className="material-symbols-outlined text-primary text-[18px] shrink-0 animate-spin">
                    progress_activity
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-[18px] shrink-0 text-outline-variant">
                    radio_button_unchecked
                  </span>
                )}
                <span className="truncate">{step.label}</span>
              </div>
            );
          })}
        </div>

        {/* Trivia Box (Tahukah Kamu?) */}
        <div className="w-full bg-surface-container-low border border-primary/10 rounded-2xl p-4 text-left relative min-h-28 transition-all duration-300 animate-fade-in">
          <div className="flex items-center gap-1.5 text-primary font-bold text-xs mb-1.5">
            <span className="material-symbols-outlined text-[16px]">{activeTrivia.icon}</span>
            <span>{activeTrivia.title}</span>
          </div>
          <p className="text-on-surface-variant text-[11.5px] leading-relaxed transition-opacity duration-300">
            {activeTrivia.text}
          </p>
        </div>

        {/* Catatan waktu */}
        <p className="mt-4 text-[9px] text-on-surface-variant/50">
          AI sedang menyusun menu... Tunggu sebentar ya...
        </p>
      </div>
    </div>
  );
}
