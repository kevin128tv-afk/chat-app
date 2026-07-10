const express = require('express');
const router = express.Router();
const User = require('./User');
const Message = require('./Message');
const multer = require('multer');
const path = require('path');
const { authenticateToken } = require('./middleware');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

router.get('/', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('friends', 'username nickname profileImage isOnline');
        if (!user) {
            return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
        }
        res.status(200).json({ success: true, friends: user.friends, me: { id: user._id, nickname: user.nickname, profileImage: user.profileImage, username: user.username } });
    } catch (error) {
        res.status(500).json({ success: false, message: '친구 목록 조회 오류', error: error.message });
    }
});

router.post('/friend', authenticateToken, async (req, res) => {
    try {
        const { friendUsername } = req.body;
        if (!friendUsername) {
            return res.status(400).json({ success: false, message: '추가할 친구의 아이디를 입력하세요.' });
        }

        if (friendUsername === req.user.username) {
            return res.status(400).json({ success: false, message: '자기 자신은 친구로 추가할 수 없습니다.' });
        }

        const friendUser = await User.findOne({ username: friendUsername });
        if (!friendUser) {
            return res.status(404).json({ success: false, message: '해당 아이디의 사용자를 찾을 수 없습니다.' });
        }

        const currentUser = await User.findById(req.user.id);
        if (currentUser.friends.includes(friendUser._id)) {
            return res.status(400).json({ success: false, message: '이미 친구로 등록된 사용자입니다.' });
        }

        currentUser.friends.push(friendUser._id);
        await currentUser.save();

        if (!friendUser.friends.includes(currentUser._id)) {
            friendUser.friends.push(currentUser._id);
            await friendUser.save();
        }

        res.status(200).json({ success: true, message: '친구 추가가 완료되었습니다.' });
    } catch (error) {
        res.status(500).json({ success: false, message: '친구 추가 오류', error: error.message });
    }
});

router.get('/messages/:userId', authenticateToken, async (req, res) => {
    try {
        const myId = req.user.id;
        const targetId = req.params.userId;

        await Message.updateMany(
            { sender: targetId, recipient: myId, isRead: false },
            { $set: { isRead: true } }
        );

        const messages = await Message.find({
            $or: [
                { sender: myId, recipient: targetId },
                { sender: targetId, recipient: myId }
            ]
        }).sort({ timestamp: 1 });

        res.status(200).json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ success: false, message: '메시지 내역 조회 오류', error: error.message });
    }
});

router.post('/messages', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { recipient, content } = req.body;
        const sender = req.user.id;

        let messageType = 'text';
        let finalContent = content;

        if (req.file) {
            messageType = 'image';
            finalContent = `/uploads/${req.file.filename}`;
        }

        const newMessage = new Message({
            sender,
            recipient,
            messageType,
            content: finalContent,
            isRead: false
        });

        await newMessage.save();
        res.status(201).json({ success: true, message: newMessage });
    } catch (error) {
        res.status(500).json({ success: false, message: '메시지 임시 저장 오류', error: error.message });
    }
});

module.exports = router;