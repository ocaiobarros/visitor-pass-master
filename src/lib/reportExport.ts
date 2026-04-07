import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatLocalDateTime } from '@/lib/dateUtils';

/* ══════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════ */

export interface ExportColumn {
  key: string;
  label: string;
}

export interface SummaryItem {
  label: string;
  value: string | number;
}

export interface PDFReportOptions {
  title: string;
  subtitle?: string;
  filename: string;
  columns: ExportColumn[];
  data: any[];
  filters?: string;
  summary?: SummaryItem[];
  generatedBy?: string;
  /** Report-specific accent color [R, G, B] */
  accentColor?: [number, number, number];
  /** Additional sections after main table */
  extraSections?: { title: string; data: any[]; columns: ExportColumn[] }[];
}

/* ══════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════ */

const SYSTEM_NAME = 'GUARDA OPERACIONAL';
const BRAND_BLUE: [number, number, number] = [30, 58, 138];
const BRAND_DARK: [number, number, number] = [15, 23, 42];
const LIGHT_BG: [number, number, number] = [245, 247, 250];
const MUTED_TEXT: [number, number, number] = [100, 116, 139];

/* ══════════════════════════════════════════════
   CSV / Excel (unchanged)
   ══════════════════════════════════════════════ */

export const exportCSV = (data: any[], columns: ExportColumn[], filename: string) => {
  const headers = columns.map(c => c.label).join(';');
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(';')
  );
  const csv = '\ufeff' + [headers, ...rows].join('\n');
  downloadBlob(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
};

export const exportExcel = (data: any[], columns: ExportColumn[], filename: string, sheetName = 'Relatório') => {
  const rows = data.map(row => {
    const obj: Record<string, any> = {};
    columns.forEach(c => { obj[c.label] = row[c.key] ?? ''; });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = columns.map(c => ({
    wch: Math.min(Math.max(c.label.length, ...data.slice(0, 50).map(r => String(r[c.key] ?? '').length)) + 2, 40)
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

/* ══════════════════════════════════════════════
   Legacy exportPDF (backwards compat)
   ══════════════════════════════════════════════ */

export const exportPDF = (data: any[], columns: ExportColumn[], title: string, filename: string, filters?: string) => {
  exportProfessionalPDF({
    title,
    filename,
    columns,
    data,
    filters,
  });
};

/* ══════════════════════════════════════════════
   Professional PDF Export Engine
   ══════════════════════════════════════════════ */

export const exportProfessionalPDF = (opts: PDFReportOptions) => {
  const {
    title, subtitle, filename, columns, data, filters,
    summary, generatedBy, accentColor = BRAND_BLUE, extraSections,
  } = opts;

  const isLandscape = columns.length > 6;
  const doc = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait' });
  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;
  const margin = 14;
  const now = formatLocalDateTime(new Date());

  let cursorY = 0;

  /* ─── Header band ─── */
  cursorY = drawHeader(doc, pageW, title, subtitle, now, filters, generatedBy, accentColor);

  /* ─── Summary cards ─── */
  if (summary && summary.length > 0) {
    cursorY = drawSummaryBlock(doc, cursorY, pageW, margin, summary, accentColor);
  }

  /* ─── Main table ─── */
  cursorY = drawTable(doc, cursorY, margin, columns, data, accentColor);

  /* ─── Extra sections ─── */
  if (extraSections) {
    for (const section of extraSections) {
      // Add section title
      cursorY += 6;
      if (cursorY > pageH - 40) {
        doc.addPage();
        cursorY = 20;
      }
      doc.setFontSize(11);
      doc.setTextColor(...BRAND_DARK);
      doc.setFont('helvetica', 'bold');
      doc.text(section.title, margin, cursorY);
      cursorY += 4;
      cursorY = drawTable(doc, cursorY, margin, section.columns, section.data, accentColor);
    }
  }

  /* ─── Footer on all pages ─── */
  drawFooter(doc, pageW, pageH);

  doc.save(`${filename}.pdf`);
};

/* ══════════════════════════════════════════════
   Internal drawing helpers
   ══════════════════════════════════════════════ */

function drawHeader(
  doc: jsPDF, pageW: number, title: string, subtitle: string | undefined,
  dateStr: string, filters: string | undefined, generatedBy: string | undefined,
  accent: [number, number, number],
): number {
  // Top color band
  doc.setFillColor(...accent);
  doc.rect(0, 0, pageW, 28, 'F');

  // System name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(SYSTEM_NAME, 14, 8);

  // Report title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 18);

  // Subtitle if any
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 14, 24);
  }

  // Meta block below band
  let metaY = 34;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_TEXT);
  doc.setFont('helvetica', 'normal');

  const metaLines: string[] = [];
  metaLines.push(`Gerado em: ${dateStr}`);
  if (generatedBy) metaLines.push(`Usuário: ${generatedBy}`);
  if (filters) metaLines.push(`Filtros: ${filters}`);
  // total is added by caller via filters or summary

  metaLines.forEach(line => {
    doc.text(line, 14, metaY);
    metaY += 4;
  });

  // Separator line
  metaY += 2;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(14, metaY, pageW - 14, metaY);
  metaY += 4;

  return metaY;
}

function drawSummaryBlock(
  doc: jsPDF, startY: number, pageW: number, margin: number,
  items: SummaryItem[], accent: [number, number, number],
): number {
  const usableW = pageW - margin * 2;
  const cols = Math.min(items.length, 5);
  const cardW = usableW / cols;
  const cardH = 18;
  const gap = 3;

  // Background for summary area
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(margin, startY, usableW, cardH + 4, 2, 2, 'F');

  items.slice(0, 10).forEach((item, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = margin + col * cardW + gap;
    const y = startY + 2 + row * (cardH + 4);

    // Value
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...accent);
    doc.text(String(item.value ?? 0), x + 4, y + 8);

    // Label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED_TEXT);
    doc.text(item.label, x + 4, y + 14);
  });

  const rows = Math.ceil(items.length / cols);
  return startY + rows * (cardH + 4) + 4;
}

function drawTable(
  doc: jsPDF, startY: number, margin: number,
  columns: ExportColumn[], data: any[], accent: [number, number, number],
): number {
  if (!data.length) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED_TEXT);
    doc.text('Nenhum registro encontrado.', margin, startY + 6);
    return startY + 12;
  }

  autoTable(doc, {
    startY,
    head: [columns.map(c => c.label)],
    body: data.map(row => columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '-';
      return String(val);
    })),
    styles: {
      fontSize: 7,
      cellPadding: 2.5,
      lineColor: [230, 230, 230],
      lineWidth: 0.2,
      textColor: [30, 30, 30],
    },
    headStyles: {
      fillColor: accent,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [250, 251, 252],
    },
    margin: { left: margin, right: margin },
    tableLineColor: [230, 230, 230],
    tableLineWidth: 0.2,
    didParseCell: (hookData) => {
      // Highlight critical status cells
      const text = String(hookData.cell.raw || '');
      if (hookData.section === 'body') {
        if (['Dentro', 'Negado', 'Bloqueado', 'Suspenso'].includes(text)) {
          hookData.cell.styles.textColor = [220, 38, 38];
          hookData.cell.styles.fontStyle = 'bold';
        } else if (['Finalizado', 'Ativo', 'Concluída'].includes(text)) {
          hookData.cell.styles.textColor = [22, 163, 74];
        }
      }
    },
  });

  return (doc as any).lastAutoTable?.finalY || startY + 20;
}

function drawFooter(doc: jsPDF, pageW: number, pageH: number) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer separator
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(14, pageH - 16, pageW - 14, pageH - 16);

    doc.setFontSize(7);
    doc.setTextColor(...MUTED_TEXT);
    doc.setFont('helvetica', 'normal');

    // Left: system name + date
    doc.text(`${SYSTEM_NAME} — ${formatLocalDateTime(new Date())}`, 14, pageH - 10);

    // Center: confidential
    const confText = 'Documento de uso interno';
    const confW = doc.getTextWidth(confText);
    doc.text(confText, (pageW - confW) / 2, pageH - 10);

    // Right: page X of Y
    const pageText = `Página ${i} de ${pageCount}`;
    const ptW = doc.getTextWidth(pageText);
    doc.text(pageText, pageW - 14 - ptW, pageH - 10);
  }
}

/* ══════════════════════════════════════════════
   Blob download helper
   ══════════════════════════════════════════════ */

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
