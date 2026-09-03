/**
 * Thin typed wrapper over the `telegram-web-app.js` global. Using the official
 * script keeps us off a third-party SDK's release cadence; swap in
 * `@telegram-apps/sdk` later if you need its extras.
 */
interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string } };
  colorScheme?: "light" | "dark";
  ready(): void;
  expand(): void;
  requestFullscreen?(): void;
  disableVerticalSwipes?(): void;
  enableClosingConfirmation?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export const tg = (): TelegramWebApp | undefined => window.Telegram?.WebApp;

export const isInsideTelegram = (): boolean => Boolean(tg()?.initData);

/** Puts the Mini App into the layout a game wants: expanded, no pull-to-close, dark chrome. */
export function initTelegram(): void {
  const app = tg();
  if (!app) return;

  app.ready();
  app.expand();
  app.requestFullscreen?.();
  app.disableVerticalSwipes?.();
  app.enableClosingConfirmation?.();
  app.setHeaderColor?.("#0b0f16");
  app.setBackgroundColor?.("#0b0f16");
}

export function haptic(style: "light" | "medium" | "heavy" = "light"): void {
  tg()?.HapticFeedback?.impactOccurred(style);
}

export function telegramDisplayName(): string {
  const user = tg()?.initDataUnsafe?.user;
  return user?.first_name || user?.username || "Герой";
}
