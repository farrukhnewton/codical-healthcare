export type BurnOcrProgress = { fileName: string; status: string; progress: number };
export type BurnOcrPageImage = { pageNumber: number; blob: Blob };
export type BurnOcrResult = { text: string; pageCount: number; confidence: number | null; pageImages: BurnOcrPageImage[]; warnings: string[] };

const MAX_PAGES = 60;
const MAX_VISION_PAGES = 12;

function clean(value: string) { return value.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim(); }
function isPdf(file: File) { return file.type === "application/pdf" || /\.pdf$/i.test(file.name); }
function isImage(file: File) { return /^image\/(?:png|jpeg)$/.test(file.type) || /\.(?:png|jpe?g)$/i.test(file.name); }
function toJpeg(canvas: HTMLCanvasElement) { return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not prepare a page image.")), "image/jpeg", .88)); }

export async function scanBurnDocument(file: File, onProgress?: (progress: BurnOcrProgress) => void): Promise<BurnOcrResult> {
  if (!isPdf(file) && !isImage(file)) return { text: "", pageCount: 0, confidence: null, pageImages: [], warnings: [] };
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { logger: (message) => onProgress?.({ fileName: file.name, status: message.status || "Reading handwriting", progress: Number(message.progress) || 0 }) });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: "1" });
  try {
    if (isImage(file)) {
      const result = await worker.recognize(file);
      return { text: clean(result.data.text), pageCount: 1, confidence: result.data.confidence, pageImages: [{ pageNumber: 1, blob: file }], warnings: result.data.confidence < 75 ? ["Low OCR confidence; review the source image and visual-model findings."] : [] };
    }
    const pdfjs = await import("pdfjs-dist");
    const { default: pdfWorkerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pageCount = Math.min(pdf.numPages, MAX_PAGES);
    const pageRows: Array<{ pageNumber: number; text: string; confidence: number; image: Blob; priority: number }> = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      onProgress?.({ fileName: file.name, status: `Scanning page ${pageNumber} of ${pageCount}`, progress: (pageNumber - 1) / pageCount });
      const page = await pdf.getPage(pageNumber);
      const native = await page.getTextContent();
      const nativeText = clean(native.items.map((item) => "str" in item ? item.str : "").join(" "));
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(3.6, 3600 / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const canvas = window.document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("This browser could not prepare the PDF for OCR.");
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;
      const ocr = await worker.recognize(canvas);
      const pageText = clean(`${nativeText}\n${ocr.data.text}`);
      const priority = (/\b(?:burn|tbsa|graft|wound|debrid|eschar|diagnos|procedure|operative|cm2|cm²)\b/i.test(pageText) ? 4 : 0) + (nativeText.length < 80 ? 3 : 0) + (ocr.data.confidence < 78 ? 2 : 0);
      pageRows.push({ pageNumber, text: pageText, confidence: ocr.data.confidence, image: await toJpeg(canvas), priority });
      page.cleanup();
    }
    const selected = [...pageRows].sort((a, b) => b.priority - a.priority || a.pageNumber - b.pageNumber).slice(0, MAX_VISION_PAGES).sort((a, b) => a.pageNumber - b.pageNumber);
    const average = pageRows.length ? pageRows.reduce((sum, row) => sum + row.confidence, 0) / pageRows.length : null;
    const warnings: string[] = [];
    if (pdf.numPages > MAX_PAGES) warnings.push(`Scanned the first ${MAX_PAGES} pages; split the document to review the remainder.`);
    if (average !== null && average < 75) warnings.push("Low OCR confidence; enhanced page images were sent for handwriting-aware visual review.");
    if (pageRows.length > MAX_VISION_PAGES) warnings.push(`${MAX_VISION_PAGES} high-priority pages received enhanced visual review; verify remaining handwritten pages manually.`);
    onProgress?.({ fileName: file.name, status: "OCR complete", progress: 1 });
    return { text: pageRows.map((row) => `--- Page ${row.pageNumber} ---\n${row.text}`).join("\n\n"), pageCount, confidence: average, pageImages: selected.map((row) => ({ pageNumber: row.pageNumber, blob: row.image })), warnings };
  } finally { await worker.terminate(); }
}
