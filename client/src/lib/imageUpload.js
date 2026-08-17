const TARGET_BYTES = 1_100_000;
const MAX_DIMENSION = 1800;

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Nao foi possivel comprimir a imagem.')),
      'image/webp',
      quality,
    );
  });
}

export async function prepareImageUpload(file) {
  if (!file || !file.type?.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Imagem original muito grande. Maximo: 20 MB.');

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (_) {
    throw new Error('Formato de imagem nao suportado. Use JPEG, PNG ou WebP.');
  }

  let width = bitmap.width;
  let height = bitmap.height;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  let canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  let ctx = canvas.getContext('2d', { alpha: true });
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  for (const quality of [0.88, 0.8, 0.72, 0.64, 0.56]) {
    const blob = await canvasBlob(canvas, quality);
    if (blob.size <= TARGET_BYTES) {
      return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'imagem'}.webp`, { type: 'image/webp' });
    }
  }

  // Very detailed images may still be too large. Downscale once more rather than
  // letting the server/database reject an otherwise valid upload.
  const smaller = document.createElement('canvas');
  const shrink = Math.min(0.78, 1350 / Math.max(canvas.width, canvas.height));
  smaller.width = Math.max(1, Math.round(canvas.width * shrink));
  smaller.height = Math.max(1, Math.round(canvas.height * shrink));
  const smallCtx = smaller.getContext('2d', { alpha: true });
  smallCtx.drawImage(canvas, 0, 0, smaller.width, smaller.height);
  canvas = smaller;
  ctx = smallCtx;

  const finalBlob = await canvasBlob(canvas, 0.58);
  if (finalBlob.size > TARGET_BYTES) throw new Error('Nao consegui reduzir a imagem o suficiente. Tente outra imagem.');
  return new File([finalBlob], `${file.name.replace(/\.[^.]+$/, '') || 'imagem'}.webp`, { type: 'image/webp' });
}
