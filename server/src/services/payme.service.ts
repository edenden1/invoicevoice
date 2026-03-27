import crypto from 'crypto';
import { config } from '../config';
import { prisma } from '../config/database';

const PAYME_BASE_URL =
  config.payme.environment === 'sandbox'
    ? 'https://preprod.paymeservice.com/api'
    : 'https://ng.paymeservice.com/api';

// ─── Helpers ────────────────────────────────────────────────────────────────

function isDemoMode(): boolean {
  return config.demoMode;
}

function demoId(): string {
  return `demo_${crypto.randomUUID().slice(0, 8)}`;
}

async function paymeRequest<T = unknown>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${PAYME_BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seller_payme_id: config.payme.sellerKey,
      ...body,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayMe API error (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Marketplace — Merchant onboarding ──────────────────────────────────────

export async function createMerchantAccount(
  userId: string,
  email: string
): Promise<string> {
  if (isDemoMode()) {
    const accountId = demoId();
    await prisma.profile.update({
      where: { userId },
      data: { paymeAccountId: accountId },
    });
    return accountId;
  }

  const result = await paymeRequest<{ seller_payme_id: string }>(
    'create-seller',
    {
      seller_email: email,
      seller_return_url: `${config.app.scheme}://payme-callback`,
      metadata: { userId },
    }
  );

  const accountId = result.seller_payme_id;

  await prisma.profile.update({
    where: { userId },
    data: { paymeAccountId: accountId },
  });

  return accountId;
}

export async function createOnboardingLink(
  accountId: string,
  returnUrl: string,
  _refreshUrl: string
): Promise<string> {
  if (isDemoMode()) {
    // In demo mode, skip external onboarding — redirect straight to the callback
    return returnUrl;
  }

  const result = await paymeRequest<{ onboarding_url: string }>(
    'onboard-seller',
    {
      seller_id: accountId,
      return_url: returnUrl,
      language: 'he',
    }
  );

  return result.onboarding_url;
}

export async function retrieveAccount(
  accountId: string
): Promise<{ active: boolean; verified: boolean }> {
  if (isDemoMode()) {
    // In demo mode, merchant is always verified
    return { active: true, verified: true };
  }

  const result = await paymeRequest<{
    seller_status: string;
    is_verified: boolean;
  }>('get-seller-status', {
    seller_id: accountId,
  });

  return {
    active: result.seller_status === 'active',
    verified: result.is_verified,
  };
}

// ─── Payment link (customer paying a tradesperson's invoice) ────────────────

export async function createPaymentLink(
  invoice: {
    id: string;
    invoiceNumber: string;
    total: number;
    customerName: string;
    userId: string;
  },
  paymeAccountId: string
): Promise<{ paymentId: string; paymentUrl: string }> {
  if (isDemoMode()) {
    // In demo mode, the payment URL points to the public invoice page
    return {
      paymentId: demoId(),
      paymentUrl: `${config.app.clientUrl}/invoice/${invoice.id}/paid`,
    };
  }

  // PayMe amounts are in agorot (ILS cents)
  const amountInAgorot = Math.round(invoice.total * 100);
  const applicationFee = Math.round(
    amountInAgorot * (config.payme.applicationFeePercent / 100)
  );

  const result = await paymeRequest<{
    payme_sale_id: string;
    sale_url: string;
  }>('generate-sale', {
    sale_price: amountInAgorot,
    currency: 'ILS',
    product_name: `Invoice ${invoice.invoiceNumber}`,
    sale_description: `Payment for services - ${invoice.customerName}`,
    seller_id: paymeAccountId,
    platform_fee: applicationFee,
    sale_callback_url: `${config.app.baseUrl}/api/v1/webhooks/payme`,
    sale_return_url: `${config.app.clientUrl}/invoice/${invoice.id}/paid`,
    sale_cancel_url: `${config.app.clientUrl}/invoice/${invoice.id}`,
    sale_type: 'sale',
    metadata: {
      invoiceId: invoice.id,
      userId: invoice.userId,
    },
    // Enable all available payment methods
    installments: 1,
    language: 'he',
  });

  return {
    paymentId: result.payme_sale_id,
    paymentUrl: result.sale_url,
  };
}

// ─── Billing (InvoiceVoice subscription) ────────────────────────────────────

export async function createBillingCustomer(
  userId: string,
  email: string,
  businessName: string
): Promise<string> {
  if (isDemoMode()) {
    const customerId = demoId();
    await prisma.profile.update({
      where: { userId },
      data: { paymeCustomerId: customerId },
    });
    return customerId;
  }

  const result = await paymeRequest<{ buyer_key: string }>(
    'create-buyer',
    {
      buyer_email: email,
      buyer_name: businessName,
      metadata: { userId },
    }
  );

  const customerId = result.buyer_key;

  await prisma.profile.update({
    where: { userId },
    data: { paymeCustomerId: customerId },
  });

  return customerId;
}

export async function createBillingSubscription(
  customerId: string,
  userId: string
): Promise<void> {
  if (isDemoMode()) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + config.payme.trialDays);

    const periodEnd = new Date(trialEnd);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await prisma.profile.update({
      where: { userId },
      data: {
        subscriptionId: demoId(),
        subscriptionStatus: 'trialing',
        trialEndsAt: trialEnd,
        currentPeriodEnd: periodEnd,
      },
    });
    return;
  }

  const result = await paymeRequest<{
    subscription_id: string;
    subscription_status: string;
    trial_end: string | null;
    current_period_end: string;
  }>('create-subscription', {
    buyer_key: customerId,
    plan_id: config.payme.subscriptionPlanId,
    trial_days: config.payme.trialDays,
    metadata: { userId },
  });

  await prisma.profile.update({
    where: { userId },
    data: {
      subscriptionId: result.subscription_id,
      subscriptionStatus: result.subscription_status,
      trialEndsAt: result.trial_end ? new Date(result.trial_end) : null,
      currentPeriodEnd: new Date(result.current_period_end),
    },
  });
}

export async function createSubscriptionPortalUrl(
  customerId: string,
  returnUrl: string
): Promise<string> {
  if (isDemoMode()) {
    // In demo mode, just redirect back to the app
    return returnUrl;
  }

  // PayMe doesn't have a built-in portal like Stripe.
  // Use their subscription management page or generate a management link.
  const result = await paymeRequest<{ manage_url: string }>(
    'subscription-manage-link',
    {
      buyer_key: customerId,
      return_url: returnUrl,
    }
  );

  return result.manage_url;
}

// ─── Webhook handling ───────────────────────────────────────────────────────

interface PaymeWebhookPayload {
  notification_type: string;
  payme_sale_id?: string;
  sale_status?: string;
  seller_id?: string;
  seller_status?: string;
  is_verified?: boolean;
  subscription_id?: string;
  subscription_status?: string;
  trial_end?: string | null;
  current_period_end?: string;
  buyer_key?: string;
  metadata?: Record<string, string>;
}

export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  if (isDemoMode()) {
    return true;
  }

  const expected = crypto
    .createHmac('sha256', config.payme.webhookSecret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

export async function handleWebhook(
  payload: string,
  signature: string
): Promise<void> {
  if (!verifyWebhookSignature(payload, signature)) {
    throw new Error('Invalid webhook signature');
  }

  const event: PaymeWebhookPayload = JSON.parse(payload);

  switch (event.notification_type) {
    // Customer paid an invoice
    case 'sale-complete': {
      const invoiceId = event.metadata?.invoiceId;
      if (invoiceId && event.sale_status === 'completed') {
        await prisma.invoice.updateMany({
          where: { id: invoiceId, status: { not: 'PAID' } },
          data: {
            status: 'PAID',
            paidAt: new Date(),
          },
        });
      }
      break;
    }

    // Merchant onboarding completed
    case 'seller-status-update': {
      if (event.seller_id && event.seller_status === 'active' && event.is_verified) {
        await prisma.profile.updateMany({
          where: { paymeAccountId: event.seller_id },
          data: { paymentOnboarded: true },
        });
      }
      break;
    }

    // Subscription status changed
    case 'subscription-update': {
      if (event.subscription_id && event.subscription_status) {
        await prisma.profile.updateMany({
          where: { subscriptionId: event.subscription_id },
          data: {
            subscriptionStatus: event.subscription_status,
            trialEndsAt: event.trial_end ? new Date(event.trial_end) : undefined,
            currentPeriodEnd: event.current_period_end
              ? new Date(event.current_period_end)
              : undefined,
          },
        });
      }
      break;
    }

    // Subscription canceled
    case 'subscription-canceled': {
      if (event.subscription_id) {
        await prisma.profile.updateMany({
          where: { subscriptionId: event.subscription_id },
          data: { subscriptionStatus: 'canceled' },
        });
      }
      break;
    }

    // Payment failed for subscription renewal
    case 'subscription-payment-failed': {
      const buyerKey = event.buyer_key;
      if (buyerKey) {
        await prisma.profile.updateMany({
          where: { paymeCustomerId: buyerKey },
          data: { subscriptionStatus: 'past_due' },
        });
      }
      break;
    }

    default:
      // Unhandled event type — ignore
      break;
  }
}
