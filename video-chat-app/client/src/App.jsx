import { useState, useRef, useEffect } from 'react';
import { Camera, Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import io from 'socket.io-client';

const SOCKET_SERVER = window.location.origin;
const ICE_SERVERS = {
  iceServers: [
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:standard.relay.metered.ca:80",
        username: import.meta.env.VITE_USERNAME,
        credential: import.meta.env.VITE_CREDENTIAL,
      },
  ],
};

export default function VideoChat() {
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [connected, setConnected] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [error, setError] = useState('');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteUserIdRef = useRef(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (joined && localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch((e) => console.log("Play blocked:", e));
    }
  }, [joined]);


  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (err) {
      setError('Failed to access camera/microphone. Please grant permissions.');
      throw err;
    }
  };

  const createPeerConnection = (stream) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    
    // Add local tracks to peer connection
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle incoming tracks
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setConnected(true);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && remoteUserIdRef.current) {
        socketRef.current.emit('ice-candidate', {
          target: remoteUserIdRef.current,
          candidate: event.candidate
        });
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnected(false);
      }
    };

    return pc;
  };

  const handleJoinRoom = async () => {
    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }

    try {
      setError('');
      
      // Initialize media
      const stream = await initializeMedia();
      console.log("✅ Local stream tracks:", stream.getTracks());
      
      // Connect to socket server
      socketRef.current = io(SOCKET_SERVER);
      
      // Setup socket listeners
      socketRef.current.on('room-full', () => {
        setError('Room is full (maximum 2 users)');
        cleanup();
      });

      socketRef.current.on('other-user', async (userId) => {
        console.log('Other user in room:', userId);
        remoteUserIdRef.current = userId;
        
        // Create peer connection and send offer
        peerConnectionRef.current = createPeerConnection(stream);
        
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        
        socketRef.current.emit('offer', {
          target: userId,
          sdp: offer
        });
      });

      socketRef.current.on('user-joined', async (userId) => {
        console.log('User joined:', userId);
        remoteUserIdRef.current = userId;
        
        // Create peer connection (will receive offer)
        peerConnectionRef.current = createPeerConnection(stream);
      });

      socketRef.current.on('offer', async (data) => {
        console.log('Received offer from:', data.sender);
        remoteUserIdRef.current = data.sender;
        
        if (!peerConnectionRef.current) {
          peerConnectionRef.current = createPeerConnection(stream);
        }
        
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
        
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        
        socketRef.current.emit('answer', {
          target: data.sender,
          sdp: answer
        });
      });

      socketRef.current.on('answer', async (data) => {
        console.log('Received answer from:', data.sender);
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
      });

      socketRef.current.on('ice-candidate', async (data) => {
        console.log('Received ICE candidate from:', data.sender);
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      });

      socketRef.current.on('user-disconnected', () => {
        console.log('User disconnected');
        setConnected(false);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
        remoteUserIdRef.current = null;
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
      });

      // Join the room
      socketRef.current.emit('join-room', roomId);
      setJoined(true);
      
    } catch (err) {
      console.error('Error joining room:', err);
      setError(err.message || 'Failed to join room');
    }
  };

  const handleLeaveRoom = () => {
    cleanup();
    setJoined(false);
    setConnected(false);
    setRoomId('');
    remoteUserIdRef.current = null;
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 flex items-center justify-center p-4">
      <div>
        {!joined ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-full mb-4">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-2">Video Chat</h1>
              <p className="text-blue-200">Enter a room ID to start your video call</p>
            </div>

            <div className="max-w-md mx-auto">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter Room ID (e.g., room123)"
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
                onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              />

              {error && (
                <div className="bg-red-500/20 border border-red-400/50 text-red-200 px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              <button
                onClick={handleJoinRoom}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Phone className="w-5 h-5" />
                Join Room
              </button>

              <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
                <h3 className="text-white font-semibold mb-2">How to use:</h3>
                <ol className="text-blue-200 text-sm space-y-1 list-decimal list-inside">
                  <li>Enter a room ID (same ID for both users)</li>
                  <li>Click "Join Room" to connect</li>
                  <li>Share the room ID with your friend</li>
                  <li>Start video chatting when they join!</li>
                </ol>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 shadow-2xl border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <div className="text-white">
                  <h2 className="text-xl font-semibold">Room: {roomId}</h2>
                  <p className="text-sm text-blue-200">
                    {connected ? 'Connected' : 'Waiting for other user...'}
                  </p>
                </div>
                <button
                  onClick={handleLeaveRoom}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <PhoneOff className="w-4 h-4" />
                  Leave
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {!connected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800/80">
                      <p className="text-white">Waiting for remote user...</p>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-sm">
                    Remote
                  </div>
                </div>

                <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-sm">
                    You
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  onClick={toggleVideo}
                  className={`${
                    videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'
                  } text-white p-4 rounded-full transition-colors`}
                >
                  {videoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                </button>
                <button
                  onClick={toggleAudio}
                  className={`${
                    audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'
                  } text-white p-4 rounded-full transition-colors`}
                >
                  {audioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}