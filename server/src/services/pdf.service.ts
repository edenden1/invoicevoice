import puppeteer from 'puppeteer';
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

  const safeLogoUrl = isSafePublicUrl(profile.logoUrl) ? profile.logoUrl : null;

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
    .business-info h1 {
      font-size: 24px;
      color: #16213e;
      margin-bottom: 5px;
    }
    .business-info p {
      font-size: 13px;
      color: #555;
    }
    .invoice-label {
      text-align: right;
    }
    .invoice-label h2 {
      font-size: 28px;
      color: #0f3460;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .invoice-label p {
      font-size: 14px;
      color: #555;
      margin-top: 5px;
    }
    .details-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .bill-to h3, .invoice-details h3 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #0f3460;
      margin-bottom: 8px;
    }
    .bill-to p, .invoice-details p {
      font-size: 14px;
      color: #333;
    }
    .description {
      background: #f4f6fa;
      padding: 15px 20px;
      border-radius: 6px;
      margin-bottom: 25px;
      font-size: 14px;
      color: #333;
    }
    .description strong {
      color: #16213e;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
    }
    thead th {
      background: #16213e;
      color: white;
      padding: 12px 15px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: left;
    }
    thead th.center { text-align: center; }
    thead th.right { text-align: right; }
    tbody td {
      padding: 12px 15px;
      font-size: 14px;
      border-bottom: 1px solid #e8e8e8;
    }
    tbody td.center { text-align: center; }
    tbody td.right { text-align: right; }
    tbody tr:nth-child(even) { background: #f9f9fc; }
    .totals {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }
    .totals-table {
      width: 280px;
    }
    .totals-table .row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
      color: #333;
    }
    .totals-table .row.total {
      border-top: 2px solid #16213e;
      padding-top: 12px;
      margin-top: 4px;
      font-size: 18px;
      font-weight: bold;
      color: #16213e;
    }
    .pay-section {
      text-align: center;
      margin: 30px 0;
    }
    .pay-button {
      display: inline-block;
      background: #0f3460;
      color: white;
      padding: 14px 40px;
      border-radius: 6px;
      text-decoration: none;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .footer {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #e8e8e8;
      font-size: 12px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="business-info">
      ${safeLogoUrl ? `<img src="${escapeHtml(safeLogoUrl)}" alt="Logo" style="max-height:60px;margin-bottom:10px;">` : ''}
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

export async function generateInvoicePdf(
  invoice: InvoiceForPdf,
  profile: ProfileForPdf
): Promise<Buffer> {
  const html = generateInvoiceHtml(invoice, profile);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

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

// Prevent SSRF: only allow public HTTPS URLs with non-private hostnames.
// Puppeteer fetches <img src> during PDF rendering, so user-controlled URLs
// could probe internal services (metadata endpoints, localhost, LAN hosts).
function isSafePublicUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    // Block localhost and loopback
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    // Block link-local (AWS metadata, etc.)
    if (host.startsWith('169.254.')) return false;
    // Block RFC-1918 private ranges
    if (host.startsWith('10.')) return false;
    if (host.startsWith('192.168.')) return false;
    const match172 = host.match(/^172\.(\d+)\./);
    if (match172 && parseInt(match172[1], 10) >= 16 && parseInt(match172[1], 10) <= 31) return false;
    return true;
  } catch {
    return false;
  }
}
