// Configure pdf.js worker once for the app (used by extractor + react-pdf).
import { pdfjs } from "react-pdf";
import * as pdfjsLib from "pdfjs-dist";

const workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

export { pdfjs, pdfjsLib };
