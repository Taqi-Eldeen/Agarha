// k6 load test at 5× the expected launch peak (section 11: ~50 req/s, no code changes).
//   k6 run -e API=https://api.staging.agarha.com load/k6/browse-and-contact.js
// Mix mirrors real traffic: mostly search and listing reads, a few leads. Thresholds are the API
// budgets: p95 < 300 ms for reads and < 600 ms for writes, < 1% errors.
import http from 'k6/http';
import { check } from 'k6';

const API = __ENV.API || 'http://localhost:4000';
const RATE = Number(__ENV.RATE || 50);
const DURATION = __ENV.DURATION || '5m';
const randomIntBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const CITIES = ['cairo', 'giza'];
const PERIODS = ['day', 'week', 'month'];

export const options = {
  scenarios: {
    peak: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{kind:read}': ['p(95)<300'],
    'http_req_duration{kind:write}': ['p(95)<600'],
  },
};

export function setup() {
  const r = http.get(`${API}/v1/search?city=cairo&limit=50`);
  const ids = r.json('items').map((i) => i.card.id);
  if (!ids.length) throw new Error('no listings to test against: seed the environment first');
  return { ids };
}

export default function ({ ids }) {
  const roll = Math.random();
  const id = ids[randomIntBetween(0, ids.length - 1)];
  const headers = { 'accept-language': Math.random() < 0.8 ? 'ar' : 'en' };
  if (roll < 0.55) {
    const city = CITIES[randomIntBetween(0, CITIES.length - 1)];
    const period = PERIODS[randomIntBetween(0, PERIODS.length - 1)];
    const r = http.get(`${API}/v1/search?city=${city}&period=${period}&limit=20`, {
      headers,
      tags: { kind: 'read', name: 'search' },
    });
    check(r, { 'search 200': (x) => x.status === 200 });
  } else if (roll < 0.9) {
    const r = http.get(`${API}/v1/listings/${id}`, {
      headers,
      tags: { kind: 'read', name: 'listing' },
    });
    check(r, { 'listing 200': (x) => x.status === 200 });
  } else if (roll < 0.97) {
    const r = http.get(`${API}/v1/catalog/cities`, {
      headers,
      tags: { kind: 'read', name: 'cities' },
    });
    check(r, { 'cities 200': (x) => x.status === 200 });
  } else {
    // Leads are rate-limited per IP in the API: expect 201 or 429 (both are correct behaviour).
    const r = http.post(
      `${API}/v1/leads`,
      JSON.stringify({ listingId: id, channel: 'whatsapp', locale: 'ar' }),
      {
        headers: {
          ...headers,
          'content-type': 'application/json',
          'idempotency-key': `${__VU}-${__ITER}-${Date.now()}`,
        },
        tags: { kind: 'write', name: 'lead' },
        responseCallback: http.expectedStatuses(201, 429),
      },
    );
    check(r, { 'lead created or limited': (x) => x.status === 201 || x.status === 429 });
  }
}
