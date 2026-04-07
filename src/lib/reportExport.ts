import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatLocalDateTime } from '@/lib/dateUtils';

export interface ExportColumn {
  key: string;
  label: string;
}

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

export const exportPDF = (data: any[], columns: ExportColumn[], title: string, filename: string, filters?: string) => {
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${formatLocalDateTime(new Date())}`, 14, 27);
  if (filters) doc.text(`Filtros: ${filters}`, 14, 33);

  autoTable(doc, {
    startY: filters ? 38 : 32,
    head: [columns.map(c => c.label)],
    body: data.map(row => columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '-';
      return String(val);
    })),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
  }
  doc.save(`${filename}.pdf`);
};

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
