import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import * as mammoth from "mammoth/mammoth.browser";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Runs fully in the browser: the resume never leaves the user's device.
export async function readResume(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
    }
    return pages.join("\n");
  }

  if (name.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
    return value;
  }

  throw new Error("Unsupported file. Upload a PDF or DOCX.");
}
