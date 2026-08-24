// Desktop app is detected via a global set by the Electron preload script.
declare global {
  interface Window {
    __PSTREAM_DESKTOP__?: boolean;
    desktopApi?: {
      startDownload(data: {
        url: string;
        title: string;
        poster?: string;
        subtitleText?: string;
        duration?: number;
        type?: string;
        headers?: Record<string, string>;
      }): void;
      openOffline(): void;
    };
  }
}

export function useIsDesktopApp(): boolean {
  return Boolean(window.__PSTREAM_DESKTOP__);
}
