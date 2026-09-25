// Reads the latest OTP the API's mock SMS adapter "sent" (local/test only endpoint) into output.code.
const res = http.get(`${API_URL}/v1/dev/outbox?to=${encodeURIComponent(PHONE_E164)}`);
const items = json(res.body).items;
const match = items.length ? items[0].body.match(/\d{6}/) : null;
if (!match) throw new Error(`no code for ${PHONE_E164}`);
output.code = match[0];
