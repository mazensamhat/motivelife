export const MAX_AVATAR_BYTES = 120_000;

export function isValidAvatarDataUrl(value: string): boolean {
  if (!value.startsWith("data:image/")) return false;
  if (value.length > MAX_AVATAR_BYTES + 128) return false;
  const base64 = value.split(",")[1];
  if (!base64) return false;
  return /^[A-Za-z0-9+/=]+$/.test(base64);
}

/** Resize image in the browser before upload (keeps server simple on Vercel). */
export async function resizeImageFile(file: File, maxSize = 256): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let quality = 0.85;
  let result = canvas.toDataURL("image/webp", quality);
  while (result.length > MAX_AVATAR_BYTES && quality > 0.45) {
    quality -= 0.1;
    result = canvas.toDataURL("image/webp", quality);
  }
  if (result.length > MAX_AVATAR_BYTES) {
    result = canvas.toDataURL("image/jpeg", 0.75);
  }
  if (result.length > MAX_AVATAR_BYTES) {
    throw new Error("Image is too large. Try a smaller photo.");
  }
  return result;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Invalid image file."));
    img.src = src;
  });
}
