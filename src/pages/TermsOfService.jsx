import { Navbar } from "../components/Navbar.jsx";
import { Footer } from "../components/Footer.jsx";
import { Toast } from "../components/Toast.jsx";

export function TermsOfService({ onNavigate }) {
  return (
    <div className="font-body-md text-on-surface bg-canvas-white min-h-dvh flex flex-col antialiased">
      <Navbar onNavigate={onNavigate} />
      <main className="flex-grow hero-gradient pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="bg-surface-container-lowest rounded-[32px] p-8 md:p-12 shadow-xl border border-outline-variant/30 space-y-8">
            <div>
              <h1 className="font-headline-xl text-headline-xl text-primary leading-tight mb-4">
                Syarat dan Ketentuan
              </h1>
              <p className="text-on-surface-variant text-sm">
                Terakhir diperbarui: 7 Juni 2026
              </p>
            </div>

            <div className="space-y-6 text-on-surface-variant leading-relaxed">
              <section>
                <h2 className="font-headline-md text-on-surface mb-3">1. Penerimaan Syarat</h2>
                <p>
                  Dengan mengakses dan menggunakan aplikasi CookPlan, Anda menyetujui untuk terikat oleh Syarat dan Ketentuan ini. Jika Anda tidak setuju dengan bagian mana pun dari syarat ini, Anda tidak diperkenankan untuk menggunakan layanan kami.
                </p>
              </section>

              <section>
                <h2 className="font-headline-md text-on-surface mb-3">2. Deskripsi Layanan</h2>
                <p>
                  CookPlan adalah platform digital yang menyediakan layanan perencanaan menu masakan mingguan, pembuatan daftar belanja otomatis, dan memfasilitasi pemesanan bahan makanan segar dari produsen/distributor lokal. Kami bertindak sebagai penyedia teknologi yang menghubungkan Anda dengan mitra penyedia bahan makanan.
                </p>
              </section>

              <section>
                <h2 className="font-headline-md text-on-surface mb-3">3. Akun Pengguna</h2>
                <ul className="list-disc pl-5 mt-2 space-y-2">
                  <li>Anda wajib memberikan informasi yang akurat dan lengkap saat mendaftar.</li>
                  <li>Anda bertanggung jawab penuh untuk menjaga kerahasiaan kata sandi dan keamanan akun Anda.</li>
                  <li>CookPlan berhak untuk menangguhkan atau menghapus akun yang melanggar ketentuan atau terlibat dalam aktivitas mencurigakan.</li>
                </ul>
              </section>

              <section>
                <h2 className="font-headline-md text-on-surface mb-3">4. Pemesanan dan Pengiriman</h2>
                <ul className="list-disc pl-5 mt-2 space-y-2">
                  <li><strong>Ketersediaan:</strong> Semua pesanan tunduk pada ketersediaan stok dari mitra lokal kami. Kami berhak membatalkan pesanan jika bahan tidak tersedia.</li>
                  <li><strong>Pengiriman:</strong> Waktu pengiriman yang tertera adalah estimasi. CookPlan tidak bertanggung jawab atas keterlambatan yang disebabkan oleh cuaca, lalu lintas, atau kendala logistik dari pihak ketiga (kurir).</li>
                  <li><strong>Kualitas Produk:</strong> Jika terdapat bahan yang rusak atau tidak sesuai saat diterima, keluhan harus disampaikan maksimal 1x24 jam setelah pesanan diterima melalui layanan Bantuan kami.</li>
                </ul>
              </section>

              <section>
                <h2 className="font-headline-md text-on-surface mb-3">5. Harga dan Pembayaran</h2>
                <p>
                  Harga bahan makanan yang tertera di aplikasi dapat berubah sewaktu-waktu tanpa pemberitahuan sebelumnya mengikuti fluktuasi pasar. Pembayaran harus diselesaikan melalui metode pembayaran yang tersedia di dalam aplikasi sebelum pesanan diproses.
                </p>
              </section>

              <section>
                <h2 className="font-headline-md text-on-surface mb-3">6. Batasan Tanggung Jawab</h2>
                <p>
                  CookPlan tidak bertanggung jawab atas kerugian tidak langsung, insidental, atau konsekuensial yang timbul dari penggunaan platform ini. Layanan disediakan secara "sebagaimana adanya" (as is) tanpa jaminan apa pun, baik tersurat maupun tersirat.
                </p>
              </section>

              <section>
                <h2 className="font-headline-md text-on-surface mb-3">7. Perubahan Syarat & Ketentuan</h2>
                <p>
                  Kami berhak memperbarui Syarat dan Ketentuan ini kapan saja untuk menyesuaikan dengan regulasi atau fitur baru. Perubahan akan berlaku segera setelah dipublikasikan di halaman ini. Penggunaan layanan secara berkelanjutan berarti Anda menyetujui perubahan tersebut.
                </p>
              </section>
            </div>
            
            <div className="pt-8 mt-8 border-t border-outline-variant/30 flex justify-center">
              <button
                onClick={() => (onNavigate ? onNavigate("overview") : null)}
                className="py-3 px-8 bg-primary text-on-primary rounded-full font-label-md text-label-md hover:shadow-lg transition-shadow cursor-pointer font-semibold inline-flex items-center gap-2"
              >
                Kembali ke Beranda
              </button>
            </div>

          </div>
        </div>
      </main>
      <Footer />
      <Toast />
    </div>
  );
}
