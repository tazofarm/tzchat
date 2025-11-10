// backend/routes/debug/passEnvRouter.js
const express = require('express');
const router = express.Router();

function mask(v) {
  if (!v) return '';
  const s = String(v);
  if (s.length <= 4) return '*'.repeat(s.length);
  return s.slice(0, 2) + '***' + s.slice(-2);
}

router.get('/pass-env', (req, res) => {
  const dev = (process.env.NODE_ENV || '').toLowerCase() !== 'production';
  res.json({
    NODE_ENV: process.env.NODE_ENV || '',
    DANAL_CPID: !!process.env.DANAL_CPID,
    DANAL_PWD: !!process.env.DANAL_PWD,
    PASS_CPID: !!process.env.PASS_CPID,
    PASS_PWD: !!process.env.PASS_PWD,
    DANAL_BASE_URL: process.env.DANAL_BASE_URL || '',
    CALLBACK_BASE: dev
      ? (process.env.PASS_CALLBACK_LOCAL || `http://localhost:${process.env.PORT || 2000}`)
      : (process.env.PASS_CALLBACK_PROD || process.env.API_ORIGIN || 'https://tzchat.tazocode.com'),
    // 안전을 위해 값은 마스킹하여 확인
    _preview: {
      DANAL_CPID: mask(process.env.DANAL_CPID || process.env.PASS_CPID || ''),
      DANAL_PWD:  mask(process.env.DANAL_PWD  || process.env.PASS_PWD  || '')
    }
  });
});

module.exports = router;
