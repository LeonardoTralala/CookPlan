-- 20260703185000_format_recipe_titles.sql
-- Membuat fungsi dan trigger untuk memformat title resep ke Title Case dengan aturan bahasa Indonesia.

CREATE OR REPLACE FUNCTION public.format_title_indonesian(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  words TEXT[];
  word TEXT;
  lower_word TEXT;
  result_text TEXT := '';
  i INT;
  is_first BOOLEAN := TRUE;
  -- List of Indonesian lowercase words (kata tugas)
  lower_words TEXT[] := ARRAY['dan', 'atau', 'di', 'ke', 'dari', 'pada', 'untuk', 'dengan', 'ala', 'terhadap', 'yang', 'dalam', 'serta', 'oleh', 'bagi', 'sebagai', 'tentang', 'seperti', 'bagaikan', 'sejak', 'sampai', 'hingga', 'melalui', 'secara', 'buat', 'pun', 'lalu', 'kemudian', 'melainkan', 'sedangkan', 'tetapi', 'namun', 'jika', 'kalau', 'karena', 'agar', 'supaya', 'sebelum', 'sesudah', 'setelah', 'ketika', 'sementara', 'sambil', 'selagi', 'sewaktu', 'bila'];
BEGIN
  IF input_text IS NULL OR TRIM(input_text) = '' THEN
    RETURN input_text;
  END IF;

  -- Trim and split into words
  words := regexp_split_to_array(TRIM(regexp_replace(input_text, '\s+', ' ', 'g')), ' ');

  FOR i IN 1..array_length(words, 1) LOOP
    word := words[i];
    lower_word := LOWER(word);
    
    -- Check if it should be lowercase
    -- Except if it's the first word, or if it follows a separator like dash, colon, open paren, etc.
    IF NOT is_first AND lower_word = ANY(lower_words) THEN
      DECLARE
        clean_word TEXT := regexp_replace(lower_word, '[^a-z]', '', 'g');
      BEGIN
        IF clean_word = ANY(lower_words) THEN
          result_text := result_text || lower_word;
        ELSE
          result_text := result_text || initcap(word);
        END IF;
      END;
    ELSE
      result_text := result_text || initcap(word);
    END IF;

    IF i < array_length(words, 1) THEN
      result_text := result_text || ' ';
    END IF;
    
    -- Next words are not the first word
    is_first := FALSE;
    
    -- If the current word ends with punctuation like '-', ':', or is a dash itself, we treat the NEXT word as first word of its segment
    IF word LIKE '%-' OR word LIKE '%:' OR word = '-' THEN
      is_first := TRUE;
    END IF;
  END LOOP;

  RETURN result_text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger function untuk tabel recipes dan meal_entries
CREATE OR REPLACE FUNCTION public.format_recipe_title_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.title := public.format_title_indonesian(NEW.title);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function untuk menyelaraskan title resep di recipes ke meal_entries
CREATE OR REPLACE FUNCTION public.sync_recipe_title_to_meal_entries()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.title IS DISTINCT FROM NEW.title THEN
    UPDATE public.meal_entries
    SET title = NEW.title
    WHERE recipe_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Pemasangan trigger ke tabel recipes
CREATE OR REPLACE TRIGGER trg_format_recipe_title
BEFORE INSERT OR UPDATE OF title ON public.recipes
FOR EACH ROW
EXECUTE FUNCTION public.format_recipe_title_trigger();

CREATE OR REPLACE TRIGGER trg_sync_recipe_title_to_meal_entries
AFTER UPDATE OF title ON public.recipes
FOR EACH ROW
EXECUTE FUNCTION public.sync_recipe_title_to_meal_entries();

-- Pemasangan trigger ke tabel meal_entries
CREATE OR REPLACE TRIGGER trg_format_meal_entry_title
BEFORE INSERT OR UPDATE OF title ON public.meal_entries
FOR EACH ROW
EXECUTE FUNCTION public.format_recipe_title_trigger();

-- Backfill data yang sudah ada
UPDATE public.recipes SET title = public.format_title_indonesian(title);
UPDATE public.meal_entries SET title = public.format_title_indonesian(title);
