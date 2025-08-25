// backend/routes/supportRouter.js
// ---------------------------------------------
// 공개 지원 라우터(로그인 불필요)
// - POST /api/public-delete-request : 계정 삭제 요청 접수
//   * 최소 유효성 검사 + 간단한 레이트 리밋(메모리)
//   * 저장 후 운영자 처리(수동/자동)에 넘김
// ---------------------------------------------
const express = require('express')
const router = express.Router()
const DeletionRequest = require('../models/DeletionRequest')

// 간단 레이트리밋(메모리) - IP당 n초에 1회
const RATE_WINDOW_MS = 30 * 1000
const lastHitMap = new Map()

router.post('/public-delete-request', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || ''
    const now = Date.now()
    const last = lastHitMap.get(ip) || 0
    if (now - last < RATE_WINDOW_MS) {
      console.warn('[PublicDelete] rate-limit ip=', ip)
      return res.status(429).json({ error: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' })
    }
    lastHitMap.set(ip, now)

    const { username, email = '', note = '' } = req.body || {}
    if (!username || typeof username !== 'string') {
      console.log('[PublicDelete] invalid username', req.body)
      return res.status(400).json({ error: '아이디는 필수입니다.' })
    }

    const doc = await DeletionRequest.create({
      username: username.trim(),
      email: (email || '').trim(),
      note: (note || '').trim(),
      ip,
      ua: req.headers['user-agent'] || ''
    })

    console.log('[PublicDelete] received', {
      id: doc._id.toString(),
      username: doc.username,
      email: doc.email,
      ip: doc.ip
    })

    // TODO(운영 선택): 이메일/슬랙 알림, 1회용 코드 발송 등 후속 처리
    return res.json({ message: '삭제 요청이 접수되었습니다. 확인 후 처리 예정입니다.' })
  } catch (err) {
    console.error('[PublicDelete] error', err)
    return res.status(500).json({ error: '요청 처리 중 오류가 발생했습니다.' })
  }
})

module.exports = router
