# PRD: Resep Kreasi Pengguna (User-Created Recipes)

> **Status:** Draft  
> **Tanggal:** 2026-07-29  
> **Branch:** `feature/user-created-recipes`  
> **Author:** Tim CookPlan (PKM-K 2026)

---

## 1. Ringkasan Eksekutif

Fitur **Resep Kreasi Pengguna** memungkinkan pengguna CookPlan membuat resep sendiri dan
mempublikasikannya agar bisa diakses oleh seluruh komunitas pengguna CookPlan. Resep komunitas
dapat disimpan (bookmark), dimasukkan ke **Weekly Planner**, dan turut dihitung di **Shopping List** —
sama seperti resep ofisial CookPlan.

### Tujuan Strategis

| Aspek               | Dampak                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------- |
| **UGC & Skalabilitas** | Konten resep tumbuh organik dari komunitas, mengurangi beban tim kurasi manual.           |
| **Social Effect**    | Pengguna bangga saat resepnya dipakai orang lain; membangun komunitas kuliner CookPlan.   |
| **Retention**        | CookPlan menjadi "buku resep digital pribadi" — semakin banyak data, semakin sulit pindah. |
| **Nilai PKM-K**      | Membuktikan CookPlan memiliki ekosistem komunitas aktif, bukan sekadar tool pasif.        |

---

## 2. User Stories

### Pengguna Pembuat Resep (Creator)

| ID    | Cerita                                                                                               | Prioritas |
| ----- | ---------------------------------------------------------------------------------------------------- | --------- |
| US-01 | Sebagai pengguna, saya ingin membuat resep baru lengkap dengan judul, foto, bahan, dan langkah masak | P0        |
| US-02 | Sebagai pengguna, saya ingin memilih status resep saya: **Publik** (dilihat semua) atau **Draf** (pribadi) | P0        |
| US-03 | Sebagai pengguna, saya ingin mengedit atau menghapus resep yang saya buat                            | P0        |
| US-04 | Sebagai pengguna, saya ingin melihat daftar semua resep yang saya buat di satu halaman ("Resep Saya") | P0        |
| US-05 | Sebagai pengguna, saya ingin memasukkan resep buatan saya ke Weekly Planner                          | P0        |
| US-06 | Sebagai pengguna, saya ingin bahan dari resep buatan saya ikut terhitung di Shopping List            | P1        |

### Pengguna Penikmat Resep (Consumer)

| ID    | Cerita                                                                                               | Prioritas |
| ----- | ---------------------------------------------------------------------------------------------------- | --------- |
| US-07 | Sebagai pengguna, saya ingin menjelajahi resep yang dibuat pengguna lain di tab "Komunitas"           | P0        |
| US-08 | Sebagai pengguna, saya ingin menyimpan (bookmark) resep komunitas ke koleksi saya                    | P0        |
| US-09 | Sebagai pengguna, saya ingin memasukkan resep komunitas ke Weekly Planner saya                       | P0        |
| US-10 | Sebagai pengguna, saya ingin melihat siapa pembuat resep (nama & avatar) di kartu dan detail resep   | P0        |
| US-11 | Sebagai pengguna, saya ingin melihat berapa kali resep komunitas telah disimpan orang lain            | P1        |

### Admin CookPlan

| ID    | Cerita                                                                                               | Prioritas |
| ----- | ---------------------------------------------------------------------------------------------------- | --------- |
| US-12 | Sebagai admin, saya ingin me-review dan memverifikasi resep komunitas yang berkualitas                | P1        |
| US-13 | Sebagai admin, saya ingin menonaktifkan resep komunitas yang melanggar ketentuan                      | P1        |

---

## 3. Perubahan Database

### 3.1 Perubahan Tabel `recipes`

Kolom baru yang ditambahkan pada tabel `recipes`:

```sql
-- ============================================================
-- Migration: Tambah kolom UGC pada tabel recipes
-- ============================================================

-- 1. Kolom baru
ALTER TABLE public.recipes
  ADD COLUMN user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN is_public   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN author_name TEXT;

-- 2. Indeks untuk query resep per user & resep publik
CREATE INDEX recipes_user_id_idx ON public.recipes (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX recipes_public_idx  ON public.recipes (is_public) WHERE is_public = true;

-- 3. Comment
COMMENT ON COLUMN public.recipes.user_id     IS 'NULL = resep ofisial CookPlan; NOT NULL = resep kreasi pengguna';
COMMENT ON COLUMN public.recipes.is_public   IS 'true = tampil di katalog komunitas; false = draf pribadi';
COMMENT ON COLUMN public.recipes.author_name IS 'Snapshot nama pengguna pembuat saat resep dibuat';
```

#### Klasifikasi Resep

| Kondisi                                 | Kategori          |
| --------------------------------------- | ----------------- |
| `user_id IS NULL`                       | Resep Ofisial     |
| `user_id IS NOT NULL AND is_public`     | Resep Komunitas   |
| `user_id IS NOT NULL AND NOT is_public` | Draf Pribadi      |

### 3.2 Counter Simpan Resep (`saves_count`)

Untuk performa, jumlah simpan dihitung via counter langsung di tabel `recipes`:

```sql
-- Tambah kolom counter
ALTER TABLE public.recipes
  ADD COLUMN saves_count INTEGER NOT NULL DEFAULT 0;

-- Trigger: increment/decrement saat saved_recipes berubah
CREATE OR REPLACE FUNCTION public.update_saves_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.recipes SET saves_count = saves_count + 1 WHERE id = NEW.recipe_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.recipes SET saves_count = GREATEST(saves_count - 1, 0) WHERE id = OLD.recipe_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER saved_recipes_update_count
  AFTER INSERT OR DELETE ON public.saved_recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_saves_count();
```

### 3.3 Perubahan RLS Policy pada `recipes`

```sql
-- ============================================================
-- RLS Policies untuk UGC
-- ============================================================

-- Hapus policy lama
DROP POLICY IF EXISTS recipes_read_public ON public.recipes;

-- READ: Resep ofisial aktif + resep publik aktif + resep milik sendiri
CREATE POLICY recipes_read_all ON public.recipes
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND (
      user_id IS NULL                          -- resep ofisial
      OR is_public = true                      -- resep komunitas publik
      OR user_id = (SELECT auth.uid())         -- draf milik sendiri
    )
  );

-- INSERT: User hanya bisa buat resep atas nama sendiri
CREATE POLICY recipes_user_insert ON public.recipes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
  );

-- UPDATE: User hanya bisa edit resep miliknya sendiri
CREATE POLICY recipes_user_update ON public.recipes
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- DELETE: User hanya bisa hapus resep miliknya sendiri
CREATE POLICY recipes_user_delete ON public.recipes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admin tetap punya akses penuh (policy existing: recipes_admin_write)
-- Policy admin yang ada sudah mencakup FOR ALL, jadi tetap berfungsi.
```

### 3.4 Perubahan RLS Policy pada `recipe_ingredients`

```sql
-- ============================================================
-- RLS Policies recipe_ingredients untuk UGC
-- ============================================================

-- INSERT: Boleh jika recipe milik user
CREATE POLICY recipe_ingredients_user_insert ON public.recipe_ingredients
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_id AND r.user_id = (SELECT auth.uid())
    )
  );

-- UPDATE: Boleh jika recipe milik user
CREATE POLICY recipe_ingredients_user_update ON public.recipe_ingredients
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_id AND r.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_id AND r.user_id = (SELECT auth.uid())
    )
  );

-- DELETE: Boleh jika recipe milik user
CREATE POLICY recipe_ingredients_user_delete ON public.recipe_ingredients
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_id AND r.user_id = (SELECT auth.uid())
    )
  );
```

---

## 4. Perubahan Service Layer

### 4.1 `src/services/recipeService.js` — Fungsi Baru

```javascript
// === RESEP KREASI PENGGUNA (UGC) ===

// Ambil resep milik user yang sedang login (untuk halaman "Resep Saya")
export async function getMyRecipes() { ... }

// Ambil resep komunitas (publik, bukan ofisial)
export async function getCommunityRecipes(options) { ... }
// options: { search, tags, page, limit, sortBy: 'newest' | 'popular' }

// Buat resep baru
export async function createRecipe(recipeData) { ... }
// recipeData: { title, description, imageUrl, difficulty, cuisine,
//               badges, tags, instructions, baseServings,
//               isPublic, ingredients: [{ name, amount, unit, category }] }

// Update resep milik sendiri
export async function updateRecipe(recipeId, recipeData) { ... }

// Hapus resep milik sendiri (soft delete: is_active = false)
export async function deleteRecipe(recipeId) { ... }

// Toggle status publik/draf
export async function toggleRecipeVisibility(recipeId) { ... }
```

### 4.2 Perubahan pada `RECIPE_SELECT`

```javascript
export const RECIPE_SELECT = `
  id, title, description, calories, difficulty, cuisine, badges, tags, instructions,
  imageUrl:image_url,
  priceIdr:price_idr,
  readyInMinutes:ready_in_minutes,
  baseServings:base_servings,
  isVerified:is_verified,
  ingredientsText:ingredients_text,
  userId:user_id,
  isPublic:is_public,
  authorName:author_name,
  savesCount:saves_count,
  ingredients:recipe_ingredients (
    id, name, amount, unit, category, priceIdr:price_idr,
    master:ingredients ( isStaple:is_staple )
  )
`;
```

---

## 5. Perubahan UI / Frontend

### 5.1 Halaman & Routing Baru

| Route                    | Komponen                 | Deskripsi                                    |
| ------------------------ | ------------------------ | -------------------------------------------- |
| `/recipes/create`        | `RecipeFormPage.jsx`     | Form pembuatan resep baru                    |
| `/recipes/:id/edit`      | `RecipeFormPage.jsx`     | Form edit resep milik sendiri (dual-mode)    |
| `/my-recipes`            | `MyRecipesPage.jsx`      | Daftar resep buatan pengguna sendiri         |

### 5.2 Perubahan pada Katalog Resep (`RecipeCatalog.jsx`)

Tambahkan **3 tab** di atas area filter:

```
┌─────────────────────────────────────────────────────────┐
│  [ 🍽️ Semua ]  [ 👨‍🍳 Komunitas ]  [ ❤️ Tersimpan ]     │
├─────────────────────────────────────────────────────────┤
│  🔍 Cari resep atau bahan...                            │
│  [chip filter diet] [chip filter diet] ...              │
│                                                         │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐     │
│  │Recipe│  │Recipe│  │Recipe│  │Recipe│  │Recipe│     │
│  │Card  │  │Card  │  │Card  │  │Card  │  │Card  │     │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘     │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐     │
│  │Recipe│  │Recipe│  │Recipe│  │Recipe│  │Recipe│     │
│  │Card  │  │Card  │  │Card  │  │Card  │  │Card  │     │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘     │
│                                                         │
│           [ Muat Lebih Banyak Resep ]                   │
└─────────────────────────────────────────────────────────┘
```

- **Tab "Semua"**: Menampilkan resep ofisial + komunitas publik (default, seperti saat ini).
- **Tab "Komunitas"**: Hanya resep buatan pengguna yang `is_public = true`.
- **Tab "Tersimpan"**: Resep yang di-bookmark pengguna (existing behavior).

### 5.3 Perubahan pada Kartu Resep (di Katalog)

Untuk resep komunitas, tampilkan elemen tambahan:

```
┌──────────────────────────┐
│  📷 [Foto Resep]         │
│  ┌──────┐         [+]    │
│  │badge │                 │
│  └──────┘                 │
│  Nasi Goreng Gila         │
│                           │
│  👤 Dinda Kitchen    ❤️ 42│
│  ─── (author & saves) ───│
└──────────────────────────┘
```

- **Nama Author**: Ditampilkan di bawah judul resep dengan ikon 👤.
- **Jumlah Simpan**: Badge kecil `❤️ N` untuk social proof.
- **Badge "Komunitas"**: Label kecil untuk membedakan dari resep ofisial.

### 5.4 Form Pembuatan Resep (`RecipeFormPage.jsx`)

Form multi-step atau single-page dengan section berikut:

#### Step 1: Informasi Dasar
- **Judul Resep** (text input, required)
- **Foto Resep** (upload gambar, opsional — gunakan Supabase Storage)
- **Deskripsi** (textarea, opsional)
- **Tingkat Kesulitan** (select: Mudah / Sedang / Sulit)
- **Kategori Masakan** (select: Nusantara / Asia / Western / dll)
- **Waktu Masak** (number input, dalam menit)
- **Porsi Dasar** (number input, default: 2)
- **Tag Diet** (multi-select chips: Vegetarian, Halal, dll)

#### Step 2: Bahan-Bahan
- List dinamis bahan:
  - **Nama Bahan** — Autocomplete dari master `ingredients` CookPlan + opsi input bebas.
  - **Jumlah** (number input)
  - **Satuan** (select: g, ml, sdm, sdt, buah, pcs, siung, lembar, dll)
  - **Kategori** (auto-fill dari master, atau manual: sayuran, daging, bumbu, dll)
- Tombol **"+ Tambah Bahan"**
- Tombol hapus per bahan

#### Step 3: Langkah Memasak
- List dinamis langkah-langkah memasak (ordered, drag-to-reorder opsional)
- Textarea per langkah
- Tombol **"+ Tambah Langkah"**

#### Step 4: Review & Publikasi
- Preview tampilan resep seperti di `RecipeDetailModal`
- Toggle **Publik / Draf**
- Tombol **"Publikasikan Resep"** atau **"Simpan sebagai Draf"**

### 5.5 Halaman "Resep Saya" (`MyRecipesPage.jsx`)

- Grid resep buatan pengguna sendiri.
- Label status: **"Publik"** (hijau) atau **"Draf"** (abu-abu) per kartu.
- Opsi per kartu: **Edit**, **Hapus**, **Toggle Publik/Draf**.
- Tombol CTA utama: **"+ Buat Resep Baru"** → navigasi ke `/recipes/create`.
- Link dari **Sidebar / Bottom Nav** atau dari halaman **Profil**.

### 5.6 Perubahan pada `RecipeDetailModal.jsx`

Untuk resep komunitas, tambahkan:
- **Author Section**: Foto profil (avatar) + nama pembuat resep di header modal.
- **Badge "Resep Komunitas"** vs **"Resep Terverifikasi CookPlan"**.
- **Counter Simpan**: "❤️ Disimpan oleh 42 pengguna".
- Jika pemilik resep membuka resepnya sendiri: tampilkan tombol **"Edit Resep"**.

### 5.7 Navigasi

Tambahkan entri navigasi ke "Resep Saya":
- **Bottom Nav** (mobile): Pertimbangkan menambahkan di menu profil atau sebagai sub-item.
- **Sidebar / Navbar**: Tambahkan link "Resep Saya" di navigasi utama, atau di halaman Profil.
- **FAB (Floating Action Button)**: Tombol "+" mengambang di halaman Katalog untuk shortcut buat resep baru.

---

## 6. Penanganan Bahan & Integrasi Shopping List

### 6.1 Autocomplete Bahan dari Master `ingredients`

Saat user menginput bahan di form resep:
1. Tampilkan dropdown autocomplete dari tabel `ingredients` (case-insensitive search by `name`).
2. Jika bahan dipilih dari master → otomatis set `ingredient_id`, `category`, `base_unit`.
3. Jika bahan diketik bebas (tidak ada di master) → `ingredient_id = NULL`, user isi category manual.

### 6.2 Implikasi pada Shopping List

| Skenario                                        | Perilaku di Shopping List                                         |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| Bahan terhubung ke master (`ingredient_id` ada) | ✅ Harga otomatis terhitung, satuan terkonversi, agregasi benar    |
| Bahan bebas (`ingredient_id` NULL)              | ⚠️ Tampil di daftar belanja tanpa estimasi harga (harga = 0)      |

> **Catatan Penting:**  
> Resep komunitas dengan bahan yang tidak terhubung ke master **tetap bisa dimasukkan ke planner
> dan shopping list** — hanya saja estimasi harga tidak tersedia untuk bahan-bahan tersebut.
> Ini adalah trade-off yang disengaja agar user tidak terblokir.

### 6.3 Kalkulasi Harga & Kalori Resep Komunitas

- **Harga**: Dihitung otomatis oleh trigger `ri_before_change()` dan `ri_after_change()` yang sudah ada — asalkan `ingredient_id` dan unit terisi dengan benar.
- **Kalori**: Untuk MVP, kolom `calories` pada resep komunitas diisi manual oleh creator (opsional). Di masa depan, kalori bisa dikalkulasi otomatis berdasarkan bahan.

---

## 7. Upload Gambar (Supabase Storage)

### 7.1 Bucket Baru

```sql
-- Buat bucket untuk foto resep pengguna
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recipe-images',
  'recipe-images',
  true,                                  -- public read
  5242880,                               -- max 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);
```

### 7.2 Storage Policy

```sql
-- Siapa saja bisa baca (publik)
CREATE POLICY recipe_images_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'recipe-images');

-- User hanya bisa upload ke folder miliknya
CREATE POLICY recipe_images_user_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'recipe-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- User hanya bisa hapus file miliknya
CREATE POLICY recipe_images_user_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'recipe-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
```

### 7.3 Path Convention

```
recipe-images/{user_id}/{timestamp}_{filename}.webp
```

---

## 8. Fase Implementasi

### Fase 1 — Foundation (P0)

> Database, service layer, dan form pembuatan resep dasar.

- [ ] **Migration**: Tambah kolom `user_id`, `is_public`, `author_name`, `saves_count` di `recipes`
- [ ] **Migration**: Update RLS policies `recipes` & `recipe_ingredients`
- [ ] **Migration**: Buat Supabase Storage bucket `recipe-images` + policies
- [ ] **Migration**: Buat trigger `saves_count` pada `saved_recipes`
- [ ] **Service**: Tambah fungsi `createRecipe`, `getMyRecipes`, `updateRecipe`, `deleteRecipe` di `recipeService.js`
- [ ] **Service**: Buat `storageService.js` untuk upload/delete gambar resep
- [ ] **UI**: Buat `RecipeFormPage.jsx` (create & edit mode)
- [ ] **UI**: Buat `MyRecipesPage.jsx` dengan grid dan aksi CRUD
- [ ] **Routing**: Daftarkan `/recipes/create`, `/recipes/:id/edit`, `/my-recipes` di `App.jsx`
- [ ] **Nav**: Tambah link "Resep Saya" di navigasi

### Fase 2 — Katalog Komunitas (P0)

> Integrasi resep komunitas ke katalog publik.

- [ ] **Service**: Tambah `getCommunityRecipes` dengan filter & sort
- [ ] **Service**: Update `RECIPE_SELECT` untuk include kolom UGC baru
- [ ] **UI**: Tambah sistem tab di `RecipeCatalog.jsx` (Semua / Komunitas / Tersimpan)
- [ ] **UI**: Update kartu resep untuk menampilkan author & badge komunitas
- [ ] **UI**: Update `RecipeDetailModal.jsx` dengan section author & counter simpan
- [ ] **Planner**: Pastikan resep komunitas bisa dipilih dan dimasukkan ke Weekly Planner
- [ ] **Shopping**: Pastikan bahan resep komunitas ikut terhitung di Shopping List

### Fase 3 — Social & Polish (P1)

> Fitur sosial, counter, dan kualitas.

- [ ] **UI**: Tampilkan `saves_count` di kartu resep & detail modal
- [ ] **UI**: Sorting resep komunitas by "Terpopuler" (based on saves_count)
- [ ] **Admin**: Halaman review resep komunitas di `/admin/recipes` — kemampuan verifikasi & nonaktifkan
- [ ] **UX**: Loading states, error handling, dan toast notifications untuk semua operasi CRUD
- [ ] **UX**: Preview resep sebelum publikasi
- [ ] **UX**: Validasi form (field required, minimum bahan, minimum langkah)

---

## 9. Hal yang Tidak Termasuk (Out of Scope)

Berikut fitur yang **tidak** akan dikerjakan di iterasi ini, namun bisa dipertimbangkan di masa depan:

| Fitur                        | Alasan Ditunda                                                |
| ---------------------------- | ------------------------------------------------------------- |
| Komentar / Review resep      | Kompleksitas moderasi tinggi; fokus MVP dulu                  |
| Rating bintang (⭐)          | Rentan manipulasi; `saves_count` cukup sebagai social proof   |
| Resep Fork / Remix           | Nice-to-have; belum prioritas                                 |
| Kalkulasi kalori otomatis    | Butuh data nutrisi per bahan yang belum tersedia              |
| Rekomendasi resep berbasis AI | Bisa diintegrasikan setelah UGC tumbuh                       |
| Profil kreator publik        | Scope terlalu besar; cukup tampilkan nama di kartu            |
| Report / Flag resep          | Penting tapi bisa ditambah setelah MVP                        |

---

## 10. Risiko & Mitigasi

| Risiko                                           | Mitigasi                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Resep sampah / spam                              | Admin bisa nonaktifkan; tambah report system di iterasi berikutnya                    |
| Bahan tidak terhubung master → harga tidak akurat | Tampilkan warning "estimasi harga tidak tersedia" di Shopping List                    |
| Upload gambar berukuran besar                    | Limit 5 MB di bucket; kompresi client-side sebelum upload                             |
| RLS complexity meningkat                         | Policy diuji per-role (anon, authenticated, admin) sebelum deploy                     |
| Performa query katalog melambat                  | Indeks pada `user_id`, `is_public`; pagination server-side jika konten membesar       |

---

## 11. Metrik Keberhasilan

| Metrik                            | Target (3 bulan pertama)  |
| --------------------------------- | ------------------------- |
| Jumlah resep komunitas dibuat     | ≥ 50 resep                |
| Resep komunitas yang disimpan     | ≥ 30% resep punya ≥ 1 save |
| Resep komunitas di Weekly Planner | ≥ 20% slot planner        |
| Rasio Publik vs Draf              | ≥ 70% resep dipublikasikan |

---

## 12. Referensi Arsitektur

### Skema Tabel Terdampak (Current State)

- `public.recipes` — Bank resep (saat ini hanya ofisial)
- `public.recipe_ingredients` — Bahan per resep (FK ke `recipes` & `ingredients`)
- `public.ingredients` — Master bahan makanan
- `public.saved_recipes` — Bookmark resep (M:N user ↔ recipe)
- `public.weekly_plans` — Rencana makan mingguan per user
- `public.meal_entries` — Slot menu dalam weekly plan (FK ke `recipes`)

### File Terdampak

| File                                 | Perubahan                                                   |
| ------------------------------------ | ----------------------------------------------------------- |
| `src/services/recipeService.js`      | Tambah fungsi CRUD resep pengguna + update `RECIPE_SELECT`  |
| `src/pages/RecipeCatalog.jsx`        | Tambah sistem tab (Semua / Komunitas / Tersimpan)           |
| `src/pages/CatalogPage.jsx`          | Routing support untuk tab baru                              |
| `src/components/RecipeDetailModal.jsx`| Tambah section author & badge komunitas                    |
| `src/App.jsx`                        | Routing baru: `/recipes/create`, `/recipes/:id/edit`, `/my-recipes` |
| `src/components/AppShell.jsx`        | Navigasi baru: link "Resep Saya"                            |
| **File Baru**                        |                                                             |
| `src/pages/RecipeFormPage.jsx`       | Form buat/edit resep (dual-mode)                            |
| `src/pages/MyRecipesPage.jsx`        | Halaman daftar resep buatan sendiri                         |
| `src/services/storageService.js`     | Upload/delete gambar ke Supabase Storage                    |
| `supabase/migrations/2026XXXX_ugc_recipes.sql` | Migration database                               |
