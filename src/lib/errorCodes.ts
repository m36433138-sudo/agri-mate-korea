/** Keep hyphens inside codes; accept pasted lists without duplicate records. */
export function parseErrorCodes(value: string): string[] {
  return [...new Set(value.split(/[\s,;、，]+/u).map((code) => code.trim().toUpperCase()).filter(Boolean))];
}

export async function compressErrorCodePhoto(file: File): Promise<Blob> {
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("사진 변환을 시작할 수 없습니다.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("사진 변환 실패")), "image/jpeg", 0.82,
    ));
  } finally {
    image.close();
  }
}