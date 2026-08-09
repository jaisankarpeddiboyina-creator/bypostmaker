import { useLayoutEffect, useEffect } from 'react';

/**
 * Reusable React Hook that implements scroll reveal functionality using IntersectionObserver.
 * - Initial hidden states are added synchronously in useLayoutEffect post-hydration to prevent flashes.
 * - Raw HTML output from static pre-render (where navigator.webdriver is true) remains unaffected.
 * - Respects prefers-reduced-motion automatically.
 * - Observer disconnects individually from elements once they are revealed.
 */
export function useScrollReveal() {
  useLayoutEffect(() => {
    const isPrerender = typeof window !== 'undefined' && navigator.webdriver;
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isPrerender || prefersReduced) return;

    const revealElements = document.querySelectorAll('[data-reveal]');
    revealElements.forEach(el => {
      el.classList.add('reveal-init');
    });
  }, []);

  useEffect(() => {
    const isPrerender = typeof window !== 'undefined' && navigator.webdriver;
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isPrerender || prefersReduced) return;

    const revealElements = document.querySelectorAll('[data-reveal]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15
    });

    revealElements.forEach(el => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, []);
}
