// Adapter AI provider-agnostic. Semua provider diakses lewat format
// OpenAI-compatible chat completions: POST {base_url}/chat/completions.
// Mendukung reasoning models (ekstrak reasoning_content).

export interface AIProvider {
  id: string;
  label: string;
  base_url: string;
  api_key: string;
  model: string;
  temperature: number;
  max_tokens: number;
  supports_json_mode: boolean;
  is_reasoning: boolean;
}

export interface AICallResult {
  content: string;
  reasoning: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  latencyMs: number;
}

// Pisahkan blok <thinking>...</thinking> (reasoning inline) dari content final.
// Beberapa proxy (mis. 9router) menaruh chain-of-thought di dalam tag <thinking>
// pada content, bukan di field reasoning_content terpisah.
function splitThinking(raw: string): { content: string; reasoning: string | null } {
  if (!raw) return { content: "", reasoning: null };
  const matches = [...raw.matchAll(/<thinking>([\s\S]*?)<\/thinking>/gi)];
  if (matches.length === 0) {
    // Tag thinking belum tertutup (terpotong) — buang dari posisi <thinking>.
    const openIdx = raw.search(/<thinking>/i);
    if (openIdx !== -1) {
      return { content: raw.slice(0, openIdx).trim(), reasoning: raw.slice(openIdx).replace(/<\/?thinking>/gi, "").trim() };
    }
    return { content: raw, reasoning: null };
  }
  const reasoning = matches.map((m) => m[1].trim()).join("\n\n");
  const content = raw.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
  return { content, reasoning: reasoning || null };
}

// Panggil satu provider. Throw kalau gagal (caller handle fallback).
// Pakai streaming (SSE) karena banyak proxy OpenAI-compat (9router/enowxlabs)
// hanya mengembalikan jawaban lengkap lewat stream; non-stream balik kosong.
export async function callProvider(
  provider: AIProvider,
  messages: { role: string; content: string }[],
  timeoutMs = 120000,
): Promise<AICallResult> {
  const url = `${provider.base_url.replace(/\/$/, "")}/chat/completions`;

  const body: Record<string, unknown> = {
    model: provider.model,
    messages,
    temperature: provider.temperature ?? 0.7,
    max_tokens: provider.max_tokens ?? 4096,
    stream: true,
  };
  if (provider.supports_json_mode) {
    body.response_format = { type: "json_object" };
  }
  // DeepSeek hybrid reasoning: matikan "thinking" untuk provider DeepSeek yang
  // ditandai is_reasoning=false. Model reasoning DeepSeek (mis. deepseek-v4-flash)
  // menghabiskan ~90% token output untuk chain-of-thought, bikin latensi
  // membengkak (foodplan seminggu bisa ~140s). Mematikannya memangkas waktu
  // drastis (≈belasan detik) tanpa kehilangan kualitas untuk tugas terstruktur.
  // Param ini khusus API DeepSeek, jadi di-scope via base_url agar tidak
  // dikirim ke provider lain (9router/Gemini) yang akan menolaknya.
  if (/deepseek\.com/i.test(provider.base_url) && provider.is_reasoning === false) {
    body.thinking = { type: "disabled" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.api_key}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Provider ${provider.label} HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    if (!res.body) {
      throw new Error(`Provider ${provider.label} tidak mengembalikan stream.`);
    }

    // Parse SSE: kumpulkan delta.content & reasoning, plus usage di chunk terakhir.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";
    let fullReasoning = "";
    let tokensInput: number | null = null;
    let tokensOutput: number | null = null;

    // Cap anti-OOM (audit M3): batasi total akumulasi agar provider nakal /
    // stream tanpa newline tidak menghabiskan memori.
    const MAX_CHARS = 2_000_000; // ~2 MB teks

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        if (buffer.length > MAX_CHARS || fullContent.length > MAX_CHARS || fullReasoning.length > MAX_CHARS) {
          throw new Error(`Provider ${provider.label} mengirim respons terlalu besar (>2MB).`);
        }

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // sisakan baris belum lengkap

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const chunk = JSON.parse(data);
            const delta = chunk?.choices?.[0]?.delta ?? {};
            if (typeof delta.content === "string") fullContent += delta.content;
            if (typeof delta.reasoning_content === "string") fullReasoning += delta.reasoning_content;
            if (typeof delta.reasoning === "string") fullReasoning += delta.reasoning;
            if (chunk?.usage) {
              tokensInput = chunk.usage.prompt_tokens ?? tokensInput;
              tokensOutput = chunk.usage.completion_tokens ?? tokensOutput;
            }
          } catch {
            // chunk tak terparse — abaikan, lanjut
          }
        }
      }
    } finally {
      // Pastikan stream ditutup walau abort/error (hindari leak koneksi).
      try { await reader.cancel(); } catch { /* ignore */ }
    }

    // Pisahkan reasoning inline (<thinking>) dari content final.
    const { content, reasoning: inlineReasoning } = splitThinking(fullContent);
    const reasoning = (fullReasoning.trim() || inlineReasoning) || null;

    if (!content) {
      throw new Error(`Provider ${provider.label} mengembalikan content kosong.`);
    }

    return {
      content,
      reasoning,
      tokensInput,
      tokensOutput,
      latencyMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Ekstrak JSON dari teks secara defensive: coba parse langsung, lalu strip code
// fence, lalu regex blok {...} pertama.
export function safeJsonExtract(raw: string): unknown | null {
  if (!raw) return null;

  // 1. parse langsung
  try { return JSON.parse(raw); } catch { /* lanjut */ }

  // 2. strip markdown code fence ```json ... ```
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch { /* lanjut */ }
  }

  // 3. ambil blok { ... } terluas
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const slice = raw.slice(first, last + 1);
    try { return JSON.parse(slice); } catch { /* lanjut */ }
  }

  return null;
}

// Hitung estimasi biaya kasar (USD) — placeholder, di-tune per model nanti.
export function estimateCost(tokensIn: number | null, tokensOut: number | null): number {
  const inRate = 0.000003;   // $3 / 1M token input (asumsi Sonnet)
  const outRate = 0.000015;  // $15 / 1M token output
  return (tokensIn ?? 0) * inRate + (tokensOut ?? 0) * outRate;
}
