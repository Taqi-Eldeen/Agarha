import { MockGateway, PaymobGateway } from './gateway';

describe('payment gateways', () => {
  it('mock gateway accepts only correctly signed webhooks', () => {
    const g = new MockGateway('secret', 'http://web');
    const body = JSON.stringify({ eventId: 'e1', invoiceId: 'i1', success: true, amountEgp: 500 });
    expect(g.parseWebhook({}, { 'x-mock-signature': g.sign(body) }, body)?.invoiceId).toBe('i1');
    expect(g.parseWebhook({}, { 'x-mock-signature': g.sign(body + ' ') }, body)).toBeNull();
    expect(g.parseWebhook({}, {}, body)).toBeNull();
  });

  it('paymob verifies the documented HMAC field order', () => {
    const secret = 'paymob-hmac';
    const g = new PaymobGateway('sk', 'pk', secret, [1]);
    const obj = {
      id: 99,
      amount_cents: 57000,
      created_at: '2026-09-25T10:00:00',
      currency: 'EGP',
      error_occured: false,
      has_parent_transaction: false,
      integration_id: 1,
      is_3d_secure: true,
      is_auth: false,
      is_capture: false,
      is_refunded: false,
      is_standalone_payment: true,
      is_voided: false,
      order: { id: 7, merchant_order_id: 'inv-1' },
      owner: 3,
      pending: false,
      source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' },
      success: true,
      special_reference: 'inv-1',
    };
    const raw = JSON.stringify({ type: 'TRANSACTION', obj });
    const ev = g.parseWebhook({ hmac: PaymobGateway.hmacOf(obj, secret) }, {}, raw);
    expect(ev).toMatchObject({ invoiceId: 'inv-1', success: true, amountEgp: 570 });
    expect(g.parseWebhook({ hmac: 'ab'.repeat(64) }, {}, raw)).toBeNull();
  });
});
