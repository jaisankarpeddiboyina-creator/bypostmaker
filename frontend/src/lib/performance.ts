/**
 * Performance Utilities
 * Includes route prefetching and Web Vitals reporting to Google Analytics
 */

// Declare gtag globally in case it is loaded
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Programmatically prefetch route chunks
 * This creates a link rel="prefetch" in the head to fetch resource during idle time
 */
export function preloadRoute(href: string) {
  try {
    const linkId = `prefetch-${href.replace(/[^a-zA-Z0-9]/g, '-')}`;
    if (document.getElementById(linkId)) return;

    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'prefetch';
    link.href = href;
    link.as = 'script';
    document.head.appendChild(link);
  } catch (err) {
    console.warn(`Failed to preload route ${href}:`, err);
  }
}

/**
 * Forward Core Web Vitals metrics to Google Analytics 4
 */
export function markWebVital(metricName: string, metricValue: number, metricId: string) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'web_vitals', {
      event_category: 'Web Vitals',
      event_action: metricName,
      event_value: Math.round(metricName === 'CLS' ? metricValue * 1000 : metricValue),
      event_label: metricId,
      non_interaction: true,
    });
  }
}
