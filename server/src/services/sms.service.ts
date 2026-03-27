import Twilio from 'twilio';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { formatCurrency } from '../utils/helpers';

let twilioClient: Twilio.Twilio | null = null;

function getClient(): Twilio.Twilio {
  if (!twilioClient) {
    if (!config.twilio.accountSid || !config.twilio.authToken) {
      throw new AppError('SMS service is not configured', 503);
    }
    twilioClient = Twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  return twilioClient;
}

export async function sendInvoiceSms(
  to: string,
  businessName: string,
  invoiceUrl: string,
  amount: number
): Promise<void> {
  const client = getClient();

  const formattedAmount = formatCurrency(amount);
  const body = `Hi! ${businessName} sent you an invoice for ${formattedAmount}. View & pay here: ${invoiceUrl}`;

  await client.messages.create({
    to,
    from: config.twilio.phoneNumber,
    body,
  });
}
