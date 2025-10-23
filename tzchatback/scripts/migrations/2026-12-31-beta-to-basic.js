#!/usr/bin/env node
/**
 * 베타 종료 마이그레이션 스크립트
 * ------------------------------------------------------------
 * 목적: user_level 이 '베타회원' 인 모든 사용자 → '일반회원' 으로 일괄 전환
 * 실행: node scripts/migrations/2026-12-31-beta-to-basic.js [--dry-run]
 *
 * 환경변수:
 *  - MONGO_URL (예: mongodb://127.0.0.1:27017/tzchat)
 *  - NODE_ENV (정보 출력용)
 *
 * 옵션:
 *  --dry-run  실제 업데이트하지 않고 변경 대상 건수만 출력
 *
 * 참고:
 *  - 스키마 상 user_level enum: ['베타회원','일반회원','라이트회원','프리미엄회원']
 *  - 실행 후 새 가입자의 기본값은 코드에서 '일반회원'로 변경해 배포하세요.
 */

const mongoose = require('mongoose');
const path = require('path');

// 모델 로딩 (models/index.js가 모든 모델을 등록)
require(path.resolve(__dirname, '../../models'));

const { User } = require(path.resolve(__dirname, '../../models'));

const BETA = '베타회원';
const BASIC = '일반회원';

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
  };
}

async function main() {
  const { dryRun } = parseArgs();
  const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/tzchat';
  const env = process.env.NODE_ENV || 'development';

  console.log('────────────────────────────────────────────────────────');
  console.log('🛠  베타 종료 마이그레이션 시작 (베타회원 → 일반회원)');
  console.log(`• NODE_ENV  : ${env}`);
  console.log(`• MONGO_URL : ${mongoUrl}`);
  console.log(`• dry-run   : ${dryRun ? 'YES (미적용)' : 'NO (실제 적용)'}`);
  console.log('────────────────────────────────────────────────────────');

  try {
    await mongoose.connect(mongoUrl, {
      autoIndex: false, // 마이그레이션 중 인덱스 생성 방지
    });

    // 대상 카운트 집계
    const match = { user_level: BETA };
    const totalCount = await User.countDocuments(match);
    console.log(`🔎 변경 대상 수: ${totalCount.toLocaleString()}명`);

    if (totalCount === 0) {
      console.log('✅ 변경할 대상이 없습니다. 종료합니다.');
      return;
    }

    if (dryRun) {
      console.log('🧪 dry-run 모드이므로 DB 업데이트는 수행하지 않습니다.');
      return;
    }

    // 실제 업데이트
    const now = new Date();
    const result = await User.updateMany(match, {
      $set: { user_level: BASIC, updatedAt: now },
    });

    // 결과 출력
    // (주의: MongoDB 드라이버/버전에 따라 matchedCount/modifiedCount 제공 방식 차이 가능)
    const matched = result.matchedCount ?? result.nMatched ?? 0;
    const modified = result.modifiedCount ?? result.nModified ?? 0;

    console.log('────────────────────────────────────────────────────────');
    console.log(`📦 matched : ${matched.toLocaleString()}명`);
    console.log(`✍️  modified: ${modified.toLocaleString()}명`);
    console.log('────────────────────────────────────────────────────────');
    console.log('✅ 마이그레이션 완료');

  } catch (err) {
    console.error('❌ 마이그레이션 중 오류 발생:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

if (require.main === module) {
  main();
}
