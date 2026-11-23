import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PdfTextPage } from "@/lib/yanmarStatement";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** PDF 글자층을 쪽별로 (x, 위에서부터 y, 글자) 목록으로 꺼낸다. 처음 몇 쪽만 읽어도 충분하다. */
export async function readPdfText(file: Blob, maxPages = 10): Promise<PdfTextPage[]> {
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer(), verbosity: 0 }).promise;
  const pages: PdfTextPage[] = [];
  for (let p = 1; p <= Math.min(pdf.numPages, maxPages); p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    pages.push({
      width: vp.width,
      height: vp.height,
      items: tc.items
        .filter((it): it is typeof it & { str: string; transform: number[] } => "str" in it && !!(it as any).str?.trim())
        .map((it) => ({ x: it.transform[4], y: vp.height - it.transform[5], str: it.str })),
    });
  }
  await pdf.destroy();
  return pages;
}
