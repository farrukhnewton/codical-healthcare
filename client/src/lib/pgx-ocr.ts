import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

const MAX_OCR_PDF_PAGES = 250;

export type PgxOcrProgress = {
  fileName: string;
  status: string;
  progress: number;
};

export type PgxOcrResult = {
  text: string;
  pageCount: number;
  confidence: number | null;
  warnings: string[];
  diagnosisPageImages: Array<{ pageNumber: number; blob: Blob }>;
};

export type PgxOcrOptions = {
  preferNativeText?: boolean;
  handwritingMode?: boolean;
};

function isImage(file: File) {
  return file.type === "image/png" || file.type === "image/jpeg" || /\.(png|jpe?g)$/i.test(file.name);
}

function isPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function cleanOcrText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality = .88) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Could not prepare the diagnosis page image.")),
    "image/jpeg",
    quality,
  ));
}

export function fileNeedsBrowserOcr(file: File) {
  return isImage(file) || isPdf(file);
}

export async function scanPgxDocument(
  file: File,
  onProgress?: (progress: PgxOcrProgress) => void,
  options: PgxOcrOptions = {},
): Promise<PgxOcrResult> {
  if (!fileNeedsBrowserOcr(file)) {
    return { text: "", pageCount: 0, confidence: null, warnings: [], diagnosisPageImages: [] };
  }

  const { createWorker, PSM } = await import("tesseract.js");
  let currentPage = 1;
  let pageTotal = 1;
  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      const pageProgress = Number.isFinite(message.progress) ? message.progress : 0;
      const overall = Math.min(1, ((currentPage - 1) + pageProgress) / pageTotal);
      onProgress?.({
        fileName: file.name,
        status: message.status || "Reading document",
        progress: overall,
      });
    },
  });
  await worker.setParameters({
    tessedit_pageseg_mode: options.handwritingMode ? PSM.SPARSE_TEXT : PSM.AUTO,
    preserve_interword_spaces: "1",
  });

  try {
    if (isImage(file)) {
      const result = await worker.recognize(file);
      onProgress?.({ fileName: file.name, status: "OCR complete", progress: 1 });
      return {
        text: cleanOcrText(result.data.text),
        pageCount: 1,
        confidence: result.data.confidence,
        diagnosisPageImages: options.handwritingMode ? [{ pageNumber: 1, blob: file }] : [],
        warnings: result.data.confidence < 75
          ? ["OCR confidence is low. Verify handwritten diagnoses and medications against the source image."]
          : [],
      };
    }

    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdfDocument = await pdfjs.getDocument({ data: bytes }).promise;
    pageTotal = Math.min(pdfDocument.numPages, MAX_OCR_PDF_PAGES);
    const text: string[] = [];
    const confidence: number[] = [];
    const diagnosisPageImages: Array<{ pageNumber: number; blob: Blob }> = [];

    for (currentPage = 1; currentPage <= pageTotal; currentPage += 1) {
      onProgress?.({
        fileName: file.name,
        status: `Preparing page ${currentPage} of ${pageTotal}`,
        progress: (currentPage - 1) / pageTotal,
      });
      const page = await pdfDocument.getPage(currentPage);
      const nativeContent = await page.getTextContent();
      const nativeText = cleanOcrText(nativeContent.items
        .map((item) => "str" in item ? item.str : "")
        .join(" "));
      if (options.preferNativeText && nativeText.length >= 100) {
        text.push(`--- Page ${currentPage} (native text) ---\n${nativeText}`);
        confidence.push(100);
        page.cleanup();
        continue;
      }

      const viewport = page.getViewport({ scale: options.handwritingMode ? 2.75 : 2.25 });
      const canvas = window.document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("This browser could not prepare the PDF page for OCR.");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;
      if (options.handwritingMode) {
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        for (let index = 0; index < image.data.length; index += 4) {
          const gray = image.data[index] * .299 + image.data[index + 1] * .587 + image.data[index + 2] * .114;
          const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.22 + 128));
          image.data[index] = contrasted;
          image.data[index + 1] = contrasted;
          image.data[index + 2] = contrasted;
        }
        context.putImageData(image, 0, 0);
      }
      const result = await worker.recognize(canvas);
      text.push(`--- Page ${currentPage} ---\n${result.data.text}`);
      confidence.push(result.data.confidence);
      const pageEvidence = `${nativeText}\n${result.data.text}`;
      const isDiagnosisChoicePage = options.handwritingMode
        && (/\bgroup\s*(?:\d{1,2}(?:\s*,\s*\d{1,2})*)\b/i.test(pageEvidence)
          || /\b(?:other\s+dx|diagnos(?:is|es)|icd[- ]?10)\b/i.test(pageEvidence));
      if (isDiagnosisChoicePage && diagnosisPageImages.length < 12) {
        // Send a page-isolated image to the visual model. Whole-document PDF vision
        // can downscale a dense page enough to miss a small handwritten/circled code.
        const baseViewport = page.getViewport({ scale: 1 });
        const enhancedScale = Math.min(4, 4096 / Math.max(baseViewport.width, baseViewport.height));
        const enhancedViewport = page.getViewport({ scale: enhancedScale });
        const enhancedCanvas = window.document.createElement("canvas");
        const enhancedContext = enhancedCanvas.getContext("2d", { alpha: false });
        if (!enhancedContext) throw new Error("This browser could not prepare enhanced diagnosis-page OCR.");
        enhancedCanvas.width = Math.ceil(enhancedViewport.width);
        enhancedCanvas.height = Math.ceil(enhancedViewport.height);
        await page.render({ canvasContext: enhancedContext, viewport: enhancedViewport }).promise;
        diagnosisPageImages.push({ pageNumber: currentPage, blob: await canvasToJpeg(enhancedCanvas) });
      }
      page.cleanup();
    }

    const averageConfidence = confidence.length
      ? confidence.reduce((total, value) => total + value, 0) / confidence.length
      : null;
    const warnings: string[] = [];
    if (pdfDocument.numPages > MAX_OCR_PDF_PAGES) {
      warnings.push(`OCR scanned the first ${MAX_OCR_PDF_PAGES} pages. Split this unusually long PDF to scan the remaining pages.`);
    }
    if (averageConfidence !== null && averageConfidence < 75) {
      warnings.push("OCR confidence is low. Verify handwritten diagnoses and medications against the source document.");
    }
    onProgress?.({ fileName: file.name, status: "OCR complete", progress: 1 });
    if (options.handwritingMode && diagnosisPageImages.length === 0) {
      warnings.push("No diagnosis-choice page was isolated for enhanced handwriting review; verify marked diagnoses manually.");
    }
    return { text: cleanOcrText(text.join("\n\n")), pageCount: pageTotal, confidence: averageConfidence, warnings, diagnosisPageImages };
  } finally {
    await worker.terminate();
  }
}
