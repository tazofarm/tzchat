// frontend/04210_Page2_target/Filter/Filter_listchat.js
// ------------------------------------------------------------
// 리스트/채팅 상대 제외 필터
// - 받은신청, 보낸신청, 친구, 차단, 채팅(신규 포함)에 들어있는 사용자를 제외
// - 다양한 백엔드/프론트 구조를 폭넓게 지원하는 ID 추출 유틸 포함
// ------------------------------------------------------------

function normId(v) {
  if (!v) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  return String(v._id || v.id || v.userId || v.user_id || '');
}

function toIdList(src) {
  const arr = Array.isArray(src) ? src : [];
  return arr.map(normId).filter(Boolean);
}

/** me 객체에서 가능한 모든 관계/채팅 ID들을 긁어모아 Set으로 반환 */
function collectRelationIdSet(me = {}) {
  const set = new Set();

  // --- 친구 ---
  // friends: [id|obj], friendIds: [id], relations?.friends: [id]
  [
    me.friends,
    me.friendIds,
    me.relations?.friends,
    me._relations?.friends,
  ].forEach(list => toIdList(list).forEach(id => set.add(id)));

  // --- 차단 ---
  // blocks: [id|obj], blockIds: [id], relations?.blocks: [id]
  [
    me.blocks,
    me.blockIds,
    me.relations?.blocks,
    me._relations?.blocks,
  ].forEach(list => toIdList(list).forEach(id => set.add(id)));

  // --- 받은/보낸 신청 ---
  // pendingRecv/pendingSent, requests.received/requests.sent, friendRequests.*
  [
    me.pendingRecv,
    me.pendingReceived,
    me.requests?.received,
    me.friendRequests?.received,
    me._relations?.pendingRecv,
  ].forEach(list => toIdList(list).forEach(id => set.add(id)));

  [
    me.pendingSent,
    me.requests?.sent,
    me.friendRequests?.sent,
    me._relations?.pendingSent,
  ].forEach(list => toIdList(list).forEach(id => set.add(id)));

  // --- 채팅 상대(신규 포함) ---
  // chatUserIds: [id], chatList: [{userId}], chats: [{participants:[...]}], recentChats
  [
    me.chatUserIds,
    me.recentChatUserIds,
    me._relations?.chatUserIds,
  ].forEach(list => toIdList(list).forEach(id => set.add(id)));

  const fromChatList = (Array.isArray(me.chatList) ? me.chatList : [])
    .map(c => c?.userId ?? c?.otherId ?? c?.peerId ?? c?.targetId)
    .map(normId)
    .filter(Boolean);
  fromChatList.forEach(id => set.add(id));

  const fromChatsParticipants = (Array.isArray(me.chats) ? me.chats : [])
    .flatMap(c => Array.isArray(c?.participants) ? c.participants : [])
    .map(normId)
    .filter(Boolean);
  fromChatsParticipants.forEach(id => set.add(id));

  const fromRecent = (Array.isArray(me.recentChats) ? me.recentChats : [])
    .map(c => c?.userId ?? c?.otherId ?? c?.peerId ?? c?.targetId)
    .map(normId)
    .filter(Boolean);
  fromRecent.forEach(id => set.add(id));

  return set;
}

/**
 * 리스트/채팅 제외 필터
 * @param {Array} users - 후보 유저 목록
 * @param {Object} me   - 내 유저 객체(여러 관계/채팅 필드를 허용)
 * @param {Object} [opt]
 * @param {boolean} [opt.log=false]
 */
export function filterByListChat(users, me, opt = {}) {
  const log = !!opt.log;
  const set = collectRelationIdSet(me);

  const myId = normId(me);
  if (myId) set.add(myId); // 혹시 몰라 자기 자신도 포함(중복 방지)

  const out = (Array.isArray(users) ? users : []).filter(u => {
    const uid = normId(u);
    const pass = uid && !set.has(uid);
    if (!pass && log) {
      console.log(`[ListChat] 제외: ${u?.nickname ?? uid} (${uid})`);
    }
    return pass;
  });

  if (log) {
    console.log(`[ListChat] 입력:${(users||[]).length} → 출력:${out.length} (제외:${(users||[]).length - out.length})`);
  }
  return out;
}
