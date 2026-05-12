import { DISPLAY_NAME_KEY, GUEST_ID_KEY } from "../types";

export const WELCOME_KEY = "di-welcome-done";

export function getOrCreateGuestId(): string {
  try {
    let id = localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  } catch {
    return `guest-${Math.random().toString(36).slice(2, 11)}`;
  }
}

export function getDisplayName(): string {
  try {
    const raw = localStorage.getItem(DISPLAY_NAME_KEY);
    if (raw && raw.trim()) return raw.trim().slice(0, 40);
  } catch {
    /* ignore */
  }
  return "Guest";
}

export function setDisplayName(name: string): void {
  try {
    localStorage.setItem(DISPLAY_NAME_KEY, name.trim().slice(0, 40));
  } catch {
    /* ignore */
  }
}

export function isWelcomeComplete(): boolean {
  try {
    return localStorage.getItem(WELCOME_KEY) === "1";
  } catch {
    return false;
  }
}

export function completeWelcome(name: string): { ok: true } | { ok: false; error: string } {
  const t = name.trim();
  if (t.length < 2) return { ok: false, error: "Enter at least 2 characters." };
  if (t.length > 40) return { ok: false, error: "Shorter than 40 characters." };
  setDisplayName(t);
  try {
    localStorage.setItem(WELCOME_KEY, "1");
  } catch {
    return { ok: false, error: "Could not save. Check private mode / storage." };
  }
  return { ok: true };
}
