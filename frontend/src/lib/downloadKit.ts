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
  const margin = 20;
  const contentW = pageW - (margin * 2); // 170mm

  // Track warnings
  const warnings: string[] = [];
  let operationCount = 0;
  const MAX_OPERATIONS = 60; // Same as ZIP

  // Helper to draw text with word wrapping and auto-paging
  const drawWrappedText = (
    text: string,
    startX: number,
    startY: number,
    maxWidth: number,
    lineHeight: number,
    textColor = [51, 65, 85] // Slate 700 default
  ): number => {
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    const lines = doc.splitTextToSize(text, maxWidth);
    let currentY = startY;

    for (const line of lines) {
      if (currentY + lineHeight > pageH - margin) {
        doc.addPage();
        currentY = margin;
      }
      doc.text(line, startX, currentY);
      currentY += lineHeight;
    }
    return currentY;
  };

  // Helper to convert hex brandColor to RGB
  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 124, g: 58, b: 237 }; // default violet
  };

  // ==========================================
  // PAGE 1: COVER PAGE
  // ==========================================
  
  // Title Accent Band (Violet brand color)
  doc.setFillColor(124, 58, 237); // #7c3aed
  doc.rect(margin, 20, contentW, 4, 'F');

  // Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text('PostMaker', margin, 35);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(71, 85, 105); // Slate 600
  doc.text('Social Media Content Kit', margin, 42);

  // Metadata Block
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.line(margin, 48, margin + contentW, 48);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text(`Campaign ID: ${campaignId}`, margin, 55);
  doc.text(`Date Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin, 60);

  doc.line(margin, 65, margin + contentW, 65);

  // Prompt Section
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Campaign Prompt:', margin, 73);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10.5);
  let promptY = drawWrappedText(prompt, margin, 79, contentW, 5.5, [71, 85, 105]);

  // Video Section (if exists)
  if (videoFile) {
    const videoSizeMB = (videoFile.size / (1024 * 1024)).toFixed(1);
    promptY += 8;
    if (promptY > pageH - 50) {
      doc.addPage();
      promptY = margin;
    }
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Media Assets (Video):', margin, promptY);
    promptY += 6;

    doc.setDrawColor(254, 243, 199); // Amber 100
    doc.setFillColor(255, 251, 235); // Amber 50
    doc.rect(margin, promptY, contentW, 20, 'F');
    doc.rect(margin, promptY, contentW, 20, 'S');

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(180, 83, 9); // Amber 700
    doc.text(`• Filename: ${videoFile.name} (${videoSizeMB} MB)`, margin + 5, promptY + 6);
    doc.text('• Note: Video files cannot be embedded inside PDF documents.', margin + 5, promptY + 11);
    doc.text('  Please upload the video file directly to your target platforms.', margin + 5, promptY + 16);
    promptY += 24;
  }

  // Platform Summary Table
  promptY += 8;
  if (promptY > pageH - 60) {
    doc.addPage();
    promptY = margin;
  }

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Generated Platforms:', margin, promptY);
  promptY += 6;

  // Table Header
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.rect(margin, promptY, contentW, 8, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, promptY, margin + contentW, promptY);
  doc.line(margin, promptY + 8, margin + contentW, promptY + 8);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Platform', margin + 4, promptY + 5.5);
  doc.text('Char Count', margin + 65, promptY + 5.5);
  doc.text('Limit', margin + 115, promptY + 5.5);
  doc.text('Images', margin + 150, promptY + 5.5);

  promptY += 8;
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  for (const post of posts) {
    const platform = PLATFORM_MAP[post.platformId];
    if (!platform) continue;

    if (promptY + 8 > pageH - margin) {
      doc.addPage();
      promptY = margin;
      // Redraw Table Header on new page
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, promptY, contentW, 8, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.text('Platform', margin + 4, promptY + 5.5);
      doc.text('Char Count', margin + 65, promptY + 5.5);
      doc.text('Limit', margin + 115, promptY + 5.5);
      doc.text('Images', margin + 150, promptY + 5.5);
      promptY += 8;
      doc.setFont('Helvetica', 'normal');
    }

    const name = platform.name;
    const charCount = post.content.length;
    const limit = platform.charLimit ? String(platform.charLimit) : 'No limit';
    const numImages = imageFiles.length > 0 ? String(Math.min(imageFiles.length, platform.maxImages)) : '0';

    doc.text(name, margin + 4, promptY + 5.5);
    doc.text(String(charCount), margin + 65, promptY + 5.5);
    doc.text(limit, margin + 115, promptY + 5.5);
    doc.text(numImages, margin + 150, promptY + 5.5);

    doc.line(margin, promptY + 8, margin + contentW, promptY + 8);
    promptY += 8;
  }

  // Footer on cover
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('Generated by PostMaker • bypostamaker.com', margin, pageH - 12);

  // ==========================================
  // PAGES 2+: PLATFORM SECTIONS
  // ==========================================
  for (const post of posts) {
    const platform = PLATFORM_MAP[post.platformId];
    if (!platform) continue;

    doc.addPage();
    let y = 20;

    // Platform Header Bar (in Platform's brand color)
    const rgb = hexToRgb(platform.brandColor);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.rect(margin, y, contentW, 12, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(255, 255, 255); // White
    doc.text(platform.name.toUpperCase(), margin + 4, y + 7.5);

    y += 18;

    // Extra fields warning/info (e.g. Subreddit)
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

    if (extraFields && Object.keys(extraFields).length > 0) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      for (const [key, value] of Object.entries(extraFields)) {
        if (value) {
          doc.text(`${key}: ${value}`, margin, y);
          y += 5;
        }
      }
      y += 3;
    }

    // Post Text Content
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 41, 59); // Slate 800

    // Split text by lines to preserve breaks
    const textLines = post.content.split('\n');
    for (const rawLine of textLines) {
      // splitTextToSize wraps long lines
      const wrapped = doc.splitTextToSize(rawLine || ' ', contentW);
      for (const wl of wrapped) {
        if (y + 5.5 > pageH - margin - 15) { // Leave room for footer/images
          doc.addPage();
          y = margin;
        }
        doc.text(wl, margin, y);
        y += 5.5;
      }
    }

    y += 6;

    // Platform limits info
    const charCount = post.content.length;
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    if (platform.charLimit) {
      doc.text(`Character Count: ${charCount} / ${platform.charLimit}`, margin, y);
    } else {
      doc.text(`Character Count: ${charCount}`, margin, y);
    }
    y += 5;

    // Clickable Share URL
    const shareUrl = platform.shareUrl(post.content, extraFields);
    if (shareUrl && shareUrl !== 'https://www.threads.net' && !shareUrl.startsWith('javascript:')) {
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(rgb.r, rgb.g, rgb.b); // Accent color
      doc.textWithLink('🔗 Click here to share directly', margin, y, { url: shareUrl });
      y += 8;
    } else {
      y += 4;
    }

    // Horizontal divider
    doc.setDrawColor(241, 245, 249); // Slate 100
    doc.line(margin, y, margin + contentW, y);
    y += 8;

    // Process platform-specific images
    if (imageFiles.length > 0 && platform.imageDimensions.length > 0) {
      const imagesToProcess = imageFiles.slice(0, platform.maxImages);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text('Resized Image Attachments:', margin, y);
      y += 6;

      for (let imgIndex = 0; imgIndex < imagesToProcess.length; imgIndex++) {
        const imgFile = imagesToProcess[imgIndex];
        const imageMimeType = imgFile.type || 'image/jpeg';

        // Check if file is too large
        if (imgFile.size > MAX_IMAGE_SIZE_BYTES) {
          const skipMsg = `⚠️ Image "${imgFile.name}" exceeds 15MB and was skipped to prevent memory crash.`;
          warnings.push(`[${platform.name}] ${skipMsg}`);
          
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(239, 68, 68); // Red 500
          doc.text(skipMsg, margin, y);
          y += 5;
          continue;
        }

        for (const dim of platform.imageDimensions) {
          // Check operation cap
          if (operationCount >= MAX_OPERATIONS) {
            const capMsg = `⚠️ Image resizing capped at ${MAX_OPERATIONS} operations to prevent memory exhaust. Skipping ${dim.label} ${dim.width}x${dim.height}.`;
            if (!warnings.includes(capMsg)) warnings.push(capMsg);

            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(239, 68, 68);
            doc.text(`⚠️ Resize Capped: ${dim.label} (${dim.width}x${dim.height})`, margin, y);
            y += 5;
            continue;
          }

          operationCount++;
          onProgress(`Processing image ${imgIndex + 1}/${imagesToProcess.length} for ${platform.name} (${dim.label})...`);

          try {
            // Resize image client-side via canvas
            const resizedBlob = await resizeImage(
              imgFile,
              dim.width,
              dim.height,
              imageMimeType
            );

            // Convert resized Blob to Base64
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(resizedBlob);
            });
            const base64 = await base64Promise;

            // Draw image on PDF. Ensure it fits page boundaries
            const imgAspect = dim.width / dim.height;
            let drawW = 55;
            let drawH = drawW / imgAspect;
            if (drawH > 35) {
              drawH = 35;
              drawW = drawH * imgAspect;
            }

            if (y + drawH > pageH - margin) {
              doc.addPage();
              y = margin + 5;
            }

            // Draw small label
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);
            doc.text(`${dim.label} (${dim.width}x${dim.height})`, margin, y);
            y += 2.5;

            // Add image with 0.8 JPEG quality compression (jspdf uses 'FAST' compression + jpeg type)
            doc.addImage(base64, 'JPEG', margin, y, drawW, drawH, undefined, 'FAST');
            y += drawH + 6;

          } catch (err: any) {
            console.warn(`PDF Image processing error for ${platform.name}:`, err);
            const errMsg = `⚠️ Failed to resize image for ${dim.label} (${dim.width}x${dim.height}).`;
            warnings.push(`[${platform.name}] ${errMsg} Error: ${err?.message || 'Unknown'}`);

            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(239, 68, 68);
            doc.text(errMsg, margin, y);
            y += 5;
          }
        }
      }
    }

    // Platform Page Footer
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`PostMaker • ${platform.name} Kit`, margin, pageH - 12);
  }

  // Draw warnings on a separate appendix page if any warnings were found
  if (warnings.length > 0) {
    doc.addPage();
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('Warnings & Generation Notes:', margin, 20);
    
    let warnY = 28;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(239, 68, 68);
    
    for (const w of warnings) {
      if (warnY + 8 > pageH - margin) {
        doc.addPage();
        warnY = margin;
      }
      const wrappedW = doc.splitTextToSize(w, contentW);
      for (const ww of wrappedW) {
        doc.text(ww, margin, warnY);
        warnY += 5;
      }
      warnY += 2;
    }
  }

  return doc.output('blob');
}
