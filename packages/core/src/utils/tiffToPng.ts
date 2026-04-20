// @ts-expect-error — utif has no bundled types
import UTIF from 'utif';

/**
 * Decode a TIFF image buffer to a PNG data URL.
 *
 * Browsers cannot natively render image/tiff, so TIFFs embedded in DOCX files
 * show as broken images. We decode the TIFF to RGBA with utif and re-encode as
 * PNG via a canvas. The original TIFF bytes are preserved elsewhere for
 * roundtrip fidelity — only the data URL used for display is replaced.
 *
 * Returns null when conversion is unavailable (no DOM — e.g. Node/headless) or
 * the buffer is not a decodable TIFF. Callers should fall back to the original
 * data URL in that case.
 */
export function tiffBufferToPngDataUrl(data: ArrayBuffer): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const ifds = UTIF.decode(data);
    if (!ifds || ifds.length === 0) return null;
    const ifd = ifds[0];
    UTIF.decodeImage(data, ifd);
    const rgba = UTIF.toRGBA8(ifd);
    const width = ifd.width as number;
    const height = ifd.height as number;
    if (!width || !height) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(rgba);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
