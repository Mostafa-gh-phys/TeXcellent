/**
 * Ensures Web Worker & main-thread polyfills for Chromium < 140 / Electron 34
 * before pdfjs-dist@6.x initializes pdf.worker.min.mjs.
 */

export function installMainThreadPdfPolyfills(): void {
  const u8Proto = Uint8Array.prototype as Uint8Array & { toHex?: () => string };
  if (typeof u8Proto.toHex !== 'function') {
    Object.defineProperty(Uint8Array.prototype, 'toHex', {
      configurable: true,
      writable: true,
      value: function toHex(this: Uint8Array): string {
        let hex = '';
        for (let i = 0; i < this.length; i++) {
          hex += this[i].toString(16).padStart(2, '0');
        }
        return hex;
      },
    });
  }

  const u8Ctor = Uint8Array as Uint8ArrayConstructor & {
    fromHex?: (str: string) => Uint8Array;
  };
  if (typeof u8Ctor.fromHex !== 'function') {
    Object.defineProperty(Uint8Array, 'fromHex', {
      configurable: true,
      writable: true,
      value: function fromHex(str: string): Uint8Array {
        const clean = String(str);
        if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) {
          throw new SyntaxError('Invalid hex string');
        }
        const out = new Uint8Array(clean.length / 2);
        for (let i = 0; i < out.length; i++) {
          out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
        }
        return out;
      },
    });
  }

  const promiseCtor = Promise as PromiseConstructor & {
    withResolvers?: <T>() => {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  };
  if (typeof promiseCtor.withResolvers !== 'function') {
    Object.defineProperty(Promise, 'withResolvers', {
      configurable: true,
      writable: true,
      value: function withResolvers<T>() {
        let resolve!: (value: T | PromiseLike<T>) => void;
        let reject!: (reason?: unknown) => void;
        const promise = new Promise<T>((res, rej) => {
          resolve = res;
          reject = rej;
        });
        return { promise, resolve, reject };
      },
    });
  }

  const urlCtor = URL as typeof URL & {
    parse?: (url: string, base?: string | URL) => URL | null;
  };
  if (typeof urlCtor.parse !== 'function') {
    Object.defineProperty(URL, 'parse', {
      configurable: true,
      writable: true,
      value: function parse(url: string, base?: string | URL): URL | null {
        try {
          return base !== undefined ? new URL(url, base) : new URL(url);
        } catch {
          return null;
        }
      },
    });
  }
}

export function buildPolyfilledWorkerSource(resolvedWorkerUrl: string): string {
  return `// TeXcellent PDF.js worker compatibility wrapper
if (typeof Uint8Array.prototype.toHex !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    configurable: true,
    writable: true,
    value: function toHex() {
      let hex = '';
      for (let i = 0; i < this.length; i++) {
        hex += this[i].toString(16).padStart(2, '0');
      }
      return hex;
    }
  });
}
if (typeof Uint8Array.fromHex !== 'function') {
  Object.defineProperty(Uint8Array, 'fromHex', {
    configurable: true,
    writable: true,
    value: function fromHex(str) {
      const clean = String(str);
      if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) {
        throw new SyntaxError('Invalid hex string');
      }
      const out = new Uint8Array(clean.length / 2);
      for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
      }
      return out;
    }
  });
}
if (typeof Promise.withResolvers !== 'function') {
  Object.defineProperty(Promise, 'withResolvers', {
    configurable: true,
    writable: true,
    value: function withResolvers() {
      let resolve, reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }
  });
}
if (typeof URL.parse !== 'function') {
  Object.defineProperty(URL, 'parse', {
    configurable: true,
    writable: true,
    value: function parse(url, base) {
      try {
        return base !== undefined ? new URL(url, base) : new URL(url);
      } catch {
        return null;
      }
    }
  });
}
await import(${JSON.stringify(resolvedWorkerUrl)});
`;
}

let cachedBlobWorkerSrc: string | null = null;

export function createPolyfilledWorkerSrc(rawWorkerUrl: string): string {
  installMainThreadPdfPolyfills();

  if (cachedBlobWorkerSrc) return cachedBlobWorkerSrc;

  if (typeof window === 'undefined' || typeof Blob === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return rawWorkerUrl;
  }

  try {
    const resolvedUrl = new URL(rawWorkerUrl, window.location.href).href;
    const code = buildPolyfilledWorkerSource(resolvedUrl);
    const blob = new Blob([code], { type: 'text/javascript' });
    cachedBlobWorkerSrc = URL.createObjectURL(blob);
    return cachedBlobWorkerSrc;
  } catch {
    return rawWorkerUrl;
  }
}
