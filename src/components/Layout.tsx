import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LogOut, Users, Phone, BookOpen, MessageSquare } from 'lucide-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuthStore();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path: string) => {
    return location.pathname.startsWith(path) ? 'bg-purple-700' : '';
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-20 bg-purple-600 flex flex-col items-center py-8 space-y-8">
        <button
          onClick={() => navigate('/home')}
          className={`p-3 rounded-lg text-white hover:bg-purple-700 transition-colors ${isActive('/home')}`}
          title="Home"
        >
          <Users size={24} />
        </button>
        <button
          onClick={() => navigate('/chat')}
          className={`p-3 rounded-lg text-white hover:bg-purple-700 transition-colors ${isActive('/chat')}`}
          title="Messages"
        >
          <MessageSquare size={24} />
        </button>
        <button
          onClick={() => navigate('/calls')}
          className={`p-3 rounded-lg text-white hover:bg-purple-700 transition-colors ${isActive('/calls')}`}
          title="Calls"
        >
          <Phone size={24} />
        </button>
        <button
          onClick={() => navigate('/stories')}
          className={`p-3 rounded-lg text-white hover:bg-purple-700 transition-colors ${isActive('/stories')}`}
          title="Stories"
        >
          <BookOpen size={24} />
        </button>
        <button
          onClick={handleSignOut}
          className="p-3 rounded-lg text-white hover:bg-purple-700 transition-colors mt-auto"
          title="Sign Out"
        >
          <LogOut size={24} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden bg-gray-50">
        {children}
      </div>
    </div>
  );
}