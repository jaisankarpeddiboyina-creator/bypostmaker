import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { PLATFORM_MAP } from '@@config/platforms';
import { MAX_IMAGE_SIZE_BYTES } from '../../../config/limits';
import { trackKitDownload } from './analytics';

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

      // 2. Calculate "cover" dimensions (fill and crop) using natural dimensions
      const scaleX = width / img.naturalWidth;
      const scaleY = height / img.naturalHeight;
      const scale = Math.max(scaleX, scaleY);

      const drawWidth = img.naturalWidth * scale;
      const drawHeight = img.naturalHeight * scale;
      const offsetX = (width - drawWidth) / 2;
      const offsetY = (height - drawHeight) / 2;

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
        if (imgFile.size > MAX_IMAGE_SIZE_BYTES) {
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

  // Track the content kit download as a conversion event
  trackKitDownload(selectedPlatformIds.length);

  onProgress('Packaging ZIP file...');
  return await zip.generateAsync({ type: 'blob' });
}

export function sanitize(name: string): string {
  return name.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '_').toLowerCase();
}

export function sanitizeFilename(filename: string): string {
  // Strip illegal chars: \ / : * ? " < > |
  let cleaned = filename.replace(/[\\/:*?"<>|]/g, '');
  // Strip control characters (chars with ASCII code < 32)
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
  // Trim leading/trailing whitespace
  cleaned = cleaned.trim();
  // Limit length to 100 characters
  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 100);
  }
  // Strip any trailing extension (e.g. .pdf, .zip, etc.)
  cleaned = cleaned.replace(/\.[a-zA-Z0-9]{2,4}$/, '');
  return cleaned;
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

/**
 * Cleans text for jsPDF WinAnsi / Latin-1 standard Helvetica encoding:
 * - Converts typographic characters (smart quotes, dashes, bullets, ellipsis) to ASCII equivalents
 * - Replaces common functional emojis with ASCII equivalents (e.g. checkmarks -> [x], crosses -> [ ], arrows -> ->, stars -> *)
 * - Removes any remaining unencodable emojis, pictographs, and surrogate pairs to prevent garbled box glyphs
 */
export function cleanPdfText(text: string): string {
  if (!text) return '';
  return text
    // Typographic replacements
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '*')
    .replace(/\u2026/g, '...')
    // Functional emoji replacements (using unicode flag /gu)
    .replace(/(?:✅|✔️|☑️)/gu, '[x]')
    .replace(/(?:❌|✖️|❎)/gu, '[ ]')
    .replace(/(?:👉|➡️|▶️|➔)/gu, '->')
    .replace(/(?:👈|⬅️|◀️)/gu, '<-')
    .replace(/(?:⭐|🌟|✨|🔥|💡)/gu, '*')
    // Unicode Extended Pictographic & Emojis removal
    .replace(/\p{Extended_Pictographic}/gu, '')
    // Remove any remaining stray surrogate codepoints
    .replace(/[\uD800-\uDFFF]/g, '')
    // Normalize duplicate spaces from stripped standalone emojis
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Generates the download kit PDF entirely client-side.
 */
export async function generateClientPdf(
  campaignId: string,
  prompt: string,
  posts: any[],
  imageFiles: File[],
  videoFile: File | null,
  onProgress: (message: string) => void
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageW = 210;
  const pageH = 297;
  const margin = 16;
  const contentW = pageW - (margin * 2); // 178mm

  // Track warnings
  const warnings: string[] = [];
  let operationCount = 0;
  let resizeCapped = false;
  const MAX_OPERATIONS = 60;

  // Helper to convert hex brandColor to RGB
  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 56, g: 189, b: 248 };
  };

  // Helper to draw text with word wrapping and auto-paging
  const drawWrappedText = (
    text: string,
    startX: number,
    startY: number,
    maxWidth: number,
    lineHeight: number,
    textColor = [51, 65, 85]
  ): number => {
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    const safeText = cleanPdfText(text);
    const lines = doc.splitTextToSize(safeText, maxWidth);
    let currentY = startY;

    for (const line of lines) {
      if (currentY + lineHeight > pageH - margin - 12) {
        doc.addPage();
        currentY = margin + 12;
      }
      doc.text(line, startX, currentY);
      currentY += lineHeight;
    }
    return currentY;
  };

  let currentY = margin;

  // ==========================================
  // PAGE 1: HEADER & COVER
  // ==========================================

  // Brand Accent Bar (Sky Blue Gradient style)
  doc.setFillColor(56, 189, 248); // #38BDF8
  doc.roundedRect(margin, currentY, contentW, 3.5, 1.5, 1.5, 'F');
  currentY += 10;

  // Header Title & Tagline
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text('PostMaker', margin, currentY);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text('Social Media Campaign Kit', margin, currentY + 5.5);

  // Top-right Metadata Badge
  const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Campaign: ${campaignId.slice(0, 18)}`, pageW - margin, currentY - 1, { align: 'right' });
  doc.text(`Date: ${dateStr}`, pageW - margin, currentY + 4, { align: 'right' });

  currentY += 14;

  // Divider Line
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.line(margin, currentY, margin + contentW, currentY);
  currentY += 8;

  // Prompt Section (Enclosed in a styled card)
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text('CAMPAIGN PROMPT', margin, currentY);
  currentY += 4;

  const safePrompt = cleanPdfText(prompt);
  const promptLines = doc.splitTextToSize(safePrompt, contentW - 12);
  const promptBoxH = Math.max(16, promptLines.length * 4.8 + 8);

  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(margin, currentY, contentW, promptBoxH, 2.5, 2.5, 'FD');

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59); // Slate 800

  let pY = currentY + 6;
  for (const line of promptLines) {
    doc.text(line, margin + 6, pY);
    pY += 4.8;
  }

  currentY += promptBoxH + 8;

  // Video Section (if exists)
  if (videoFile) {
    const videoSizeMB = (videoFile.size / (1024 * 1024)).toFixed(1);
    doc.setFillColor(255, 251, 235); // Amber 50
    doc.setDrawColor(253, 230, 138); // Amber 200
    doc.roundedRect(margin, currentY, contentW, 16, 2, 2, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(180, 83, 9); // Amber 700
    doc.text(`MEDIA ATTACHMENT (VIDEO): ${cleanPdfText(videoFile.name)} (${videoSizeMB} MB)`, margin + 6, currentY + 6);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(146, 64, 14); // Amber 800
    doc.text('Video files cannot be embedded directly in PDF. Please upload the raw file to target platforms.', margin + 6, currentY + 11);
    currentY += 22;
  }

  // ==========================================
  // PLATFORM SUMMARY TABLE
  // ==========================================
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Campaign Overview (${posts.length} Platforms)`, margin, currentY);
  currentY += 5;

  // Table Header
  const colW = { platform: 60, chars: 42, limit: 42, media: 34 };
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.roundedRect(margin, currentY, contentW, 7.5, 1.5, 1.5, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('PLATFORM', margin + 4, currentY + 5);
  doc.text('CHARACTERS', margin + colW.platform + 4, currentY + 5);
  doc.text('LIMIT', margin + colW.platform + colW.chars + 4, currentY + 5);
  doc.text('ASSETS', margin + colW.platform + colW.chars + colW.limit + 4, currentY + 5);

  currentY += 7.5;

  // Table Rows with alternating background
  posts.forEach((post, index) => {
    const platform = PLATFORM_MAP[post.platformId];
    if (!platform) return;

    if (currentY + 7 > pageH - margin - 15) {
      doc.addPage();
      currentY = margin + 12;
    }

    const rowBg = index % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
    doc.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
    doc.rect(margin, currentY, contentW, 7, 'F');
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, currentY + 7, margin + contentW, currentY + 7);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(platform.name, margin + 4, currentY + 4.8);

    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(String(post.content.length), margin + colW.platform + 4, currentY + 4.8);
    doc.text(platform.charLimit ? `${platform.charLimit} chars` : 'No limit', margin + colW.platform + colW.chars + 4, currentY + 4.8);
    doc.text(imageFiles.length > 0 ? `${Math.min(imageFiles.length, platform.maxImages)} img` : '0 img', margin + colW.platform + colW.chars + colW.limit + 4, currentY + 4.8);

    currentY += 7;
  });

  currentY += 10;

  // ==========================================
  // PLATFORM DETAIL POST CARDS
  // ==========================================
  for (const post of posts) {
    const platform = PLATFORM_MAP[post.platformId];
    if (!platform) continue;

    const rgb = hexToRgb(platform.brandColor);
    const safeContent = cleanPdfText(post.content);
    const textLines = doc.splitTextToSize(safeContent, contentW - 12);
    
    // Parse extra fields
    let extraFields: Record<string, string> = {};
    if (post.extraFields) {
      try {
        extraFields = typeof post.extraFields === 'string'
          ? JSON.parse(post.extraFields)
          : post.extraFields;
      } catch {
        /* ignore */
      }
    }

    const extraFieldCount = Object.keys(extraFields).filter(k => extraFields[k]).length;
    const postBodyHeight = (textLines.length * 4.8) + (extraFieldCount * 5) + 26;

    // Check if card fits on current page, otherwise start clean page
    if (currentY + postBodyHeight > pageH - margin - 15) {
      doc.addPage();
      currentY = margin + 12;
    }

    // Platform Header Bar
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.roundedRect(margin, currentY, contentW, 9, 2, 2, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text(platform.name.toUpperCase(), margin + 6, currentY + 6.2);

    // Right-aligned Character count badge
    doc.setFontSize(8.5);
    doc.setFont('Helvetica', 'normal');
    const countBadge = platform.charLimit
      ? `${post.content.length} / ${platform.charLimit} chars`
      : `${post.content.length} chars`;
    doc.text(countBadge, pageW - margin - 6, currentY + 6.2, { align: 'right' });

    currentY += 9;

    // Card Body Box
    const cardTopY = currentY;
    doc.setFillColor(252, 253, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, cardTopY, contentW, postBodyHeight - 9, 2, 2, 'FD');

    let bodyY = cardTopY + 6;

    // Render extra fields if present
    if (extraFieldCount > 0) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      for (const [key, value] of Object.entries(extraFields)) {
        if (value) {
          doc.text(`${cleanPdfText(key)}: `, margin + 6, bodyY);
          const keyWidth = doc.getTextWidth(`${cleanPdfText(key)}: `);
          doc.setFont('Helvetica', 'normal');
          doc.setTextColor(15, 23, 42);
          doc.text(cleanPdfText(String(value)), margin + 6 + keyWidth, bodyY);
          doc.setFont('Helvetica', 'bold');
          doc.setTextColor(71, 85, 105);
          bodyY += 5;
        }
      }
      bodyY += 2;
    }

    // Render post content lines
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59); // Slate 800

    for (const line of textLines) {
      if (bodyY + 4.8 > pageH - margin - 15) {
        doc.addPage();
        bodyY = margin + 12;
      }
      doc.text(line, margin + 6, bodyY);
      bodyY += 4.8;
    }

    bodyY += 4;

    // Clickable direct share link
    const shareUrl = platform.shareUrl(post.content, extraFields);
    if (shareUrl && shareUrl !== 'https://www.threads.net' && !shareUrl.startsWith('javascript:')) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(rgb.r, rgb.g, rgb.b);
      doc.textWithLink(`-> Open in ${platform.name} to Share Directly`, margin + 6, bodyY, { url: shareUrl });
    }

    currentY = cardTopY + postBodyHeight - 9 + 8;

    // Resized Image Attachments for this platform
    if (imageFiles.length > 0 && platform.imageDimensions.length > 0) {
      const imagesToProcess = imageFiles.slice(0, platform.maxImages);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Image Assets for ${platform.name}:`, margin, currentY);
      currentY += 5;

      for (let imgIndex = 0; imgIndex < imagesToProcess.length; imgIndex++) {
        const imgFile = imagesToProcess[imgIndex];
        const imageMimeType = imgFile.type || 'image/jpeg';

        if (imgFile.size > MAX_IMAGE_SIZE_BYTES) {
          const skipMsg = `[WARNING] Image "${cleanPdfText(imgFile.name)}" exceeds 15MB and was skipped to prevent memory crash.`;
          warnings.push(`[${platform.name}] ${skipMsg}`);
          
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(239, 68, 68);
          doc.text(skipMsg, margin, currentY);
          currentY += 5;
          continue;
        }

        for (const dim of platform.imageDimensions) {
          if (operationCount >= MAX_OPERATIONS) {
            resizeCapped = true;
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(239, 68, 68);
            doc.text(`[Resize Capped] ${cleanPdfText(dim.label)} (${dim.width}x${dim.height})`, margin, currentY);
            currentY += 5;
            continue;
          }

          operationCount++;
          onProgress(`Processing image ${imgIndex + 1}/${imagesToProcess.length} for ${platform.name} (${dim.label})...`);

          try {
            const resizedBlob = await resizeImage(
              imgFile,
              dim.width,
              dim.height,
              imageMimeType
            );

            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(resizedBlob);
            });
            const base64 = await base64Promise;

            const imgAspect = dim.width / dim.height;
            let drawW = 55;
            let drawH = drawW / imgAspect;
            if (drawH > 35) {
              drawH = 35;
              drawW = drawH * imgAspect;
            }

            if (currentY + drawH + 8 > pageH - margin - 15) {
              doc.addPage();
              currentY = margin + 12;
            }

            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`${cleanPdfText(dim.label)} (${dim.width}x${dim.height})`, margin, currentY);
            currentY += 2.5;

            doc.addImage(base64, 'JPEG', margin, currentY, drawW, drawH, undefined, 'FAST');
            currentY += drawH + 6;

          } catch (err: any) {
            console.warn(`PDF Image processing error for ${platform.name}:`, err);
            const errMsg = `[WARNING] Failed to resize image for ${cleanPdfText(dim.label)} (${dim.width}x${dim.height}).`;
            warnings.push(`[${platform.name}] ${errMsg} Error: ${err?.message || 'Unknown'}`);

            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(239, 68, 68);
            doc.text(errMsg, margin, currentY);
            currentY += 5;
          }
        }
      }
    }

    currentY += 4;
  }

  if (resizeCapped) {
    warnings.push(`[WARNING] Image resizing was capped at ${MAX_OPERATIONS} operations to prevent browser memory exhaustion. Some platform dimensions were skipped.`);
  }

  // Draw warnings on a separate appendix page if any warnings were logged
  if (warnings.length > 0) {
    doc.addPage();
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(239, 68, 68);
    doc.text('Warnings & Generation Notes:', margin, margin + 12);
    
    let warnY = margin + 20;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(185, 28, 28);
    
    for (const w of warnings) {
      if (warnY + 8 > pageH - margin - 15) {
        doc.addPage();
        warnY = margin + 12;
      }
      const safeW = cleanPdfText(w);
      const wrappedW = doc.splitTextToSize(safeW, contentW);
      for (const ww of wrappedW) {
        doc.text(ww, margin, warnY);
        warnY += 4.5;
      }
      warnY += 2;
    }
  }

  // ==========================================
  // GLOBAL HEADERS & "PAGE X OF Y" FOOTERS
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);

    // Header on pages 2+
    if (pageNum > 1) {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(`PostMaker · Content Kit · ID: ${campaignId.slice(0, 18)}`, margin, margin + 4);
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, margin + 6, margin + contentW, margin + 6);
    }

    // Bottom Footer on all pages
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.line(margin, pageH - 14, margin + contentW, pageH - 14);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text('PostMaker · Social Media Content Kit · bypostamaker.com', margin, pageH - 9);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, pageH - 9, { align: 'right' });
  }

  return doc.output('blob');
}

