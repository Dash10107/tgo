import { useSyncExternalStore } from 'react';

// The theme is applied as a `dark` class on <html> (see uiStore / App), so watch that directly:
// it already resolves the "system" preference.
const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
};

const getSnapshot = () => document.documentElement.classList.contains('dark');

/** Whether the dark theme is currently active */
export const useIsDarkTheme = (): boolean => useSyncExternalStore(subscribe, getSnapshot);
