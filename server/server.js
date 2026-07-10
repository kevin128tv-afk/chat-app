require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const authRoutes = require('./auth');
const userRoutes = require('./users');
const User = require('./User');
const Message = require('./Message');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../client')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.use((err, req, res, next) => {
    res.status(500).json({ success: false, message: '글로벌 서버 내부 오류 발생', error: err.message });
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-app';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB Connected Successfully'))
    .catch(err => {
        console.error('MongoDB Connection Database Error:', err.message);
        process.exit(1);
    });

const onlineUsers = new Map();

io.on('connection', (socket) => {
    socket.on('login', async (userId) => {
        try {
            if (!userId) return;
            socket.userId = userId;
            onlineUsers.set(userId, socket.id);
            await User.findByIdAndUpdate(userId, { isOnline: true });
            io.emit('status_change', { userId, isOnline: true });
        } catch (err) {
            console.error(err);
        }
    });

    socket.on('message', async (data) => {
        try {
            const { sender, recipient, messageType, content, timestamp, _id } = data;
            
            await Message.updateMany(
                { sender: recipient, recipient: sender, isRead: false },
                { $set: { isRead: true } }
            );

            const targetSocketId = onlineUsers.get(recipient);
            if (targetSocketId) {
                io.to(targetSocketId).emit('message', data);
            }
            socket.emit('message_self', data);
        } catch (err) {
            console.error(err);
        }
    });

    socket.on('disconnect', async () => {
        try {
            if (socket.userId) {
                onlineUsers.delete(socket.userId);
                await User.findByIdAndUpdate(socket.userId, { isOnline: false });
                io.emit('status_change', { userId: socket.userId, isOnline: false });
            }
        } catch (err) {
            console.error(err);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 