import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, serverTimestamp } from 'firebase/firestore';
import { Play, Pause, SkipForward, SkipBack, Music, Plus, Trash2, Volume2, ListMusic, Disc, AlertCircle } from 'lucide-react';

// --- Firebase Configuration ---
// 提供された設定をベースにし、プレビュー環境のフォールバックを組み込みます
let firebaseConfig = {
  apiKey: "AIzaSyDaGkRiRbe54qV85-32ZS09AALS8KlGrLU",
  authDomain: "mymusicplayer-ef8f0.firebaseapp.com",
  projectId: "mymusicplayer-ef8f0",
  storageBucket: "mymusicplayer-ef8f0.firebasestorage.app",
  messagingSenderId: "305125896450",
  appId: "1:305125896450:web:eb15f3650452fe442f521b",
  measurementId: "G-4M73KXLS97"
};

// プレビュー環境用の自動フォールバック（APIキーがプレースホルダーの場合など）
if (typeof __firebase_config !== 'undefined') {
  try {
    const envConfig = JSON.parse(__firebase_config);
    if (envConfig && envConfig.apiKey) {
      firebaseConfig = envConfig;
    }
  } catch (e) {
    console.error("Firebase config parse error:", e);
  }
}

// 唯一の初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'music-player-app';

export default function App() {
  const [user, setUser] = useState(null);
  const [songs, setSongs] = useState([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSong, setNewSong] = useState({ title: '', artist: '', url: '', cover: '' });
  const [authError, setAuthError] = useState(null);

  const audioRef = useRef(null);

  // --- Auth & Firestore Setup ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
        setAuthError(null);
      } catch (error) {
        console.error("Auth error:", error);
        setAuthError(error.message);
      }
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (userData) => {
      setUser(userData);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch songs from public collection
    // RULE 1: /artifacts/{appId}/public/data/{collectionName}
    const songsCol = collection(db, 'artifacts', appId, 'public', 'data', 'songs');
    const unsubscribeSongs = onSnapshot(songsCol, 
      (snapshot) => {
        const songsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // JavaScript memory sort (RULE 2: No complex queries)
        setSongs(songsList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      },
      (error) => {
        console.error("Firestore error:", error);
      }
    );

    return () => unsubscribeSongs();
  }, [user]);

  // --- Audio Logic ---
  const currentSong = songs[currentSongIndex];

  useEffect(() => {
    if (isPlaying && audioRef.current && currentSong) {
      audioRef.current.play().catch(e => {
        console.error("Playback error:", e);
        setIsPlaying(false);
      });
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [isPlaying, currentSongIndex, currentSong]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration || 0;
      setProgress(total > 0 ? (current / total) * 100 : 0);
      setDuration(total);
    }
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = (val / 100) * audioRef.current.duration;
      setProgress(val);
    }
  };

  const handleNext = () => {
    if (songs.length === 0) return;
    setCurrentSongIndex((prev) => (prev + 1) % songs.length);
  };

  const handlePrev = () => {
    if (songs.length === 0) return;
    setCurrentSongIndex((prev) => (prev - 1 + songs.length) % songs.length);
  };

  // --- Database Operations ---
  const addSong = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      const songsCol = collection(db, 'artifacts', appId, 'public', 'data', 'songs');
      await addDoc(songsCol, {
        ...newSong,
        createdAt: serverTimestamp(),
        userId: user.uid
      });
      setNewSong({ title: '', artist: '', url: '', cover: '' });
      setShowAddModal(false);
    } catch (error) {
      console.error("Error adding song:", error);
    }
  };

  const deleteSong = async (id) => {
    if (!user) return;
    try {
      const songDoc = doc(db, 'artifacts', appId, 'public', 'data', 'songs', id);
      await deleteDoc(songDoc);
    } catch (error) {
      console.error("Error deleting song:", error);
    }
  };

  if (authError) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-900 text-white p-6 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Firebase設定エラー</h2>
        <p className="text-slate-400 mb-6 max-w-md">{authError}</p>
      </div>
    );
  }

  if (!user) return (
    <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-32">
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Disc className="text-indigo-500 animate-spin-slow" size={32} />
          <h1 className="text-2xl font-bold tracking-tight">Cloud<span className="text-indigo-500">Player</span></h1>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-full flex items-center gap-2 transition-all shadow-lg shadow-indigo-900/20"
        >
          <Plus size={18} /> 曲を追加
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <ListMusic size={20} className="text-indigo-400" /> 
            プレイリスト ({songs.length})
          </h2>
          
          {songs.length === 0 ? (
            <div className="bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-xl p-12 text-center text-slate-500">
              <Music size={48} className="mx-auto mb-4 opacity-20" />
              <p>曲がありません。右上のボタンから追加してください。</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {songs.map((song, index) => (
                <div 
                  key={song.id}
                  className={`group flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer ${
                    index === currentSongIndex 
                      ? 'bg-indigo-600/20 border border-indigo-500/30' 
                      : 'bg-slate-900 hover:bg-slate-800'
                  }`}
                  onClick={() => {
                    setCurrentSongIndex(index);
                    setIsPlaying(true);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center overflow-hidden">
                      {song.cover ? (
                        <img src={song.cover} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Music className="text-slate-600" />
                      )}
                    </div>
                    <div>
                      <p className={`font-medium ${index === currentSongIndex ? 'text-indigo-400' : ''}`}>{song.title}</p>
                      <p className="text-sm text-slate-400">{song.artist}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSong(song.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-400 transition-opacity"
                    >
                      <Trash2 size={18} />
                    </button>
                    {index === currentSongIndex && isPlaying && (
                      <div className="flex gap-1">
                        <div className="w-1 h-4 bg-indigo-500 animate-pulse"></div>
                        <div className="w-1 h-4 bg-indigo-500 animate-pulse delay-75"></div>
                        <div className="w-1 h-4 bg-indigo-500 animate-pulse delay-150"></div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Persistent Player Controls */}
      {currentSong && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-xl border-t border-white/5 p-4 z-20 shadow-2xl">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-4 md:gap-8">
            
            <div className="flex items-center gap-4 w-full md:w-1/4">
              <div className="w-14 h-14 rounded-lg bg-indigo-900/50 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/10">
                 {currentSong.cover ? (
                   <img src={currentSong.cover} alt="" className="w-full h-full object-cover" />
                 ) : (
                   <Music className="text-indigo-400" />
                 )}
              </div>
              <div className="overflow-hidden">
                <p className="font-bold truncate">{currentSong.title}</p>
                <p className="text-xs text-slate-400 truncate">{currentSong.artist}</p>
              </div>
            </div>

            <div className="flex flex-col items-center flex-grow w-full md:w-auto">
              <div className="flex items-center gap-6 mb-2">
                <button onClick={handlePrev} className="text-slate-400 hover:text-white transition-colors">
                  <SkipBack fill="currentColor" size={24} />
                </button>
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
                >
                  {isPlaying ? <Pause fill="black" size={24} /> : <Play className="ml-1" fill="black" size={24} />}
                </button>
                <button onClick={handleNext} className="text-slate-400 hover:text-white transition-colors">
                  <SkipForward fill="currentColor" size={24} />
                </button>
              </div>
              
              <div className="flex items-center gap-3 w-full max-w-xl">
                <span className="text-[10px] text-slate-500 w-10 text-right">
                  {formatTime(audioRef.current?.currentTime || 0)}
                </span>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={handleSeek}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <span className="text-[10px] text-slate-500 w-10">
                  {formatTime(duration)}
                </span>
              </div>
            </div>

            <div className="hidden md:flex items-center justify-end gap-3 w-1/4">
              <Volume2 size={20} className="text-slate-400" />
              <div className="w-24 h-1 bg-slate-700 rounded-full">
                <div className="w-2/3 h-full bg-slate-400 rounded-full"></div>
              </div>
            </div>

            <audio 
              ref={audioRef}
              src={currentSong.url}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleNext}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Add Song Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-6">新しい曲を追加</h3>
            <form onSubmit={addSong} className="space-y-4">
              <div>
                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">タイトル</label>
                <input 
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="曲名を入力"
                  value={newSong.title}
                  onChange={(e) => setNewSong({...newSong, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">アーティスト</label>
                <input 
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="アーティスト名を入力"
                  value={newSong.artist}
                  onChange={(e) => setNewSong({...newSong, artist: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">音源URL (.mp3)</label>
                <input 
                  required
                  type="url"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://example.com/song.mp3"
                  value={newSong.url}
                  onChange={(e) => setNewSong({...newSong, url: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">カバー画像URL (任意)</label>
                <input 
                  type="url"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://images.com/cover.jpg"
                  value={newSong.cover}
                  onChange={(e) => setNewSong({...newSong, cover: e.target.value})}
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl transition-colors"
                >
                  キャンセル
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold transition-colors"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
}

function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
