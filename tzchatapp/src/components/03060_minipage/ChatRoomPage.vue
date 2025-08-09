<template>
  <div class="chatroom-container">
    <!-- 상단바 -->
    <div class="chatroom-header">
      <ion-button size="small" fill="clear" @click="goBack">←</ion-button>
      <span class="chat-title" @click="goToPartnerProfile">{{ partnerNickname }}</span>
    </div>

    <!-- 메시지 리스트 -->
    <div class="chat-messages" ref="chatScroll">
      <div
        v-for="msg in messages"
        :key="msg._id"
        class="message-row"
        :class="{ mine: msg.sender && msg.sender._id === myId }"
      >
        <template v-if="msg.sender && msg.sender._id === myId">
          <div class="my-message">
            <span class="time">{{ formatTime(msg.createdAt) }}</span>
            <div class="bubble">
              <template v-if="msg.imageUrl">
                <img :src="getImageUrl(msg.imageUrl)" class="chat-image" @click="openImage(getImageUrl(msg.imageUrl))" />
              </template>
              <template v-else>
                {{ msg.content }}
              </template>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="other-message">
            <div class="bubble">
              <template v-if="msg.imageUrl">
                <img :src="getImageUrl(msg.imageUrl)" class="chat-image" @click="openImage(getImageUrl(msg.imageUrl))" />
              </template>
              <template v-else>
                {{ msg.content }}
              </template>
            </div>
            <span class="time">{{ formatTime(msg.createdAt) }}</span>
          </div>
        </template>
      </div>
    </div>

    <!-- 입력창 -->
    <div class="chat-input-wrapper">
      <div v-if="showEmoji" class="emoji-picker-wrapper">
        <emoji-picker @emoji-click="insertEmoji"></emoji-picker>
      </div>
      <div class="chat-input">
        <ion-button size="small" fill="outline" @click="triggerFileInput">📎</ion-button>
        <input type="file" accept="image/*" ref="fileInput" style="display: none" @change="uploadImage" />
        <ion-button size="small" fill="outline" @click="toggleEmoji">😊</ion-button>
        <textarea
          v-model="newMessage"
          placeholder="메시지를 입력하세요"
          @keydown="handleKeydown"
          rows="1"
        ></textarea>
        <ion-button size="small" color="primary" @click="sendMessage">전송</ion-button>
      </div>
    </div>

    <!-- ✅ 이미지 확대 팝업 -->
    <transition name="fade">
      <div v-if="enlargedImage" class="image-modal">
        <div class="image-wrapper">
          <button class="close-button" @click="enlargedImage = ''">×</button>
          <img :src="enlargedImage" class="modal-image" @click.stop />
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { IonButton } from '@ionic/vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '@/lib/axiosInstance'
import { io } from 'socket.io-client'
import 'emoji-picker-element'

const socket = io('http://localhost:2000', { withCredentials: true })
const route = useRoute()
const router = useRouter()
const roomId = route.params.id

const myId = ref('')
const partnerId = ref('')
const partnerNickname = ref('상대방')
const messages = ref([])
const newMessage = ref('')
const chatScroll = ref(null)
const showEmoji = ref(false)
const fileInput = ref(null)

const enlargedImage = ref('')
const openImage = (url) => { enlargedImage.value = url }

const getImageUrl = (path) => path?.startsWith('http') ? path : `http://localhost:2000${path}`

const loadMessages = async () => {
  try {
    const res = await axios.get(`/api/chatrooms/${roomId}`)
    messages.value = res.data.messages || []
    myId.value = res.data.myId
    const partner = res.data.participants.find(p => p._id !== myId.value)
    partnerNickname.value = partner?.nickname || '상대방'
    partnerId.value = partner?._id || ''
    scrollToBottom()
  } catch (err) {
    console.error('❌ 메시지 불러오기 실패:', err)
  }
}

const sendMessage = async () => {
  if (!newMessage.value.trim()) return
  try {
    const res = await axios.post(`/api/chatrooms/${roomId}/message`, {
      content: newMessage.value,
      type: 'text'
    })
    newMessage.value = ''
    socket.emit('chatMessage', { roomId, message: res.data })
  } catch (err) {
    console.error('❌ 텍스트 메시지 전송 실패:', err)
  }
}

const uploadImage = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  const formData = new FormData()
  formData.append('image', file)

  try {
    const uploadRes = await axios.post('/api/chatrooms/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      withCredentials: true
    })
    const imageUrl = uploadRes.data.imageUrl
    const messageRes = await axios.post(`/api/chatrooms/${roomId}/message`, {
      content: imageUrl,
      type: 'image'
    }, { withCredentials: true })
    socket.emit('chatMessage', { roomId, message: messageRes.data })
  } catch (err) {
    console.error('❌ 이미지 업로드 실패:', err)
  }
}

const handleKeydown = (e) => {
  if (e.key === 'Enter') {
    if (e.shiftKey) return
    e.preventDefault()
    sendMessage()
  }
}

const triggerFileInput = () => fileInput.value.click()
const insertEmoji = (event) => newMessage.value += event.detail.unicode
const toggleEmoji = () => showEmoji.value = !showEmoji.value
const formatTime = (isoString) => new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const scrollToBottom = async () => {
  await nextTick()
  if (chatScroll.value) {
    chatScroll.value.scrollTop = chatScroll.value.scrollHeight
  }
}

onMounted(async () => {
  await loadMessages()
  socket.emit('joinRoom', roomId)
  socket.on('chatMessage', (msg) => {
    const message = msg.message || msg
    if (msg.chatRoom === roomId || msg.chatRoom?._id === roomId) {
      messages.value.push(message)
      scrollToBottom()
    }
  })
})

onBeforeUnmount(() => {
  socket.emit('leaveRoom', roomId)
  socket.off('chatMessage')
  socket.disconnect()
})

const goBack = () => router.push('/home/4page')
const goToPartnerProfile = () => {
  if (partnerId.value) {
    router.push(`/home/user/${partnerId.value}`)
  }
}
</script>

<style scoped>
.chatroom-container { display: flex; flex-direction: column; height: 80vh; background: #fefefe; color: black; }
.chatroom-header { display: flex; align-items: center; padding: 0.5rem 1rem; background: #f1f1f1; border-bottom: 1px solid #ddd; font-weight: bold; color: black; }
.chat-title { margin-left: 0.5rem; cursor: pointer; text-decoration: underline; }
.chat-messages { flex: 1; overflow-y: auto; padding: 1rem; background: #fafafa; }
.message-row { margin-bottom: 0.5rem; }
.other-message, .my-message { display: flex; align-items: flex-end; }
.other-message { justify-content: flex-start; }
.my-message { justify-content: flex-end; }
.bubble {
  max-width: 70%; padding: 0.5rem 0.8rem; border-radius: 12px;
  background-color: #e0e0e0; color: black; word-break: break-word; white-space: pre-wrap;
}
.my-message .bubble { background-color: #d2f1ff; }
.time { font-size: 0.7rem; color: gray; white-space: nowrap; margin: 0 0.4rem; }
.chat-input-wrapper { position: relative; background: white; }
.chat-input {
  display: flex; padding: 0.5rem; border-top: 1px solid #ccc;
  background: white; align-items: flex-end;
}
.chat-input textarea {
  flex: 1; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;
  margin: 0 0.5rem; font-size: 0.85rem; background-color: black; color: white;
  resize: none; line-height: 1.4; min-height: 32px; max-height: 100px;
}
.chat-input textarea::placeholder { color: #ccc; }
.emoji-picker-wrapper {
  position: absolute; bottom: 3.5rem; left: 0.5rem; z-index: 999;
  background: white; border: 1px solid #ccc; border-radius: 10px;
  overflow: hidden; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
}
emoji-picker { width: 300px; max-height: 400px; }
.chat-image { max-width: 150px; max-height: 150px; border-radius: 10px; cursor: pointer; }

/* ✅ 확대 팝업 */
.image-modal {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
}
.image-wrapper {
  position: relative;
  max-width: 90%;
  max-height: 90%;
}
.modal-image {
  max-width: 100%;
  max-height: 100%;
  border-radius: 12px;
}
.close-button {
  position: absolute;
  top: -12px;           /* 기존보다 살짝 위 */
  right: -12px;         /* 기존보다 살짝 오른쪽 */
  background: white;
  border: none;
  font-size: 20px;
  font-weight: bold;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  cursor: pointer;
  line-height: 28px;
  text-align: center;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
  color: black;         /* ✅ 검정색 X 아이콘 */
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
