import { createHmac } from 'node:crypto';
import { hmac, safeEqualHex } from '../../common/crypto';

export interface CheckoutRequest {
  invoiceId: string;
  invoiceNumber: string;
  totalEgp: number;
  description: string;
  customer: { name: string; phone: string; email?: string };
  returnUrl: string;
  webhookUrl: string;
}
export interface Checkout {
  url: string;
  gatewayRef: string;
}
export interface PaymentEvent {
  eventId: string;
  invoiceId: string;
  gatewayRef: string;
  success: boolean;
  amountEgp: number;
  raw: unknown;
}

/** Payment gateway port (Paymob / Fawry / Kashier). Customers never pay through Agarha: dealers only. */
export interface PaymentGateway {
  readonly name: string;
  createCheckout(req: CheckoutRequest): Promise<Checkout>;
  /** Returns null if the signature is invalid. */
  parseWebhook(query: Record<string, string>, headers: Record<string, string | undefined>, rawBody: string): PaymentEvent | null;
}
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

/** Mock gateway: checkout is a page on our own web app; webhooks are HMAC-SHA256 signed with a local secret. */
export class MockGateway implements PaymentGateway {
  readonly name = 'mock';
  constructor(
    private readonly secret: string,
    private readonly webBase: string,
  ) {}
  async createCheckout(req: CheckoutRequest): Promise<Checkout> {
    return { url: `${this.webBase}/en/dealer/billing/mock-checkout?invoice=${req.invoiceId}&amount=${req.totalEgp}`, gatewayRef: `mock_${req.invoiceId}` };
  }
  sign(body: string): string {
    return hmac(this.secret, body);
  }
  parseWebhook(_q: Record<string, string>, headers: Record<string, string | undefined>, rawBody: string): PaymentEvent | null {
    const sig = headers['x-mock-signature'];
    if (!sig || !safeEqualHex(sig, this.sign(rawBody))) return null;
    const b = JSON.parse(rawBody) as { eventId: string; invoiceId: string; success: boolean; amountEgp: number };
    return { eventId: b.eventId, invoiceId: b.invoiceId, gatewayRef: `mock_${b.invoiceId}`, success: b.success, amountEgp: b.amountEgp, raw: b };
  }
}

/** Paymob Accept: Intention API + unified checkout; transaction callbacks verified with HMAC-SHA512. */
export class PaymobGateway implements PaymentGateway {
  readonly name = 'paymob';
  constructor(
    private readonly secretKey: string,
    private readonly publicKey: string,
    private readonly hmacSecret: string,
    private readonly integrationIds: number[],
  ) {}

  async createCheckout(req: CheckoutRequest): Promise<Checkout> {
    const [first, ...rest] = req.customer.name.split(' ');
    const res = await fetch('https://accept.paymob.com/v1/intention/', {
      method: 'POST',
      headers: { authorization: `Token ${this.secretKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        amount: req.totalEgp * 100,
        currency: 'EGP',
        payment_methods: this.integrationIds,
        items: [{ name: req.description.slice(0, 50), amount: req.totalEgp * 100, quantity: 1 }],
        billing_data: { first_name: first || 'Agarha', last_name: rest.join(' ') || 'Dealer', phone_number: req.customer.phone, email: req.customer.email ?? 'billing@agarha.com', country: 'EG' },
        special_reference: req.invoiceId,
        notification_url: req.webhookUrl,
        redirection_url: req.returnUrl,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`paymob intention failed: ${res.status}`);
    const body = (await res.json()) as { client_secret: string; id: string };
    return { url: `https://accept.paymob.com/unifiedcheckout/?publicKey=${this.publicKey}&clientSecret=${body.client_secret}`, gatewayRef: String(body.id) };
  }

  static readonly HMAC_FIELDS = [
    'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction', 'id', 'integration_id', 'is_3d_secure',
    'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment', 'is_voided', 'order.id', 'owner', 'pending',
    'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success',
  ];

  static hmacOf(obj: Record<string, unknown>, secret: string): string {
    const get = (path: string): unknown => path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
    const concat = PaymobGateway.HMAC_FIELDS.map((f) => String(get(f) ?? '')).join('');
    return createHmac('sha512', secret).update(concat).digest('hex');
  }

  parseWebhook(query: Record<string, string>, _h: Record<string, string | undefined>, rawBody: string): PaymentEvent | null {
    const body = JSON.parse(rawBody) as { type?: string; obj?: Record<string, unknown> & { id: number; success: boolean; amount_cents: number; special_reference?: string; order?: { id: number; merchant_order_id?: string } } };
    if (body.type !== 'TRANSACTION' || !body.obj || !query.hmac) return null;
    if (!safeEqualHex(query.hmac, PaymobGateway.hmacOf(body.obj, this.hmacSecret))) return null;
    const invoiceId = body.obj.special_reference ?? body.obj.order?.merchant_order_id;
    if (!invoiceId) return null;
    return { eventId: String(body.obj.id), invoiceId, gatewayRef: String(body.obj.order?.id ?? ''), success: body.obj.success === true, amountEgp: Math.round(body.obj.amount_cents / 100), raw: body };
  }
}
