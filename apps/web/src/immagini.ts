// Immagini del personaggio (solo nel browser: usa canvas).

const LATO_AVATAR = 256; // px
const QUALITA_AVATAR = 0.85;

// Ritaglia al centro un quadrato e lo riduce a 256 px: un JPEG di poche decine di KB,
// abbastanza piccolo da viaggiare dentro la scheda.
export async function ridimensionaAvatar(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Il file non è un'immagine.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Immagine non leggibile.");
  });
  const lato = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = LATO_AVATAR;
  canvas.height = LATO_AVATAR;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Il browser non permette di elaborare l'immagine.");
  ctx.fillStyle = "#0f172a"; // le zone trasparenti diventano del colore delle card
  ctx.fillRect(0, 0, LATO_AVATAR, LATO_AVATAR);
  ctx.drawImage(bitmap, (bitmap.width - lato) / 2, (bitmap.height - lato) / 2, lato, lato, 0, 0, LATO_AVATAR, LATO_AVATAR);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", QUALITA_AVATAR);
}
