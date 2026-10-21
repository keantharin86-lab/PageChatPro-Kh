import React, { useState, useRef } from 'react';
import {
  X,
  FileDown,
  Printer,
  CheckCircle2,
  FileText,
  User,
  Phone,
  MapPin,
  ShoppingBag,
  MessageSquare,
  Bot,
  Calendar,
  Building2,
  SlidersHorizontal,
} from 'lucide-react';
import { ChatThread, Order, PageAccount, ChatMessage } from '../types';

interface ConversationPdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  thread: ChatThread;
  page: PageAccount;
  orders: Order[];
  language: 'kh' | 'en';
}

/**
 * Packages an array of JPEG data URLs (each representing one A4 page at 595.28 x 841.89 pt)
 * into a standards-compliant multi-page PDF 1.4 binary Blob.
 */
function buildPdfBlobFromJpegPages(jpegDataUrls: string[], pixelWidth: number, pixelHeight: number): Blob {
  const pageWidthPt = 595.28;
  const pageHeightPt = 841.89;

  const jpegBytesList: Uint8Array[] = jpegDataUrls.map((dataUrl) => {
    const base64 = dataUrl.split(',')[1] || '';
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  });

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // 1-indexed PDF object byte offsets
  let currentLength = 0;

  const pushString = (str: string) => {
    const bytes = encoder.encode(str);
    chunks.push(bytes);
    currentLength += bytes.length;
  };

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    currentLength += bytes.length;
  };

  const startObj = (id: number) => {
    offsets[id] = currentLength;
    pushString(`${id} 0 obj\n`);
  };

  const endObj = () => {
    pushString(`\nendobj\n`);
  };

  // PDF Header
  pushString(`%PDF-1.4\n%\xFF\xFF\xFF\xFF\n`);

  // Object 1: Catalog
  startObj(1);
  pushString(`<< /Type /Catalog /Pages 2 0 R >>`);
  endObj();

  const numPages = jpegBytesList.length;
  // Each page uses 3 objects: Page (3 + i*3), ContentStream (4 + i*3), ImageXObject (5 + i*3)
  const pageObjIds: number[] = [];
  for (let i = 0; i < numPages; i++) {
    pageObjIds.push(3 + i * 3);
  }

  // Object 2: Pages Tree
  startObj(2);
  pushString(`<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${numPages} >>`);
  endObj();

  for (let i = 0; i < numPages; i++) {
    const pageObjId = 3 + i * 3;
    const contentObjId = 4 + i * 3;
    const imgObjId = 5 + i * 3;
    const imgName = `/Im${i + 1}`;
    const jpegBytes = jpegBytesList[i];

    // Page Object
    startObj(pageObjId);
    pushString(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt.toFixed(2)} ${pageHeightPt.toFixed(
        2
      )}] /Resources << /XObject << ${imgName} ${imgObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`
    );
    endObj();

    // Content Stream Object
    const contentStream = `q\n${pageWidthPt.toFixed(2)} 0 0 ${pageHeightPt.toFixed(2)} 0 0 cm\n${imgName} Do\nQ\n`;
    const contentBytes = encoder.encode(contentStream);
    startObj(contentObjId);
    pushString(`<< /Length ${contentBytes.length} >>\nstream\n`);
    pushBytes(contentBytes);
    pushString(`\nendstream`);
    endObj();

    // Image XObject (DCTDecode JPEG)
    startObj(imgObjId);
    pushString(
      `<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
    );
    pushBytes(jpegBytes);
    pushString(`\nendstream`);
    endObj();
  }

  const totalObjects = 2 + numPages * 3;
  const xrefOffset = currentLength;
  pushString(`xref\n0 ${totalObjects + 1}\n`);
  pushString(`0000000000 65535 f \n`);
  for (let id = 1; id <= totalObjects; id++) {
    const off = String(offsets[id] || 0).padStart(10, '0');
    pushString(`${off} 00000 n \n`);
  }

  pushString(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(chunks, { type: 'application/pdf' });
}

/**
 * Helper to wrap text accurately for both Khmer (which may not have spaces between words)
 * and English/Latin text on an HTML5 Canvas 2D context.
 */
function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [''];
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }

    // Segment by spaces or zero-width spaces first; if a token is still wider than maxWidth, break by grapheme/character
    const tokens = para.split(/(\s+|\u200B+)/);
    let currentLine = '';

    for (const token of tokens) {
      if (!token) continue;
      const testLine = currentLine + token;
      if (ctx.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (ctx.measureText(token).width > maxWidth) {
          // Break long unbroken Khmer/URL strings cleanly at character boundaries
          const chars = Array.from(token);
          for (const ch of chars) {
            const testCharLine = currentLine + ch;
            if (ctx.measureText(testCharLine).width <= maxWidth) {
              currentLine = testCharLine;
            } else {
              if (currentLine.trim()) lines.push(currentLine.trimEnd());
              currentLine = ch;
            }
          }
        } else {
          if (currentLine.trim()) lines.push(currentLine.trimEnd());
          currentLine = token.trimStart();
        }
      }
    }
    if (currentLine.trim()) {
      lines.push(currentLine.trimEnd());
    }
  }

  return lines.length > 0 ? lines : [''];
}

export const ConversationPdfExportModal: React.FC<ConversationPdfExportModalProps> = ({
  isOpen,
  onClose,
  thread,
  page,
  orders,
  language,
}) => {
  const [includeCrmProfile, setIncludeCrmProfile] = useState(true);
  const [includeOrderSummary, setIncludeOrderSummary] = useState(true);
  const [includeInternalNotes, setIncludeInternalNotes] = useState(true);
  const [includeSignatureFooter, setIncludeSignatureFooter] = useState(true);
  const [messageFilter, setMessageFilter] = useState<'all' | 'customer_admin_only'>('all');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const printFrameRef = useRef<HTMLIFrameElement>(null);

  if (!isOpen) return null;

  const customer = thread.customer;
  const customerOrders = orders.filter(
    (o) =>
      o.threadId === thread.id ||
      o.customerPhone === customer.phone ||
      o.customerName === customer.name ||
      (thread.orderIds && thread.orderIds.includes(o.id))
  );

  const filteredMessages: ChatMessage[] = thread.messages.filter((m) => {
    if (messageFilter === 'customer_admin_only') {
      return m.sender === 'customer' || m.sender === 'admin';
    }
    return true;
  });

  const totalSpentUsd = customerOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalSpentKhr = Math.round(totalSpentUsd * 4100);
  const exportDateStr = new Date().toLocaleDateString('km-KH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const exportTimeStr = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const recordReferenceId = `REC-${thread.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}-${Date.now()
    .toString()
    .slice(-4)}`;

  const getSenderLabel = (msg: ChatMessage) => {
    if (msg.sender === 'customer') {
      return language === 'kh' ? `អតិថិជន (${customer.name})` : `Customer (${customer.name})`;
    }
    if (msg.sender === 'bot') {
      return language === 'kh' ? 'ជំនួយការ AI Gemini (Auto-Pilot)' : 'AI Gemini Auto-Pilot';
    }
    return language === 'kh' ? `ផេក Admin (${msg.senderName})` : `Page Admin (${msg.senderName})`;
  };

  // Multi-page high-DPI Canvas-to-PDF generator (supports full Khmer Unicode script)
  const handleDownloadPdfFile = async () => {
    setIsGeneratingPdf(true);
    setExportSuccess(false);

    try {
      const scale = 2; // 2x retina resolution for sharp Khmer & English typography
      const pageW = 794;
      const pageH = 1123;
      const marginX = 44;
      const contentW = pageW - marginX * 2;
      const fontStack = `'Kantumruy Pro', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif`;

      const canvases: HTMLCanvasElement[] = [];
      let currentCanvas = document.createElement('canvas');
      currentCanvas.width = pageW * scale;
      currentCanvas.height = pageH * scale;
      let ctx = currentCanvas.getContext('2d')!;
      ctx.scale(scale, scale);

      const fillPageBackground = (c: CanvasRenderingContext2D) => {
        c.fillStyle = '#ffffff';
        c.fillRect(0, 0, pageW, pageH);
      };

      fillPageBackground(ctx);
      canvases.push(currentCanvas);
      let cursorY = 42;

      const startNewPage = () => {
        currentCanvas = document.createElement('canvas');
        currentCanvas.width = pageW * scale;
        currentCanvas.height = pageH * scale;
        ctx = currentCanvas.getContext('2d')!;
        ctx.scale(scale, scale);
        fillPageBackground(ctx);
        canvases.push(currentCanvas);
        cursorY = 44;

        // Subtle running header on continuation pages
        ctx.fillStyle = '#64748b';
        ctx.font = `600 10px ${fontStack}`;
        ctx.fillText(
          `${page.name} — កំណត់ត្រាប្រវត្តិឆាតអតិថិជន (${customer.name}) • ${recordReferenceId}`,
          marginX,
          cursorY
        );
        cursorY += 10;
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(marginX, cursorY);
        ctx.lineTo(pageW - marginX, cursorY);
        ctx.stroke();
        cursorY += 20;
      };

      const ensureSpace = (neededHeight: number) => {
        if (cursorY + neededHeight > pageH - 60) {
          startNewPage();
        }
      };

      // 1. Document Top Banner
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(marginX, cursorY, contentW, 82, 10);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 18px ${fontStack}`;
      ctx.fillText('កំណត់ត្រាប្រវត្តិសន្ទនាអតិថិជន (CUSTOMER CHAT RECORD)', marginX + 20, cursorY + 30);

      ctx.fillStyle = '#94a3b8';
      ctx.font = `500 11.5px ${fontStack}`;
      ctx.fillText(
        `ទំព័រផេក៖ ${page.name}  •  ប្រព័ន្ធ៖ ${customer.platform.toUpperCase()}  •  លេខសម្គាល់៖ ${recordReferenceId}`,
        marginX + 20,
        cursorY + 52
      );
      ctx.fillText(
        `កាលបរិច្ឆេទទាញយក៖ ${exportDateStr} (${exportTimeStr})  •  ចំនួនសារសរុប៖ ${filteredMessages.length} សារ`,
        marginX + 20,
        cursorY + 70
      );

      cursorY += 98;

      // 2. Customer CRM Profile Section
      if (includeCrmProfile) {
        const notesLines =
          includeInternalNotes && customer.notes
            ? wrapCanvasText(ctx, `កំណត់សម្គាល់៖ ${customer.notes}`, contentW - 32)
            : [];
        const boxHeight = 104 + (notesLines.length > 0 ? notesLines.length * 16 + 14 : 0);
        ensureSpace(boxHeight + 16);

        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(marginX, cursorY, contentW, boxHeight, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = `700 13px ${fontStack}`;
        ctx.fillText('១. ព័ត៌មានអតិថិជន (Customer CRM Profile)', marginX + 16, cursorY + 24);

        ctx.font = `500 11.5px ${fontStack}`;
        ctx.fillStyle = '#334155';
        const col1X = marginX + 16;
        const col2X = marginX + contentW / 2 + 10;

        ctx.fillText(`ឈ្មោះអតិថិជន៖ ${customer.name}`, col1X, cursorY + 46);
        ctx.fillText(`លេខទូរស័ព្ទ៖ ${customer.phone || 'មិនទាន់មាន'}`, col1X, cursorY + 66);
        ctx.fillText(`ខេត្ត/ក្រុង៖ ${customer.province || 'ភ្នំពេញ'} — ${customer.address || ''}`, col1X, cursorY + 86);

        ctx.fillText(`PSID / ID៖ ${customer.psid || customer.id}`, col2X, cursorY + 46);
        ctx.fillText(
          `ការកុម្ម៉ង់សរុប៖ ${customerOrders.length} ដង ($${totalSpentUsd.toFixed(2)} / ${totalSpentKhr.toLocaleString()} ៛)`,
          col2X,
          cursorY + 66
        );
        ctx.fillText(
          `ស្លាកសម្គាល់ (Tags)៖ ${customer.tags?.length ? customer.tags.join(', ') : 'ភ្ញៀវផេក'}`,
          col2X,
          cursorY + 86
        );

        if (notesLines.length > 0) {
          let noteY = cursorY + 106;
          ctx.fillStyle = '#92400e';
          ctx.font = `500 11px ${fontStack}`;
          for (const nl of notesLines) {
            ctx.fillText(nl, col1X, noteY);
            noteY += 16;
          }
        }

        cursorY += boxHeight + 18;
      }

      // 3. Customer Orders Table Section
      if (includeOrderSummary && customerOrders.length > 0) {
        const headerH = 54;
        const rowH = 26;
        const totalTableH = headerH + customerOrders.length * rowH + 12;
        ensureSpace(Math.min(totalTableH, 160));

        ctx.fillStyle = '#0f172a';
        ctx.font = `700 13px ${fontStack}`;
        ctx.fillText(
          `២. ប្រវត្តិវិក្កយបត្រកុម្ម៉ង់ទំនិញ (${customerOrders.length} វិក្កយបត្រ)`,
          marginX,
          cursorY + 14
        );
        cursorY += 24;

        // Table Header
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.roundRect(marginX, cursorY, contentW, 24, 4);
        ctx.fill();

        ctx.fillStyle = '#1e293b';
        ctx.font = `700 10.5px ${fontStack}`;
        ctx.fillText('លេខបុង (Order #)', marginX + 10, cursorY + 16);
        ctx.fillText('មុខទំនិញ (Items)', marginX + 125, cursorY + 16);
        ctx.fillText('សេវាដឹកជញ្ជូន', marginX + 380, cursorY + 16);
        ctx.fillText('ស្ថានភាព', marginX + 495, cursorY + 16);
        ctx.fillText('ទឹកប្រាក់សរុប', marginX + 590, cursorY + 16);
        cursorY += 26;

        for (const ord of customerOrders) {
          ensureSpace(30);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(marginX, cursorY, contentW, 24);
          ctx.strokeStyle = '#e2e8f0';
          ctx.strokeRect(marginX, cursorY, contentW, 24);

          const itemsSummary = ord.items
            .map((it) => `${it.name} (x${it.quantity})`)
            .join(', ')
            .slice(0, 38);

          ctx.fillStyle = '#0f172a';
          ctx.font = `600 10.5px ${fontStack}`;
          ctx.fillText(`#${ord.orderNumber}`, marginX + 10, cursorY + 16);

          ctx.font = `500 10.5px ${fontStack}`;
          ctx.fillStyle = '#334155';
          ctx.fillText(itemsSummary || 'ទំនិញក្នុងហាង', marginX + 125, cursorY + 16);
          ctx.fillText(ord.deliveryProvider.toUpperCase(), marginX + 380, cursorY + 16);
          ctx.fillText(ord.status.toUpperCase(), marginX + 495, cursorY + 16);

          ctx.fillStyle = '#047857';
          ctx.font = `700 10.5px ${fontStack}`;
          ctx.fillText(`$${Number(ord.total).toFixed(2)}`, marginX + 590, cursorY + 16);

          cursorY += 24;
        }

        cursorY += 18;
      }

      // 4. Conversation Messages Section Header
      ensureSpace(50);
      ctx.fillStyle = '#0f172a';
      ctx.font = `700 13px ${fontStack}`;
      ctx.fillText(
        `ប្រវត្តិសារសន្ទនាទាំងអស់ (Complete Conversation History — ${filteredMessages.length} សារ)`,
        marginX,
        cursorY + 14
      );
      cursorY += 24;

      // Render each message block chronologically
      for (let idx = 0; idx < filteredMessages.length; idx++) {
        const msg = filteredMessages[idx];
        const isCustomer = msg.sender === 'customer';
        const isBot = msg.sender === 'bot';

        ctx.font = `500 11.5px ${fontStack}`;
        const bubbleMaxW = contentW - 90;
        const textLines = wrapCanvasText(ctx, msg.text || '', bubbleMaxW - 28);

        // Attachment descriptions if any
        const attLines: string[] = [];
        if (Array.isArray(msg.attachments)) {
          for (const att of msg.attachments) {
            if (att.type === 'order_invoice' && att.data) {
              attLines.push(
                `🧾 [វិក្កយបត្រ #${att.data.orderNumber} — សរុប $${Number(att.data.total || 0).toFixed(2)}]`
              );
            } else if (att.type === 'product' && att.data) {
              attLines.push(`🛍️ [ទំនិញ៖ ${att.data.nameKh || att.data.name} — $${att.data.price}]`);
            } else if (att.type === 'image') {
              attLines.push(`🖼️ [រូបភាពភ្ជាប់ក្នុងសារ / Attached Image]`);
            } else if (att.type === 'khqr') {
              attLines.push(`💳 [បណ្ណទូទាត់ប្រាក់ ABA / Bakong KHQR]`);
            }
          }
        }

        const lineHeight = 18;
        const msgBoxH = 30 + textLines.length * lineHeight + attLines.length * 18 + 10;

        ensureSpace(msgBoxH + 12);

        const boxX = isCustomer ? marginX : marginX + 70;
        const boxW = contentW - 70;

        // Bubble Background & Border
        ctx.fillStyle = isCustomer ? '#f8fafc' : isBot ? '#f5f3ff' : '#eff6ff';
        ctx.strokeStyle = isCustomer ? '#cbd5e1' : isBot ? '#ddd6fe' : '#bfdbfe';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(boxX, cursorY, boxW, msgBoxH, 8);
        ctx.fill();
        ctx.stroke();

        // Sender Header & Timestamp
        ctx.font = `700 10.5px ${fontStack}`;
        ctx.fillStyle = isCustomer ? '#0f172a' : isBot ? '#6d28d9' : '#1d4ed8';
        const senderTitle = `${idx + 1}. ${getSenderLabel(msg)}`;
        ctx.fillText(senderTitle, boxX + 14, cursorY + 18);

        ctx.font = `500 10px ${fontStack}`;
        ctx.fillStyle = '#64748b';
        const timeWidth = ctx.measureText(msg.timestamp || '').width;
        ctx.fillText(msg.timestamp || '', boxX + boxW - timeWidth - 14, cursorY + 18);

        // Message Body Lines
        ctx.font = `500 11.5px ${fontStack}`;
        ctx.fillStyle = '#1e293b';
        let lineY = cursorY + 38;
        for (const line of textLines) {
          ctx.fillText(line, boxX + 14, lineY);
          lineY += lineHeight;
        }

        // Attachment Summary Lines
        if (attLines.length > 0) {
          ctx.font = `600 10.5px ${fontStack}`;
          ctx.fillStyle = '#047857';
          for (const al of attLines) {
            ctx.fillText(al, boxX + 14, lineY);
            lineY += 18;
          }
        }

        cursorY += msgBoxH + 10;
      }

      // 5. Official Signature / Verification Footer
      if (includeSignatureFooter) {
        ensureSpace(95);
        cursorY += 16;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(marginX, cursorY);
        ctx.lineTo(pageW - marginX, cursorY);
        ctx.stroke();

        cursorY += 24;
        ctx.fillStyle = '#334155';
        ctx.font = `600 11px ${fontStack}`;
        ctx.fillText(`អ្នករៀបចំឯកសារ៖ ${page.activeStaff || 'សុខា (Admin)'}`, marginX + 20, cursorY);
        ctx.fillText(`បញ្ជាក់ដោយទំព័រផេក៖ ${page.name}`, pageW - marginX - 240, cursorY);

        ctx.fillStyle = '#94a3b8';
        ctx.font = `500 10px ${fontStack}`;
        ctx.fillText('ហត្ថលេខា និងត្រាហាង (Signature & Stamp)', pageW - marginX - 240, cursorY + 38);
      }

      // Add page numbers to the bottom of every rendered page
      const totalPages = canvases.length;
      canvases.forEach((canvasEl, pageIdx) => {
        const c = canvasEl.getContext('2d')!;
        c.fillStyle = '#94a3b8';
        c.font = `500 10px ${fontStack}`;
        const footerText = `PageChat Pro CRM • ឯកសារប្រវត្តិឆាតអតិថិជន ${customer.name} (${recordReferenceId}) • ទំព័រទី ${
          pageIdx + 1
        } នៃ ${totalPages}`;
        c.fillText(footerText, marginX, pageH - 22);
      });

      const jpegDataUrls = canvases.map((c) => c.toDataURL('image/jpeg', 0.92));
      const pdfBlob = buildPdfBlobFromJpegPages(jpegDataUrls, pageW * scale, pageH * scale);

      const safeName = customer.name.replace(/[^a-zA-Z0-9\u1780-\u17FF_-]+/g, '_');
      const fileName = `Chat_Record_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3500);
    } catch (err) {
      console.error('Error generating PDF document:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Native Print / Save as Vector PDF via hidden iframe (no window.open needed)
  const handlePrintDocument = () => {
    const iframe = printFrameRef.current;
    if (!iframe || !iframe.contentWindow) return;

    const doc = iframe.contentWindow.document;
    const escapeHtml = (str: string) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const ordersHtml =
      includeOrderSummary && customerOrders.length > 0
        ? `
      <div class="section">
        <div class="section-title">២. ប្រវត្តិវិក្កយបត្រកុម្ម៉ង់ទំនិញ (${customerOrders.length} វិក្កយបត្រ)</div>
        <table>
          <thead>
            <tr>
              <th>លេខបុង</th>
              <th>មុខទំនិញ</th>
              <th>សេវាដឹក</th>
              <th>ស្ថានភាព</th>
              <th>ទឹកប្រាក់សរុប</th>
            </tr>
          </thead>
          <tbody>
            ${customerOrders
              .map(
                (o) => `
              <tr>
                <td><strong>#${escapeHtml(o.orderNumber)}</strong></td>
                <td>${escapeHtml(o.items.map((i) => `${i.name} (x${i.quantity})`).join(', '))}</td>
                <td>${escapeHtml(o.deliveryProvider.toUpperCase())}</td>
                <td>${escapeHtml(o.status.toUpperCase())}</td>
                <td><strong>$${Number(o.total).toFixed(2)}</strong></td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
        : '';

    const messagesHtml = filteredMessages
      .map((m, idx) => {
        const isCustomer = m.sender === 'customer';
        const isBot = m.sender === 'bot';
        const cls = isCustomer ? 'msg-customer' : isBot ? 'msg-bot' : 'msg-admin';
        const attHtml = Array.isArray(m.attachments)
          ? m.attachments
              .map((att) => {
                if (att.type === 'order_invoice' && att.data) {
                  return `<div class="att-badge">🧾 វិក្កយបត្រ #${escapeHtml(att.data.orderNumber)} — $${Number(
                    att.data.total || 0
                  ).toFixed(2)}</div>`;
                }
                if (att.type === 'product' && att.data) {
                  return `<div class="att-badge">🛍️ ទំនិញ៖ ${escapeHtml(
                    att.data.nameKh || att.data.name
                  )}</div>`;
                }
                if (att.type === 'image' && att.data?.url) {
                  return `<div class="att-badge">🖼️ រូបភាពភ្ជាប់ក្នុងសារ</div>`;
                }
                return '';
              })
              .join('')
          : '';

        return `
        <div class="msg-row ${cls}">
          <div class="msg-meta">
            <span class="msg-sender">${idx + 1}. ${escapeHtml(getSenderLabel(m))}</span>
            <span class="msg-time">${escapeHtml(m.timestamp)}</span>
          </div>
          <div class="msg-text">${escapeHtml(m.text).replace(/\n/g, '<br/>')}</div>
          ${attHtml}
        </div>`;
      })
      .join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="km">
<head>
  <meta charset="utf-8" />
  <title>Customer_Chat_Record_${escapeHtml(customer.name)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 14mm; }
    body {
      font-family: 'Kantumruy Pro', system-ui, -apple-system, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.5;
    }
    .header {
      background: #0f172a;
      color: #ffffff;
      padding: 16px 20px;
      border-radius: 10px;
      margin-bottom: 16px;
    }
    .header h1 {
      margin: 0 0 6px 0;
      font-size: 17px;
      font-weight: 700;
    }
    .header p {
      margin: 2px 0;
      font-size: 11px;
      color: #cbd5e1;
    }
    .section {
      margin-bottom: 16px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px 16px;
      background: #f8fafc;
    }
    .section-title {
      font-weight: 700;
      font-size: 13px;
      margin-bottom: 8px;
      color: #0f172a;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      background: #fff;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      font-size: 11px;
    }
    th {
      background: #e2e8f0;
      font-weight: 700;
    }
    .msg-row {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 8px;
      page-break-inside: avoid;
    }
    .msg-customer {
      background: #f8fafc;
      margin-right: 48px;
    }
    .msg-admin {
      background: #eff6ff;
      border-color: #bfdbfe;
      margin-left: 48px;
    }
    .msg-bot {
      background: #f5f3ff;
      border-color: #ddd6fe;
      margin-left: 48px;
    }
    .msg-meta {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      margin-bottom: 4px;
    }
    .msg-sender { font-weight: 700; color: #1e293b; }
    .msg-time { color: #64748b; }
    .msg-text { font-size: 12px; color: #0f172a; white-space: pre-wrap; }
    .att-badge {
      margin-top: 6px;
      font-size: 10.5px;
      font-weight: 600;
      color: #047857;
    }
    .footer-sign {
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>កំណត់ត្រាប្រវត្តិសន្ទនាអតិថិជន (CUSTOMER CHAT RECORD)</h1>
    <p>ទំព័រផេក៖ ${escapeHtml(page.name)} • ប្រព័ន្ធ៖ ${escapeHtml(customer.platform.toUpperCase())} • លេខកំណត់ត្រា៖ ${escapeHtml(
      recordReferenceId
    )}</p>
    <p>កាលបរិច្ឆេទទាញយក៖ ${escapeHtml(exportDateStr)} (${escapeHtml(exportTimeStr)}) • ចំនួនសារសរុប៖ ${
      filteredMessages.length
    } សារ</p>
  </div>

  ${
    includeCrmProfile
      ? `<div class="section">
    <div class="section-title">១. ព័ត៌មានអតិថិជន (Customer CRM Profile)</div>
    <div class="grid-2">
      <div><strong>ឈ្មោះអតិថិជន៖</strong> ${escapeHtml(customer.name)}</div>
      <div><strong>PSID / ID៖</strong> ${escapeHtml(customer.psid || customer.id)}</div>
      <div><strong>លេខទូរស័ព្ទ៖</strong> ${escapeHtml(customer.phone || 'មិនទាន់មាន')}</div>
      <div><strong>ការកុម្ម៉ង់សរុប៖</strong> ${customerOrders.length} ដង ($${totalSpentUsd.toFixed(2)})</div>
      <div><strong>ខេត្ត/ក្រុង និងអាសយដ្ឋាន៖</strong> ${escapeHtml(customer.province)} — ${escapeHtml(customer.address)}</div>
      <div><strong>ស្លាកសម្គាល់៖</strong> ${escapeHtml(customer.tags?.join(', ') || 'ភ្ញៀវផេក')}</div>
    </div>
    ${
      includeInternalNotes && customer.notes
        ? `<div style="margin-top:8px;color:#92400e;font-size:11px;"><strong>កំណត់សម្គាល់ផ្ទៃក្នុង៖</strong> ${escapeHtml(
            customer.notes
          )}</div>`
        : ''
    }
  </div>`
      : ''
  }

  ${ordersHtml}

  <div>
    <div class="section-title" style="margin-bottom:10px;">ប្រវត្តិសារសន្ទនាទាំងអស់ (${filteredMessages.length} សារ)</div>
    ${messagesHtml}
  </div>

  ${
    includeSignatureFooter
      ? `<div class="footer-sign">
    <div>
      <strong>អ្នករៀបចំឯកសារ៖</strong> ${escapeHtml(page.activeStaff || 'សុខា (Admin)')}<br/>
      <span style="color:#64748b;font-size:10px;">PageChat Pro CRM Official Archive</span>
    </div>
    <div style="text-align:right;">
      <strong>បញ្ជាក់ដោយទំព័រផេក៖</strong> ${escapeHtml(page.name)}<br/>
      <span style="color:#64748b;font-size:10px;">ហត្ថលេខា និងត្រាហាង (Signature & Stamp)</span>
    </div>
  </div>`
      : ''
  }
</body>
</html>`;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      {/* Hidden iframe for native print / Save as PDF */}
      <iframe ref={printFrameRef} title="pdf-print-frame" className="hidden" />

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-xs">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold truncate">
                {language === 'kh'
                  ? 'ទាញយកប្រវត្តិសន្ទនាអតិថិជនជា PDF (Customer Chat Record)'
                  : 'Export Conversation History as PDF'}
              </h2>
              <p className="text-xs text-slate-300 truncate">
                {customer.name} • {filteredMessages.length}{' '}
                {language === 'kh' ? 'សារក្នុងប្រវត្តិសន្ទនា' : 'messages in transcript'} • {recordReferenceId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrintDocument}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
              title="បោះពុម្ព ឬ Save as PDF តាមរយៈ Browser"
            >
              <Printer className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">
                {language === 'kh' ? 'បោះពុម្ព / Save PDF' : 'Print / Save PDF'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdfFile}
              disabled={isGeneratingPdf}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <FileDown className={`w-4 h-4 ${isGeneratingPdf ? 'animate-bounce' : ''}`} />
              <span>
                {isGeneratingPdf
                  ? language === 'kh'
                    ? 'កំពុងបង្កើត PDF...'
                    : 'Generating PDF...'
                  : language === 'kh'
                  ? 'ទាញយកឯកសារ .PDF ឥឡូវនេះ'
                  : 'Download .PDF File'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Export Configuration Controls Bar */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span>{language === 'kh' ? 'ជម្រើសក្នុងឯកសារ PDF៖' : 'PDF Content Options:'}</span>
            </span>

            <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeCrmProfile}
                onChange={(e) => setIncludeCrmProfile(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{language === 'kh' ? 'ព័ត៌មានអតិថិជន (CRM)' : 'Customer CRM Info'}</span>
            </label>

            <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeOrderSummary}
                onChange={(e) => setIncludeOrderSummary(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                {language === 'kh'
                  ? `ប្រវត្តិកុម្ម៉ង់ (${customerOrders.length})`
                  : `Order History (${customerOrders.length})`}
              </span>
            </label>

            <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeInternalNotes}
                onChange={(e) => setIncludeInternalNotes(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{language === 'kh' ? 'កំណត់សម្គាល់ (Notes)' : 'Internal Notes'}</span>
            </label>

            <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeSignatureFooter}
                onChange={(e) => setIncludeSignatureFooter(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{language === 'kh' ? 'ហត្ថលេខា & ត្រាហាង' : 'Signature Footer'}</span>
            </label>
          </div>

          <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setMessageFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                messageFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'kh' ? 'សារទាំងអស់ (រួមទាំង AI)' : 'All Messages'}
            </button>
            <button
              type="button"
              onClick={() => setMessageFilter('customer_admin_only')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                messageFilter === 'customer_admin_only'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'kh' ? 'តែភ្ញៀវ & Admin' : 'Customer & Admin'}
            </button>
          </div>
        </div>

        {/* Success Notification Banner */}
        {exportSuccess && (
          <div className="px-5 py-2.5 bg-emerald-600 text-white text-xs font-semibold flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {language === 'kh'
                  ? `បានទាញយកឯកសារ PDF កំណត់ត្រាសន្ទនារបស់ "${customer.name}" រួចរាល់!`
                  : `Successfully exported PDF conversation record for "${customer.name}"!`}
              </span>
            </div>
            <span className="text-[11px] opacity-90">{recordReferenceId}.pdf</span>
          </div>
        )}

        {/* Live A4 Document Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100">
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md border border-slate-200 p-6 sm:p-8 space-y-6">
            {/* Document Banner */}
            <div className="bg-slate-900 text-white p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-blue-400 font-semibold">
                  Official Customer Conversation Transcript
                </div>
                <h3 className="text-lg font-bold">
                  {language === 'kh'
                    ? 'កំណត់ត្រាប្រវត្តិសន្ទនាអតិថិជន'
                    : 'Customer Conversation Record'}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-300 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {page.name}
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {exportDateStr} ({exportTimeStr})
                  </span>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
                <div className="text-[11px] text-slate-400">
                  {language === 'kh' ? 'លេខសម្គាល់ឯកសារ' : 'Record Reference'}
                </div>
                <div className="text-sm font-mono font-bold text-emerald-400 tabular-nums">
                  {recordReferenceId}
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5 tabular-nums">
                  {filteredMessages.length} {language === 'kh' ? 'សារសរុប' : 'Messages'}
                </div>
              </div>
            </div>

            {/* 1. Customer CRM Profile */}
            {includeCrmProfile && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>
                      {language === 'kh'
                        ? '១. ព័ត៌មានអតិថិជន (Customer CRM Profile)'
                        : '1. Customer CRM Profile'}
                    </span>
                  </h4>
                  <span className="text-xs text-slate-500 font-mono">
                    PSID: {customer.psid || customer.id}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 w-28 shrink-0">
                        {language === 'kh' ? 'ឈ្មោះអតិថិជន៖' : 'Customer Name:'}
                      </span>
                      <span className="font-bold text-slate-900">{customer.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 w-28 shrink-0 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {language === 'kh' ? 'លេខទូរស័ព្ទ៖' : 'Phone:'}
                      </span>
                      <span className="font-semibold text-slate-800 tabular-nums">
                        {customer.phone || 'មិនទាន់មាន'}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500 w-28 shrink-0 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {language === 'kh' ? 'អាសយដ្ឋាន៖' : 'Address:'}
                      </span>
                      <span className="text-slate-800">
                        {customer.province} — {customer.address}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 w-32 shrink-0">
                        {language === 'kh' ? 'ប្រព័ន្ធទំនាក់ទំនង៖' : 'Platform:'}
                      </span>
                      <span className="font-semibold text-slate-800 capitalize">
                        {customer.platform} Live
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 w-32 shrink-0">
                        {language === 'kh' ? 'ការកុម្ម៉ង់សរុប៖' : 'Total Orders:'}
                      </span>
                      <span className="font-bold text-emerald-700 tabular-nums">
                        {customerOrders.length} {language === 'kh' ? 'ដង' : 'orders'} ($
                        {totalSpentUsd.toFixed(2)} / {totalSpentKhr.toLocaleString()} ៛)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 w-32 shrink-0">
                        {language === 'kh' ? 'ស្លាកសម្គាល់៖' : 'Customer Tags:'}
                      </span>
                      <span className="text-slate-700">
                        {customer.tags?.length ? customer.tags.join(' · ') : 'ភ្ញៀវផេក'}
                      </span>
                    </div>
                  </div>
                </div>

                {includeInternalNotes && customer.notes && (
                  <div className="pt-2 border-t border-slate-200/80 text-xs text-amber-900">
                    <span className="font-semibold">
                      {language === 'kh' ? 'កំណត់សម្គាល់ផ្ទៃក្នុង៖ ' : 'Internal Notes: '}
                    </span>
                    <span>{customer.notes}</span>
                  </div>
                )}
              </div>
            )}

            {/* 2. Customer Order History Table */}
            {includeOrderSummary && customerOrders.length > 0 && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-emerald-600" />
                  <span>
                    {language === 'kh'
                      ? `២. ប្រវត្តិវិក្កយបត្រកុម្ម៉ង់ទំនិញ (${customerOrders.length})`
                      : `2. Associated Customer Orders (${customerOrders.length})`}
                  </span>
                </h4>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                        <th className="py-2 px-3 font-semibold">
                          {language === 'kh' ? 'លេខបុង' : 'Order #'}
                        </th>
                        <th className="py-2 px-3 font-semibold">
                          {language === 'kh' ? 'មុខទំនិញ' : 'Items'}
                        </th>
                        <th className="py-2 px-3 font-semibold">
                          {language === 'kh' ? 'សេវាដឹក' : 'Delivery'}
                        </th>
                        <th className="py-2 px-3 font-semibold">
                          {language === 'kh' ? 'ស្ថានភាព' : 'Status'}
                        </th>
                        <th className="py-2 px-3 font-semibold text-right">
                          {language === 'kh' ? 'ទឹកប្រាក់សរុប' : 'Total'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {customerOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-slate-900 tabular-nums">
                            #{ord.orderNumber}
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            {ord.items.map((it) => `${it.name} (x${it.quantity})`).join(', ')}
                          </td>
                          <td className="py-2 px-3 text-slate-600 uppercase">
                            {ord.deliveryProvider}
                          </td>
                          <td className="py-2 px-3 text-slate-700 uppercase font-medium">
                            {ord.status}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-700 tabular-nums">
                            ${Number(ord.total).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. Full Chronological Chat Transcript */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <span>
                    {language === 'kh'
                      ? `ប្រវត្តិសារសន្ទនាទាំងអស់ (${filteredMessages.length} សារ)`
                      : `Complete Conversation History (${filteredMessages.length} messages)`}
                  </span>
                </h4>
                <span className="text-[11px] text-slate-500">
                  {language === 'kh' ? 'តម្រៀបតាមលំដាប់ម៉ោងឆាត' : 'Chronological Order'}
                </span>
              </div>

              <div className="space-y-2.5">
                {filteredMessages.map((msg, index) => {
                  const isCustomer = msg.sender === 'customer';
                  const isBot = msg.sender === 'bot';

                  return (
                    <div
                      key={msg.id || index}
                      className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                        isCustomer
                          ? 'bg-slate-50 border-slate-200 mr-6 sm:mr-14'
                          : isBot
                          ? 'bg-purple-50/60 border-purple-200 ml-6 sm:ml-14'
                          : 'bg-blue-50/60 border-blue-200 ml-6 sm:ml-14'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5 text-[11px]">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="text-slate-400 tabular-nums">#{index + 1}</span>
                          {isBot && <Bot className="w-3.5 h-3.5 text-purple-600" />}
                          <span
                            className={
                              isCustomer
                                ? 'text-slate-900'
                                : isBot
                                ? 'text-purple-800'
                                : 'text-blue-800'
                            }
                          >
                            {getSenderLabel(msg)}
                          </span>
                        </div>
                        <span className="text-slate-500 tabular-nums">{msg.timestamp}</span>
                      </div>

                      <p className="text-slate-800 whitespace-pre-wrap">{msg.text}</p>

                      {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200/70 space-y-1">
                          {msg.attachments.map((att, attIdx) => {
                            if (att.type === 'order_invoice' && att.data) {
                              return (
                                <div
                                  key={attIdx}
                                  className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5"
                                >
                                  <span>
                                    🧾 វិក្កយបត្របញ្ជាទិញ #{att.data.orderNumber} — សរុប $
                                    {Number(att.data.total || 0).toFixed(2)}
                                  </span>
                                </div>
                              );
                            }
                            if (att.type === 'product' && att.data) {
                              return (
                                <div
                                  key={attIdx}
                                  className="text-[11px] font-semibold text-blue-700"
                                >
                                  🛍️ ទំនិញ៖ {att.data.nameKh || att.data.name} ($
                                  {Number(att.data.price || 0).toFixed(2)})
                                </div>
                              );
                            }
                            if (att.type === 'image' && att.data?.url) {
                              return (
                                <div key={attIdx} className="pt-1">
                                  <img
                                    src={att.data.url}
                                    alt={att.data.caption || 'Attachment'}
                                    referrerPolicy="no-referrer"
                                    className="max-h-32 rounded-lg border border-slate-200 object-cover"
                                  />
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Official Verification Signature Footer */}
            {includeSignatureFooter && (
              <div className="pt-6 mt-6 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 text-xs text-slate-600">
                <div>
                  <p className="font-bold text-slate-800">
                    {language === 'kh' ? 'អ្នករៀបចំកំណត់ត្រា៖ ' : 'Prepared By: '}
                    {page.activeStaff || 'សុខា (Admin)'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    PageChat Pro CRM • Official Customer Conversation Record
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="font-bold text-slate-800">
                    {language === 'kh' ? 'បញ្ជាក់ដោយទំព័រផេក៖ ' : 'Verified By Page: '}
                    {page.name}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-4">
                    ........................................................................
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {language === 'kh'
                      ? 'ហត្ថលេខា និងត្រាហាង (Authorized Signature)'
                      : 'Authorized Signature & Stamp'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Action Footer */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 hidden sm:block">
            {language === 'kh'
              ? 'គាំទ្រអក្សរខ្មែរ Unicode និងទម្រង់ក្រដាសស្តង់ដារ A4 សម្រាប់រក្សាទុកជាឯកសារអតិថិជន'
              : 'Full Khmer Unicode & A4 formatting for official customer records'}
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
            >
              {language === 'kh' ? 'បិទផ្ទាំង' : 'Close'}
            </button>

            <button
              type="button"
              onClick={handlePrintDocument}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-700" />
              <span>{language === 'kh' ? 'បោះពុម្ព (Print)' : 'Print PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdfFile}
              disabled={isGeneratingPdf}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>
                {isGeneratingPdf
                  ? language === 'kh'
                    ? 'កំពុងបង្កើត PDF...'
                    : 'Generating PDF...'
                  : language === 'kh'
                  ? 'ទាញយកជា PDF (Download)'
                  : 'Download PDF'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
