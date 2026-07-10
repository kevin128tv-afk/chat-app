document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const nickname = document.getElementById('nickname').value;
            const profileFile = document.getElementById('profileImage').files[0];

            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);
            formData.append('nickname', nickname);
            if (profileFile) {
                formData.append('profileImage', profileFile);
            }

            try {
                const response = await fetch('http://localhost:3000/api/auth/register', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    alert(data.message);
                    window.location.href = 'login.html';
                } else {
                    alert(data.message || '회원가입 실패');
                }
            } catch (error) {
                console.error('Register network error:', error);
                alert('회원가입 통신 중 오류가 발생했습니다.');
            }
        });
    }
});