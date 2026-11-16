// The Latin subset of Caveat Brush, inlined as a data URL so no font file is
// exposed to sites and nothing is fetched.
import fontUrl from '@fontsource/caveat-brush/files/caveat-brush-latin-400-normal.woff2?inline';

/** The private family name website notes use, so a site's own fonts never clash. */
const HAND_FAMILY = 'SB Hand';

let loading: Promise<boolean> | null = null;

const bytesOf = (dataUrl: string): Uint8Array => {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

/**
 * Registers the handwriting font on this page once. Resolves true when it is
 * ready, false when the page refused it (the notes then use the system font).
 */
export const loadHandFont = (): Promise<boolean> => {
  loading ??= (async () => {
    try {
      const face = new FontFace(HAND_FAMILY, bytesOf(fontUrl));
      await face.load();
      document.fonts.add(face);
      return true;
    } catch {
      return false;
    }
  })();
  return loading;
};

/** For tests: forget the loaded font. */
export const resetHandFont = () => {
  loading = null;
};
