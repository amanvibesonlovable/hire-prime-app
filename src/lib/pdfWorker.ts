// Configure pdf.js only after the browser loads it. Importing pdf.js during SSR
// evaluates canvas code that expects DOMMatrix, which is browser-only.
type PdfJsLike = {
  version?: string;
  GlobalWorkerOptions?: { workerSrc?: string };
};

export function configurePdfWorker(pdfjs: PdfJsLike) {
  const version = pdfjs.version ?? "5.7.284";
  const workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  }
  return workerSrc;
}

export async function loadPdfJs() {
  if (typeof window === "undefined") {
    throw new Error("PDF rendering is only available in the browser.");
  }

  const pdfjsLib = await import("pdfjs-dist");
  configurePdfWorker(pdfjsLib as PdfJsLike);
  return pdfjsLib;
}
