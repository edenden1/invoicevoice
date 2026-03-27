import PDFDocument from 'pdfkit';
import { formatCurrency } from '../utils/helpers';

interface InvoiceForPdf {
  invoiceNumber: string;
  createdAt: Date;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  serviceAddress?: string | null;
  description?: string | null;
  lineItems: Array<{
    type: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentUrl?: string | null;
}

interface ProfileForPdf {
  businessName: string;
  ownerName: string;
  phone: string;
  licenseNumber?: string | null;
  logoUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

// ─── Colors ─────────────────────────────────────────────────────────────────

const COLORS = {
  primary: '#16213e',
  secondary: '#0f3460',
  text: '#1a1a2e',
  textLight: '#555555',
  gray: '#e8e8e8',
  bgLight: '#f4f6fa',
  bgRow: '#f9f9fc',
  white: '#ffffff',
  footerText: '#999999',
};

// ─── HTML generation (for public invoice endpoint) ──────────────────────────

export function generateInvoiceHtml(
  invoice: InvoiceForPdf,
  profile: ProfileForPdf
): string {
  const invoiceDate = new Date(invoice.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const businessAddress = [
    profile.addressLine1 ? escapeHtml(profile.addressLine1) : null,
    profile.addressLine2 ? escapeHtml(profile.addressLine2) : null,
    [profile.city, profile.state, profile.zip]
      .filter(Boolean)
      .map((s) => escapeHtml(s!))
      .join(', '),
  ]
    .filter(Boolean)
    .join('<br>');

  const lineItemRows = invoice.lineItems
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.description)}</td>
        <td class="center">${item.type}</td>
        <td class="center">${item.quantity}</td>
        <td class="right">${formatCurrency(item.unitPrice)}</td>
        <td class="right">${formatCurrency(item.total)}</td>
      </tr>`
    )
    .join('');

  const payButton = invoice.paymentUrl
    ? `<div class="pay-section">
        <a href="${escapeHtml(invoice.paymentUrl)}" class="pay-button">Pay Now - ${formatCurrency(invoice.total)}</a>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a2e;
      line-height: 1.6;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #16213e;
    }
    .business-info h1 { font-size: 24px; color: #16213e; margin-bottom: 5px; }
    .business-info p { font-size: 13px; color: #555; }
    .invoice-label { text-align: right; }
    .invoice-label h2 { font-size: 28px; color: #0f3460; text-transform: uppercase; letter-spacing: 2px; }
    .invoice-label p { font-size: 14px; color: #555; margin-top: 5px; }
    .details-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .bill-to h3, .invoice-details h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #0f3460; margin-bottom: 8px; }
    .bill-to p, .invoice-details p { font-size: 14px; color: #333; }
    .description { background: #f4f6fa; padding: 15px 20px; border-radius: 6px; margin-bottom: 25px; font-size: 14px; color: #333; }
    .description strong { color: #16213e; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
    thead th { background: #16213e; color: white; padding: 12px 15px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
    thead th.center { text-align: center; }
    thead th.right { text-align: right; }
    tbody td { padding: 12px 15px; font-size: 14px; border-bottom: 1px solid #e8e8e8; }
    tbody td.center { text-align: center; }
    tbody td.right { text-align: right; }
    tbody tr:nth-child(even) { background: #f9f9fc; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 30px; }
    .totals-table { width: 280px; }
    .totals-table .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; color: #333; }
    .totals-table .row.total { border-top: 2px solid #16213e; padding-top: 12px; margin-top: 4px; font-size: 18px; font-weight: bold; color: #16213e; }
    .pay-section { text-align: center; margin: 30px 0; }
    .pay-button { display: inline-block; background: #0f3460; color: white; padding: 14px 40px; border-radius: 6px; text-decoration: none; font-size: 16px; font-weight: 600; letter-spacing: 0.5px; }
    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #e8e8e8; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="header">
    <div class="business-info">
      <h1>${escapeHtml(profile.businessName)}</h1>
      <p>${escapeHtml(profile.ownerName)}</p>
      ${businessAddress ? `<p>${businessAddress}</p>` : ''}
      <p>${escapeHtml(profile.phone)}</p>
      ${profile.licenseNumber ? `<p>License: ${escapeHtml(profile.licenseNumber)}</p>` : ''}
    </div>
    <div class="invoice-label">
      <h2>Invoice</h2>
      <p><strong>${escapeHtml(invoice.invoiceNumber)}</strong></p>
      <p>${invoiceDate}</p>
    </div>
  </div>

  <div class="details-section">
    <div class="bill-to">
      <h3>Bill To</h3>
      <p><strong>${escapeHtml(invoice.customerName)}</strong></p>
      ${invoice.customerPhone ? `<p>${escapeHtml(invoice.customerPhone)}</p>` : ''}
      ${invoice.customerEmail ? `<p>${escapeHtml(invoice.customerEmail)}</p>` : ''}
      ${invoice.serviceAddress ? `<p>${escapeHtml(invoice.serviceAddress)}</p>` : ''}
    </div>
    <div class="invoice-details">
      <h3>Invoice Details</h3>
      <p><strong>Invoice #:</strong> ${escapeHtml(invoice.invoiceNumber)}</p>
      <p><strong>Date:</strong> ${invoiceDate}</p>
    </div>
  </div>

  ${invoice.description ? `<div class="description"><strong>Description:</strong> ${escapeHtml(invoice.description)}</div>` : ''}

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="center">Type</th>
        <th class="center">Qty</th>
        <th class="right">Unit Price</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-table">
      <div class="row">
        <span>Subtotal</span>
        <span>${formatCurrency(invoice.subtotal)}</span>
      </div>
      ${invoice.taxRate > 0 ? `
      <div class="row">
        <span>Tax (${invoice.taxRate}%)</span>
        <span>${formatCurrency(invoice.taxAmount)}</span>
      </div>` : ''}
      <div class="row total">
        <span>Total</span>
        <span>${formatCurrency(invoice.total)}</span>
      </div>
    </div>
  </div>

  ${payButton}

  <div class="footer">
    <p>Thank you for your business!</p>
    <p>${escapeHtml(profile.businessName)} | ${escapeHtml(profile.phone)}</p>
  </div>
</body>
</html>`;
}

// ─── PDF generation (PDFKit — no browser needed) ────────────────────────────

export async function generateInvoicePdf(
  invoice: InvoiceForPdf,
  profile: ProfileForPdf
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 80; // 40px margin each side
    const invoiceDate = new Date(invoice.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // ── Header ──────────────────────────────────────────────────────────
    doc
      .fontSize(20)
      .fillColor(COLORS.primary)
      .text(profile.businessName, 40, 40);

    doc.fontSize(10).fillColor(COLORS.textLight);
    doc.text(profile.ownerName);

    const addressParts = [
      profile.addressLine1,
      profile.addressLine2,
      [profile.city, profile.state, profile.zip].filter(Boolean).join(', '),
    ].filter(Boolean);
    addressParts.forEach((line) => doc.text(line!));

    doc.text(profile.phone);
    if (profile.licenseNumber) {
      doc.text(`License: ${profile.licenseNumber}`);
    }

    // Invoice label — right-aligned
    doc
      .fontSize(24)
      .fillColor(COLORS.secondary)
      .text('INVOICE', 40, 40, { align: 'right' });
    doc
      .fontSize(11)
      .fillColor(COLORS.textLight)
      .text(invoice.invoiceNumber, { align: 'right' });
    doc.text(invoiceDate, { align: 'right' });

    // Header divider
    const headerBottom = doc.y + 10;
    doc
      .moveTo(40, headerBottom)
      .lineTo(40 + pageWidth, headerBottom)
      .lineWidth(2)
      .strokeColor(COLORS.primary)
      .stroke();

    let y = headerBottom + 20;

    // ── Bill To + Invoice Details ────────────────────────────────────────
    doc
      .fontSize(9)
      .fillColor(COLORS.secondary)
      .text('BILL TO', 40, y);
    y += 14;

    doc.fontSize(11).fillColor(COLORS.text).font('Helvetica-Bold');
    doc.text(invoice.customerName, 40, y);
    doc.font('Helvetica');
    y = doc.y;

    doc.fontSize(10).fillColor(COLORS.textLight);
    if (invoice.customerPhone) {
      doc.text(invoice.customerPhone, 40, y);
      y = doc.y;
    }
    if (invoice.customerEmail) {
      doc.text(invoice.customerEmail, 40, y);
      y = doc.y;
    }
    if (invoice.serviceAddress) {
      doc.text(invoice.serviceAddress, 40, y);
      y = doc.y;
    }

    y += 20;

    // ── Description ─────────────────────────────────────────────────────
    if (invoice.description) {
      doc
        .roundedRect(40, y, pageWidth, 30, 4)
        .fillColor(COLORS.bgLight)
        .fill();
      doc
        .fontSize(10)
        .fillColor(COLORS.text)
        .text(`Description: ${invoice.description}`, 50, y + 8, {
          width: pageWidth - 20,
        });
      y = doc.y + 15;
    }

    // ── Line items table ────────────────────────────────────────────────
    const colWidths = {
      desc: pageWidth * 0.35,
      type: pageWidth * 0.15,
      qty: pageWidth * 0.12,
      unit: pageWidth * 0.19,
      total: pageWidth * 0.19,
    };
    const colX = {
      desc: 40,
      type: 40 + colWidths.desc,
      qty: 40 + colWidths.desc + colWidths.type,
      unit: 40 + colWidths.desc + colWidths.type + colWidths.qty,
      total: 40 + colWidths.desc + colWidths.type + colWidths.qty + colWidths.unit,
    };
    const rowHeight = 28;

    // Table header
    doc.rect(40, y, pageWidth, rowHeight).fillColor(COLORS.primary).fill();
    doc.fontSize(8).fillColor(COLORS.white);
    doc.text('DESCRIPTION', colX.desc + 8, y + 9, { width: colWidths.desc - 16 });
    doc.text('TYPE', colX.type + 4, y + 9, { width: colWidths.type - 8, align: 'center' });
    doc.text('QTY', colX.qty + 4, y + 9, { width: colWidths.qty - 8, align: 'center' });
    doc.text('UNIT PRICE', colX.unit + 4, y + 9, { width: colWidths.unit - 8, align: 'right' });
    doc.text('TOTAL', colX.total + 4, y + 9, { width: colWidths.total - 8, align: 'right' });
    y += rowHeight;

    // Table rows
    invoice.lineItems.forEach((item, i) => {
      if (i % 2 === 1) {
        doc.rect(40, y, pageWidth, rowHeight).fillColor(COLORS.bgRow).fill();
      }

      doc.fontSize(9).fillColor(COLORS.text);
      doc.text(item.description, colX.desc + 8, y + 8, { width: colWidths.desc - 16 });
      doc.text(item.type, colX.type + 4, y + 8, { width: colWidths.type - 8, align: 'center' });
      doc.text(String(item.quantity), colX.qty + 4, y + 8, { width: colWidths.qty - 8, align: 'center' });
      doc.text(formatCurrency(item.unitPrice), colX.unit + 4, y + 8, { width: colWidths.unit - 8, align: 'right' });
      doc.text(formatCurrency(item.total), colX.total + 4, y + 8, { width: colWidths.total - 8, align: 'right' });

      // Bottom border
      doc
        .moveTo(40, y + rowHeight)
        .lineTo(40 + pageWidth, y + rowHeight)
        .lineWidth(0.5)
        .strokeColor(COLORS.gray)
        .stroke();

      y += rowHeight;
    });

    y += 15;

    // ── Totals ──────────────────────────────────────────────────────────
    const totalsX = 40 + pageWidth - 200;

    doc.fontSize(10).fillColor(COLORS.textLight);
    doc.text('Subtotal', totalsX, y, { width: 100 });
    doc.text(formatCurrency(invoice.subtotal), totalsX + 100, y, { width: 100, align: 'right' });
    y += 18;

    if (invoice.taxRate > 0) {
      doc.text(`Tax (${invoice.taxRate}%)`, totalsX, y, { width: 100 });
      doc.text(formatCurrency(invoice.taxAmount), totalsX + 100, y, { width: 100, align: 'right' });
      y += 18;
    }

    // Total divider
    doc
      .moveTo(totalsX, y)
      .lineTo(totalsX + 200, y)
      .lineWidth(1.5)
      .strokeColor(COLORS.primary)
      .stroke();
    y += 8;

    doc
      .fontSize(14)
      .fillColor(COLORS.primary)
      .font('Helvetica-Bold')
      .text('Total', totalsX, y, { width: 100 });
    doc.text(formatCurrency(invoice.total), totalsX + 100, y, { width: 100, align: 'right' });
    doc.font('Helvetica');
    y += 30;

    // ── Payment link ────────────────────────────────────────────────────
    if (invoice.paymentUrl) {
      doc
        .roundedRect(40 + pageWidth / 2 - 100, y, 200, 32, 4)
        .fillColor(COLORS.secondary)
        .fill();
      doc
        .fontSize(12)
        .fillColor(COLORS.white)
        .text(`Pay Now - ${formatCurrency(invoice.total)}`, 40, y + 9, {
          width: pageWidth,
          align: 'center',
          link: invoice.paymentUrl,
        });
      y += 50;
    }

    // ── Footer ──────────────────────────────────────────────────────────
    doc
      .moveTo(40, y)
      .lineTo(40 + pageWidth, y)
      .lineWidth(0.5)
      .strokeColor(COLORS.gray)
      .stroke();
    y += 12;

    doc
      .fontSize(9)
      .fillColor(COLORS.footerText)
      .text('Thank you for your business!', 40, y, { width: pageWidth, align: 'center' });
    doc.text(`${profile.businessName} | ${profile.phone}`, {
      width: pageWidth,
      align: 'center',
    });

    doc.end();
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
