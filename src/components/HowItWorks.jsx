const steps = [
  {
    icon: "menu_book",
    title: "Rekomendasi Resep",
    desc: "Dapatkan rekomendasi berbagai resep yang cocok untuk semua gaya hidup dan kebutuhanmu.",
  },
  {
    icon: "calendar_month",
    title: "Atur Jadwal",
    desc: "Atur jadwal memasakmu, rencanakan menu sesuai kebutuhan dan nutrisi harianmu.",
  },
  {
    icon: "local_mall",
    title: "Belanja Otomatis",
    desc: "Daftar belanja langsung terkirim ke pemasok lokal dan bahan segar sampai di depan pintu.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="section-padding bg-canvas-white px-margin-mobile md:px-margin-desktop"
    >
      <div className="max-w-container-max mx-auto text-center mb-10 md:mb-16">
        <h2 className="font-headline-lg text-headline-lg text-primary mb-4">Cara Kerja CookPlan</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Hanya butuh 3 langkah mudah untuk mempermudah hidupmu.
        </p>
      </div>
      <div className="max-w-container-max mx-auto grid md:grid-cols-3 gap-6 md:gap-8">
        {steps.map((step) => (
          <div
            key={step.title}
            className="p-6 md:p-8 bg-surface-container-low rounded-3xl border border-outline-variant/30 flex flex-col items-center text-center hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 md:w-16 md:h-16 bg-primary-container rounded-2xl flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-on-primary-container text-3xl">
                {step.icon}
              </span>
            </div>
            <h3 className="font-headline-md text-headline-md text-primary mb-3">{step.title}</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
