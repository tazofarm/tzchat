// /scripts/promoteMaster.js
// 사용법 예시:
//   node scripts/promoteMaster.js username=admin
//   node scripts/promoteMaster.js id=6520f3...abcd
//   node scripts/promoteMaster.js email=owner@domain.com
// 옵션:
//   role=master|admin (기본 master)
//   dryrun=1  (변경 미적용, 대상만 조회)
//   mongo=... (직접 연결문자열 지정; 없으면 환경변수 사용)
//
// 환경변수 우선순위:
//   MONGODB_URI > MONGO_URI > MONGO_URL > (mongo 옵션) > 기본값

require('dotenv').config();
const mongoose = require('mongoose');

const argv = Object.fromEntries(
  process.argv.slice(2).map(kv => {
    const i = kv.indexOf('=');
    return i === -1 ? [kv, true] : [kv.slice(0, i), kv.slice(i + 1)];
  })
);

// --- Mongo 연결문자열 결정 ---
const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MONGO_URL ||
  argv.mongo ||
  'mongodb://127.0.0.1:27017/tzchat';

console.log('[CFG] MONGO_URI =', MONGO_URI.replace(/\/\/([^@]+)@/, '//***@'));

// --- User 모델 로딩 (여러 경로 시도) ---
let User = null;
const candidates = [
  '../models/User',
  '../models/user/User',
  '../models/user',
  '../backend/models/User',
  '../backend/models/user/User',
  '../backend/models/user',
];
for (const p of candidates) {
  try {
    const mod = require(p);
    User = mod?.User || mod?.default || mod;
    if (User && typeof User.findOne === 'function') {
      console.log('[MODEL] Loaded User from', p);
      break;
    }
  } catch {}
}
if (!User) {
  console.error('[ERR] User 모델을 찾을 수 없습니다. models 경로를 확인하세요.');
  process.exit(2);
}

// --- 인자 파싱/검증 ---
const { username, id, email } = argv;
const roleArg = String(argv.role || 'master').toLowerCase();
const dryrun = argv.dryrun === '1' || argv.dryrun === 1 || argv.dryrun === true;

if (!username && !id && !email) {
  console.error('사용법: node scripts/promoteMaster.js username=<아이디> | id=<ObjectId> | email=<메일주소> [role=master|admin] [dryrun=1]');
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 조회 쿼리 구성
    const q = id
      ? { _id: id }
      : (username ? { username } : { email });

    const user = await User.findOne(q).lean();
    if (!user) {
      console.error('대상 사용자를 찾을 수 없습니다.', q);
      process.exit(3);
    }

    console.log('[TARGET]', {
      _id: String(user._id),
      username: user.username,
      email: user.email || null,
      role: user.role || null,
      roles: user.roles || null,
      isAdmin: user.isAdmin || false,
      isMaster: user.isMaster || false,
    });

    if (dryrun) {
      console.log('🧪 dryrun 모드: 변경 없이 종료합니다.');
      process.exit(0);
    }

    // 승격 업데이트: role 우선, 보조 플래그도 함께 세팅
    const update = {
      $set: { role: roleArg },
      $addToSet: { roles: roleArg }, // roles 배열이 있다면 보강
    };

    // owner/superadmin이 아닌 경우에도 관리자 플래그 보강
    if (roleArg === 'master' || roleArg === 'admin') {
      update.$set.isAdmin = true;
      if (roleArg === 'master') update.$set.isMaster = true;
    }

    const updated = await User.findByIdAndUpdate(user._id, update, { new: true });
    console.log('[OK] 승격 완료:', {
      _id: String(updated._id),
      username: updated.username,
      role: updated.role,
      roles: updated.roles || null,
      isAdmin: updated.isAdmin || false,
      isMaster: updated.isMaster || false,
    });
    process.exit(0);
  } catch (e) {
    console.error('[ERR]', e?.message || e);
    process.exit(9);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
