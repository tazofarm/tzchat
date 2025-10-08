// routes/system/accountDeletionRouter.js
// base: /api/account
const express = require('express');
const router = express.Router();

const requireLogin = require('@/middlewares/authMiddleware'); // 기존 프로젝트 기준
const { User } = require('@/models');
const retention = require('@/config/retention');

// ------------------------
// 유틸: 필드 적용 (fallback)
// ------------------------
function applyRequestDeletionFields(userDoc) {
  const days = retention?.DELETION_GRACE_DAYS ?? 14;
  const now = new Date();
  userDoc.status = 'pendingDeletion';
  userDoc.deletionRequestedAt = now;
  userDoc.deletionDueAt = new Date(now.getTime() + days * 86400000);
}
function applyCancelDeletionFields(userDoc) {
  userDoc.status = 'active';
  userDoc.deletionRequestedAt = null;
  userDoc.deletionDueAt = null;
}

// ------------------------
// GET /api/account/status
// 로그인 직후/앱 진입 시 계정 상태 확인 용도
// ------------------------
router.get('/status', requireLogin, async (req, res) => {
  try {
    const userId = req._uid || req.user?._id || req.auth?.userId || req.session?.user?._id;
    if (!userId) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

    const isPending = user.status === 'pendingDeletion';
    return res.json({
      ok: true,
      status: isPending ? 'pendingDeletion' : 'active',
      pendingDeletion: isPending
        ? {
            requestedAt: user.deletionRequestedAt || null,
            scheduledAt: user.deletionDueAt || null,
          }
        : null,
    });
  } catch (e) {
    console.error('[accountDeletionRouter] status error', e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// ------------------------
// POST /api/account/delete-request
// 탈퇴 신청
// ------------------------
router.post('/delete-request', requireLogin, async (req, res) => {
  try {
    const userId = req._uid || req.user?._id || req.auth?.userId || req.session?.user?._id;
    if (!userId) return res.status(401).json({ ok: false, message: 'Unauthorized' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

    if (user.status === 'pendingDeletion' || user.status === 'deleted') {
      return res.json({
        ok: true,
        message: 'Already requested',
        status: user.status,
        deletionDueAt: user.deletionDueAt || null,
      });
    }

    if (typeof user.requestDeletion === 'function') user.requestDeletion();
    else applyRequestDeletionFields(user);

    await user.save();
    return res.json({
      ok: true,
      message: 'Deletion pending',
      status: user.status,
      deletionDueAt: user.deletionDueAt || null,
    });
  } catch (e) {
    console.error('[accountDeletionRouter] delete-request error', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// ------------------------
// POST /api/account/cancel-delete
// 유예기간 내 탈퇴 신청 취소
// ------------------------
router.post('/cancel-delete', requireLogin, async (req, res) => {
  try {
    const userId = req._uid || req.user?._id || req.auth?.userId || req.session?.user?._id;
    if (!userId) return res.status(401).json({ ok: false, message: 'Unauthorized' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

    const now = new Date();
    const isInGrace =
      user.status === 'pendingDeletion' &&
      user.deletionDueAt instanceof Date &&
      user.deletionDueAt > now;

    if (!isInGrace) {
      return res.status(400).json({
        ok: false,
        message: 'Cancellation not allowed (not in pendingDeletion or grace period passed).',
        status: user.status,
        deletionDueAt: user.deletionDueAt || null,
      });
    }

    if (typeof user.cancelDeletion === 'function') user.cancelDeletion();
    else applyCancelDeletionFields(user);

    await user.save();
    return res.json({ ok: true, message: 'Deletion canceled', status: user.status });
  } catch (e) {
    console.error('[accountDeletionRouter] cancel-delete error', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

module.exports = router;
