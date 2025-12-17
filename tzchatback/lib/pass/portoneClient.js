// backend/lib/pass/portoneClient.js
const axios = require('axios');

const PORTONE_API_BASE = 'https://api.portone.io';
const PORTONE_V2_API_SECRET = process.env.PORTONE_V2_API_SECRET || '';

function authHeader() {
  if (!PORTONE_V2_API_SECRET) {
    const err = new Error('PORTONE_V2_API_SECRET is missing');
    err.code = 'ENV_MISSING';
    throw err;
  }
  // Authorization: PortOne MY_API_SECRET
  return { Authorization: `PortOne ${PORTONE_V2_API_SECRET}` };
}

async function getIdentityVerification(identityVerificationId) {
  const url = `${PORTONE_API_BASE}/identity-verifications/${encodeURIComponent(identityVerificationId)}`;
  const res = await axios.get(url, {
    headers: {
      ...authHeader(),
      'Content-Type': 'application/json',
    },
    timeout: 15000,
    validateStatus: () => true,
  });

  return { status: res.status, data: res.data };
}

module.exports = {
  getIdentityVerification,
};
