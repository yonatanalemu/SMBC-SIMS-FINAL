import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// Renders the given DOM node to canvas, then drops it into an A4 PDF
export async function exportElementToPdf(element, filename) {
  if (document.fonts?.ready) await document.fonts.ready;

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    scrollX: 0,
    scrollY: 0, // Prevents page scroll position from shifting absolute overlays
  });
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}

// Renders the single fitted DOM node (certificates, single-page docs) exactly as generated
export async function exportFittedElementToPdf(element, filename) {
  // 1. Ensure all custom fonts (Newsreader, etc.) are completely loaded before taking snapshot
  if (document.fonts?.ready) await document.fonts.ready;

  // 2. Capture the exact DOM node with fixed 0-scroll offsets and cloned styles
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    scrollX: 0,
    scrollY: 0, // Keeps absolute positioning perfectly aligned with screen view
    onclone: (clonedDoc) => {
      // Pass main window stylesheet rules to html2canvas's internal iframe context
      // so web fonts like Newsreader are rendered instead of fallback Times New Roman
      const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"));
      styles.forEach((style) => {
        clonedDoc.head.appendChild(style.cloneNode(true));
      });
    },
  });

  const imgData = canvas.toDataURL("image/png");

  const aspect = canvas.width / canvas.height;
  const isLandscape = aspect >= 1;
  const longEdgeMM = 297;
  const pageWidth = isLandscape ? longEdgeMM : longEdgeMM * aspect;
  const pageHeight = isLandscape ? longEdgeMM / aspect : longEdgeMM;

  const pdf = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: [pageWidth, pageHeight],
  });

  pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);
  pdf.save(filename);
}