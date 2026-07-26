import posthog from 'posthog-js';

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let isInitialized = false;

/**
 * Daftar konstanta event resmi CookPlan untuk menjaga konsistensi penamaan.
 */
export const EVENTS = {
  // Auth & User Lifecycle
  AUTH_SIGNED_UP: 'auth_signed_up',
  AUTH_LOGGED_IN: 'auth_logged_in',
  AUTH_LOGGED_OUT: 'auth_logged_out',
  ONBOARDING_COMPLETED: 'onboarding_completed',

  // AI Meal Plan Generator
  PLAN_GENERATION_STARTED: 'plan_generation_started',
  PLAN_GENERATION_COMPLETED: 'plan_generation_completed',
  PLAN_GENERATION_FAILED: 'plan_generation_failed',
  PLAN_APPLIED_TO_PLANNER: 'plan_applied_to_planner',

  // Weekly Planner & Recipes
  MEAL_SWAPPED: 'meal_swapped',
  RECIPE_SEARCHED: 'recipe_searched',
  RECIPE_FILTERED: 'recipe_filtered',
  RECIPE_VIEWED: 'recipe_viewed',

  // Shopping & Checkout Flow
  SHOPPING_MODE_TOGGLED: 'shopping_mode_toggled',
  ORDER_CREATED: 'order_created',
  CHECKOUT_WHATSAPP_CLICKED: 'checkout_whatsapp_clicked',
};

/**
 * Inisialisasi PostHog Analytics.
 * Jika VITE_POSTHOG_KEY tidak diisi di .env, tracking akan di-bypass secara aman tanpa crash.
 */
export function initPostHog() {
  if (!posthogKey) {
    if (import.meta.env.DEV) {
      console.info('[PostHog] VITE_POSTHOG_KEY tidak ditemukan di .env. Analytics di-bypass.');
    }
    return;
  }

  if (!isInitialized) {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
    });
    isInitialized = true;
  }
}

/**
 * Melacak kustom event di CookPlan (misal: 'generate_plan_started', 'checkout_whatsapp').
 * @param {string} eventName 
 * @param {Object} properties 
 */
export function trackEvent(eventName, properties = {}) {
  if (!isInitialized || !posthogKey) return;
  posthog.capture(eventName, properties);
}

/**
 * Mengidentifikasi pengguna yang telah ber-autentikasi.
 * @param {string} userId 
 * @param {Object} userProperties 
 */
export function identifyUser(userId, userProperties = {}) {
  if (!isInitialized || !posthogKey) return;
  posthog.identify(userId, userProperties);
}

/**
 * Reset identitas saat pengguna logout.
 */
export function resetUser() {
  if (!isInitialized || !posthogKey) return;
  posthog.reset();
}

/* ==========================================================================
 * HELPER TRACKING UTAMA (BEST PRACTICE FOR COOKPLAN)
 * ========================================================================== */

export function trackSignUp(method = 'email') {
  trackEvent(EVENTS.AUTH_SIGNED_UP, { method });
}

export function trackLogIn(method = 'email') {
  trackEvent(EVENTS.AUTH_LOGGED_IN, { method });
}

export function trackOnboarding(persona) {
  trackEvent(EVENTS.ONBOARDING_COMPLETED, { persona });
}

export function trackPlanGenerationStart(input) {
  trackEvent(EVENTS.PLAN_GENERATION_STARTED, {
    periode: input?.periode,
    porsi: input?.porsi,
    meals_count: Array.isArray(input?.meals) ? input.meals.length : 0,
    diet_tags: input?.diet || [],
    budget_idr: input?.budget,
    has_pantry: Array.isArray(input?.pantry) && input.pantry.length > 0,
  });
}

export function trackPlanGenerationComplete(result, latencyMs) {
  trackEvent(EVENTS.PLAN_GENERATION_COMPLETED, {
    plan_id: result?.planId,
    latency_ms: latencyMs,
    total_days: result?.plan?.days?.length || 0,
    model: result?.meta?.model,
  });
}

export function trackPlanGenerationError(errorMsg) {
  trackEvent(EVENTS.PLAN_GENERATION_FAILED, {
    error_message: errorMsg,
  });
}

export function trackPlanApplied(planId) {
  trackEvent(EVENTS.PLAN_APPLIED_TO_PLANNER, { plan_id: planId });
}

export function trackShoppingMode(mode) {
  trackEvent(EVENTS.SHOPPING_MODE_TOGGLED, { mode });
}

export function trackOrderCreated(orderId, totalAmount, paymentMethod) {
  trackEvent(EVENTS.ORDER_CREATED, {
    order_id: orderId,
    total_amount: totalAmount,
    payment_method: paymentMethod,
  });
}

export function trackWhatsappCheckout(orderId) {
  trackEvent(EVENTS.CHECKOUT_WHATSAPP_CLICKED, { order_id: orderId });
}

export function trackRecipeSearch(query) {
  if (!query || query.trim().length === 0) return;
  trackEvent(EVENTS.RECIPE_SEARCHED, { query: query.trim() });
}

export function trackRecipeView(recipeId, recipeName) {
  trackEvent(EVENTS.RECIPE_VIEWED, { recipe_id: recipeId, recipe_name: recipeName });
}

export default posthog;

