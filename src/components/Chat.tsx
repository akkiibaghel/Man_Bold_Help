import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Send, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';

interface Message {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  image_url?: string;
}

interface Profile {
  id: string;
  username: string;
  avatar_url: string;
}

export function Chat() {
  const { id: receiverId } = useParams();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [receiver, setReceiver] = useState<Profile | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const fetchMessages = async () => {
      const { data: receiverData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', receiverId)
        .single();

      setReceiver(receiverData);

      const { data: messagesData } = await supabase
        .from('chats')
        .select('*')
        .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user?.id})`)
        .order('created_at', { ascending: true });

      setMessages(messagesData || []);
    };

    fetchMessages();

    // Subscribe to new messages and typing status
    const channel = supabase.channel(`chat:${receiverId}`);
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user !== user?.id) {
          setIsTyping(true);
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chats',
        filter: `or(and(sender_id.eq.${user?.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user?.id}))`
      }, (payload) => {
        setMessages(current => [...current, payload.new as Message]);
      })
      .subscribe();

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      channel.unsubscribe();
    };
  }, [receiverId, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleTyping = () => {
    const channel = supabase.channel(`chat:${receiverId}`);
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user: user?.id }
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${user?.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-images')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('chat-images')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !imageFile) || !user?.id) return;

    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const { error } = await supabase
        .from('chats')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          message: newMessage.trim(),
          image_url: imageUrl
        });

      if (error) throw error;

      setNewMessage('');
      setImageFile(null);
      setImagePreview(null);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const cancelImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="bg-white border-b p-4 flex items-center space-x-4">
        <img
          src={receiver?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${receiver?.username}`}
          alt={receiver?.username}
          className="w-10 h-10 rounded-full"
        />
        <div>
          <h2 className="text-lg font-semibold">{receiver?.username}</h2>
          {isTyping && (
            <p className="text-sm text-gray-500">typing...</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                message.sender_id === user?.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {message.image_url && (
                <img
                  src={message.image_url}
                  alt="Shared image"
                  className="rounded-lg mb-2 max-w-full"
                />
              )}
              {message.message && <p>{message.message}</p>}
              <p className={`text-xs mt-1 ${
                message.sender_id === user?.id ? 'text-purple-200' : 'text-gray-500'
              }`}>
                {format(new Date(message.created_at), 'HH:mm')}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="bg-gray-100 p-2">
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-32 rounded"
            />
            <button
              onClick={cancelImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <form onSubmit={sendMessage} className="bg-white border-t p-4">
        <div className="flex space-x-4">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleTyping}
            placeholder="Type a message..."
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-gray-100 text-gray-600 rounded-lg px-4 py-2 hover:bg-gray-200 transition-colors"
          >
            <ImageIcon size={20} />
          </button>
          <button
            type="submit"
            className="bg-purple-600 text-white rounded-lg px-6 py-2 hover:bg-purple-700 transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}