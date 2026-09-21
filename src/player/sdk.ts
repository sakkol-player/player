declare global { interface Window { onSpotifyWebPlaybackSDKReady?: () => void; Spotify?: any } }

/** Spotify's player needs DRM (Widevine). Some browser windows (for example Firefox private windows) do not offer it. */
export async function drmAvailable(): Promise<boolean> {
  if (!navigator.requestMediaKeySystemAccess) return false;
  try {
    await navigator.requestMediaKeySystemAccess("com.widevine.alpha", [{ initDataTypes: ["cenc"], audioCapabilities: [{ contentType: 'audio/mp4;codecs="mp4a.40.2"' }] }]);
    return true;
  } catch { return false; }
}

let loading: Promise<void> | null = null;
/** Loads Spotify's SDK script. Called only AFTER unlock, never on the QR or phone pages. */
export function loadSdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve();
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      window.onSpotifyWebPlaybackSDKReady = () => resolve();
      const s = document.createElement("script");
      s.src = "https://sdk.scdn.co/spotify-player.js"; s.async = true;
      s.onerror = () => { loading = null; reject(new Error("sdk_load_failed")); };
      document.head.append(s);
    });
  }
  return loading;
}
