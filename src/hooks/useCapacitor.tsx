import { Capacitor } from '@capacitor/core';

export function useIsNativeApp() {
  return Capacitor.isNativePlatform();
}

export function useIsMobileLayout() {
  // Show mobile layout in native app OR when URL param is set (for testing)
  const isNative = Capacitor.isNativePlatform();
  const forceLayout = new URLSearchParams(window.location.search).get('layout');
  if (forceLayout === 'mobile') return true;
  if (forceLayout === 'desktop') return false;
  return isNative;
}
