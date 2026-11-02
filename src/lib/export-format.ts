// Builds export files from plain rows. No framework here, so tests can run it directly.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportTable = { title: string; columns: string[]; rows: string[][]; total: number; truncated: boolean };
export type PdfHeader = { organization: string; title: string; note: string; showDate: boolean; landscape: boolean; logo?: { dataUrl: string; width: number; height: number } | null };

/** A spreadsheet runs a cell starting with these as a formula, so they're made plain text. */
const quoteCell = (value: string) => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The leading mark tells Excel it's UTF-8, so accented names survive. */
export const toCsv = ({ columns, rows }: Pick<ExportTable, "columns" | "rows">) =>
  `﻿${[columns, ...rows].map((row) => row.map(quoteCell).join(",")).join("\r\n")}\r\n`;

export const exportFileName = (title: string, extension: string, now = new Date()) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "export"}-${now.toLocaleDateString("en-CA")}.${extension}`;

// The built-in PDF fonts cover Western characters only.
const pdfText = (text: string) => text.replace(/[–—]/g, "-").replace(/[^\x20-\x7E -ÿ]/g, "?");

const MARGIN = 14;
const LOGO_HEIGHT = 16;

/** Returns the PDF. The custom header repeats on every page. */
export function buildPdf(table: ExportTable, header: PdfHeader, now = new Date()) {
  const doc = new jsPDF({ orientation: header.landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const logoWidth = header.logo ? Math.min((header.logo.width / header.logo.height) * LOGO_HEIGHT, 40) : 0;
  const textLeft = MARGIN + (logoWidth ? logoWidth + 4 : 0);
  const textWidth = pageWidth - textLeft - MARGIN;

  const titleLines: string[] = doc.setFont("helvetica", "bold").setFontSize(15).splitTextToSize(pdfText(header.title), textWidth);
  const noteLines: string[] = header.note ? doc.setFont("helvetica", "normal").setFontSize(9).splitTextToSize(pdfText(header.note), textWidth) : [];
  const details = [header.showDate ? `Generated ${now.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : "", `${table.rows.length.toLocaleString()} rows${table.truncated ? ` of ${table.total.toLocaleString()}` : ""}`].filter(Boolean).join("  |  ");
  const headerBottom = Math.max(MARGIN + LOGO_HEIGHT, MARGIN + (header.organization ? 8 : 2) + titleLines.length * 6 + noteLines.length * 4 + 4) + 3;

  const drawHeader = () => {
    if (header.logo) doc.addImage(header.logo.dataUrl, "PNG", MARGIN, MARGIN - 2, logoWidth, LOGO_HEIGHT);
    let y = MARGIN + 2;
    if (header.organization) {
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90).text(pdfText(header.organization), textLeft, y, { maxWidth: textWidth });
      y += 6;
    }
    doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(20).text(titleLines, textLeft, y);
    y += titleLines.length * 6 - 1;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90);
    if (noteLines.length) {
      doc.text(noteLines, textLeft, y);
      y += noteLines.length * 4;
    }
    doc.text(pdfText(details), textLeft, y);
    doc.setDrawColor(200).setLineWidth(0.3).line(MARGIN, headerBottom - 2, pageWidth - MARGIN, headerBottom - 2);
  };

  autoTable(doc, {
    head: [table.columns.map(pdfText)],
    body: table.rows.map((row) => row.map(pdfText)),
    margin: { top: headerBottom + 1, left: MARGIN, right: MARGIN, bottom: 14 },
    styles: { fontSize: 8, cellPadding: 1.8, overflow: "linebreak" },
    headStyles: { fillColor: [38, 76, 140], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didDrawPage: drawHeader,
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120).text(`Page ${page} of ${pages}`, pageWidth - MARGIN, pageHeight - 7, { align: "right" });
  }
  return doc;
}
