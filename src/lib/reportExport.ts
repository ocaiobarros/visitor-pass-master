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
  accentColor?: [number, number, number];
  extraSections?: { title: string; data: any[]; columns: ExportColumn[] }[];
}

/* ══════════════════════════════════════════════
   Corporate Green Palette
   ══════════════════════════════════════════════ */

const SYSTEM_NAME = 'GUARDA OPERACIONAL';
const BRAND_GREEN: [number, number, number] = [22, 101, 52];   // #166534
const ACCENT_GREEN: [number, number, number] = [34, 197, 94];  // #22c55e
const BRAND_DARK: [number, number, number] = [31, 41, 55];     // #1f2937
const LIGHT_BG: [number, number, number] = [243, 244, 246];    // #f3f4f6
const MUTED_TEXT: [number, number, number] = [107, 114, 128];  // #6b7280
const CARD_BORDER: [number, number, number] = [229, 231, 235]; // #e5e7eb
const ALT_ROW: [number, number, number] = [249, 250, 251];     // #f9fafb
const RED: [number, number, number] = [220, 38, 38];           // #dc2626
const GREEN_TEXT: [number, number, number] = [22, 163, 74];    // #16a34a

/* ══════════════════════════════════════════════
   CSV / Excel
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
   Legacy wrapper
   ══════════════════════════════════════════════ */

export const exportPDF = (data: any[], columns: ExportColumn[], title: string, filename: string, filters?: string) => {
  exportProfessionalPDF({ title, filename, columns, data, filters });
};

/* ══════════════════════════════════════════════
   Professional PDF Export Engine
   ══════════════════════════════════════════════ */

export const exportProfessionalPDF = (opts: PDFReportOptions) => {
  const {
    title, subtitle, filename, columns, data, filters,
    summary, generatedBy, accentColor = BRAND_GREEN, extraSections,
  } = opts;

  const isLandscape = columns.length > 6;
  const doc = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait' });
  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;
  const margin = 14;
  const now = formatLocalDateTime(new Date());

  let cursorY = 0;

  /* ─── Header ─── */
  cursorY = drawHeader(doc, pageW, title, subtitle, now, filters, generatedBy, accentColor);

  /* ─── Summary cards ─── */
  if (summary && summary.length > 0) {
    cursorY = drawSummaryCards(doc, cursorY, pageW, margin, summary, accentColor);
  }

  /* ─── Main table ─── */
  cursorY = drawTable(doc, cursorY, margin, columns, data, accentColor);

  /* ─── Extra sections ─── */
  if (extraSections) {
    for (const section of extraSections) {
      cursorY += 6;
      if (cursorY > pageH - 40) { doc.addPage(); cursorY = 20; }
      doc.setFontSize(11);
      doc.setTextColor(...BRAND_DARK);
      doc.setFont('helvetica', 'bold');
      doc.text(section.title, margin, cursorY);
      cursorY += 4;
      cursorY = drawTable(doc, cursorY, margin, section.columns, section.data, accentColor);
    }
  }

  /* ─── Footer ─── */
  drawFooter(doc, pageW, pageH);
  doc.save(`${filename}.pdf`);
};

/* ══════════════════════════════════════════════
   Drawing helpers
   ══════════════════════════════════════════════ */

function drawHeader(
  doc: jsPDF, pageW: number, title: string, subtitle: string | undefined,
  dateStr: string, filters: string | undefined, generatedBy: string | undefined,
  accent: [number, number, number],
): number {
  // Green header band
  doc.setFillColor(...accent);
  doc.rect(0, 0, pageW, 26, 'F');

  // System name (small, white)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(SYSTEM_NAME, 14, 7);

  // Report title (large, white, bold)
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 16);

  // Subtitle
  if (subtitle) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 14, 22);
  }

  // Date on the right
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const dateW = doc.getTextWidth(dateStr);
  doc.text(dateStr, pageW - 14 - dateW, 7);

  // Meta below band
  let metaY = 32;
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED_TEXT);
  doc.setFont('helvetica', 'normal');

  if (generatedBy) { doc.text(`Usuário: ${generatedBy}`, 14, metaY); metaY += 4; }
  if (filters) { doc.text(`Filtros: ${filters}`, 14, metaY); metaY += 4; }

  // Thin separator
  doc.setDrawColor(...CARD_BORDER);
  doc.setLineWidth(0.3);
  doc.line(14, metaY, pageW - 14, metaY);
  metaY += 4;

  return metaY;
}

function drawSummaryCards(
  doc: jsPDF, startY: number, pageW: number, margin: number,
  items: SummaryItem[], accent: [number, number, number],
): number {
  const usableW = pageW - margin * 2;
  const cols = Math.min(items.length, 5);
  const cardW = usableW / cols - 2;
  const cardH = 18;
  const gap = 2;

  items.slice(0, 10).forEach((item, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = margin + col * (cardW + gap);
    const y = startY + row * (cardH + 4);

    // White card with border
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...CARD_BORDER);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'FD');

    // Value in green
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...accent);
    doc.text(String(item.value ?? 0), x + 4, y + 9);

    // Label in gray
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED_TEXT);
    doc.text(item.label, x + 4, y + 14.5);
  });

  const rows = Math.ceil(items.length / cols);
  return startY + rows * (cardH + 4) + 2;
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
      cellPadding: 3,
      lineColor: CARD_BORDER,
      lineWidth: 0.2,
      textColor: [30, 30, 30],
    },
    headStyles: {
      fillColor: accent,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 3.5,
    },
    alternateRowStyles: {
      fillColor: ALT_ROW,
    },
    margin: { left: margin, right: margin },
    tableLineColor: CARD_BORDER,
    tableLineWidth: 0.2,
    didParseCell: (hookData) => {
      const text = String(hookData.cell.raw || '');
      if (hookData.section === 'body') {
        // Red statuses
        if (['Dentro', 'Negado', 'Bloqueado', 'Suspenso', 'Inconsistente', 'Incompleto', 'denied', 'blocked'].includes(text)) {
          hookData.cell.styles.textColor = RED;
          hookData.cell.styles.fontStyle = 'bold';
        }
        // Green statuses
        else if (['Finalizado', 'Ativo', 'Concluída', 'Fora', 'allowed', 'active', 'completed'].includes(text)) {
          hookData.cell.styles.textColor = GREEN_TEXT;
          hookData.cell.styles.fontStyle = 'bold';
        }
        // Muted statuses
        else if (['Expirado sem uso', 'Pendente', 'Sem registro', 'expired_unused', 'pending'].includes(text)) {
          hookData.cell.styles.textColor = MUTED_TEXT;
        }
        // Direction
        else if (text === 'in') {
          hookData.cell.styles.textColor = GREEN_TEXT;
          hookData.cell.styles.fontStyle = 'bold';
        } else if (text === 'out') {
          hookData.cell.styles.textColor = MUTED_TEXT;
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

    // Thin separator
    doc.setDrawColor(...CARD_BORDER);
    doc.setLineWidth(0.3);
    doc.line(14, pageH - 14, pageW - 14, pageH - 14);

    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED_TEXT);
    doc.setFont('helvetica', 'normal');

    // Left
    doc.text(SYSTEM_NAME, 14, pageH - 9);

    // Center
    const confText = 'Documento de uso interno';
    const confW = doc.getTextWidth(confText);
    doc.text(confText, (pageW - confW) / 2, pageH - 9);

    // Right
    const pageText = `Página ${i} de ${pageCount}`;
    const ptW = doc.getTextWidth(pageText);
    doc.text(pageText, pageW - 14 - ptW, pageH - 9);
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
