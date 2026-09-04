import { useEffect } from 'react';

// Keeps reference count so nested/overlapping modals don't prematurely unlock body scroll
let activeModalCount = 0;
let originalBodyOverflow = '';
let originalHtmlOverflow = '';
let originalBodyTouchAction = '';

export function useScrollLock(isOpen) {
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    if (activeModalCount === 0) {
      originalBodyOverflow = document.body.style.overflow;
      originalHtmlOverflow = document.documentElement.style.overflow;
      originalBodyTouchAction = document.body.style.touchAction;

      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    }
    activeModalCount++;

    return () => {
      activeModalCount--;
      if (activeModalCount <= 0) {
        activeModalCount = 0;
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
        document.body.style.touchAction = originalBodyTouchAction;
      }
    };
  }, [isOpen]);
}

export default useScrollLock;
