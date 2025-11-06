const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Serve static files from React build
app.use(express.static(path.join(__dirname, 'client/dist')));

// Store rooms and their users
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    console.log(`User ${socket.id} joining room ${roomId}`);
    
    // Get or create room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    
    const room = rooms.get(roomId);
    
    // Check if room is full (max 2 users)
    if (room.size >= 2) {
      socket.emit('room-full');
      return;
    }
    
    // Add user to room
    room.add(socket.id);
    socket.join(roomId);
    socket.roomId = roomId;
    
    console.log(`Room ${roomId} now has ${room.size} users`);
    
    // Notify others in the room
    const otherUsers = Array.from(room).filter(id => id !== socket.id);
    
    if (otherUsers.length > 0) {
      // Tell the new user about existing users
      socket.emit('other-user', otherUsers[0]);
      // Tell existing users about the new user
      socket.to(otherUsers[0]).emit('user-joined', socket.id);
    }
  });

  socket.on('offer', (data) => {
    console.log(`Offer from ${socket.id} to ${data.target}`);
    socket.to(data.target).emit('offer', {
      sdp: data.sdp,
      sender: socket.id
    });
  });

  socket.on('answer', (data) => {
    console.log(`Answer from ${socket.id} to ${data.target}`);
    socket.to(data.target).emit('answer', {
      sdp: data.sdp,
      sender: socket.id
    });
  });

  socket.on('ice-candidate', (data) => {
    console.log(`ICE candidate from ${socket.id} to ${data.target}`);
    socket.to(data.target).emit('ice-candidate', {
      candidate: data.candidate,
      sender: socket.id
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        room.delete(socket.id);
        
        // Notify others in the room
        socket.to(socket.roomId).emit('user-disconnected', socket.id);
        
        // Clean up empty rooms
        if (room.size === 0) {
          rooms.delete(socket.roomId);
        }
      }
    }
  });
});

// Catch-all handler for React routing - FIXED for Express 5.x
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access at http://localhost:${PORT}`);
});