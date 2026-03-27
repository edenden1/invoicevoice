import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

const openai = config.openai.apiKey
  ? new OpenAI({ apiKey: config.openai.apiKey })
  : null;

const anthropic = config.anthropic.apiKey
  ? new Anthropic({ apiKey: config.anthropic.apiKey })
  : null;

export interface InvoiceExtraction {
  customerName: string;
  customerPhone: string | null;
  serviceAddress: string | null;
  description: string;
  lineItems: Array<{
    type: 'LABOR' | 'MATERIAL' | 'FLAT_RATE' | 'OTHER';
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export async function transcribeAudio(filePath: string): Promise<string> {
  if (config.whisper.provider === 'openai') {
    return transcribeWithOpenAI(filePath);
  }
  return transcribeWithGroq(filePath);
}

async function transcribeWithOpenAI(filePath: string): Promise<string> {
  if (!openai) {
    throw new Error('OPENAI_API_KEY is required when WHISPER_PROVIDER is "openai"');
  }
  const fileStream = fs.createReadStream(filePath);
  try {
    const response = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: fileStream,
      language: 'en',
    });
    return response.text;
  } finally {
    fileStream.destroy();
  }
}

async function transcribeWithGroq(filePath: string): Promise<string> {
  if (!config.groq.apiKey) {
    throw new Error('GROQ_API_KEY is required when WHISPER_PROVIDER is "groq"');
  }

  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer]), fileName);
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'json');
  formData.append('language', 'en');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.groq.apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq Whisper API error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { text: string };
  return data.text;
}

export async function extractInvoiceData(
  transcript: string,
  tradeType: string
): Promise<InvoiceExtraction> {
  if (config.llmProvider === 'anthropic') {
    return extractWithAnthropic(transcript, tradeType);
  }
  return extractWithOpenAI(transcript, tradeType);
}

function buildExtractionPrompt(tradeType: string, tradeContext: string): string {
  return `You are an AI assistant that extracts structured invoice data from voice transcripts for tradespeople.

You specialize in ${tradeType} work. ${tradeContext}

Extract the following from the transcript:
- Customer name
- Customer phone number (if mentioned)
- Service/job address (if mentioned)
- Job description (brief summary of work performed)
- Line items: each item should have a type (LABOR, MATERIAL, FLAT_RATE, or OTHER), description, quantity, and unit price

Rules:
- If a price is mentioned as an hourly rate, set type to LABOR and quantity to hours worked
- If specific parts/materials are mentioned with prices, set type to MATERIAL
- If a flat fee for a service is mentioned, set type to FLAT_RATE with quantity 1
- If you can't determine the type, use OTHER
- Use reasonable default prices for common ${tradeType} items if prices aren't explicitly stated but items are mentioned
- Always include at least one line item even if details are sparse
- Quantities default to 1 if not specified
- If no customer name is given, use "Customer"

Return ONLY valid JSON matching this exact schema:
{
  "customerName": "string",
  "customerPhone": "string or null",
  "serviceAddress": "string or null",
  "description": "string",
  "lineItems": [
    {
      "type": "LABOR | MATERIAL | FLAT_RATE | OTHER",
      "description": "string",
      "quantity": number,
      "unitPrice": number
    }
  ]
}`;
}

async function extractWithAnthropic(
  transcript: string,
  tradeType: string
): Promise<InvoiceExtraction> {
  if (!anthropic) {
    throw new Error('ANTHROPIC_API_KEY is required when LLM_PROVIDER is "anthropic"');
  }

  const tradeContext = getTradeContext(tradeType);
  const systemPrompt = buildExtractionPrompt(tradeType, tradeContext);

  const response = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: 1024,
    temperature: 0.1,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Extract invoice data from this transcript:\n\n"${transcript}"`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  const content = textBlock?.text;
  if (!content) {
    throw new Error('Failed to extract invoice data from transcript');
  }

  return parseAndValidateExtraction(content);
}

async function extractWithOpenAI(
  transcript: string,
  tradeType: string
): Promise<InvoiceExtraction> {
  if (!openai) {
    throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER is "openai"');
  }

  const tradeContext = getTradeContext(tradeType);
  const systemPrompt = buildExtractionPrompt(tradeType, tradeContext);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.1,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Extract invoice data from this transcript:\n\n"${transcript}"`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Failed to extract invoice data from transcript');
  }

  return parseAndValidateExtraction(content);
}

function parseAndValidateExtraction(content: string): InvoiceExtraction {
  // Strip markdown code fences if present
  const jsonStr = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();

  let parsed: InvoiceExtraction;
  try {
    parsed = JSON.parse(jsonStr) as InvoiceExtraction;
  } catch {
    throw new Error('AI returned malformed data. Please try recording again.');
  }

  return {
    customerName: parsed.customerName || 'Customer',
    customerPhone: parsed.customerPhone || null,
    serviceAddress: parsed.serviceAddress || null,
    description: parsed.description || 'Service provided',
    lineItems: (parsed.lineItems || []).map((item) => ({
      type: (['LABOR', 'MATERIAL', 'FLAT_RATE', 'OTHER'].includes(item.type)
        ? item.type
        : 'OTHER') as 'LABOR' | 'MATERIAL' | 'FLAT_RATE' | 'OTHER',
      description: item.description || 'Service',
      quantity: Math.max(0, Number(item.quantity) || 1),
      unitPrice: Math.max(0, Number(item.unitPrice) || 0),
    })),
  };
}

function getTradeContext(tradeType: string): string {
  const contexts: Record<string, string> = {
    PLUMBING:
      'Common items include pipe fittings, water heaters, faucets, toilets, garbage disposals, drain cleaning, solder, PVC pipe, copper pipe, PEX tubing, shut-off valves, wax rings, supply lines, and P-traps. Labor rates typically range from $75-150/hour.',
    ELECTRICAL:
      'Common items include outlets, switches, circuit breakers, wire (Romex, THHN), conduit, junction boxes, light fixtures, ceiling fans, GFCI outlets, panels, dimmers, and wire nuts. Labor rates typically range from $75-150/hour.',
    HVAC:
      'Common items include filters, thermostats, refrigerant, capacitors, contactors, fan motors, compressors, ductwork, dampers, and coils. Labor rates typically range from $85-175/hour.',
    GENERAL_HANDYMAN:
      'Common items include drywall, paint, caulk, screws, nails, lumber, hinges, door hardware, weatherstripping, and general repair supplies. Labor rates typically range from $50-100/hour.',
    LOCKSMITH:
      'Common items include locks, deadbolts, key cylinders, strike plates, key blanks, smart locks, padlocks, and rekeying kits. Labor rates typically range from $50-100/hour plus service call fees.',
    PAINTING:
      'Common items include paint (gallons), primer, brushes, rollers, tape, drop cloths, caulk, spackle, and sandpaper. Labor rates typically range from $40-85/hour or per square foot pricing.',
    LANDSCAPING:
      'Common items include plants, mulch, soil, gravel, pavers, sod, fertilizer, edging, and irrigation supplies. Labor rates typically range from $45-85/hour.',
    CLEANING:
      'Common items include deep cleaning, standard cleaning, move-out cleaning, carpet cleaning, and window cleaning. Rates typically range from $30-75/hour or flat rates per room/property.',
    APPLIANCE_REPAIR:
      'Common items include parts (motors, belts, seals, thermostats, heating elements, pumps, valves), diagnostic fees, and service call fees. Labor rates typically range from $75-125/hour.',
    OTHER:
      'Extract prices and descriptions as accurately as possible from the transcript.',
  };

  return contexts[tradeType] || contexts['OTHER'];
}
