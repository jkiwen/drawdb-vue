export interface HotkeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented?: boolean;
  preventDefault?: () => void;
}

export interface ParsedBinding {
  /** The lower-cased key of the binding. */
  key: string;
  /** The binding uses the platform modifier (control, or command on macOS). */
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

export interface HotkeyOptions {
  /** Handlers with a higher priority run first. */
  priority?: number;
  description?: string;
}

export interface HotkeyRegistration {
  binding: string;
  handler: (event: HotkeyEvent) => void;
  priority: number;
  description?: string;
}

export interface HotkeyRegistry {
  register(
    binding: string,
    handler: (event: HotkeyEvent) => void,
    options?: HotkeyOptions,
  ): void;
  unregister(binding: string): void;
  clear(): void;
  handle(event: HotkeyEvent): boolean;
  registrations(): HotkeyRegistration[];
}

export type ModifierName = "mod" | "ctrl" | "meta" | "shift" | "alt";

const MODIFIER_ALIASES: Record<string, ModifierName> = {
  mod: "mod",
  ctrl: "ctrl",
  control: "ctrl",
  meta: "meta",
  cmd: "meta",
  command: "meta",
  super: "meta",
  win: "meta",
  shift: "shift",
  alt: "alt",
  option: "alt",
};

/** Detects the platform the editor runs on. */
export function detectPlatform(): string {
  const globalAny = globalThis as {
    navigator?: { platform?: string; userAgent?: string };
    process?: { platform?: string };
  };

  if (typeof globalAny.navigator !== "undefined") {
    const platform =
      globalAny.navigator.platform ?? globalAny.navigator.userAgent ?? "";
    if (platform) {
      return platform.toLowerCase().includes("mac") ? "darwin" : "other";
    }
  }

  return globalAny.process?.platform ?? "other";
}

/**
 * Splits a binding such as `mod+shift+z` into its parts.
 *
 * `mod` stays a separate flag, because it means control on Windows and Linux
 * but command on macOS; the registry resolves it against the platform.
 */
export function normalizeBinding(binding: string): ParsedBinding {
  const parts = binding
    .split("+")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);

  const key = parts.length > 0 ? (parts.pop() as string) : "";
  const parsed: ParsedBinding = {
    key,
    mod: false,
    ctrl: false,
    meta: false,
    shift: false,
    alt: false,
  };

  for (const part of parts) {
    const modifier = MODIFIER_ALIASES[part];
    if (modifier) {
      parsed[modifier] = true;
    }
  }

  return parsed;
}

/** Checks whether a keyboard event matches a binding. */
export function matchesBinding(
  binding: ParsedBinding,
  event: HotkeyEvent,
  platform: string,
): boolean {
  if (event.key.toLowerCase() !== binding.key) {
    return false;
  }

  if (binding.mod) {
    const modifierPressed =
      platform === "darwin" ? event.metaKey : event.ctrlKey;
    if (!modifierPressed) {
      return false;
    }
  } else {
    if (binding.ctrl && !event.ctrlKey) {
      return false;
    }
    if (!binding.ctrl && event.ctrlKey) {
      return false;
    }
    if (binding.meta && !event.metaKey) {
      return false;
    }
    if (!binding.meta && event.metaKey) {
      return false;
    }
  }

  if (binding.shift !== event.shiftKey) {
    return false;
  }

  if (binding.alt !== event.altKey) {
    return false;
  }

  return true;
}

/**
 * Creates a registry of keyboard shortcuts.
 *
 * The registry is independent of the DOM, so it can be used to test the
 * shortcut behaviour without a browser.
 */
export function createHotkeyRegistry(
  platform: string = detectPlatform(),
): HotkeyRegistry {
  const entries: HotkeyRegistration[] = [];

  function register(
    binding: string,
    handler: (event: HotkeyEvent) => void,
    options: HotkeyOptions = {},
  ): void {
    entries.push({
      binding,
      handler,
      priority: options.priority ?? 0,
      description: options.description,
    });
  }

  function unregister(binding: string): void {
    const target = binding.toLowerCase();
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (entries[index].binding.toLowerCase() === target) {
        entries.splice(index, 1);
      }
    }
  }

  function clear(): void {
    entries.length = 0;
  }

  function registrations(): HotkeyRegistration[] {
    return [...entries];
  }

  function handle(event: HotkeyEvent): boolean {
    const matching = entries
      .filter((registration) =>
        matchesBinding(normalizeBinding(registration.binding), event, platform),
      )
      .sort((left, right) => right.priority - left.priority);

    if (matching.length === 0) {
      return false;
    }

    let stopped = false;
    const wrapped: HotkeyEvent = {
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      get defaultPrevented() {
        return stopped || event.defaultPrevented === true;
      },
      preventDefault() {
        stopped = true;
        event.preventDefault?.();
      },
    };

    for (const registration of matching) {
      registration.handler(wrapped);
      if (stopped) {
        break;
      }
    }

    return true;
  }

  return { register, unregister, clear, handle, registrations };
}

let sharedRegistry: HotkeyRegistry | undefined;

/**
 * The keyboard shortcuts of the editor.
 *
 * All components share one registry, so a shortcut registered by a plugin is
 * honoured everywhere.
 */
export function useHotkeys(): HotkeyRegistry {
  if (!sharedRegistry) {
    sharedRegistry = createHotkeyRegistry();
  }
  return sharedRegistry;
}
