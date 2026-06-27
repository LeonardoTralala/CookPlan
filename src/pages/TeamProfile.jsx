import { Navbar } from "../components/Navbar.jsx";
import { Footer } from "../components/Footer.jsx";
import { Toast } from "../components/Toast.jsx";

// Data anggota tim — placeholder, mudah diganti dengan data asli nanti.
// Setiap kartu pakai lg:col-span-2 agar membentuk grid bento di 6 kolom.
const TEAM_MEMBERS = [
  {
    name: 'Zilfi Alvin Mubarok',
    role: 'Direktur Utama',
    desc: 'Mengatur visi proyek dan memastikan seluruh elemen tim selaras dengan misi CookPlan.',
    image: '/foto/al.jpeg'
  },
  {
    name: 'Tiara Eka Wahyuningayu Vasha',
    role: 'Manajer IT',
    desc: 'Bertanggung jawab atas arsitektur sistem, pengembangan fitur, dan pengalaman digital pengguna.',
    image: '/foto/rara.jpeg'
  },
  {
    name: 'Tri Khusnul Hidayati',
    role: 'Manajer Operasional',
    desc: 'Memastikan alur kerja harian dan integrasi produk dengan petani lokal berjalan lancar.',
    image: '/foto/aul.jpeg'
  },
  {
    name: 'Irma Ramadia Hakim',
    role: 'Manajer Keuangan',
    desc: 'Mengelola efisiensi anggaran, pembukuan, dan memastikan keberlanjutan bisnis CookPlan.',
    image: '/foto/irma.jpeg'
  },
  {
    name: 'Nanda Maharani',
    role: 'Manajer Marketing',
    desc: 'Merancang strategi promosi dan kampanye kreatif untuk mendekatkan CookPlan dengan masyarakat.',
    image: '/foto/nanda.jpeg'
  }
];

const ADVISOR = {
  name: 'Dr. Uke Prajogo, S.TP., M.M., CMA',
  quote:
    'Membimbing tim berbakat ini melalui program PKM-K sangat membanggakan. Dedikasi mereka dalam memecahkan masalah gizi dan efisiensi waktu melalui platform inovatif patut diapresiasi.',
  faculty: 'Dosen Pembimbing PKM-K',
  image: '/foto/p uke.jpeg'
};

export function TeamProfile({ onNavigate }) {
  return (
    <div className="bg-canvas-white text-on-surface min-h-dvh flex flex-col antialiased">
      <Navbar onNavigate={onNavigate} />
      <main className="flex-grow pt-24 pb-16">
        {/* ---------------- Hero ---------------- */}
      <section className="w-full max-w-container-max mx-auto px-5 md:px-10 section-padding text-center flex flex-col items-center">
        <h1 className="font-headline-xl text-headline-lg md:text-headline-xl tracking-tight text-primary max-w-3xl mb-6 leading-tight">
          Perencanaan Masak Praktis untuk Kamu yang Super Sibuk
        </h1>
        <p className="text-lg text-on-surface-variant max-w-2xl mb-12 leading-relaxed">
          Terinspirasi dari tantangan sehari-hari mahasiswa dan pekerja kantoran, CookPlan hadir untuk
          membawa kembali keteraturan, kesehatan, dan kesederhanaan ke dapur. Kami percaya makanan
          yang baik tidak seharusnya menjadi sumber stres.
        </p>
        {/* Foto Bersama */}
        <div className="w-full max-w-4xl h-48 md:h-64 rounded-3xl overflow-hidden bg-surface-variant flex items-center justify-center shadow-md mx-auto">
          <img src="/foto/bersama.jpeg" alt="Foto Bersama Tim CookPlan" className="w-full h-full object-cover object-[center_55%]" />
        </div>
      </section>

      {/* ---------------- Meet the Team ---------------- */}
      <section className="w-full bg-canvas-white section-padding">
        <div className="max-w-container-max mx-auto px-5 md:px-10">
          <div className="mb-12 text-center md:text-left">
            <h2 className="font-headline-lg text-headline-md md:text-headline-lg text-on-surface mb-4">Kenali Tim Kami</h2>
            <p className="text-base text-on-surface-variant">
              Tim penuh semangat yang siap membangun asisten dapur andalanmu berikutnya!
            </p>
          </div>

          {/* Horizontal Scroll (Netflix style) */}
          <div className="flex overflow-x-auto hide-scrollbar gap-6 pb-8 -mx-5 px-5 md:-mx-10 md:px-10 snap-x snap-mandatory">
            {TEAM_MEMBERS.map((member) => (
              <div
                key={member.name}
                className="w-[280px] md:w-[320px] shrink-0 snap-center bg-surface-cream rounded-3xl p-8 flex flex-col items-center text-center transition-transform hover:-translate-y-1 duration-300"
              >
                <div className="w-32 h-32 rounded-full mb-6 overflow-hidden border-4 border-canvas-white bg-surface-variant flex items-center justify-center shadow-sm">
                  {member.image ? (
                    <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-[64px] text-primary opacity-50">
                      account_circle
                    </span>
                  )}
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-2">{member.name}</h3>
                <span className="text-sm font-semibold text-primary bg-surface-container-low px-4 py-1 rounded-full mb-4">
                  {member.role}
                </span>
                <p className="text-base text-on-surface-variant mt-auto">{member.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Project Advisor ---------------- */}
      <section className="w-full bg-surface section-padding border-t border-outline-variant/30">
        <div className="max-w-container-max mx-auto px-5 md:px-10">
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12 bg-canvas-white rounded-3xl p-8 md:p-12 shadow-sm border border-outline-variant/50">
            <div className="w-40 h-40 md:w-48 md:h-48 flex-shrink-0 rounded-2xl bg-surface-variant flex items-center justify-center shadow-md overflow-hidden">
              {ADVISOR.image ? (
                <img src={ADVISOR.image} alt={ADVISOR.name} className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-[80px] text-primary opacity-50">
                  account_circle
                </span>
              )}
            </div>
            <div className="flex flex-col items-center md:items-start text-center md:text-left">
              <div className="flex items-center gap-2 mb-2 text-primary">
                <span className="material-symbols-outlined fill">verified</span>
                <span className="text-xs font-semibold uppercase tracking-widest text-primary-container">
                  Dosen Pembimbing
                </span>
              </div>
              <h2 className="font-headline-md text-headline-md md:text-headline-lg text-on-surface mb-4">{ADVISOR.name}</h2>
              <p className="text-lg text-on-surface-variant mb-6 max-w-2xl leading-relaxed italic">
                &ldquo;{ADVISOR.quote}&rdquo;
              </p>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-secondary">
                <span className="material-symbols-outlined text-[18px]">school</span>
                {ADVISOR.faculty}
              </span>
            </div>
          </div>
        </div>
      </section>
      </main>
      <Footer />
      <Toast />
    </div>
  );
}
