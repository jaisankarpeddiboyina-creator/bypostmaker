import JSZip from 'jszip';
import { PLATFORM_MAP } from '../config/platforms';

const ZIP_VIDEO_THRESHOLD = 80 * 1024 * 1024; // 80MB

/**
 * Helper to convert a dataURL to a Blob (fallback for browsers without canvas.toBlob)
 */
function dataURLToBlob(dataUrl: string): Blob {
  const base64Parts = dataUrl.split(',');
  const byteString = atob(base64Parts[1]);
  const mimeString = base64Parts[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

/**
 * Resizes an image file to the specified dimensions using HTML5 Canvas.
 * Fallback to toDataURL is used if toBlob is not supported.
 */
export function resizeImage(
  file: File,
  width: number,
  height: number,
  mimeType: string
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get 2d context from canvas'));
        return;
      }

      // 1. Fill background with solid white to handle any transparency in the source image
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // 2. Calculate "cover" dimensions (fill and crop)
      const imgRatio = img.width / img.height;
      const targetRatio = width / height;

      let drawWidth = width;
      let drawHeight = height;
      let offsetX = 0;
      let offsetY = 0;

      if (imgRatio > targetRatio) {
        // Image is wider than target aspect ratio -> fit height, crop width
        drawWidth = height * imgRatio;
        offsetX = (width - drawWidth) / 2;
      } else {
        // Image is taller than target aspect ratio -> fit width, crop height
        drawHeight = width / imgRatio;
        offsetY = (height - drawHeight) / 2;
      }

      // 3. Draw the image with cover cropping
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas toBlob returned null'));
            }
          },
          mimeType,
          0.9
        );
      } else {
        // Fallback for older browsers / Safari quirks
        try {
          const dataUrl = canvas.toDataURL(mimeType, 0.9);
          const blob = dataURLToBlob(dataUrl);
          resolve(blob);
        } catch (err) {
          reject(err);
        }
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image file into Image object'));
    };

    img.src = objectUrl;
  });
}

/**
 * Generates the download kit ZIP entirely client-side.
 * Resizes images sequentially to keep the main thread responsive.
 */
export async function generateClientZip(
  campaignId: string,
  prompt: string,
  posts: any[],
  imageFiles: File[],
  videoFile: File | null,
  onProgress: (message: string) => void
): Promise<Blob> {
  const zip = new JSZip();

  // Calculate total operations for the sanity ceiling
  let totalResizes = 0;
  const selectedPlatformIds: string[] = [];

  for (const post of posts) {
    const platform = PLATFORM_MAP[post.platformId];
    if (!platform) continue;
    selectedPlatformIds.push(post.platformId);
    if (imageFiles.length > 0 && platform.imageDimensions.length > 0) {
      const imagesToProcess = imageFiles.slice(0, platform.maxImages);
      totalResizes += imagesToProcess.length * platform.imageDimensions.length;
    }
  }

  const MAX_OPERATIONS = 60;
  let operationCount = 0;
  let resizeCapped = false;
  let imageSkippedCount = 0;
  const warnings: string[] = [];

  zip.file('prompt.txt', prompt);

  // Process video file
  let includeVideo = false;
  const videoFileName = videoFile?.name ?? 'your_video.mp4';
  if (videoFile) {
    if (videoFile.size <= ZIP_VIDEO_THRESHOLD) {
      includeVideo = true;
      zip.file(videoFileName, videoFile);
    } else {
      warnings.push(
        `Video "${videoFileName}" was excluded from the ZIP because it exceeds the 80MB threshold (${(
          videoFile.size /
          (1024 * 1024)
        ).toFixed(1)}MB).`
      );
    }
  }

  // Process each platform's post and images
  for (const post of posts) {
    const platform = PLATFORM_MAP[post.platformId];
    if (!platform) continue;

    const platformFolderName = sanitize(platform.name);
    const folder = zip.folder(platformFolderName)!;
    folder.file('post.txt', post.content);

    // Extra fields (subreddit, url etc) saved with the post
    let extraFields: Record<string, string> = {};
    if (post.extraFields) {
      try {
        extraFields =
          typeof post.extraFields === 'string'
            ? JSON.parse(post.extraFields)
            : post.extraFields;
      } catch {
        /* ignore */
      }
    }

    const shareUrl = platform.shareUrl(post.content, extraFields);
    folder.file('share_url.txt', `Share on ${platform.name}:\n${shareUrl}`);

    // Handle images for this platform
    if (imageFiles.length > 0 && platform.imageDimensions.length > 0) {
      const imagesToProcess = imageFiles.slice(0, platform.maxImages);

      for (let imgIndex = 0; imgIndex < imagesToProcess.length; imgIndex++) {
        const imgFile = imagesToProcess[imgIndex];
        const imageMimeType = imgFile.type || 'image/jpeg';
        const ext = imageMimeType.includes('png') ? 'png' : 'jpg';

        // Pre-resize file size guard: 15MB
        if (imgFile.size > 15 * 1024 * 1024) {
          imageSkippedCount++;
          const skipMsg = `Image "${imgFile.name}" exceeds 15MB and was skipped to prevent memory crash.`;
          warnings.push(skipMsg);
          folder.file(`image_warning_${imgIndex + 1}.txt`, skipMsg);
          continue;
        }

        for (const dim of platform.imageDimensions) {
          // Check if we hit the operation ceiling
          if (operationCount >= MAX_OPERATIONS) {
            resizeCapped = true;
            continue;
          }

          operationCount++;
          onProgress(
            `Resizing image ${imgIndex + 1} of ${imagesToProcess.length} for ${
              platform.name
            } (${dim.label} ${dim.width}x${dim.height})...`
          );

          try {
            // Sequential execution: await each resize operation in turn
            const resizedBlob = await resizeImage(
              imgFile,
              dim.width,
              dim.height,
              imageMimeType
            );

            const filename =
              imagesToProcess.length > 1
                ? `image${imgIndex + 1}_${dim.width}x${dim.height}_${sanitize(
                    dim.label
                  )}.${ext}`
                : `image_${dim.width}x${dim.height}_${sanitize(dim.label)}.${ext}`;

            folder.file(filename, resizedBlob);
          } catch (err: any) {
            // Per-image error handling: log warning, add txt note, and continue
            console.warn(
              `Failed to resize ${imgFile.name} for ${platform.name} (${dim.width}x${dim.height}):`,
              err
            );
            const errorMsg = `Could not resize image "${imgFile.name}" for ${
              dim.label
            } (${dim.width}x${dim.height}). Error: ${
              err?.message || 'Unknown error'
            }. Please resize manually.`;
            warnings.push(errorMsg);
            folder.file(
              `image_error_${imgIndex + 1}_${dim.width}x${dim.height}.txt`,
              errorMsg
            );
          }
        }
      }
    }

    if (videoFile) {
      const note =
        videoFile.size > ZIP_VIDEO_THRESHOLD
          ? `Your video is too large to include in the ZIP (>${
              ZIP_VIDEO_THRESHOLD / 1024 / 1024
            }MB).\nUpload "${videoFileName}" directly to ${platform.name}.`
          : `Your video "${videoFileName}" is at the root of this kit.\nUpload it directly to ${platform.name}.`;
      folder.file('video_note.txt', note);
    }
  }

  if (resizeCapped) {
    const capMsg = `Resizing was capped at ${MAX_OPERATIONS} operations to prevent browser memory exhaustion. Some platform dimensions were skipped.`;
    warnings.push(capMsg);
  }

  // Build and add the README.txt
  const readmeContent = buildReadme(selectedPlatformIds, prompt, warnings);
  zip.file('README.txt', readmeContent);

  onProgress('Packaging ZIP file...');
  return await zip.generateAsync({ type: 'blob' });
}

export function sanitize(name: string): string {
  return name.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '_').toLowerCase();
}

function buildReadme(
  platformIds: string[],
  prompt: string,
  warnings: string[]
): string {
  const names = platformIds.map((id) => PLATFORM_MAP[id]?.name ?? id);
  let content = `PostMaker Kit
=============
Prompt: "${prompt}"

Platforms (${names.length}):
${names.map((n) => `  · ${n}`).join('\n')}

Each folder contains:
  post.txt         Copy-paste ready content
  share_url.txt    Click to share directly
  image_WxH.jpg    Resized for this platform (if image uploaded)
  video_note.txt   Video instructions (if video uploaded)

Video: included at root level if under 80MB, otherwise upload directly.`;

  if (warnings.length > 0) {
    content += `\n\nWarnings / Notes during generation:\n`;
    content += warnings.map((w) => `  ⚠️  ${w}`).join('\n');
  }

  content += `\n\nGenerated by PostMaker · bypostamaker.com`;
  return content;
}
