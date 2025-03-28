import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { Home } from './components/Home';
import { Chat } from './components/Chat';
import { Call } from './components/Call';
import { Stories } from './components/Stories';
import { useAuthStore } from './store/authStore';
import { supabase } from './lib/supabase';

function App() {
  const { user, setUser } = useAuthStore();

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for changes on auth state (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!user) {
    return <Auth />;
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/home" />} />
          <Route path="/home" element={<Home />} />
          <Route path="/chat/:id" element={<Chat />} />
          <Route path="/call/:id" element={<Call />} />
          <Route path="/stories" element={<Stories />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;