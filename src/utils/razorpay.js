/**
 * Razorpay Standard Checkout Script Loader Utility
 *
 * Securely and dynamically injects the official Razorpay Checkout SDK (checkout.js).
 * Includes timeout guards, duplicate script deduplication, and failure recovery.
 */

export const RAZORPAY_CHECKOUT_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

let scriptPromise = null;

/**
 * Loads the official Razorpay Checkout script asynchronously.
 * @param {number} timeoutMs - Max time to wait for script to load before timing out (default: 10000ms)
 * @returns {Promise<boolean>} True if window.Razorpay is available, false otherwise.
 */
export function loadRazorpayCheckoutScript(timeoutMs = 10000) {
  if (typeof window === 'undefined') {
    return Promise.resolve(false);
  }

  // Already loaded and ready
  if (typeof window.Razorpay === 'function') {
    return Promise.resolve(true);
  }

  // Return existing in-flight loading promise to avoid duplicate DOM injection
  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve) => {
    // Check if script element is already present in document
    const existing = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_SCRIPT_URL}"]`);
    if (existing) {
      if (typeof window.Razorpay === 'function') {
        resolve(true);
        return;
      }
      existing.addEventListener('load', () => resolve(typeof window.Razorpay === 'function'));
      existing.addEventListener('error', () => {
        scriptPromise = null;
        resolve(false);
      });
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_CHECKOUT_SCRIPT_URL;
    script.async = true;

    let timer = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      script.onload = null;
      script.onerror = null;
    };

    timer = setTimeout(() => {
      cleanup();
      scriptPromise = null;
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      resolve(false);
    }, timeoutMs);

    script.onload = () => {
      cleanup();
      const ready = typeof window.Razorpay === 'function';
      if (!ready) {
        scriptPromise = null;
      }
      resolve(ready);
    };

    script.onerror = () => {
      cleanup();
      scriptPromise = null;
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      resolve(false);
    };

    document.body.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Resets the cached script loading promise (useful for tests or retry recovery)
 */
export function resetRazorpayScriptCache() {
  scriptPromise = null;
}
