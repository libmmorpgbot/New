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

/**
 * Every Telegram call goes through here.
 *
 * The SDK throws `WebAppMethodUnsupported` when the method is newer than the
 * user's Telegram build — and optional chaining does not help, because the
 * method exists and the *call* is what throws. One old client would otherwise
 * take down everything after it, including the React mount.
 */
function attempt(label: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    console.warn(`[telegram] ${label} недоступен в этой версии клиента:`, err);
  }
}

/** Puts the Mini App into the layout a game wants: expanded, no pull-to-close, dark chrome. */
export function initTelegram(): void {
  const app = tg();
  if (!app) return;

  // Bot API 6.0 — supported everywhere the Mini App platform exists.
  attempt("ready", () => app.ready());
  attempt("expand", () => app.expand());

  // 6.1+ — a client older than the method throws instead of ignoring it.
  attempt("setHeaderColor", () => app.setHeaderColor?.("#0b0f16"));
  attempt("setBackgroundColor", () => app.setBackgroundColor?.("#0b0f16"));
  attempt("enableClosingConfirmation", () => app.enableClosingConfirmation?.());

  // 7.7 — stops a swipe on the joystick from dragging the app closed.
  attempt("disableVerticalSwipes", () => app.disableVerticalSwipes?.());

  // `requestFullscreen` (8.0) is deliberately not called: in fullscreen the
  // Telegram controls float over the page, and the HUD only accounts for the
  // CSS safe area, so it would sit under the close button.
}

export function haptic(style: "light" | "medium" | "heavy" = "light"): void {
  // Called on every hit, so it must never be able to break the game loop.
  attempt("haptic", () => tg()?.HapticFeedback?.impactOccurred(style));
}

export function telegramDisplayName(): string {
  const user = tg()?.initDataUnsafe?.user;
  return user?.first_name || user?.username || "Герой";
}
