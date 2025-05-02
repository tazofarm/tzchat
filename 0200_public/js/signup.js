function updateRegion2() {
    const region1 = document.getElementById('region1').value;
    const region2 = document.getElementById('region2');

    // 지역2의 내용을 초기화
    region2.innerHTML = '<option value="">선택하세요</option>';
    if (region1 === '서울') {
        region2.innerHTML += '<option value="강남구">강남구</option>';
        region2.innerHTML += '<option value="광진구">광진구</option>';
    } else if (region1 === '인천') {
        region2.innerHTML += '<option value="중구">중구</option>';
        region2.innerHTML += '<option value="남구">남구</option>';
    }
}

function validateForm() {
    // 초기화
    document.getElementById('username-error').innerText = '';
    document.getElementById('password-error').innerText = '';
    document.getElementById('password-confirm-error').innerText = '';
    document.getElementById('nickname-error').innerText = '';
    document.getElementById('submission-error').innerText = '';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;
    const nickname = document.getElementById('nickname').value.trim();
    
    let isValid = true;

    // 아이디 유효성 검사
    if (!/^[a-z0-9]{1,15}$/.test(username)) {
        document.getElementById('username-error').innerText = '아이디는 소문자와 숫자로만 이루어져야 하며, 1~15자 사이여야 합니다.';
        isValid = false;
    }

    // 비밀번호 유효성 검사
    if (password.length > 20) {
        document.getElementById('password-error').innerText = '비밀번호는 20자 이하로 설정해야 합니다.';
        isValid = false;
    }

    // 비밀번호 확인 유효성 검사
    if (password !== passwordConfirm) {
        document.getElementById('password-confirm-error').innerText = '비밀번호가 일치하지 않습니다.';
        isValid = false;
    }

    // 닉네임 유효성 검사
    if (nickname.length > 10) {
        document.getElementById('nickname-error').innerText = '닉네임은 10자 이하로 설정해야 합니다.';
        isValid = false;
    }

    // 출생년도 체크
    const birthyear = document.getElementById('birthyear').value;
    if (!birthyear) {
        document.getElementById('submission-error').innerText = '출생년도를 선택하세요.';
        isValid = false;
    }

    // 필수 선택 체크 (출생년도, 성별, 지역1, 지역2, 성향)
    const gender = document.querySelector('input[name="gender"]:checked');
    const region1 = document.getElementById('region1').value;
    const region2 = document.getElementById('region2').value;
    const preference = document.getElementById('preference').value;

    if (!birthyear || !gender || !region1 || !region2 || !preference) {
        document.getElementById('submission-error').innerText = '모든 필드를 선택해주세요.';
        isValid = false;
    }

    return isValid; // 모든 검사가 통과하면 true 반환
}