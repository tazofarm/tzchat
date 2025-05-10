gp() {
  echo "📝 커밋 메시지를 입력하세요:"
  read msg
  git add .
  git commit -m "$msg"
  git push origin master
}