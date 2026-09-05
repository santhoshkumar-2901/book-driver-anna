import { useEffect } from 'react';

// Keeps reference count so nested/overlapping modals don't prematurely unlock body scroll
let activeModalCount = 0;
let originalBodyOverflow = '';
let originalHtmlOverflow = '';

export function useScrollLock(isOpen) {
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    if (activeModalCount === 0) {
      originalBodyOverflow = document.body.style.overflow;
      originalHtmlOverflow = document.documentElement.style.overflow;

      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
    activeModalCount++;

    return () => {
      activeModalCount--;
      if (activeModalCount <= 0) {
        activeModalCount = 0;
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      }
    };
  }, [isOpen]);
}

export default useScrollLock;
