// Google Analytics & Google Tag Manager Analytics Helpers

declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Initialise GA4/GTM setup configuration
 */
export function initGA4() {
  if (typeof window.gtag === 'function') {
    // GA4 config
    const ga4Id = import.meta.env.VITE_GA4_ID || 'G-XXXXXXXXXX';
    window.gtag('js', new Date());
    window.gtag('config', ga4Id, {
      send_page_view: false, // Page views tracked manually via trackPageView
    });
  }
}

/**
 * Track a page view manually (crucial for Single Page Applications)
 */
export function trackPageView(path: string, title?: string) {
  const ga4Id = import.meta.env.VITE_GA4_ID || 'G-XXXXXXXXXX';
  
  // Track using direct gtag
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title || document.title,
      send_to: ga4Id
    });
  }

  // Push to dataLayer for GTM to trigger history change / virtual page view
  pushDataLayer('virtual_page_view', {
    page_path: path,
    page_title: title || document.title
  });
}

/**
 * General helper to push custom events to GTM dataLayer
 */
export function pushDataLayer(event: string, params?: Record<string, any>) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    ...params,
  });
}

/**
 * ── CONVERSION TRACKING FUNCTIONS ──────────────────────────────────────────
 */

/**
 * Track a successful free sign-up
 */
export function trackSignUp(method: 'email' | 'google', userId?: string) {
  if (userId) {
    const key = `pm_tracked_signup_${userId}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, 'true');
  }
  // 1. GA4
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'sign_up', { method });
  }
  // 2. GTM Custom Event
  pushDataLayer('sign_up', { method });
}

/**
 * Track a successful login
 */
export function trackLogin(method: 'email' | 'google') {
  // 1. GA4
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'login', { method });
  }
  // 2. GTM Custom Event
  pushDataLayer('login', { method });
}

/**
 * Track user initiating the paid upgrade checkout
 */
export function trackBeginCheckout(plan: string, value: number, currency: string = 'INR') {
  const items = [{
    item_name: `${plan.toUpperCase()} Plan Subscription`,
    item_category: 'Subscription',
    price: value,
    quantity: 1
  }];

  // 1. GA4 Standard Event
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'begin_checkout', {
      value,
      currency,
      items
    });
  }

  // 2. GTM Custom Event
  pushDataLayer('begin_checkout', {
    plan,
    value,
    currency,
    items
  });
}

/**
 * Track a successful paid plan subscription creation/purchase
 */
export function trackPurchase(
  plan: string,
  value: number,
  currency: string = 'INR',
  transactionId: string
) {
  const items = [{
    item_name: `${plan.toUpperCase()} Plan Subscription`,
    item_category: 'Subscription',
    price: value,
    quantity: 1
  }];

  // 1. GA4 Standard Event
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'purchase', {
      transaction_id: transactionId,
      value,
      currency,
      items
    });
  }

  // 2. GTM Custom Event
  pushDataLayer('purchase', {
    transaction_id: transactionId,
    plan,
    value,
    currency,
    items
  });
}

/**
 * Track when a user successfully downloads their content kit (lead generation/product usage)
 */
export function trackKitDownload(platformCount: number) {
  // 1. GA4 Standard Event (representing dynamic interest / lead generation)
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'generate_lead', {
      event_category: 'Engagement',
      event_label: 'Content Kit Download',
      value: platformCount
    });
  }

  // 2. GTM Custom Event
  pushDataLayer('generate_lead', {
    platform_count: platformCount
  });
}
