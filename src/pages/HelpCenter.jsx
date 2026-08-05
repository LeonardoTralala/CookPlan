import { useState } from "react";
import { Navbar } from "../components/Navbar.jsx";
import { Footer } from "../components/Footer.jsx";
import { Toast } from "../components/Toast.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { SEOHead } from "../components/SEOHead.jsx";

const FAQ_ITEMS = [
  {
    question: "Bagaimana cara merencanakan menu mingguan?",
    answer: "Setelah mendaftar, kamu bisa masuk ke halaman 'Katalog Resep'. Dapatkan rekomendasi resep yang sesuai dengan preferensimu, tentukan porsi serta hari memasaknya, lalu klik 'Tambahkan ke Rencana'. Sistem kami akan otomatis mengatur jadwal mingguanmu."
  },
  {
    question: "Apakah saya bisa mengubah daftar belanja otomatis?",
    answer: "Tentu saja! Daftar belanja yang dibuat otomatis dari rencana menumu sepenuhnya bisa kamu edit. Kamu bisa menghapus bahan yang sudah ada di kulkas atau menambah item lain sesuai kebutuhan."
  },
  {
    question: "Bagaimana sistem pengiriman bahan makanan bekerja?",
    answer: "Setelah kamu memfinalisasi rencana belanja, kamu bisa menekan tombol 'Pesan Bahan'. Pesanan akan diteruskan ke mitra produsen dan distributor lokal kami terdekat, lalu kurir akan mengantarkan bahan segar tersebut ke alamatmu sesuai slot waktu yang kamu pilih."
  },
  {
    question: "Apakah CookPlan tersedia di kota saya?",
    answer: "Saat ini untuk fase rilis awal, layanan CookPlan baru mencakup wilayah Kota Malang. Namun, fitur perencanaan menu dan daftar belanja dapat digunakan oleh siapa saja di seluruh Indonesia."
  },
  {
    question: "Apa metode pembayaran yang didukung?",
    answer: "Kami mendukung berbagai metode pembayaran, mulai dari transfer bank (Virtual Account), e-Wallet (GoPay, OVO, ShopeePay), hingga pembayaran QRIS."
  }
];

export function HelpCenter({ onNavigate }) {
  const [openIndex, setOpenIndex] = useState(null);

  const { user } = useAuth();
  const isLoggedIn = !!user;

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const handleOpenFeedback = () => {
    window.dispatchEvent(new CustomEvent('trigger-feedback-modal', {
      detail: { category: 'saran' }
    }));
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <div className="font-body-md text-on-surface bg-canvas-white min-h-dvh flex flex-col antialiased">
      <SEOHead
        title="Pusat Bantuan & FAQ | CookPlan"
        description="Panduan lengkap penggunaan CookPlan, pertanyaan umum seputar rencana menu harian, belanja bahan otomatis, serta layanan pengiriman."
        canonicalUrl="https://cookplan.id/help"
        jsonLd={faqSchema}
      />
      <Navbar onNavigate={onNavigate} />
      <main className="flex-grow hero-gradient pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop space-y-12">

          {/* Header Bantuan */}
          <div className="text-center space-y-4">
            <h1 className="font-headline-xl text-headline-xl text-primary leading-tight">
              Pusat Bantuan
            </h1>
            <p className="text-on-surface-variant max-w-xl mx-auto text-lg">
              Ada yang bisa kami bantu? Temukan jawaban dari pertanyaan yang paling sering diajukan seputar layanan CookPlan.
            </p>
          </div>

          {/* Search Bar (Visual Only) */}
          <div className="max-w-2xl mx-auto relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
              search
            </span>
            <input
              type="text"
              placeholder="Cari bantuan (misalnya: 'cara ganti kata sandi')..."
              className="w-full pl-12 pr-4 py-4 rounded-full bg-surface-container-lowest border border-outline-variant/30 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-sm"
            />
          </div>

          {/* FAQ Accordion */}
          <div className="bg-surface-container-lowest rounded-[32px] p-6 md:p-10 shadow-xl border border-outline-variant/30">
            <h2 className="font-headline-lg text-primary mb-6">Pertanyaan Populer (FAQ)</h2>
            <div className="space-y-4">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openIndex === index;
                return (
                  <div key={index} className="border border-outline-variant/30 rounded-2xl overflow-hidden transition-all duration-200">
                    <button
                      onClick={() => toggleFAQ(index)}
                      className="w-full px-6 py-5 flex items-center justify-between text-left bg-canvas-white hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      <span className="font-headline-md text-base text-on-surface pr-4">{item.question}</span>
                      <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                        expand_more
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5 pt-2 bg-canvas-white">
                        <p className="text-on-surface-variant leading-relaxed">
                          {item.answer}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contact Support */}
          <div className="bg-primary-container/30 rounded-[32px] p-8 md:p-10 text-center border border-primary/10">
            <span className="material-symbols-outlined text-4xl text-primary mb-4 block">
              support_agent
            </span>
            <h2 className="font-headline-lg text-primary mb-3">Masih Butuh Bantuan?</h2>
            <p className="text-on-surface-variant max-w-lg mx-auto mb-6">
              Tim bantuan kami selalu siap membantumu. Jangan ragu untuk menghubungi kami jika pertanyaanmu belum terjawab di FAQ.
            </p>
            {isLoggedIn ? (
              <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
                <a
                  href="mailto:cookplanofficial@gmail.com"
                  className="inline-flex py-3 px-8 border border-primary text-primary rounded-full font-label-md text-label-md hover:bg-primary/5 transition cursor-pointer font-semibold items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">mail</span>
                  Hubungi via Email
                </a>
                <button
                  onClick={handleOpenFeedback}
                  className="inline-flex py-3 px-8 bg-primary text-on-primary rounded-full font-label-md text-label-md hover:shadow-lg active:scale-95 transition cursor-pointer font-semibold items-center gap-2 border-none"
                >
                  <span className="material-symbols-outlined text-[18px]">rate_review</span>
                  Kirim Masukan &amp; Saran
                </button>
              </div>
            ) : (
              <a
                href="mailto:cookplanofficial@gmail.com"
                className="inline-flex py-3 px-8 bg-primary text-on-primary rounded-full font-label-md text-label-md hover:shadow-lg transition-shadow cursor-pointer font-semibold items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">mail</span>
                Hubungi Bantuan via Email
              </a>
            )}
          </div>

        </div>
      </main>
      <Footer />
      <Toast />
    </div>
  );
}
