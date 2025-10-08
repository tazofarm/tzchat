// routes/system/noticeRouter.js
// base: /api/notices
const express = require('express')
const router = express.Router()

const { Notice } = require('@/models')
const requireMaster = require('@/middlewares/requireMaster') // 마스터 가드

// ░░ helper: 요청에서 role=master 판별 (세션/JWT 하이브리드 호환) ░░
function isMasterFromReq(req) {
  const role =
    (req._urole && String(req._urole)) ||
    (req.auth?.role && String(req.auth.role)) ||
    (req.user?.role && String(req.user.role)) ||
    (req.session?.user?.role && String(req.session.user.role)) ||
    ''
  return role === 'master'
}

// 리스트 (공개)
// - 공개 글만 노출(마스터라도 기본 리스트는 공개 글만; 필요시 쿼리로 확장 가능)
router.get('/', async (req, res, next) => {
  try {
    const skip = Math.max(Number(req.query.skip || 0), 0)
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100)

    const q = { isPublished: true }
    const items = await Notice.find(q)
      .sort({ publishedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .select('_id title category publishedAt createdAt updatedAt')
      .lean()

    res.json({ items })
  } catch (e) {
    next(e)
  }
})

// 상세 (공개)
// - 일반 사용자는 공개 글만,
// - 마스터는 비공개 글도 열람 가능(수정/삭제를 위해)
router.get('/:id', async (req, res, next) => {
  try {
    const master = isMasterFromReq(req)
    const doc = await Notice.findById(req.params.id).lean()
    if (!doc) return res.status(404).json({ error: 'Not found' })

    if (!doc.isPublished && !master) {
      return res.status(404).json({ error: 'Not found' })
    }
    res.json({ notice: doc })
  } catch (e) {
    next(e)
  }
})

// 생성 (마스터)
router.post('/', requireMaster, async (req, res, next) => {
  try {
    const { title, content, category, publishedAt, isPublished } = req.body || {}

    if (!title || !content) {
      return res.status(400).json({ error: 'title and content are required' })
    }

    const doc = await Notice.create({
      title: String(title).trim(),
      content: String(content),
      category: category ? String(category).trim() : '',
      isPublished: isPublished !== false,
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
      author: req.user?._id || req.session?.user?._id || undefined,
    })
    res.status(201).json({ notice: doc })
  } catch (e) {
    next(e)
  }
})

// 수정 (마스터)
router.put('/:id', requireMaster, async (req, res, next) => {
  try {
    const { title, content, category, publishedAt, isPublished } = req.body || {}

    const patch = {}
    if (title != null) patch.title = String(title).trim()
    if (content != null) patch.content = String(content)
    if (category != null) patch.category = String(category).trim()
    if (isPublished != null) patch.isPublished = !!isPublished
    if (publishedAt != null) patch.publishedAt = new Date(publishedAt)

    const doc = await Notice.findByIdAndUpdate(req.params.id, patch, { new: true })
    if (!doc) return res.status(404).json({ error: 'Not found' })
    res.json({ notice: doc })
  } catch (e) {
    next(e)
  }
})

// 삭제 (마스터)
router.delete('/:id', requireMaster, async (req, res, next) => {
  try {
    const r = await Notice.findByIdAndDelete(req.params.id)
    if (!r) return res.status(404).json({ error: 'Not found' })
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

module.exports = router
