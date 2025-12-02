import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AnalysisResult } from '../types.ts';

export const generatePDFReport = (data: AnalysisResult, referenceFilenames: string[], referenceUrls: string[]) => {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.setTextColor(41, 128, 185);
  doc.text("Refinery Instrumentation Inspection Report", 14, 22);

  // Metadata
  doc.setFontSize(10);
  doc.setTextColor(100);
  const date = new Date().toLocaleDateString();
  const time = new Date().toLocaleTimeString();
  doc.text(`Generated on: ${date} at ${time}`, 14, 30);
  doc.text(`AI Engine: Gemini 2.5 Flash`, 14, 35);
  
  let yPos = 42;
  
  // List PDF Files
  if (referenceFilenames.length > 0) {
      doc.text(`Reference PDFs:`, 14, yPos);
      doc.setFontSize(9);
      doc.setTextColor(60);
      referenceFilenames.forEach((name) => {
          yPos += 5;
          doc.text(`- ${name}`, 20, yPos);
      });
      yPos += 7;
  } else {
      doc.text(`Reference PDFs: None provided`, 14, yPos);
      yPos += 7;
  }

  // List URLs
  if (referenceUrls.length > 0) {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Reference URLs:`, 14, yPos);
      doc.setFontSize(9);
      doc.setTextColor(60);
      referenceUrls.forEach((url) => {
          yPos += 5;
          doc.text(`- ${url}`, 20, yPos);
      });
      yPos += 10;
  }

  // Summary Section
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Executive Summary", 14, yPos);
  
  doc.setFontSize(10);
  doc.setTextColor(60);
  const splitSummary = doc.splitTextToSize(data.summary, 180);
  doc.text(splitSummary, 14, yPos + 7);

  // Table of Faults
  const tableData = data.faults.map(fault => [
    fault.timestamp,
    fault.component,
    fault.faultType,
    fault.severity,
    fault.standardGap,
    fault.recommendation
  ]);

  // Calculate start Y for table based on summary length
  const summaryHeight = splitSummary.length * 4;
  const tableStartY = yPos + 7 + summaryHeight + 10;

  autoTable(doc, {
    startY: tableStartY > 250 ? 20 : tableStartY, // New page if summary is too long
    head: [['Time', 'Component', 'Fault', 'Severity', 'Gap / Violation', 'Action']],
    body: tableData,
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 15 }, // Time
      1: { cellWidth: 25 }, // Component
      2: { cellWidth: 25 }, // Fault
      3: { cellWidth: 20 }, // Severity
      4: { cellWidth: 50 }, // Gap
      5: { cellWidth: 45 }, // Action
    },
    styles: { fontSize: 8, overflow: 'linebreak' },
    margin: { top: 10 }
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, 190, 290, { align: 'right' });
    doc.text("RefineryEye AI - Confidential Maintenance Record", 14, 290);
  }

  doc.save(`Refinery_Inspection_Report_${Date.now()}.pdf`);
};