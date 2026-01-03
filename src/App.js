import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, query, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { Play, Pause, SkipBack, SkipForward, Volume2, Search, Home, Library, Sparkles, Zap, Wand2 } from 'lucide-react';

// --- Firebase Configuration ---
// グローバル変数から設定を取得し、フォールバックを用意
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "AIzaSyDaGkRiRbe54qV85-32ZS09AALS8KlGrLU",
      authDomain: "mymusicplayer-ef8f0.firebaseapp.com",
      projectId: "mymusicplayer-ef8f0",
      storageBucket: "mymusicplayer-ef8f0.firebasestorage.app",
      messagingSenderId: "305125896450",
      appId: "1:305125896450:web:eb15f3650452fe442f521b"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'firebeat-ai-pro-v2';

export default function App() {
  const [user, setUser] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const audioRef = useRef(new Audio());

  // --- Logic Functions ---

  const handleTrackSelect = (track) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  };

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.id === currentTrack?.id);
    const nextTrack = tracks[(idx + 1) % tracks.length];
    setCurrentTrack(nextTrack);
    setIsPlaying(true);
  }, [tracks, currentTrack]);

  const handlePrev = useCallback(() => {
    if (tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.id === currentTrack?.id);
    const prevTrack = tracks[(idx - 1 + tracks.length) % tracks.length];
    setCurrentTrack(prevTrack);
    setIsPlaying(true);
  }, [tracks, currentTrack]);

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio.duration) return;
    const newTime = (e.target.value / 100) * audio.duration;
    audio.currentTime = newTime;
    setProgress(e.target.value);
  };

  const runAiAnalysis = () => {
    if (tracks.length === 0) return;
    setAiAnalyzing(true);
    setTimeout(() => {
      setAiAnalyzing(false);
      const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
      setCurrentTrack(randomTrack);
      setIsPlaying(true);
    }, 2500);
  };

  // --- Effects ---

  // (1) 認証の初期化
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Authentication failed:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // (2) データの取得 (ユーザー認証後)
  useEffect(() => {
    if (!user) return;

    const tracksCollection = collection(db, 'artifacts', appId, 'public', 'data', 'tracks');

    // シードデータ投入（データが空の場合）
    const seedDataIfEmpty = async () => {
      try {
        const snap = await getDocs(tracksCollection);
        if (snap.empty) {
          const samples = [
            { 
              title: "Neon Dreams", 
              artist: "SynthWave AI", 
              cover: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&h=400&fit=crop", 
              url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" 
            },
            { 
              title: "Digital Horizon", 
              artist: "Data Beats", 
              cover: "https://images.unsplash.com/photo-1557683316-973673baf926?w=400&h=400&fit=crop", 
              url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" 
            }
          ];
          for (const s of samples) {
            await addDoc(tracksCollection, { ...s, createdAt: serverTimestamp() });
          }
        }
      } catch (err) {
        console.error("Seeding error:", err);
      }
    };
    seedDataIfEmpty();

    // リアルタイムリスナー
    const unsubscribe = onSnapshot(query(tracksCollection), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTracks(data);
      setLoading(false);
      if (data.length > 0 && !currentTrack) setCurrentTrack(data[0]);
    }, (error) => {
      console.error("Firestore listener error:", error);
    });

    return () => unsubscribe();
  }, [user, currentTrack]);

  // (3) オーディオ再生制御
  useEffect(() => {
    const audio = audioRef.current;
    if (currentTrack?.url && audio.src !== currentTrack.url) {
      audio.src = currentTrack.url;
      audio.load();
    }
    
    if (isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => setIsPlaying(false));
      }
    } else {
      audio.pause();
    }
  }, [currentTrack, isPlaying]);

  // (4) タイムアップデートと終了イベント
  useEffect(() => {
    const audio = audioRef.current;
    const up = () => audio.duration && setProgress((audio.currentTime / audio.duration) * 100);
    const ed = () => handleNext();
    audio.addEventListener('timeupdate', up);
    audio.addEventListener('ended', ed);
    return () => { 
      audio.removeEventListener('timeupdate', up); 
      audio.removeEventListener('ended', ed); 
    };
  }, [handleNext]);

  // (5) 音量
  useEffect(() => {
    audioRef.current.volume = volume;
  }, [volume]);

  return (
    <div className="flex h-screen bg-[#050505] text-zinc-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-black/80 backdrop-blur-md flex flex-col border-r border-zinc-800/50 p-6 hidden lg:flex shadow-2xl">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Zap size={24} className="text-white" fill="white" />
          </div>
          <span className="text-xl font-black italic tracking-tighter">FIREBEAT<span className="text-indigo-400">AI</span></span>
        </div>
        
        <nav className="space-y-8 flex-1">
          <div className="space-y-1">
            <NavItem icon={<Home size={20} />} label="ホーム" active />
            <NavItem icon={<Search size={20} />} label="検索" />
            <NavItem icon={<Library size={20} />} label="ライブラリ" />
          </div>
          
          <div className="pt-8 border-t border-zinc-800/50">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-6 px-3">Intelligence Engine</p>
            <button 
              onClick={runAiAnalysis}
              disabled={aiAnalyzing}
              className={`w-full group relative flex items-center gap-3 px-4 py-4 rounded-2xl transition-all duration-500 overflow-hidden ${aiAnalyzing ? 'bg-indigo-600' : 'bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20'}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <Sparkles size={20} className={`relative z-10 ${aiAnalyzing ? "animate-spin text-white" : "text-indigo-400 group-hover:text-white"}`} />
              <span className={`relative z-10 font-black text-xs uppercase tracking-widest ${aiAnalyzing ? "text-white" : "text-indigo-400 group-hover:text-white"}`}>
                {aiAnalyzing ? "Analyzing..." : "AI Auto-Pick"}
              </span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-[#080808] via-[#050505] to-[#0a0a0f]">
        <header className="p-10 flex justify-between items-center">
          <div>
            <h2 className="text-5xl font-black mb-3 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">
              {user ? "AI READY." : "CONNECTING..."}
            </h2>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-[0.3em]">
              {user ? `User: ${user.uid.slice(0, 8)}` : "Initializing Engine..."}
            </p>
          </div>
        </header>

        <div className="px-10 pb-40">
          <section className="mb-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
              <div className="h-56 rounded-[2.5rem] bg-gradient-to-br from-indigo-600 to-indigo-900 p-10 flex flex-col justify-end relative overflow-hidden group shadow-2xl shadow-indigo-500/10 cursor-pointer">
                <Sparkles className="absolute -top-6 -right-6 text-white/10 group-hover:scale-125 transition-transform duration-1000 group-hover:rotate-12" size={200} />
                <h3 className="text-3xl font-black relative z-10 italic">AI MIX VOL.1</h3>
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest mt-2 relative z-10">Curated for you</p>
              </div>
              <div className="h-56 rounded-[2.5rem] bg-zinc-900/50 border border-zinc-800/50 p-10 flex flex-col justify-end group cursor-pointer hover:border-zinc-700 transition-colors">
                <h3 className="text-3xl font-black italic">NEW RELEASES</h3>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-2">Latest AI Synthesis</p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-black flex items-center gap-3 tracking-widest uppercase">
                <Wand2 size={18} className="text-indigo-500" /> AI Suggestions
              </h3>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                {[1, 2, 3, 4].map(i => <div key={i} className="aspect-square bg-zinc-900/50 rounded-[2.5rem] animate-pulse" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                {tracks.map(track => (
                  <div 
                    key={track.id} 
                    onClick={() => handleTrackSelect(track)}
                    className={`group p-5 rounded-[2.5rem] transition-all duration-700 cursor-pointer border ${currentTrack?.id === track.id ? 'bg-indigo-600/10 border-indigo-500/30 shadow-2xl shadow-indigo-500/10 scale-[1.02]' : 'bg-zinc-900/20 border-transparent hover:bg-zinc-900/50 hover:border-zinc-800'}`}
                  >
                    <div className="relative aspect-square mb-6 overflow-hidden rounded-[1.8rem] shadow-2xl">
                      <img src={track.cover} className="w-full h-full object-cover transition-transform duration-[1.5s] group-hover:scale-110" alt="" />
                      <div className={`absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center transition-all duration-500 ${currentTrack?.id === track.id && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {currentTrack?.id === track.id && isPlaying ? 
                          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black shadow-2xl"><Pause fill="black" size={32} /></div> : 
                          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-transform"><Play fill="white" size={32} className="ml-1" /></div>
                        }
                      </div>
                    </div>
                    <h4 className="font-black truncate text-sm mb-1 tracking-tight">{track.title}</h4>
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">{track.artist}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Player Bar */}
      <footer className="fixed bottom-0 left-0 right-0 h-32 bg-black/40 backdrop-blur-3xl border-t border-zinc-800/30 px-10 flex items-center justify-between z-50">
        <div className="flex items-center gap-6 w-1/3">
          {currentTrack && (
            <>
              <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 ring-1 ring-white/5">
                <img src={currentTrack.cover} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="overflow-hidden">
                <h4 className="font-black text-sm truncate tracking-tight">{currentTrack.title}</h4>
                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1.5">{currentTrack.artist}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-4 flex-1 max-w-2xl px-12">
          <div className="flex items-center gap-10">
            <button onClick={handlePrev} className="text-zinc-600 hover:text-white transition-all hover:scale-110 active:scale-90"><SkipBack size={24} /></button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all"
            >
              {isPlaying ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" className="ml-1" />}
            </button>
            <button onClick={handleNext} className="text-zinc-600 hover:text-white transition-all hover:scale-110 active:scale-90"><SkipForward size={24} /></button>
          </div>
          
          <div className="w-full group px-2">
            <input 
              type="range" min="0" max="100" value={progress} onChange={handleSeek}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 outline-none transition-all group-hover:h-2"
            />
          </div>
        </div>

        <div className="w-1/3 flex justify-end items-center gap-5">
          <Volume2 size={20} className="text-zinc-600" />
          <input 
            type="range" min="0" max="1" step="0.01" value={volume} 
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-24 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-400 hover:accent-white transition-all" 
          />
        </div>
      </footer>
    </div>
  );
}

function NavItem({ icon, label, active = false }) {
  return (
    <div className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl cursor-pointer transition-all duration-500 ${active ? 'bg-indigo-600/10 text-white shadow-inner' : 'text-zinc-600 hover:text-zinc-200 hover:bg-white/5'}`}>
      <span className={active ? 'text-indigo-500' : ''}>{icon}</span>
      <span className="font-black text-[11px] uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
}
