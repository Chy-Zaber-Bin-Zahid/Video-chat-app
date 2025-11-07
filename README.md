# 🎥 Video Chat App - Complete Installation Guide

A peer-to-peer video chat application built with React, Node.js, Express, Socket.io, and WebRTC.

---

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Production Deployment](#production-deployment)
- [Deployment Options](#deployment-options)
- [Troubleshooting](#troubleshooting)
- [Usage Guide](#usage-guide)

---

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** (optional, for version control) - [Download here](https://git-scm.com/)
- **Modern web browser** (Chrome, Firefox, or Edge recommended)

Check your installations:
```bash
node --version
npm --version
```

---

## 🚀 Local Development Setup

### Step 1: Create Project Structure

```bash
# Create main project folder
mkdir video-chat-app
cd video-chat-app
```

### Step 2: Setup Backend

```bash
# Initialize npm in the root directory
npm init -y

# Install backend dependencies
npm install express socket.io
```

**Create `server.js`** in the root directory with this content:

```javascript
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
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    
    const room = rooms.get(roomId);
    
    if (room.size >= 2) {
      socket.emit('room-full');
      return;
    }
    
    room.add(socket.id);
    socket.join(roomId);
    socket.roomId = roomId;
    
    console.log(`Room ${roomId} now has ${room.size} users`);
    
    const otherUsers = Array.from(room).filter(id => id !== socket.id);
    
    if (otherUsers.length > 0) {
      socket.emit('other-user', otherUsers[0]);
      socket.to(otherUsers[0]).emit('user-joined', socket.id);
    }
  });

  socket.on('offer', (data) => {
    socket.to(data.target).emit('offer', {
      sdp: data.sdp,
      sender: socket.id
    });
  });

  socket.on('answer', (data) => {
    socket.to(data.target).emit('answer', {
      sdp: data.sdp,
      sender: socket.id
    });
  });

  socket.on('ice-candidate', (data) => {
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
        socket.to(socket.roomId).emit('user-disconnected', socket.id);
        
        if (room.size === 0) {
          rooms.delete(socket.roomId);
        }
      }
    }
  });
});

// Catch-all handler for React routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access at http://localhost:${PORT}`);
});
```

**Update `package.json`** to include scripts:

```json
{
  "name": "video-chat-app",
  "version": "1.0.0",
  "description": "WebRTC Video Chat Application",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js",
    "build": "cd client && npm run build"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.6.1"
  }
}
```

### Step 3: Setup Frontend

```bash
# Create React app with Vite
npx create-vite@latest client --template react

# Navigate to client folder
cd client

# Install dependencies
npm install

# Install additional packages
npm install socket.io-client
```

**Update `client/vite.config.js`:**

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['all'],
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true
      },
    },
  },
})
```

**Replace `client/src/App.jsx`** with the video chat component code (provided separately).

**Update `client/src/main.jsx`** (should already be correct):

```javascript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

### Step 4: Run in Development Mode

Open **two terminal windows**:

**Terminal 1 - Backend:**
```bash
# In the root directory (video-chat-app)
node server.js
```
You should see: `Server running on port 3001`

**Terminal 2 - Frontend:**
```bash
# Navigate to client folder
cd client
npm run dev
```

### TURN Credentials (Optional)
```
TURN_USERNAME=hqwfeq12hgf32112h6e31948
TURN_CREDENTIAL=ASDjgj23hhsadsad
```

You should see: `Local: http://localhost:5173/`

### Step 5: Test Locally

1. Open `http://localhost:5173` in **two different browser tabs** (or two browsers)
2. Enter the same **Room ID** in both tabs (e.g., "test123")
3. Click **"Join Room"** in both tabs
4. Grant camera and microphone permissions
5. You should see both video feeds connected! 🎉

---

## 📦 Production Build

### Build Frontend for Production

```bash
# From the root directory
cd client
npm run build
cd ..
```

This creates an optimized production build in `client/dist/`.

### Run Production Server

```bash
# From root directory
node server.js
```

Now access the app at: `http://localhost:3001`

Everything (frontend + backend) is served from one port!

---

## 🌐 Deployment Options

### Option 1: Deploy on Render.com (Recommended)

**Step 1: Prepare for Deployment**

Create `.gitignore` in root:
```
node_modules/
client/node_modules/
client/dist/
.env
```

**Step 2: Push to GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

**Step 3: Deploy on Render**

1. Go to [render.com](https://render.com) and sign up
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure settings:
   - **Name**: `video-chat-app`
   - **Environment**: `Node`
   - **Build Command**: 
     ```bash
     cd client && npm install && npm run build && cd .. && npm install
     ```
   - **Start Command**: 
     ```bash
     node server.js
     ```
   - **Port**: `3001` (or leave default)

5. Click **"Create Web Service"**
6. Wait 5-10 minutes for deployment
7. You'll get a URL like: `https://video-chat-app.onrender.com`

**Share this URL with your friend!**

---

### Option 2: Deploy on Replit

1. Go to [replit.com](https://replit.com) and create an account
2. Click **"Create Repl"** → **"Import from GitHub"** (or upload files manually)
3. In the Shell tab, run:
   ```bash
   npm install
   cd client && npm install && npm run build && cd ..
   ```
4. Click the **"Run"** button
5. Your app will be live at: `https://your-repl-name.username.repl.co`

---

### Option 3: Use ngrok (Local Sharing)

**Step 1: Download ngrok**
- Go to [ngrok.com/download](https://ngrok.com/download)
- Download and extract for your OS

**Step 2: Build and Run**
```bash
# Build frontend
cd client
npm run build
cd ..

# Start backend
node server.js
```

**Step 3: Expose with ngrok**
```bash
# In a new terminal (where ngrok is extracted)
ngrok http 3001
```

**Step 4: Share the URL**
- ngrok will display: `Forwarding https://abc123.ngrok-free.app -> http://localhost:3001`
- Share the `https://abc123.ngrok-free.app` link with your friend!

⚠️ **Note**: Free ngrok URLs change every time you restart. Sign up for a free account to get consistent URLs.

---

### Option 4: Deploy on Vercel (Alternative)

```bash
# Install Vercel CLI
npm install -g vercel

# Build frontend
cd client && npm run build && cd ..

# Deploy
vercel
```

Follow the prompts and you'll get a deployment URL!

---

## 🐛 Troubleshooting

### Problem: "Failed to access camera/microphone"
**Solution:**
- Grant browser permissions (click the camera icon in address bar)
- Check if another app is using your camera
- Try a different browser (Chrome/Firefox recommended)
- Ensure you're using HTTPS (required for WebRTC in production)

### Problem: "Room is full"
**Solution:**
- Only 2 users can join the same room
- Use a different Room ID
- Wait for the other user to leave

### Problem: Can't see remote video
**Solution:**
- Check browser console (F12) for errors
- Ensure both users are in the same room
- Try refreshing both browsers
- Check if both users have stable internet
- Verify firewall isn't blocking WebRTC

### Problem: Videos showing same person
**Solution:**
- Clear browser cache
- Refresh both pages
- Ensure WebRTC peer connection is established (check console logs)

### Problem: ngrok "Host not allowed" error
**Solution:**
- Update `vite.config.js` with `allowedHosts: ['all']`
- OR build the frontend and serve from backend only

### Problem: Socket.io connection failed
**Solution:**
- Check if backend is running on port 3001
- Verify proxy settings in `vite.config.js`
- Check firewall settings
- In production, ensure WebSocket support is enabled

### Problem: Can't connect online with friend
**Solution:**
- Both users must use HTTPS in production
- Use Render, Replit, or ngrok (they provide HTTPS)
- Both users must enter the **exact same Room ID**
- Check if your firewall blocks WebRTC

---

## 📖 Usage Guide

### For Users

1. **Open the app** in your web browser
2. **Enter a Room ID** (e.g., "myroom123")
3. **Click "Join Room"**
4. **Allow camera and microphone** when prompted
5. **Share the Room ID** with your friend
6. **Wait for connection** - when your friend joins, you'll see their video!

### Controls

- **Camera Button**: Toggle your video on/off
- **Microphone Button**: Mute/unmute your audio
- **Leave Button**: Exit the room and return to home

### Tips

- Use a **unique Room ID** to avoid strangers joining
- Room IDs are case-sensitive
- Maximum **2 users per room**
- Works best on **Chrome or Firefox**
- Requires **stable internet connection**

---

## 🔒 Security Notes

⚠️ **Important**: This is a demo application. For production use:

- Add user authentication
- Implement room passwords
- Add rate limiting to prevent abuse
- Use TURN servers for better connectivity (not just STUN)
- Validate and sanitize all inputs
- Add HTTPS enforcement
- Implement proper error logging

---

## 📁 Project Structure

```
video-chat-app/
├── server.js                 # Backend server (Express + Socket.io)
├── package.json             # Backend dependencies
├── client/                  # React frontend
│   ├── src/
│   │   ├── App.jsx         # Main video chat component
│   │   ├── main.jsx        # React entry point
│   │   └── index.css       # Styles
│   ├── vite.config.js      # Vite configuration
│   ├── package.json        # Frontend dependencies
│   └── dist/               # Production build (after npm run build)
└── README.md               # This file
```

---

## 🎯 Features

✅ Peer-to-peer video calling with WebRTC  
✅ Real-time audio communication  
✅ Room-based system (max 2 users)  
✅ Toggle video/audio controls  
✅ Automatic reconnection handling  
✅ Responsive design  
✅ Works on mobile and desktop  
✅ No registration required  

---

## 🤝 Support

Having issues? Check:
1. The [Troubleshooting](#troubleshooting) section above
2. Browser console for error messages (F12)
3. Ensure both backend and frontend are running
4. Verify all dependencies are installed

---

## 📝 License

MIT License - Free to use for personal and commercial projects!

---

## 🎉 Happy Video Chatting!

You're all set! Open two tabs, enter the same room ID, and start chatting! 📞🎥

For online deployment, we recommend **Render.com** for the best experience.