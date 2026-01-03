import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, addDoc, serverTimestamp, getDocs, doc } from 'firebase/firestore';
import { Play, Pause, SkipBack, SkipForward, Volume2, Search, Home, Library, Zap, Sparkles } from 'lucide-react';

/**
 * Firebase Configuration
 */
const firebaseConfig = JSON.parse(__firebase_config);

// シングルトン初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'firebeat-ai-v3-final';

export default function App() {
  const [user, setUser] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [loading, setLoading] = useState(true);
  
  const audioRef = useRef(new Audio());

  const handleTrackSelect = useCallback((track) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(prev => !prev);
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  }, [currentTrack]);

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.id === currentTrack?.id);
    const nextIdx = (idx + 1) % tracks.length;
    setCurrentTrack(tracks[nextIdx]);
    setIsPlaying(true);
  }, [tracks, currentTrack]);

  const handlePrev = useCallback(() => {
    if (tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.id === currentTrack?.id);
    const prevIdx = (idx - 1 + tracks.length) % tracks.length;
    setCurrentTrack(tracks[prevIdx]);
    setIsPlaying(true);
  }, [tracks, currentTrack]);

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio.duration) return;
    const newTime = (e.target.value / 100) * audio.duration;
    audio.currentTime = newTime;
    setProgress(e.target.value);
  };

  /**
   * 認証フロー: トークンエラー時のフォールバック
   */
  useEffect(() => {
    const performAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            await signInWithCustomToken(auth, __initial_auth_token);
          } catch (tokenError) {
            console.warn("Custom token failed, falling back to anonymous auth:", tokenError.message);
            await signInAnonymously(auth);
          }
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Critical Auth error:", error);
      }
    };

    performAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Firestoreデータ購読 (RULE 1 & 3 準拠)
   */
  useEffect(() => {
    if (!user) return;
    
    // 正しい階層パス (artifacts -> appId -> public -> data -> tracks)
    const tracksCollection = collection(db, 'artifacts', appId, 'public', 'data', 'tracks');
    
    let isMounted = true;

    const setupData = async () => {
      try {
        const snap = await getDocs(tracksCollection);
        if (snap.empty && isMounted) {
          const samples = [
            { title: "AI Nebula", artist: "Neural Synth", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", cover: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400" },
            { title: "Cyber Horizon", artist: "Data Pulse", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", cover: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400" }
          ];
          for (const s of samples) {
            await addDoc(tracksCollection, { ...s, createdAt: serverTimestamp() });
          }
        }
      } catch (e) {
        console.error("Seeding Error:", e);
      }

      // 購読 (RULE 2: シンプルなクエリ)
      const unsubSnapshot = onSnapshot(tracksCollection, (snap) => {
        if (!isMounted) return;
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // メモリ内でソート
        const sortedData = data.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        
        setTracks(sortedData);
        setLoading(false);
        if (sortedData.length > 0 && !currentTrack) {
          setCurrentTrack(sortedData[0]);
        }
      }, (err) => {
        console.error("Snapshot Error:", err);
        setLoading(false);
      });

      return unsubSnapshot;
    };

    const unsubPromise = setupData();

    return () => {
      isMounted = false;
      unsubPromise.then(unsub => unsub && unsub());
    };
  }, [user, appId]);

  /**
   * オーディオ同期
   */
  useEffect(() => {
    const audio = audioRef.current;
    if (currentTrack?.url && audio.src !== currentTrack.url) {
      audio.src = currentTrack.url;
    }
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleNext);
    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', handleNext);
    };
  }, [handleNext]);

  useEffect(() => {
    audioRef.current.volume = volume;
  }, [volume]);

  if (loading) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl animate-pulse flex items-center justify-center">
          <Zap size={32} className="text-indigo-500 animate-bounce" />
        </div>
        <div className="text-zinc-500 font-bold text-xs uppercase tracking-widest animate-pulse">Initializing...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-black border-r border-zinc-800 p-6 hidden lg:flex flex-col">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Zap size={24} className="text-white" fill="white" />
          </div>
          <span className="text-xl font-black italic tracking-tighter">FIREBEAT<span className="text-indigo-400">AI</span></span>
        </div>
        <nav className="space-y-4 flex-1">
          <NavItem icon={Home} label="ホーム" active />
          <NavItem icon={Search} label="検索" />
          <NavItem icon={Library} label="ライブラリ" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-[#080808] to-[#050505] relative">
        <header className="p-8 sticky top-0 bg-[#050505]/80 backdrop-blur-md z-10 flex justify-between items-center">
          <div className="flex-1 max-w-md relative group">
            <label htmlFor="search-input" className="sr-only">楽曲を検索</label>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              id="search-input"
              type="text" 
              placeholder="アーティスト、楽曲..." 
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
        </header>

        <div className="px-8 pb-40">
          <section className="mb-12 mt-4">
            <h2 className="text-3xl font-black italic flex items-center gap-3 mb-8">
              <Sparkles className="text-indigo-500" /> AI READY
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {tracks.map(track => (
                <button 
                  key={track.id} 
                  onClick={() => handleTrackSelect(track)}
                  className={`group p-4 rounded-[2rem] transition-all duration-500 text-left border ${currentTrack?.id === track.id ? 'bg-indigo-600/10 border-indigo-500' : 'bg-zinc-900/20 border-transparent hover:bg-zinc-900/40 hover:border-zinc-800'}`}
                >
                  <div className="relative aspect-square mb-4 overflow-hidden rounded-[1.5rem] bg-zinc-800">
                    <img src={track.cover} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="" loading="lazy" />
                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${currentTrack?.id === track.id && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      {currentTrack?.id === track.id && isPlaying ? <Pause fill="white" size={48} /> : <Play fill="white" size={48} className="ml-1" />}
                    </div>
                  </div>
                  <h4 className="font-bold truncate text-sm">{track.title}</h4>
                  <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest mt-1">{track.artist}</p>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Player Bar */}
      <footer className="fixed bottom-0 left-0 right-0 h-32 bg-black/95 backdrop-blur-xl border-t border-zinc-800 px-8 flex items-center justify-between z-50">
        <div className="flex items-center gap-5 w-1/3">
          {currentTrack && (
            <>
              <div className="w-16 h-16 rounded-xl overflow-hidden border border-zinc-800">
                <img src={currentTrack.cover} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="overflow-hidden">
                <h4 className="font-bold text-sm truncate">{currentTrack.title}</h4>
                <p className="text-[10px] text-zinc-400 font-bold uppercase mt-1.5">{currentTrack.artist}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-4 flex-1 max-w-2xl px-8">
          <div className="flex items-center gap-8">
            <button onClick={handlePrev} className="text-zinc-400 hover:text-white"><SkipBack size={24} /></button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-all"
            >
              {isPlaying ? <Pause size={28} fill="black" /> : <Play size={28} fill="black" className="ml-1" />}
            </button>
            <button onClick={handleNext} className="text-zinc-400 hover:text-white"><SkipForward size={24} /></button>
          </div>
          <div className="w-full flex items-center gap-3">
            <span className="text-[10px] text-zinc-500 w-10 text-right">
              {audioRef.current.currentTime ? Math.floor(audioRef.current.currentTime / 60) + ":" + ("0" + Math.floor(audioRef.current.currentTime % 60)).slice(-2) : "0:00"}
            </span>
            <div className="flex-1 relative h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <input 
                type="range" min="0" max="100" value={progress} onChange={handleSeek}
                className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
              />
              <div className="bg-indigo-500 h-full" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] text-zinc-500 w-10">
              {audioRef.current.duration ? Math.floor(audioRef.current.duration / 60) + ":" + ("0" + Math.floor(audioRef.current.duration % 60)).slice(-2) : "0:00"}
            </span>
          </div>
        </div>

        <div className="w-1/3 flex justify-end items-center gap-4">
          <Volume2 size={20} className="text-zinc-400" />
          <input 
            type="range" min="0" max="1" step="0.01" value={volume} 
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-24 accent-white" 
          />
        </div>
      </footer>
    </div>
  );
}

function NavItem({ icon: Icon, label, active = false }) {
  return (
    <button className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${active ? 'bg-indigo-600/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
      <Icon size={20} className={active ? 'text-indigo-400' : ''} />
      <span className="font-bold text-xs uppercase tracking-widest">{label}</span>
    </button>
  );
}
