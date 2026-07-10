const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ success: false, message: '인증 토큰이 없습니다.' });
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(403).json({ success: false, message: '유효하지 않은 토큰입니다.' });
            }
            req.user = user;
            next();
        });
    } catch (error) {
        res.status(500).json({ success: false, message: '미들웨어 내부 오류', error: error.message });
    }
};

module.exports = { authenticateToken };