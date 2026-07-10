let currentSelectedUserId = null;
let myInfo = null;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
        window.location.href = 'login.html';
        return;
    }

    myInfo = JSON.parse(userStr);
    
    document.getElementById('my-avatar').src = myInfo.profileImage || '/uploads/default-profile.png';
    document.getElementById('my-nickname').innerText = myInfo.nickname;

    socket.connect();
    socket.emit('login', myInfo.id);

    loadFriends();

    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.clear();
        socket.disconnect();
        window.location.href = 'login.html';
    });

    document.getElementById('btn-add-friend').addEventListener('click', addFriend);
    document.getElementById('btn-send-message').addEventListener('click', sendMessage);
    document.getElementById('chat-text-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    document.getElementById('chat-image-input').addEventListener('change', sendImageMessage);
});

async function loadFriends() {
    try {
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await response.json();
        if (data.success) {
            const listContainer = document.getElementById('friends-list');
            listContainer.innerHTML = '';
            document.getElementById('friend-count').innerText = data.friends.length;

            data.friends.forEach(friend => {
                const li = document.createElement('li');
                li.className = `friend-item ${currentSelectedUserId === friend._id ? 'active' : ''}`;
                li.setAttribute('data-id', friend._id);
                li.innerHTML = `
                    <div class="friend-avatar-wrap">
                        <img src="${friend.profileImage || '/uploads/default-profile.png'}" alt="아바타">
                        <div class="status-badge ${friend.isOnline ? 'online' : ''}" id="status-${friend._id}"></div>
                    </div>
                    <div class="friend-info">
                        <span class="friend-name">${friend.nickname}</span>
                    </div>
                `;
                li.addEventListener('click', () => selectUser(friend));
                listContainer.appendChild(li);
            });
        }
    } catch (err) {
        console.error('친구 로드 실패:', err);
    }
}

async function addFriend() {
    const input = document.getElementById('friend-username-input');
    const friendUsername = input.value.trim();
    if (!friendUsername) return;

    try {
        const response = await fetch('/api/users/friend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ friendUsername })
        });
        const data = await response.json();
        alert(data.message);
        if (data.success) {
            input.value = '';
            loadFriends();
        }
    } catch (err) {
        alert('친구 추가 오류');
    }
}

async function selectUser(friend) {
    currentSelectedUserId = friend._id;
    
    document.querySelectorAll('.friend-item').forEach(el => el.classList.remove('active'));
    const selectedEl = document.querySelector(`.friend-item[data-id="${friend._id}"]`);
    if (selectedEl) selectedEl.classList.add('active');

    document.getElementById('chat-blank').classList.add('hide');
    document.getElementById('chat-window').classList.remove('hide');

    document.getElementById('target-avatar').src = friend.profileImage || '/uploads/default-profile.png';
    document.getElementById('target-nickname').innerText = friend.nickname;

    await loadChatHistory(friend._id);
}

async function loadChatHistory(targetUserId) {
    try {
        const response = await fetch(`/api/users/messages/${targetUserId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await response.json();
        if (data.success) {
            const display = document.getElementById('messages-display');
            display.innerHTML = '';
            data.messages.forEach(msg => appendMessageUI(msg));
            scrollToBottom();
        }
    } catch (err) {
        console.error(err);
    }
}

async function sendMessage() {
    const input = document.getElementById('chat-text-input');
    const text = input.value.trim();
    if (!text || !currentSelectedUserId) return;

    try {
        const response = await fetch('/api/users/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ recipient: currentSelectedUserId, content: text })
        });
        const data = await response.json();
        if (data.success) {
            input.value = '';
            socket.emit('message', data.message);
        }
    } catch (err) {
        console.error(err);
    }
}

async function sendImageMessage(e) {
    const file = e.target.files[0];
    if (!file || !currentSelectedUserId) return;

    const formData = new FormData();
    formData.append('recipient', currentSelectedUserId);
    formData.append('image', file);

    try {
        const response = await fetch('/api/users/messages', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });
        const data = await response.json();
        if (data.success) {
            e.target.value = '';
            socket.emit('message', data.message);
        }
    } catch (err) {
        console.error(err);
    }
}

function appendMessageUI(msg) {
    const display = document.getElementById('messages-display');
    const isMe = msg.sender === myInfo.id;

    const wrapper = document.createElement('div');
    wrapper.className = `msg-wrapper ${isMe ? 'me' : 'other'}`;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    if (msg.messageType === 'image') {
        bubble.innerHTML = `<img src="${msg.content}" alt="이미지 전송">`;
    } else {
        bubble.innerText = msg.content;
    }

    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.innerHTML = `
        <span class="unread-count">${msg.isRead ? '' : '1'}</span>
        <span class="msg-time">${timeStr}</span>
    `;

    wrapper.appendChild(bubble);
    wrapper.appendChild(meta);
    display.appendChild(wrapper);
}

function scrollToBottom() {
    const display = document.getElementById('messages-display');
    display.scrollTop = display.scrollHeight;
}

socket.on('message', (data) => {
    if (currentSelectedUserId === data.sender || currentSelectedUserId === data.recipient) {
        data.isRead = true;
        appendMessageUI(data);
        scrollToBottom();
    }
});

socket.on('message_self', (data) => {
    if (currentSelectedUserId === data.recipient) {
        appendMessageUI(data);
        scrollToBottom();
    }
});

socket.on('status_change', (data) => {
    const badge = document.getElementById(`status-${data.userId}`);
    if (badge) {
        if (data.isOnline) {
            badge.classList.add('online');
        } else {
            badge.classList.remove('online');
        }
    }
});