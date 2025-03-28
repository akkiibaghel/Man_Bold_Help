import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { MessageSquare, Phone, Video, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Profile {
  id: string;
  username: string;
  avatar_url: string;
}

export function Home() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfiles = async () => {
      if (!user?.id) return;

      try {
        // First, try to get the user's profile
        const { data: existingProfile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        // Only create profile if it doesn't exist
        if (!existingProfile) {
          const { error: insertError } = await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              username: user.email?.split('@')[0] || 'User',
              avatar_url: null
            }, {
              onConflict: 'id'
            });

          if (insertError) {
            throw insertError;
          }
        }

        // Fetch all other profiles
        const { data: otherProfiles, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .neq('id', user.id);

        if (fetchError) {
          throw fetchError;
        }

        setProfiles(otherProfiles || []);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [user]);

  const handleChat = (profileId: string) => {
    navigate(`/chat/${profileId}`);
  };

  const handleVideoCall = (profileId: string) => {
    navigate(`/call/${profileId}?type=video`);
  };

  const handleVoiceCall = (profileId: string) => {
    navigate(`/call/${profileId}?type=voice`);
  };

  const handleViewStories = () => {
    navigate('/stories');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Connect with Others</h1>
        <button
          onClick={handleViewStories}
          className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Share2 size={20} />
          <span>View Stories</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profiles.map((profile) => (
          <div key={profile.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-4">
              <img
                src={profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.username}`}
                alt={profile.username}
                className="w-16 h-16 rounded-full"
              />
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{profile.username}</h3>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2">
              <button
                onClick={() => handleChat(profile.id)}
                className="flex items-center justify-center space-x-1 bg-purple-100 text-purple-600 py-2 px-3 rounded-lg hover:bg-purple-200 transition-colors"
                title="Send Message"
              >
                <MessageSquare size={18} />
                <span className="hidden sm:inline">Chat</span>
              </button>
              <button
                onClick={() => handleVoiceCall(profile.id)}
                className="flex items-center justify-center space-x-1 bg-green-100 text-green-600 py-2 px-3 rounded-lg hover:bg-green-200 transition-colors"
                title="Voice Call"
              >
                <Phone size={18} />
                <span className="hidden sm:inline">Call</span>
              </button>
              <button
                onClick={() => handleVideoCall(profile.id)}
                className="flex items-center justify-center space-x-1 bg-blue-100 text-blue-600 py-2 px-3 rounded-lg hover:bg-blue-200 transition-colors"
                title="Video Call"
              >
                <Video size={18} />
                <span className="hidden sm:inline">Video</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}