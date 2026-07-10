const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('./User');

const uploadDir = path.join(__dirname, '../uploads/');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

router.post('/register', upload.single('profileImage'), async (req, res) => {
    try {
        const { username, password, nickname } = req.body;
        if (!username || !password || !nickname) {
            return res.status(400).json({ success: false, message: '모든 필수 항목을 입력해주세요.' });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ success: false, message: '이미 존재하는 아이디입니다.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let profileImagePath = '/uploads/default-profile.png';
        if (req.file) {
            profileImagePath = `/uploads/${req.file.filename}`;
        }

        const newUser = new User({
            username,
            password: hashedPassword,
            nickname,
            profileImage: profileImagePath,
            friends: []
        });

        await newUser.save();
        res.status(201).json({ success: true, message: '회원가입이 완료되었습니다.' });
    } catch (error) {
        console.error('Register Error:', error);
        res.status(500).json({ success: false, message: '서버 회원가입 내부 오류', error: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: '아이디와 비밀번호를 입력해주세요.' });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ success: false, message: '존재하지 않는 아이디입니다.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET || 'chat_app_secret_key_2026_safe_and_secure',
            { expiresIn: '24h' }
        );

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                nickname: user.nickname,
                profileImage: user.profileImage
            }
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, message: '서버 로그인 내부 오류', error: error.message });
    }
});

module.exports = router;