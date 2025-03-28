import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { Send, Heart, MessageCircle, Image as ImageIcon, Share2, Globe } from 'lucide-react';

interface Story {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  image_url?: string;
  profiles: {
    username: string;
    avatar_url: string;
  };
  likes_count: number;
  comments_count: number;
  liked_by_user?: boolean;
  is_public: boolean;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  story_id: string;
  profiles: {
    username: string;
    avatar_url: string;
  };
}

export function Stories() {
  const [stories, setStories] = useState<Story[]>([]);
  const [newStory, setNewStory] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedStory, setSelectedStory] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const { user } = useAuthStore();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const { data, error } = await supabase
          .from('stories')
          .select(`
            *,
            profiles (
              username,
              avatar_url
            ),
            likes:story_likes(count),
            comments:story_comments(count),
            liked_by_user:story_likes!inner(user_id)
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const storiesWithCounts = data?.map(story => ({
          ...story,
          likes_count: story.likes[0]?.count || 0,
          comments_count: story.comments[0]?.count || 0,
          liked_by_user: story.liked_by_user.length > 0
        }));

        setStories(storiesWithCounts || []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching stories:', error);
        setLoading(false);
      }
    };

    fetchStories();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('stories_channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'stories'
      }, () => {
        fetchStories();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id]);

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
      .from('story-images')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('story-images')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newStory.trim() && !imageFile) || !user) return;

    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const { error } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          content: newStory.trim(),
          image_url: imageUrl,
          is_public: isPublic
        });

      if (error) throw error;

      setNewStory('');
      setImageFile(null);
      setImagePreview(null);
      setIsPublic(true);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error posting story:', error);
      alert('Failed to post story. Please try again.');
    }
  };

  const toggleLike = async (storyId: string, currentLiked: boolean) => {
    if (!user) return;

    try {
      if (currentLiked) {
        await supabase
          .from('story_likes')
          .delete()
          .eq('story_id', storyId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('story_likes')
          .insert({
            story_id: storyId,
            user_id: user.id
          });
      }

      setStories(current =>
        current.map(story =>
          story.id === storyId
            ? {
                ...story,
                likes_count: currentLiked
                  ? story.likes_count - 1
                  : story.likes_count + 1,
                liked_by_user: !currentLiked
              }
            : story
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const shareStory = async (storyId: string) => {
    try {
      const { data: story } = await supabase
        .from('stories')
        .select('*')
        .eq('id', storyId)
        .single();

      if (story) {
        const shareData = {
          title: 'Check out this story!',
          text: story.content,
          url: `${window.location.origin}/stories/${storyId}`
        };

        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(shareData.url);
          alert('Story link copied to clipboard!');
        }
      }
    } catch (error) {
      console.error('Error sharing story:', error);
    }
  };

  const fetchComments = async (storyId: string) => {
    try {
      const { data, error } = await supabase
        .from('story_comments')
        .select(`
          *,
          profiles (
            username,
            avatar_url
          )
        `)
        .eq('story_id', storyId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
      setSelectedStory(storyId);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const addComment = async (storyId: string) => {
    if (!newComment.trim() || !user) return;

    try {
      const { error } = await supabase
        .from('story_comments')
        .insert({
          story_id: storyId,
          user_id: user.id,
          content: newComment.trim()
        });

      if (error) throw error;

      setNewComment('');
      await fetchComments(storyId);
      
      setStories(current =>
        current.map(story =>
          story.id === storyId
            ? { ...story, comments_count: story.comments_count + 1 }
            : story
        )
      );
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const cancelImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Stories</h1>

      {/* Story Input */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="bg-white rounded-lg shadow-md p-4">
          <textarea
            value={newStory}
            onChange={(e) => setNewStory(e.target.value)}
            placeholder="Share your story..."
            className="w-full border rounded-lg p-4 mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
            rows={3}
          />
          {imagePreview && (
            <div className="relative inline-block mb-4">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-48 rounded"
              />
              <button
                type="button"
                onClick={cancelImage}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
              >
                ×
              </button>
            </div>
          )}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-gray-600 hover:text-gray-800 transition-colors"
                title="Add Image"
              >
                <ImageIcon size={24} />
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(!isPublic)}
                className={`text-gray-600 hover:text-gray-800 transition-colors ${
                  isPublic ? 'text-green-500' : 'text-gray-400'
                }`}
                title={isPublic ? 'Public Story' : 'Private Story'}
              >
                <Globe size={24} />
              </button>
            </div>
            <button
              type="submit"
              className="bg-purple-600 text-white rounded-lg px-6 py-2 hover:bg-purple-700 transition-colors flex items-center space-x-2"
            >
              <Send size={20} />
              <span>Share Story</span>
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
        </div>
      </form>

      {/* Stories List */}
      <div className="space-y-6">
        {stories.map((story) => (
          <div key={story.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <img
                  src={story.profiles.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${story.profiles.username}`}
                  alt={story.profiles.username}
                  className="w-12 h-12 rounded-full"
                />
                <div>
                  <h3 className="font-semibold text-gray-800">{story.profiles.username}</h3>
                  <p className="text-sm text-gray-500">
                    {format(new Date(story.created_at), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {story.is_public && (
                  <Globe size={18} className="text-green-500" title="Public Story" />
                )}
                <button
                  onClick={() => shareStory(story.id)}
                  className="text-gray-500 hover:text-gray-700"
                  title="Share Story"
                >
                  <Share2 size={18} />
                </button>
              </div>
            </div>
            
            {story.image_url && (
              <img
                src={story.image_url}
                alt="Story image"
                className="rounded-lg mb-4 max-w-full"
              />
            )}
            
            <p className="text-gray-700 whitespace-pre-wrap mb-4">{story.content}</p>
            
            <div className="flex items-center space-x-6 text-gray-500">
              <button
                onClick={() => toggleLike(story.id, story.liked_by_user || false)}
                className={`flex items-center space-x-2 transition-colors ${
                  story.liked_by_user ? 'text-red-500' : 'hover:text-red-500'
                }`}
              >
                <Heart
                  size={20}
                  fill={story.liked_by_user ? 'currentColor' : 'none'}
                />
                <span>{story.likes_count}</span>
              </button>
              <button
                onClick={() => fetchComments(story.id)}
                className="flex items-center space-x-2 hover:text-purple-500 transition-colors"
              >
                <MessageCircle size={20} />
                <span>{story.comments_count}</span>
              </button>
            </div>

            {/* Comments Section */}
            {selectedStory === story.id && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-semibold mb-4">Comments</h4>
                <div className="space-y-4 mb-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex space-x-3">
                      <img
                        src={comment.profiles.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${comment.profiles.username}`}
                        alt={comment.profiles.username}
                        className="w-8 h-8 rounded-full"
                      />
                      <div className="flex-1">
                        <div className="bg-gray-100 rounded-lg p-3">
                          <p className="font-medium text-sm">{comment.profiles.username}</p>
                          <p className="text-gray-700">{comment.content}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(new Date(comment.created_at), 'MMM d, HH:mm')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => addComment(story.id)}
                    className="bg-purple-600 text-white rounded-lg px-4 py-2 hover:bg-purple-700 transition-colors"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}