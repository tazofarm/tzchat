<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>아동 안전 정책</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <h2>네네챗 아동 안전 정책</h2>
      <p>
        네네챗은 아동 성적 학대 및 착취(CSAE) 관련 콘텐츠를
        엄격히 금지하며, 이를 방지하기 위한 정책을 운영합니다.
      </p>

      <ul>
        <li>사용자는 앱 내 신고 기능을 통해 아동 안전 관련 우려사항을 언제든 신고할 수 있습니다.</li>
        <li>접수된 신고는 즉시 검토되며, 필요한 경우 지역 및 국가 당국에 전달됩니다.</li>
        <li>관련 법규를 철저히 준수하고 있으며, 아동의 안전을 최우선으로 보호합니다.</li>
      </ul>

      <p>
        국제 아동 보호 표준에 대해서는 
        <a href="https://inhope.org" target="_blank">INHOPE (국제 아동보호 네트워크)</a>를 참고하세요.
      </p>

      <p>문의: <a href="mailto:tazocode@gmail.com">tazocode@gmail.com</a></p>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
// 특별한 로직 없음
</script>

<style scoped>
h2 { margin-bottom: 16px; color:#000; }
p, li { color:#000; line-height:1.6; }
ul { margin: 16px 0; padding-left: 20px; }
a { color: #1a73e8; text-decoration: underline; }
</style>
