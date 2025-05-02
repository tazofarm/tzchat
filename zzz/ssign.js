// 아이디 확인
function checkDuplicateId() {
    var userid = document.getElementById("userid").value;
    var duplicateCheckResultId = document.getElementById("duplicateCheckResultId");
  
    // 입력값 검증: 한글, 대문자, 특수 기호가 포함된 경우
    var invalidPattern = /[^a-z0-9]/; // 영어 소문자와 숫자 이외의 모든 문자
    if (invalidPattern.test(userid)) {
        duplicateCheckResultId.textContent = "영어 소문자와 숫자만 사용할 수 있습니다.";
        duplicateCheckResultId.style.color = "red";
        window.isDuplicateId = false; // 중복 확인 결과
        
    } else if (userid.length < 2 || userid.length > 16) {
        duplicateCheckResultId.textContent = "사용자 이름은 2자 이상 16자 이하이어야 합니다.";
        duplicateCheckResultId.style.color = "red";
        
        window.isDuplicateId = false;
    } else if (userid === "tttt") { // 예시로 하드코딩된 값
        duplicateCheckResultId.textContent = "이미 존재합니다.";
        duplicateCheckResultId.style.color = "red";
        
        window.isDuplicateId = true;
    } else {
        duplicateCheckResultId.textContent = "사용 가능합니다.";
        duplicateCheckResultId.style.color = "green";
        window.isDuplicateId = false;
        
    }
  }
  
  // 닉네임 확인
  function checkDuplicateName() {
    var username = document.getElementById("username").value;
    var duplicateCheckResultName = document.getElementById("duplicateCheckResultName");
  
    // 글자 수 검증: 2자 이상 12자 이하
    if (username.length < 2 || username.length > 12) {
        duplicateCheckResultName.textContent = "사용자 이름은 2자 이상 12자 이하이어야 합니다.";
        duplicateCheckResultName.style.color = "red";
        window.isDuplicateName = false;
        
    } else if (username === "tttt") { // 예시로 하드코딩된 값
        duplicateCheckResultName.textContent = "이미 존재합니다.";
        duplicateCheckResultName.style.color = "red";
        window.isDuplicateName = true;
      
    } else {
        duplicateCheckResultName.textContent = "사용 가능합니다.";
        duplicateCheckResultName.style.color = "green";
        window.isDuplicateName = false;
       
  }
  }
  
  // 비밀번호 확인
  function checkPasswordMatch() {
    var password = document.getElementById("password").value;
    var passwordCheck = document.getElementById("passwordCheck").value;
    var passwordCheckError = document.getElementById("passwordCheckError");
  
    // 초기화
    passwordCheckError.textContent = "";
  
    // 비밀번호가 비어있는지 확인
    if (password.length < 4) {
        passwordCheckError.textContent = "비밀번호는 4글자 이상이어야 합니다.";
        passwordCheckError.style.color = "red";
    } else if (passwordCheck === "") {
        passwordCheckError.textContent = "비밀번호 확인을 입력해 주세요.";
    } else if (password !== passwordCheck) {
        passwordCheckError.textContent = "비밀번호가 일치하지 않습니다.";
        passwordCheckError.style.color = "red";
    } else {
        passwordCheckError.textContent = "비밀번호가 일치합니다.";
        passwordCheckError.style.color = "green";
    }
  }
  
  function signUpCheck() {
    let userid = document.getElementById("userid").value;
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;
    let areaParent = document.getElementById("area_parent").value;
    let areaChild = document.getElementById("area_child").value;
    let gender_man = document.getElementById("gender_man").checked;
    let gender_woman = document.getElementById("gender_woman").checked;
    let check = true;
  
    // 모든 오류 메시지 초기화
    document.getElementById("useridError").innerHTML = "";
    document.getElementById("usernameError").innerHTML = "";
    document.getElementById("passwordError").innerHTML = "";
    document.getElementById("passwordCheckError").innerHTML = "";
    document.getElementById("areaError").innerHTML = "";
    document.getElementById("genderError").innerHTML = "";
  
    // 아이디 확인
    if (userid === "") {
        document.getElementById("useridError").innerHTML = "ID를 입력해주세요.";
        check = false;
    }
  
    // 이름 확인
    if (username === "") {
        document.getElementById("usernameError").innerHTML = "이름이 올바르지 않습니다.";
        check = false;
    }
  
    // 비밀번호 확인
    if (password === "") {
        document.getElementById("passwordError").innerHTML = "비밀번호를 입력해주세요.";
        check = false;
    } else if (password.length < 6) {
        document.getElementById("passwordError").innerHTML = "비밀번호는 6자 이상이어야 합니다.";
        check = false;
    }
  
    // 지역 선택 확인
    if (areaParent === "") {
        document.getElementById("areaError").innerHTML = "지역을 선택해주세요.";
        check = false;
    }
  
    // 성별 체크 확인
    if (!gender_man && !gender_woman) {
        document.getElementById("genderError").innerHTML = "성별을 선택해주세요.";
        check = false;
    }
  
    // 중복 확인
    if (window.isDuplicateId) {
        document.getElementById("useridError").innerHTML = "사용자 ID가 이미 존재합니다.";
        check = false;
    }
    if (window.isDuplicateName) {
        document.getElementById("usernameError").innerHTML = "사용자 이름이 이미 존재합니다.";
        check = false;
    }
  
    // 버튼 활성화/비활성화
    const signUpButton = document.getElementById("signUpButton");
    signUpButton.disabled = !check;
  }