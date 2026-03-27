import { prisma } from '../config/database';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { createPaymentLink } from './payme.service';
import { sendInvoiceSms } from './sms.service';
import { InvoiceStatus, LineItemType } from '@prisma/client';

interface CreateInvoiceData {
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  serviceAddress?: string | null;
  description?: string | null;
  customerId?: string | null;
  taxRate?: number;
  voiceTranscript?: string | null;
  lineItems: Array<{
    type: LineItemType;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

interface InvoiceFilters {
  status?: InvoiceStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export async function createInvoice(userId: string, data: CreateInvoiceData) {
  return prisma.$transaction(async (tx) => {
    // Atomic invoice number generation inside transaction
    const lastInvoice = await tx.invoice.findFirst({
      where: { userId },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    let invoiceNumber = 'INV-0001';
    if (lastInvoice) {
      const match = lastInvoice.invoiceNumber.match(/INV-(\d+)/);
      if (match) {
        const nextNumber = parseInt(match[1], 10) + 1;
        invoiceNumber = `INV-${String(nextNumber).padStart(6, '0')}`;
      }
    }

    // Verify customerId belongs to this user (prevent IDOR)
    if (data.customerId) {
      const customer = await tx.customer.findFirst({
        where: { id: data.customerId, userId },
        select: { id: true },
      });
      if (!customer) {
        throw new AppError('Customer not found', 404);
      }
    }

    const lineItemsWithTotal = data.lineItems.map((item) => ({
      ...item,
      total: Math.round(item.quantity * item.unitPrice * 100) / 100,
    }));

    const subtotal = Math.round(lineItemsWithTotal.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
    const taxRate = data.taxRate || 0;
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    const invoice = await tx.invoice.create({
      data: {
        userId,
        invoiceNumber,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        serviceAddress: data.serviceAddress,
        description: data.description,
        customerId: data.customerId,
        voiceTranscript: data.voiceTranscript,
        subtotal,
        taxRate,
        taxAmount,
        total,
        lineItems: {
          create: lineItemsWithTotal,
        },
      },
      include: {
        lineItems: true,
      },
    });

    return invoice;
  });
}

export async function getInvoices(userId: string, filters: InvoiceFilters) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { userId };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      (where.createdAt as Record<string, unknown>).gte = filters.startDate;
    }
    if (filters.endDate) {
      (where.createdAt as Record<string, unknown>).lte = filters.endDate;
    }
  }

  const [invoices, count] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { lineItems: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.invoice.count({ where }),
  ]);

  return {
    invoices,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  };
}

export async function getInvoiceById(invoiceId: string, userId?: string) {
  const where: Record<string, unknown> = { id: invoiceId };
  if (userId) {
    where.userId = userId;
  }

  const invoice = await prisma.invoice.findFirst({
    where,
    include: {
      lineItems: true,
      user: {
        include: { profile: true },
      },
    },
  });

  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  return invoice;
}

export async function updateInvoice(
  invoiceId: string,
  userId: string,
  data: Partial<CreateInvoiceData>
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findFirst({
      where: { id: invoiceId, userId },
    });

    if (!existing) {
      throw new AppError('Invoice not found', 404);
    }

    if (existing.status !== 'DRAFT') {
      throw new AppError('Only draft invoices can be edited', 400);
    }

    const updateData: Record<string, unknown> = {};

    if (data.customerName !== undefined) updateData.customerName = data.customerName;
    if (data.customerPhone !== undefined) updateData.customerPhone = data.customerPhone;
    if (data.customerEmail !== undefined) updateData.customerEmail = data.customerEmail;
    if (data.serviceAddress !== undefined) updateData.serviceAddress = data.serviceAddress;
    if (data.description !== undefined) updateData.description = data.description;

    if (data.lineItems) {
      // Delete old line items and create new ones inside transaction
      await tx.lineItem.deleteMany({ where: { invoiceId } });

      const lineItemsWithTotal = data.lineItems.map((item) => ({
        ...item,
        total: Math.round(item.quantity * item.unitPrice * 100) / 100,
      }));

      const subtotal = Math.round(lineItemsWithTotal.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
      const taxRate = data.taxRate ?? existing.taxRate;
      const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
      const total = Math.round((subtotal + taxAmount) * 100) / 100;

      updateData.subtotal = subtotal;
      updateData.taxRate = taxRate;
      updateData.taxAmount = taxAmount;
      updateData.total = total;
      updateData.lineItems = { create: lineItemsWithTotal };
    } else if (data.taxRate !== undefined) {
      const taxRate = data.taxRate;
      const taxAmount = Math.round(existing.subtotal * (taxRate / 100) * 100) / 100;
      const total = Math.round((existing.subtotal + taxAmount) * 100) / 100;
      updateData.taxRate = taxRate;
      updateData.taxAmount = taxAmount;
      updateData.total = total;
    }

    const invoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: updateData,
      include: { lineItems: true },
    });

    return invoice;
  });
}

export async function deleteInvoice(invoiceId: string, userId: string) {
  const existing = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
  });

  if (!existing) {
    throw new AppError('Invoice not found', 404);
  }

  if (existing.status !== 'DRAFT') {
    throw new AppError('Only draft invoices can be deleted', 400);
  }

  await prisma.invoice.delete({ where: { id: invoiceId } });
}

export async function sendInvoice(invoiceId: string, userId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: {
      lineItems: true,
      user: { include: { profile: true } },
    },
  });

  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  if (invoice.status !== 'DRAFT' && invoice.status !== 'SENT') {
    throw new AppError('Invoice cannot be sent in its current status', 400);
  }

  const profile = invoice.user.profile;
  if (!profile) {
    throw new AppError('Business profile not set up', 400);
  }

  // Public URL for the invoice (serves HTML via the public endpoint)
  const pdfUrl = `${config.app.baseUrl}/api/v1/invoices/public/${invoice.id}`;

  let paymentId: string | null = null;
  let paymentUrl: string | null = null;

  // Create payment link if PayMe is connected
  if (profile.paymeAccountId && profile.paymentOnboarded) {
    try {
      const paymentResult = await createPaymentLink(
        {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          total: invoice.total,
          customerName: invoice.customerName,
          userId: invoice.userId,
        },
        profile.paymeAccountId
      );
      paymentId = paymentResult.paymentId;
      paymentUrl = paymentResult.paymentUrl;
    } catch (error) {
      console.error('Failed to create payment link:', error);
      // Continue sending without payment link
    }
  }

  // Update invoice
  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'SENT',
      sentAt: invoice.sentAt || new Date(),
      pdfUrl,
      paymentId,
      paymentUrl,
    },
    include: { lineItems: true },
  });

  // Send SMS if customer phone is available
  if (invoice.customerPhone && config.twilio.accountSid) {
    try {
      const invoiceUrl = paymentUrl || pdfUrl;
      await sendInvoiceSms(
        invoice.customerPhone,
        profile.businessName,
        invoiceUrl,
        invoice.total
      );
    } catch (error) {
      console.error('Failed to send SMS:', error);
      // Don't fail the whole operation if SMS fails
    }
  }

  return { invoice: updatedInvoice };
}

export async function getDashboardStats(userId: string) {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const [revenueAgg, unpaidAgg, invoiceCount, paidCount, recentPaid] = await Promise.all([
    prisma.invoice.aggregate({
      where: { userId, status: 'PAID' },
      _sum: { total: true },
    }),
    prisma.invoice.aggregate({
      where: { userId, status: { in: ['SENT', 'VIEWED', 'OVERDUE'] } },
      _sum: { total: true },
    }),
    prisma.invoice.count({ where: { userId } }),
    prisma.invoice.count({ where: { userId, status: 'PAID' } }),
    prisma.invoice.findMany({
      where: { userId, status: 'PAID', paidAt: { gte: twelveMonthsAgo } },
      select: { paidAt: true, total: true },
    }),
  ]);

  const totalRevenue = revenueAgg._sum.total ?? 0;
  const unpaidAmount = unpaidAgg._sum.total ?? 0;

  const now = new Date();
  const monthlyRevenue: Array<{ month: string; revenue: number }> = [];

  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const monthLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

    const revenue = recentPaid
      .filter((inv) => inv.paidAt && inv.paidAt >= date && inv.paidAt <= monthEnd)
      .reduce((sum, inv) => sum + inv.total, 0);

    monthlyRevenue.push({ month: monthLabel, revenue });
  }

  return { totalRevenue, unpaidAmount, invoiceCount, paidCount, monthlyRevenue };
}

export async function markInvoicePaid(
  invoiceId: string,
  userId: string,
  paymentMethod: string
) {
  const existing = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
  });

  if (!existing) {
    throw new AppError('Invoice not found', 404);
  }

  if (existing.status === 'PAID') {
    throw new AppError('Invoice is already marked as paid', 400);
  }

  if (existing.status === 'CANCELLED') {
    throw new AppError('Cancelled invoices cannot be marked as paid', 400);
  }

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      paymentMethod,
    },
    include: { lineItems: true },
  });
}

const OVERDUE_DAYS = 30;

export async function markOverdueInvoices(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - OVERDUE_DAYS);

  const result = await prisma.invoice.updateMany({
    where: {
      status: { in: ['SENT', 'VIEWED'] },
      sentAt: { lt: cutoff },
    },
    data: { status: 'OVERDUE' },
  });

  return result.count;
}
