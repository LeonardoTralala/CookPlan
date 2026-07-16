import { Navbar } from "../components/Navbar.jsx";
import { Footer } from "../components/Footer.jsx";
import { Toast } from "../components/Toast.jsx";

export function PrivacyPolicy({ onNavigate }) {
  return (
    <div className="font-body-md text-on-surface bg-canvas-white min-h-dvh flex flex-col antialiased">
      <Navbar onNavigate={onNavigate} />
      <main className="flex-grow hero-gradient pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="bg-surface-container-lowest rounded-[32px] p-8 md:p-12 shadow-xl border border-outline-variant/30 space-y-8">
            <div>
              <h1 className="font-headline-xl text-headline-xl text-primary leading-tight mb-4">
                Kebijakan Privasi
              </h1>
              <p className="text-on-surface-variant text-sm">
                Terakhir diperbarui: 7 Juni 2026
              </p>
            </div>

            <div className="space-y-6 text-on-surface-variant leading-relaxed">
              <section>
                <h2 className="font-headline-md text-on-surface mb-3">1. Pendahuluan</h2>
                <p>
                  Selamat datang di CookPlan. Kami menghargai privasi Anda dan berkomitmen untuk melindungi data pribadi yang Anda bagikan kepada kami. Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, membagikan, dan melindungi informasi Anda saat menggunakan platform CookPlan, termasuk layanan perencanaan masakan dan pemesanan bahan dari mitra lokal.
                </p>
              </section>

              <section>
                <h2 className="font-headline-md text-on-surface mb-3">2. Data yang Kami Kumpulkan</h2>
                <p>Untuk memberikan layanan yang optimal, terutama terkait dengan akun dan fitur pengiriman bahan masakan, kami mengumpulkan data pribadi berikut:</p>
                <ul className="list-disc pl-5 mt-2 space-y-2">
                  <li><strong>Informasi Profil:</strong> Nama lengkap dan alamat email (untuk pembuatan akun dan otentikasi).</li>
                  <li><strong>Informasi Kontak & Logistik:</strong> Nomor telepon dan alamat pengiriman lengkap.</li>
                  <li><strong>Preferensi Pengguna:</strong> Preferensi makanan dan informasi alergi yang Anda berikan untuk personalisasi rekomendasi resep mingguan.</li>
                </ul>
              </section>

              <section>
                <h2 className="font-headline-md text-on-surface mb-3">3. Penggunaan Data</h2>
                <p>Data Anda kami gunakan untuk tujuan berikut:</p>
                <ul className="list-disc pl-5 mt-2 space-y-2">
                  <li>Menyediakan layanan inti seperti rekomendasi resep, kalkulasi porsi, dan pembuatan daftar belanja otomatis.</li>
                  <li>Memfasilitasi proses pemesanan dan pengiriman bahan makanan segar dari mitra lokal ke alamat Anda.</li>
                  <li>Meningkatkan pengalaman pengguna dan mengembangkan fitur-fitur baru di CookPlan.</li>
                  <li>Berkomunikasi dengan Anda mengenai pembaruan layanan, masalah keamanan, atau dukungan pelanggan.</li>
                </ul>
              </section>

              <section>
                <h2 className="font-headline-md text-on-surface mb-3">4. Pembagian Data dengan Pihak Ketiga</h2>
                <p>Kami sangat menjaga kerahasiaan data Anda dan tidak menjual data pribadi Anda kepada siapa pun. Namun, agar fitur pemesanan dan logistik CookPlan dapat berjalan, kami membagikan data Anda dengan ketentuan berikut:</p>
                <ul className="list-disc pl-5 mt-2 space-y-2">
                  <li><strong>Mitra Penjual & Kurir:</strong> Data alamat pengiriman, nama pemesan, dan nomor telepon <strong>hanya dibagikan</strong> kepada mitra produsen/distributor dan kurir yang menangani pesanan Anda secara langsung. Informasi ini sangat dibatasi hanya pada hal-hal yang dibutuhkan untuk kelancaran pengiriman pesanan Anda.</li>
                </ul>
              </section>

              <section>
                <h2 className="font-headline-md text-on-surface mb-3">5. Hak Pengguna & Penghapusan Data</h2>
                <p>Anda memiliki kendali penuh atas data yang Anda simpan di CookPlan:</p>
                <ul className="list-disc pl-5 mt-2 space-y-2">
                  <li><strong>Penghapusan Akun & Data:</strong> Ya, Anda dapat meminta penghapusan akun Anda beserta <strong>seluruh data pribadi</strong> kapan saja melalui pengaturan akun di dalam aplikasi, atau dengan menghubungi tim dukungan kami. Data Anda akan dihapus secara permanen dari server kami.</li>
                  <li><strong>Pembaruan Data:</strong> Anda bebas memperbarui atau mengubah informasi profil, alamat pengiriman, dan preferensi masakan Anda secara mandiri di halaman profil.</li>
                </ul>
              </section>

              <section>
                <h2 className="font-headline-md text-on-surface mb-3">6. Keamanan Data</h2>
                <p>
                  Kami menggunakan praktik keamanan standar industri terbaik dan bekerja sama dengan penyedia layanan infrastruktur cloud yang terpercaya untuk melindungi data pribadi Anda dari akses, modifikasi, atau pengungkapan yang tidak sah. Data Anda diamankan dan dienkripsi baik saat ditransmisikan maupun saat disimpan.
                </p>
              </section>

              <section>
                <h2 className="font-headline-md text-on-surface mb-3">7. Hubungi Kami</h2>
                <p>
                  Jika Anda memiliki pertanyaan lebih lanjut, saran, atau kekhawatiran mengenai Kebijakan Privasi ini, jangan ragu untuk menghubungi kami melalui <a href="mailto:cookplanofficial@gmail.com" className="text-primary hover:underline font-semibold">cookplanofficial@gmail.com</a>.
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
