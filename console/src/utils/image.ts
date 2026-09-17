/**
 * 图片相关工具（1.2.5）
 *
 * - `preloadImage`：上传后自检——确认地址真的能打开再写入记录，避免"存进去却打不开"。
 * - `thumbUrl`：列表/相册网格用 Halo 的图片处理参数取小图（`?width=`），点开再看原图，省流量、首屏更快。
 * - `compressImage`：上传前按需压缩（手机直出照片常见 5–10MB），尺寸/质量可在设置里配。
 */

/** 预加载图片，返回是否成功（带超时，避免一直挂着） */
export function preloadImage(url: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }
    const img = new Image();
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      done(true);
    };
    img.onerror = () => {
      clearTimeout(timer);
      done(false);
    };
    img.src = url;
  });
}

/**
 * 取缩略图地址：仅对本站 `/upload/**` 地址追加 Halo 的图片处理参数 `?width=N`；
 * 外部地址、非 /upload 地址原样返回；已有 width 参数则替换。
 */
export function thumbUrl(url: string | undefined, width: number): string {
  const raw = (url || "").trim();
  if (!raw || !raw.startsWith("/upload/") || width <= 0) return raw;
  const [base, query = ""] = raw.split("?");
  const params = query
    .split("&")
    .filter((p) => p && !p.startsWith("width="))
    .filter(Boolean);
  params.push(`width=${width}`);
  return `${base}?${params.join("&")}`;
}

export interface CompressOptions {
  /** 目标最大宽度（高度按比例） */
  maxWidth: number;
  /** JPEG 质量 0–1 */
  quality: number;
  /** 小于该体积（字节）的文件不压缩 */
  minBytes?: number;
}

export interface CompressResult {
  file: File;
  compressed: boolean;
  originalSize: number;
  size: number;
}

/** 上传前压缩：仅在体积超过 minBytes 且能被浏览器解码为图片时压缩，失败则原样返回 */
export async function compressImage(file: File, options: CompressOptions): Promise<CompressResult> {
  const originalSize = file.size;
  const minBytes = options.minBytes ?? 1_500_000; // 1.5MB 以下不动
  if (!file.type.startsWith("image/") || originalSize <= minBytes) {
    return { file, compressed: false, originalSize, size: originalSize };
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, options.maxWidth / bitmap.width);
    const targetW = Math.max(1, Math.round(bitmap.width * scale));
    const targetH = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no-2d-context");
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", options.quality)
    );
    if (!blob || blob.size >= originalSize) {
      return { file, compressed: false, originalSize, size: originalSize };
    }
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return {
      file: new File([blob], name, { type: "image/jpeg" }),
      compressed: true,
      originalSize,
      size: blob.size,
    };
  } catch {
    return { file, compressed: false, originalSize, size: originalSize };
  }
}

/** 人类可读的体积 */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
