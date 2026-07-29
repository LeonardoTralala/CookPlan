# PRD: Resep Kreasi Pengguna (User-Created Recipes)

> **Status:** Draft (Diperbarui berdasarkan masukan King)  
> **Tanggal:** 2026-07-29  
> **Branch:** `feature/user-created-recipes`  
> **Author:** Tim CookPlan (PKM-K 2026)

---

## 1. Ringkasan Eksekutif

Fitur **Resep Kreasi Pengguna** memungkinkan pengguna CookPlan membuat resep sendiri dan
mempublikasikannya agar bisa diakses oleh seluruh komunitas pengguna CookPlan. Resep komunitas
dapat disukai (like), disimpan (bookmark), dimasukkan ke **Weekly Planner**, diajukan ke **AI Plan Generator**,
dan turut dihitung di **Shopping List** — sama seperti resep ofisial CookPlan.

### Tujuan Strategis

| Aspek               | Dampak                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------- |
| **UGC & Skalabilitas** | Konten resep tumbuh organik dari komunitas, mengurangi beban tim kurasi manual.           |
| **Social Effect**    | Fitur **Like** dan atribusi nama pembuat membangun keterikatan sosial antar pengguna.      |
| **Integrasi AI**     | Resep komunitas turut diperhitungkan oleh AI saat menyusun rencana makan mingguan.        |
| **Crowdsourcing Data**| Bahan manual dari user masuk ke antrean admin untuk di-map ke master data secara bertahap. |
| **Retention**        | CookPlan menjadi "buku resep digital pribadi" — meningkatkan daya simpan pengguna.         |
| **Nilai PKM-K**      | Membuktikan CookPlan memiliki ekosistem komunitas aktif & berpotensi komersial tinggi.   |

---

## 2. User Stories

### Pengguna Pembuat Resep (Creator)

| ID    | Cerita                                                                                               | Prioritas |
| ----- | ---------------------------------------------------------------------------------------------------- | --------- |
| US-01 | Sebagai pengguna, saya ingin membuat resep baru via tombol **FAB** di Katalog dengan judul, foto, bahan, dan langkah masak | P0 |
| US-02 | Sebagai pengguna, saya ingin memilih status resep saya: **Publik** (dilihat semua) atau **Draf** (pribadi) | P0        |
| US-03 | Sebagai pengguna, saya ingin mengedit atau menghapus resep yang saya buat                            | P0        |
| US-04 | Sebagai pengguna, saya ingin melihat daftar semua resep yang saya buat di satu halaman ("Resep Saya") | P0        |
| US-05 | Sebagai pengguna, saya ingin memasukkan resep buatan saya ke Weekly Planner                          | P0        |
| US-06 | Sebagai pengguna, saya ingin bahan dari resep buatan saya ikut terhitung di Shopping List            | P1        |

### Pengguna Penikmat Resep (Consumer)

| ID    | Cerita                                                                                               | Prioritas |
| ----- | ---------------------------------------------------------------------------------------------------- | --------- |
| US-07 | Sebagai pengguna, saya ingin menjelajahi resep komunitas di tab "Komunitas" di Katalog               | P0        |
| US-08 | Sebagai pengguna, saya ingin menyukai (**Like**) resep komunitas favorit saya                        | P0        |
| US-09 | Sebagai pengguna, saya ingin menyimpan (bookmark) resep komunitas ke koleksi saya                    | P0        |
| US-10 | Sebagai pengguna, saya ingin memasukkan resep komunitas ke Weekly Planner saya                       | P0        |
| US-11 | Sebagai pengguna, saya ingin resep komunitas juga muncul sebagai pilihan dalam rekomendasi **AI Generator** | P1 |
| US-12 | Sebagai pengguna, saya ingin melihat siapa pembuat resep & jumlah **Like** di kartu dan detail resep | P0        |

### Admin CookPlan

| ID    | Cerita                                                                                               | Prioritas |
| ----- | ---------------------------------------------------------------------------------------------------- | --------- |
| US-13 | Sebagai admin, saya ingin menonaktifkan (`is_active = false`) atau menghapus resep yang terindikasi spam/sampah | P0 |
| US-14 | Sebagai admin, saya ingin melihat antrean **Bahan Unlinked** dan melakukan **1-Click Mapping** ke master `ingredients` | P1 |
| US-15 | Sebagai admin, saya ingin me-review dan memverifikasi resep komunitas berkualitas                    | P1        |

---

## 3. Perubahan Database

### 3.1 Perubahan Tabel `recipes`

Kolom baru yang ditambahkan pada tabel `recipes`:

```sql
-- ============================================================
-- Migration: Tambah kolom UGC & Likes pada tabel recipes
-- ============================================================

-- 1. Kolom baru
ALTER TABLE public.recipes
  ADD COLUMN user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN is_public   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN author_name TEXT,
  ADD COLUMN likes_count INTEGER NOT NULL DEFAULT 0;

-- Catatan: Kolom `calories` tetap ada di DB tetapi diabaikan (dihapuskan sementara) dari UI form & tampilan UGC.

-- 2. Indeks untuk query resep per user, resep publik, dan sorting populer
CREATE INDEX recipes_user_id_idx    ON public.recipes (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX recipes_public_idx     ON public.recipes (is_public) WHERE is_public = true;
CREATE INDEX recipes_likes_count_idx ON public.recipes (likes_count DESC);

-- 3. Comments
COMMENT ON COLUMN public.recipes.user_id     IS 'NULL = resep ofisial CookPlan; NOT NULL = resep kreasi pengguna';
COMMENT ON COLUMN public.recipes.is_public   IS 'true = tampil di katalog komunitas; false = draf pribadi';
COMMENT ON COLUMN public.recipes.author_name IS 'Snapshot nama pengguna pembuat saat resep dibuat';
COMMENT ON COLUMN public.recipes.likes_count IS 'Jumlah total like dari pengguna lain';
```

### 3.2 Tabel Baru `recipe_likes` (Sistem Like)

```sql
-- ============================================================
-- Tabel Pencatat Like Resep (1 User 1 Like per Resep)
-- ============================================================
CREATE TABLE public.recipe_likes (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipe_id  INTEGER NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, recipe_id)
);

CREATE INDEX recipe_likes_recipe_id_idx ON public.recipe_likes(recipe_id);

-- RLS Policy untuk recipe_likes
ALTER TABLE public.recipe_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY recipe_likes_read_public ON public.recipe_likes
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY recipe_likes_owner_insert ON public.recipe_likes
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY recipe_likes_owner_delete ON public.recipe_likes
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Trigger: Otomatis memperbarui recipes.likes_count saat insert/delete
CREATE OR REPLACE FUNCTION public.update_recipe_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.recipes SET likes_count = likes_count + 1 WHERE id = NEW.recipe_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.recipes SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.recipe_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER recipe_likes_count_trigger
  AFTER INSERT OR DELETE ON public.recipe_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_recipe_likes_count();
```

### 3.3 Perubahan RLS Policy pada `recipes`

```sql
-- ============================================================
-- RLS Policies untuk UGC & Moderasi Admin
-- ============================================================

DROP POLICY IF EXISTS recipes_read_public ON public.recipes;

-- READ: Resep ofisial aktif + resep publik aktif + resep milik sendiri
CREATE POLICY recipes_read_all ON public.recipes
  FOR SELECT TO anon, authenticated
  USING (
    (is_active = true AND (user_id IS NULL OR is_public = true OR user_id = (SELECT auth.uid())))
    OR public.is_admin() -- Admin bisa membaca resep non-aktif untuk moderasi
  );

-- INSERT: User hanya bisa buat resep atas nama sendiri
CREATE POLICY recipes_user_insert ON public.recipes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- UPDATE: Pemilik resep atau Admin
CREATE POLICY recipes_user_update ON public.recipes
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

-- DELETE: Pemilik resep atau Admin
CREATE POLICY recipes_user_delete ON public.recipes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());
```

---

## 4. Perubahan Service Layer (`src/services/recipeService.js`)

### 4.1 Update `RECIPE_SELECT` & Fungsi Baru

```javascript
export const RECIPE_SELECT = `
  id, title, description, difficulty, cuisine, badges, tags, instructions,
  imageUrl:image_url,
  priceIdr:price_idr,
  readyInMinutes:ready_in_minutes,
  baseServings:base_servings,
  isVerified:is_verified,
  ingredientsText:ingredients_text,
  userId:user_id,
  isPublic:is_public,
  authorName:author_name,
  likesCount:likes_count,
  ingredients:recipe_ingredients (
    id, ingredientId:ingredient_id, name, amount, unit, category, priceIdr:price_idr,
    master:ingredients ( isStaple:is_staple )
  )
`;

// === FUNGSI LIKE ===
export async function toggleLikeRecipe(recipeId, isLiked) { ... }
export async function getMyLikedRecipeIds() { ... }

// === RESEP KREASI PENGGUNA (UGC) ===
export async function getMyRecipes() { ... }
export async function getCommunityRecipes(options) { ... }
// options: { search, tags, page, limit, sortBy: 'newest' | 'popular' }

export async function createRecipe(recipeData) { ... }
export async function updateRecipe(recipeId, recipeData) { ... }
export async function deleteRecipe(recipeId) { ... } // Owner or Admin
```

---

## 5. Perubahan UI & Navigasi Frontend

### 5.1 Navigasi Utama: FAB (Floating Action Button) di Katalog

Di halaman `RecipeCatalog.jsx`, pasang **FAB** mengambang di kanan bawah:

```
┌─────────────────────────────────────────────────────────┐
│ [ 🍽️ Semua ] [ 👨‍🍳 Komunitas ] [ ❤️ Tersimpan ]         │
│ 🔍 Cari resep...                                        │
│ [Grid Resep...]                                         │
│                                                         │
│                                           ┌───────────┐ │
│                                           │ ➕ Buat   │ │
│                                           │    Resep  │ │
│                                           └───────────┘ │
└─────────────────────────────────────────────────────────┘
```
- **FAB Action**: Navigasi langsung ke `/recipes/create`.
- **Halaman "Resep Saya"**: Akses via tab di Katalog / Profil user (`/my-recipes`).

### 5.2 Penyederhanaan Form (`RecipeFormPage.jsx`)
- **Tanpa Input Kalori**: Kolom kalori dihapus dari form untuk mempermudah proses input.
- **Section Bahan**:
  - Input nama bahan dilengkapi Autocomplete dari master `ingredients`.
  - Jika nama bahan belum ada di master: Izinkan simpan bebas (`ingredient_id = null`).
- **Review & Publish**: Pilihan publikasikan ke katalog komunitas atau simpan sebagai draf pribadi.

### 5.3 Perubahan Kartu Resep & Detail Modal
- **Indikator Like**: Tampilkan ❤️ `likesCount` dan tombol toggle Like.
- **Author Attribution**: Tampilkan `"Oleh @author_name"` dengan badge **Komunitas**.
- **Warning Bahan Unlinked**:
  - Jika ada bahan yang `ingredient_id === null`, tampilkan peringatan di modal detail resep & shopping list:
    ⚠️ *"Estimasi harga belum tersedia untuk beberapa bahan"*

---

## 6. Fitur Admin & Moderasi (`src/pages/admin/`)

### 6.1 Moderasi Resep Spam
- Di halaman `/admin/recipes`:
  - Filter berdasarkan status: **Ofisial**, **Komunitas Publik**, **Nonaktif/Spam**.
  - **Aksi Nonaktifkan**: Mengubah `is_active = false` (resep tersembunyi dari publik).
  - **Aksi Hapus**: Menghapus permanen resep spam yang melanggar aturan.

### 6.2 Antrean Bahan Unlinked & **1-Click Mapping** (Sensasional)
- Seksi khusus di Admin Dashboard: **"Antrean Bahan Bebas Pengguna"**.
- Tampilan list bahan-bahan manual (`ingredient_id IS NULL`) yang diinput user, diurutkan dari yang paling sering digunakan.
- **Fitur 1-Click Link**:
  - Admin bisa memilih bahan master dari dropdown, lalu mengklik tombol **"Hubungkan"**.
  - Sistem otomatis menjalankan query `UPDATE recipe_ingredients SET ingredient_id = X WHERE name ILIKE 'Y'`.
  - Trigger Supabase otomatis menghitung ulang harga per porsi pada seluruh resep terkait!

---

## 7. Integrasi AI Plan Generator (`generate-plan` Edge Function)

### 7.1 Penyesuaian AI Proxy
- Dalam `supabase/functions/generate-plan/index.ts`, query pemilihan kandidat resep diubah menjadi:
  ```typescript
  const { data: recipes } = await supabaseClient
    .from('recipes')
    .select('id, title, description, price_idr, ready_in_minutes, tags, cuisine, is_verified, author_name')
    .eq('is_active', true)
    .or('user_id.is.null,is_public.eq.true'); // Resep ofisial + resep komunitas publik!
  ```
- Prompt AI diperbarui agar memberikan atribusi jika resep komunitas terpilih:
  *"Resep kreasi komunitas CookPlan (oleh @author_name) juga dapat diprioritaskan jika cocok dengan preferensi diet pengguna."*

---

## 8. Upload Gambar (Supabase Storage)

- Bucket `recipe-images` (public read, max 5 MB).
- Policy: User hanya bisa upload/hapus di folder miliknya (`recipe-images/{user_id}/...`).

---

## 9. Fase Implementasi

### Fase 1 — Foundation & Form (P0)
- [ ] Migration: Tambah kolom `user_id`, `is_public`, `author_name`, `likes_count` pada `recipes`
- [ ] Migration: Tabel `recipe_likes` + trigger counter + RLS policies
- [ ] Migration: Storage bucket `recipe-images`
- [ ] Service: Fungsi CRUD resep & toggleLike di `recipeService.js`
- [ ] Service: `storageService.js` untuk upload foto
- [ ] UI: FAB (Floating Action Button) di `RecipeCatalog.jsx`
- [ ] UI: Form `RecipeFormPage.jsx` (tanpa kalori, autocomplete bahan)
- [ ] UI: Halaman `MyRecipesPage.jsx`

### Fase 2 — Social Catalog & AI Integration (P0)
- [ ] UI: Tab Komunitas di `RecipeCatalog.jsx`
- [ ] UI: Kartu resep & Modal detail dengan Like count, Author, & Warning bahan unlinked
- [ ] AI: Update Edge Function `generate-plan` agar menyertakan resep komunitas publik
- [ ] Planner & Shopping: Pastikan resep komunitas terintegrasi lancar di planner & daftar belanja

### Fase 3 — Moderasi Admin & Crowdsourcing (P1)
- [ ] Admin: Tombol Nonaktifkan & Hapus resep spam di `/admin/recipes`
- [ ] Admin: Halaman **Antrean Bahan Unlinked & 1-Click Mapping**
- [ ] UX Polish: Toast notification, loading skeleton, validasi form

---

## 10. Metrik Keberhasilan

| Metrik                            | Target (3 bulan pertama)  |
| --------------------------------- | ------------------------- |
| Jumlah resep komunitas dibuat     | ≥ 50 resep                |
| Total Likes pada resep komunitas  | ≥ 100 likes               |
| Resep komunitas di AI Generator   | ≥ 15% rekomendasi AI      |
| Bahan unlinked ter-mapping admin  | ≥ 80% bahan crowdsourced  |
