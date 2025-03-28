import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mic, MicOff, PhoneOff, Video, VideoOff, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface Profile {
  id: string;
  username: string;
  avatar_url: string;
}

export function Call() {
  const { id: receiverId } = useParams();
  const [searchParams] = useSearchParams();
  const callType = searchParams.get('type') || 'video';
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [receiver, setReceiver] = useState<Profile | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);

  useEffect(() => {
    const fetchReceiver = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', receiverId)
        .single();

      setReceiver(data);
    };

    fetchReceiver();
    initializeCall();

    // Subscribe to call status changes
    const channel = supabase.channel(`call:${receiverId}`);
    channel
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        if (newPresences.some(p => p.user_id === receiverId)) {
          setIsConnecting(false);
          createOffer();
        }
      })
      .on('presence', { event: 'leave' }, () => {
        endCall();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      peerConnectionRef.current?.close();
    };
  }, [receiverId, user?.id, callType]);

  const initializeCall = async () => {
    try {
      setPermissionError(null);
      const constraints = {
        audio: true,
        video: callType === 'video'
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      peerConnection.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setIsCallActive(true);
          setIsConnecting(false);
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          await supabase.from('call_signals').insert({
            from_user: user?.id,
            to_user: receiverId,
            type: 'ice-candidate',
            signal: JSON.stringify(event.candidate)
          });
        }
      };

      // Create data channel
      const dataChannel = peerConnection.createDataChannel('call-channel');
      dataChannel.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'end-call') {
          endCall();
        }
      };
      channelRef.current = dataChannel;

      peerConnectionRef.current = peerConnection;
    } catch (error: any) {
      console.error('Error accessing media devices:', error);
      let errorMessage = 'Could not access camera or microphone.';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Please allow access to your camera and microphone to make calls.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera or microphone found. Please check your device connections.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Your camera or microphone is already in use by another application.';
      }
      
      setPermissionError(errorMessage);
    }
  };

  const createOffer = async () => {
    if (!peerConnectionRef.current) return;

    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      await supabase.from('call_signals').insert({
        from_user: user?.id,
        to_user: receiverId,
        type: 'offer',
        signal: JSON.stringify(offer)
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const toggleMute = () => {
    const stream = localVideoRef.current?.srcObject as MediaStream;
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    const stream = localVideoRef.current?.srcObject as MediaStream;
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const endCall = () => {
    if (channelRef.current) {
      channelRef.current.send(JSON.stringify({ type: 'end-call' }));
    }

    const stream = localVideoRef.current?.srcObject as MediaStream;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    peerConnectionRef.current?.close();
    setIsCallActive(false);
    navigate('/home');
  };

  // Show permission error if present
  if (permissionError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-white p-8">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-4">Permission Required</h2>
        <p className="text-center mb-6">{permissionError}</p>
        <div className="flex space-x-4">
          <button
            onClick={() => initializeCall()}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => navigate('/home')}
            className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex-1 relative">
        {/* Remote Video (Full Screen) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Local Video (Picture-in-Picture) */}
        {callType === 'video' && (
          <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Connecting Overlay */}
        {isConnecting && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-xl">Connecting to {receiver?.username}...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-4">
        <div className="flex items-center justify-center space-x-6">
          <button
            onClick={toggleMute}
            className={`p-4 rounded-full ${
              isMuted ? 'bg-red-500' : 'bg-gray-600'
            } hover:bg-opacity-80 transition-colors`}
          >
            {isMuted ? <MicOff size={24} className="text-white" /> : <Mic size={24} className="text-white" />}
          </button>
          {callType === 'video' && (
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full ${
                !isVideoEnabled ? 'bg-red-500' : 'bg-gray-600'
              } hover:bg-opacity-80 transition-colors`}
            >
              {isVideoEnabled ? (
                <Video size={24} className="text-white" />
              ) : (
                <VideoOff size={24} className="text-white" />
              )}
            </button>
          )}
          <button
            onClick={endCall}
            className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
          >
            <PhoneOff size={24} className="text-white" />
          </button>
        </div>
      </div>

      {/* User Info */}
      <div className="absolute top-4 left-4 bg-gray-800 bg-opacity-75 p-3 rounded-lg flex items-center space-x-3">
        <img
          src={receiver?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${receiver?.username}`}
          alt={receiver?.username}
          className="w-10 h-10 rounded-full"
        />
        <div className="text-white">
          <p className="font-semibold">{receiver?.username}</p>
          <p className="text-sm text-gray-300">
            {isCallActive ? 'Connected' : (isConnecting ? 'Connecting...' : 'Ready')}
          </p>
        </div>
      </div>
    </div>
  );
}