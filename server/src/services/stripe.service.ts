import Stripe from 'stripe';
import { config } from '../config';
import { prisma } from '../config/database';

const stripe = new Stripe(config.stripe.secretKey);

export async function createConnectAccount(
  userId: string,
  email: string
): Promise<string> {
  const account = await stripe.accounts.create({
    type: 'express',
    email,
    metadata: { userId },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  await prisma.profile.update({
    where: { userId },
    data: { stripeAccountId: account.id },
  });

  return account.id;
}

export async function createOnboardingLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string
): Promise<string> {
  const link = await stripe.accountLinks.create({
    account: accountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: 'account_onboarding',
  });

  return link.url;
}

export async function createPaymentLink(
  invoice: {
    id: string;
    invoiceNumber: string;
    total: number;
    customerName: string;
    userId: string;
  },
  stripeAccountId: string
): Promise<{ paymentId: string; paymentUrl: string }> {
  const amountInCents = Math.round(invoice.total * 100);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    // Automatically enables Apple Pay, Google Pay, Link, ACH, and more
    // based on the customer's device, browser, and saved payment methods.
    automatic_payment_methods: { enabled: true },
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Invoice ${invoice.invoiceNumber}`,
            description: `Payment for services - ${invoice.customerName}`,
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: Math.round(
        amountInCents * (config.stripe.applicationFeePercent / 100)
      ),
      transfer_data: {
        destination: stripeAccountId,
      },
      metadata: {
        invoiceId: invoice.id,
        userId: invoice.userId,
      },
    },
    metadata: {
      invoiceId: invoice.id,
      userId: invoice.userId,
    },
    success_url: `${config.app.clientUrl}/invoice/${invoice.id}/paid`,
    cancel_url: `${config.app.clientUrl}/invoice/${invoice.id}`,
  });

  if (!session.url) {
    throw new Error('Stripe session created without a payment URL');
  }

  return {
    paymentId: session.id,
    paymentUrl: session.url,
  };
}

export async function retrieveAccount(accountId: string): Promise<Stripe.Account> {
  return stripe.accounts.retrieve(accountId);
}

// ─── Billing (InvoiceVoice subscription) ─────────────────────────────────────

export async function createBillingCustomer(
  userId: string,
  email: string,
  businessName: string
): Promise<string> {
  const customer = await stripe.customers.create({
    email,
    name: businessName,
    metadata: { userId },
  });

  await prisma.profile.update({
    where: { userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createBillingSubscription(
  customerId: string,
  userId: string
): Promise<void> {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: config.stripe.priceId }],
    trial_period_days: config.stripe.trialDays,
    metadata: { userId },
    // Stripe will email the customer before trial ends to collect payment method.
    // They can also add it via the Customer Portal.
  });

  await prisma.profile.update({
    where: { userId },
    data: {
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });
}

export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

export async function handleWebhook(
  payload: Buffer,
  signature: string
): Promise<void> {
  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    config.stripe.webhookSecret
  );

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoiceId;
      if (invoiceId && session.payment_status === 'paid') {
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

    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      if (account.charges_enabled && account.details_submitted) {
        await prisma.profile.updateMany({
          where: { stripeAccountId: account.id },
          data: { stripeOnboarded: true },
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      await prisma.profile.updateMany({
        where: { subscriptionId: sub.id },
        data: {
          subscriptionStatus: sub.status,
          trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        },
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await prisma.profile.updateMany({
        where: { subscriptionId: sub.id },
        data: { subscriptionStatus: 'canceled' },
      });
      break;
    }

    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice;
      const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
      if (customerId) {
        await prisma.profile.updateMany({
          where: { stripeCustomerId: customerId },
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
