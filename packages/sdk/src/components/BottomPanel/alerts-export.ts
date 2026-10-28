import type { AlertItem } from "./use-alerts.ts";

/** The plain text the copy and export actions write (design section 8.1). */
export function alertsAsText(alerts: AlertItem[]): string {
  return alerts
    .map((alert) => `[${alert.severity.toUpperCase()}] ${alert.code} ${alert.label}`)
    .join("\n");
}

/**
 * Copies the alerts the panel currently shows as plain text.
 *
 * The clipboard API is missing outside a secure browser context and in the
 * test environment, so the action degrades to a no-op instead of throwing.
 */
export async function copyAlerts(alerts: AlertItem[]): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  const clipboard = navigator.clipboard;
  if (!clipboard || typeof clipboard.writeText !== "function") return false;
  try {
    await clipboard.writeText(alertsAsText(alerts));
    return true;
  } catch {
    return false;
  }
}

/**
 * Downloads the alerts the panel currently shows as a `.txt` file.
 *
 * The download is a Blob plus an object URL, the same path the other
 * exports of the editor use; it is skipped when the document or the URL
 * factory is unavailable (a server-side render, for instance).
 */
export function exportAlerts(
  alerts: AlertItem[],
  filename = "drawdb-alerts.txt",
): boolean {
  if (typeof document === "undefined") return false;
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return false;
  }
  if (typeof Blob === "undefined") return false;
  const blob = new Blob([alertsAsText(alerts)], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}
