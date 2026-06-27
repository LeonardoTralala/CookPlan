import { whyImages } from "../utils/recipes.js";

const benefits = [
  {
    icon: "eco",
    title: "Efisien dan Mudah",
    desc: "Atur jadwal masak mingguan. Sesuaikan dengan porsi yang kamu butuhkan tanpa ribet.",
  },
  {
    icon: "schedule",
    title: "Hemat Waktu Berharga",
    desc: 'Hentikan kebingungan "masak apa hari ini" dan kurangi waktu belanja di pasar hingga 70%.',
  },
  {
    icon: "payments",
    title: "Hemat Anggaran",
    desc: "Belanja bahan sesuai dengan anggaran yang kamu tentukan. Kami menyarankan alternatif bahan yang lebih hemat.",
  },
];

export function WhyCookPlan() {
  return (
    <section className="section-padding bg-surface px-margin-mobile md:px-margin-desktop overflow-hidden">
      <div className="max-w-container-max mx-auto grid md:grid-cols-2 gap-16 items-center">
        <div className="order-2 md:order-1 relative">
          <div className="grid grid-cols-2 gap-4">
            <img
              className="w-full h-64 sm:h-80 object-cover rounded-3xl shadow-md mt-12 transition-transform hover:scale-[1.02] duration-300"
              alt="Vibrant local farmers market scene"
              src={whyImages[0]}
              loading="lazy"
              onError={(e) => { e.currentTarget.src = '/img/recipe-placeholder.svg'; }}
            />
            <img
              className="w-full h-64 sm:h-80 object-cover rounded-3xl shadow-md transition-transform hover:scale-[1.02] duration-300"
              alt="Clean kitchen counter with prepped vegetables"
              src={whyImages[1]}
              loading="lazy"
              onError={(e) => { e.currentTarget.src = '/img/recipe-placeholder.svg'; }}
            />
          </div>
        </div>
        <div className="order-1 md:order-2 space-y-12">
          <h2 className="font-headline-lg text-headline-lg text-primary">Apa Keunggulan CookPlan?</h2>
          <div className="space-y-8">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="flex gap-6">
                <span
                  className="material-symbols-outlined text-primary text-3xl font-semibold"
                  style={{ fontVariationSettings: '"FILL" 1' }}
                >
                  {benefit.icon}
                </span>
                <div>
                  <h3 className="text-xl font-bold text-on-surface mb-1">{benefit.title}</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant">{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
