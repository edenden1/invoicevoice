import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { transcribeAudio, extractInvoiceData } from '../services/ai.service';
import {
  createInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoice as updateInvoiceSvc,
  deleteInvoice as deleteInvoiceSvc,
  sendInvoice as sendInvoiceSvc,
  getDashboardStats,
  markInvoicePaid as markInvoicePaidSvc,
} from '../services/invoice.service';
import { prisma } from '../config/database';
import { generateInvoiceHtml } from '../services/pdf.service';
import { InvoiceStatus, LineItemType } from '@prisma/client';

const lineItemSchema = z.object({
  type: z.nativeEnum(LineItemType),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
});

const createInvoiceSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().optional().nullable(),
  customerEmail: z.string().email().optional().nullable(),
  serviceAddress: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  taxRate: z.number().min(0).max(100).optional(),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
});

const updateInvoiceSchema = z.object({
  customerName: z.string().min(1).optional(),
  customerPhone: z.string().optional().nullable(),
  customerEmail: z.string().email().optional().nullable(),
  serviceAddress: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  taxRate: z.number().min(0).max(100).optional(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
});

const uuidParamSchema = z.string().uuid('Invalid ID');

const listFiltersSchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export async function createFromVoice(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError('Audio file is required', 400);
    }

    const userId = req.user!.id;

    // Get user's trade type for context
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { tradeType: true },
    });

    if (!profile) {
      throw new AppError('Business profile not set up', 400);
    }

    // Transcribe audio
    const transcript = await transcribeAudio(req.file.path);

    // Extract structured data
    const extractedData = await extractInvoiceData(transcript, profile.tradeType);

    // Validate AI-extracted data through schema
    const validatedData = createInvoiceSchema.parse({
      customerName: extractedData.customerName || 'Customer',
      customerPhone: extractedData.customerPhone,
      serviceAddress: extractedData.serviceAddress,
      description: extractedData.description,
      lineItems: extractedData.lineItems.length > 0
        ? extractedData.lineItems
        : [{ type: 'OTHER', description: 'Service provided', quantity: 1, unitPrice: 0 }],
    });

    // Create draft invoice
    const invoice = await createInvoice(userId, {
      ...validatedData,
      voiceTranscript: transcript,
    });

    // Clean up temp file
    fs.unlink(req.file.path, () => {});

    res.status(201).json({
      invoice,
      transcript,
      extractedData,
    });
  } catch (error) {
    // Clean up temp file on error
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    next(error);
  }
}

export async function create(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = createInvoiceSchema.parse(req.body);
    const invoice = await createInvoice(req.user!.id, data);
    res.status(201).json({ invoice });
  } catch (error) {
    next(error);
  }
}

export async function getAll(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filters = listFiltersSchema.parse(req.query);
    const result = await getInvoices(req.user!.id, {
      status: filters.status,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      page: filters.page,
      limit: filters.limit,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = uuidParamSchema.parse(req.params.id);
    const invoice = await getInvoiceById(id, req.user!.id);
    res.json({ invoice });
  } catch (error) {
    next(error);
  }
}

export async function update(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = uuidParamSchema.parse(req.params.id);
    const data = updateInvoiceSchema.parse(req.body);
    const invoice = await updateInvoiceSvc(id, req.user!.id, data);
    res.json({ invoice });
  } catch (error) {
    next(error);
  }
}

export async function remove(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = uuidParamSchema.parse(req.params.id);
    await deleteInvoiceSvc(id, req.user!.id);
    res.json({ message: 'Invoice deleted' });
  } catch (error) {
    next(error);
  }
}

export async function send(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = uuidParamSchema.parse(req.params.id);
    const result = await sendInvoiceSvc(id, req.user!.id);
    res.json({ invoice: result.invoice });
  } catch (error) {
    next(error);
  }
}

export async function getPublicInvoice(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const idSchema = z.string().uuid('Invalid invoice ID');
    const invoiceId = idSchema.parse(req.params.id);

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        status: { in: ['SENT', 'VIEWED', 'PAID', 'OVERDUE'] },
      },
      include: {
        lineItems: true,
        user: { include: { profile: true } },
      },
    });

    if (!invoice || !invoice.user.profile) {
      throw new AppError('Invoice not found', 404);
    }

    // Mark as viewed if sent
    const displayStatus = invoice.status === 'SENT' ? 'VIEWED' : invoice.status;
    if (invoice.status === 'SENT') {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'VIEWED' },
      });
    }

    // Return HTML or JSON based on Accept header
    const invoiceForDisplay = { ...invoice, status: displayStatus };
    if (req.accepts('html')) {
      const html = generateInvoiceHtml(invoiceForDisplay, invoice.user.profile);
      res.type('html').send(html);
    } else {
      res.json({
        invoice: {
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customerName,
          description: invoice.description,
          lineItems: invoice.lineItems,
          subtotal: invoice.subtotal,
          taxRate: invoice.taxRate,
          taxAmount: invoice.taxAmount,
          total: invoice.total,
          status: displayStatus,
          paymentUrl: invoice.paymentUrl,
          createdAt: invoice.createdAt,
          business: {
            name: invoice.user.profile.businessName,
          },
        },
      });
    }
  } catch (error) {
    next(error);
  }
}

const markAsPaidSchema = z.object({
  paymentMethod: z.enum(['cash', 'check', 'venmo', 'zelle', 'paypal', 'bank_transfer', 'other']),
});

export async function markAsPaid(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = uuidParamSchema.parse(req.params.id);
    const { paymentMethod } = markAsPaidSchema.parse(req.body);
    const invoice = await markInvoicePaidSvc(id, req.user!.id, paymentMethod);
    res.json({ invoice });
  } catch (error) {
    next(error);
  }
}

export async function getStats(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stats = await getDashboardStats(req.user!.id);
    res.json({ stats });
  } catch (error) {
    next(error);
  }
}
