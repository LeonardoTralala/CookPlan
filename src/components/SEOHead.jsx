import { useEffect } from 'react';

/**
 * SEOHead Component
 * Mengelola metadata SEO secara dinamis per halaman (Title, Description, Open Graph, Twitter Cards, & JSON-LD).
 */
export function SEOHead({
  title,
  description,
  canonicalUrl,
  ogImage = 'https://cookplan.id/hero-poster.jpg',
  ogType = 'website',
  jsonLd,
}) {
  useEffect(() => {
    // 1. Update Title
    if (title) {
      document.title = title;
    }

    // Helper untuk membuat / memperbarui tag meta
    const setMetaTag = (selector, attributeName, attributeValue, content) => {
      if (!content) return;
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attributeName, attributeValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // 2. Meta description
    setMetaTag('meta[name="description"]', 'name', 'description', description);

    // 3. Open Graph
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', title);
    setMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
    setMetaTag('meta[property="og:type"]', 'property', 'og:type', ogType);
    if (ogImage) {
      setMetaTag('meta[property="og:image"]', 'property', 'og:image', ogImage);
    }
    const currentUrl = canonicalUrl || (typeof window !== 'undefined' ? window.location.href : '');
    if (currentUrl) {
      setMetaTag('meta[property="og:url"]', 'property', 'og:url', currentUrl);
    }

    // 4. Twitter Cards
    setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    if (ogImage) {
      setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', ogImage);
    }

    // 5. Canonical Link
    if (canonicalUrl) {
      let canonicalEl = document.querySelector('link[rel="canonical"]');
      if (canonicalEl) {
        canonicalEl.setAttribute('href', canonicalUrl);
      }
    }

    // 6. Structured Data JSON-LD
    let scriptEl = document.getElementById('dynamic-json-ld');
    if (jsonLd) {
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.id = 'dynamic-json-ld';
        scriptEl.type = 'application/ld+json';
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = typeof jsonLd === 'string' ? jsonLd : JSON.stringify(jsonLd);
    } else if (scriptEl) {
      scriptEl.remove();
    }

    return () => {
      const el = document.getElementById('dynamic-json-ld');
      if (el) el.remove();
    };
  }, [title, description, canonicalUrl, ogImage, ogType, jsonLd]);

  return null;
}

export default SEOHead;
