/* eslint-disable no-undef */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { Play, Pause, SkipBack, SkipForward, Volume2, Search, Home, Library, Zap, Sparkles, Wand2 } from 'lucide-react';

/**
 * Firebase Configuration
 */
const firebaseConfig = JSON.parse(__firebase_config);

// Firebaseサービスの初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'firebeat-ai-pro-v2-stable';

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

  /**
   * AI分析ロジック (演出用)
   */
  const runAiAnalysis = () => {
    if (tracks.length === 0) return;
    setAiAnalyzing(true);
    // 2.5秒の分析演出
    setTimeout(() => {
      setAiAnalyzing(false);
      const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
      setCurrentTrack(randomTrack);
      setIsPlaying(true);
    }, 2500);
  };

  /**
   * トラック操作ロジック
   */
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
   * 認証フロー (RULE 3)
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth initialization failed:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  /**
   * Firestoreデータ購読 (RULE 1, 2, 3)
   */
  useEffect(() => {
    if (!user) return;

    // RULE 1: 正しいセグメント数(5つ)でコレクションを参照
    const tracksCollection = collection(db, 'artifacts', appId, 'public', 'data', 'tracks');
    
    const setupDatabase = async () => {
      try {
        const snap = await getDocs(tracksCollection);
        if (snap.empty) {
          const samples = [
            { title: "AI Nebula", artist: "Neural Synth", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", cover: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400" },
            { title: "Cyber Horizon", artist: "Data Pulse", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", cover: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400" },
            { title: "Deep Thought", artist: "Logic Flow", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", cover: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400" }
          ];
          for (const s of samples) {
            await addDoc(tracksCollection, { ...s, createdAt: serverTimestamp() });
          }
        }
      } catch (e) {
        console.error("Database setup failed:", e);
      }

      // リアルタイム購読
      return onSnapshot(tracksCollection, (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const sorted = data.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        setTracks(sorted);
        setLoading(false);
        if (sorted.length > 0 && !currentTrack) setCurrentTrack(sorted[0]);
      }, (err) => {
        console.error("Firestore subscription error:", err);
        setLoading(false);
      });
    };

    const unsubPromise = setupDatabase();
    return () => unsubPromise.then(unsub => unsub && unsub());
  }, [user]);

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
    const up = () => audio.duration && setProgress((audio.currentTime / audio.duration) * 100);
    audio.addEventListener('timeupdate', up);
    audio.addEventListener('ended', handleNext);
    return () => {
      audio.removeEventListener('timeupdate', up);
      audio.removeEventListener('ended', handleNext);
    };
  }, [handleNext]);

  useEffect(() => {
    audioRef.current.volume = volume;
  }, [volume]);

  if (loading) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center space-y-6 text-white">
        <Zap size={48} className="text-indigo-500 animate-pulse" />
        <div className="flex flex-col items-center gap-2">
          <p className="text-zinc-500 font-black text-[10px] tracking-[0.3em] uppercase">FireBeat Engine Loading</p>
          <div className="w-32 h-1 bg-zinc-900 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 animate-[loading_2s_ease-in-out_infinite]" style={{ width: '40%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#050505] text-zinc-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-black/80 backdrop-blur-md flex flex-col border-r border-zinc-800/50 p-8 hidden lg:flex shadow-2xl">
        <div className="flex items-center gap-4 mb-16">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap size={28} className="text-white" fill="white" />
          </div>
          <span className="text-2xl font-black italic tracking-tighter uppercase">FIREBEAT<span className="text-indigo-400">AI</span></span>
        </div>
        
        <nav className="space-y-10 flex-1">
          <div className="space-y-2">
            <NavItem icon={<Home size={22} />} label="ホーム" active />
            <NavItem icon={<Search size={22} />} label="検索" />
            <NavItem icon={<Library size={22} />} label="ライブラリ" />
          </div>
          
          <div className="pt-10 border-t border-zinc-800/50">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.25em] mb-6 px-4">Intelligence Engine</p>
            <button 
              onClick={runAiAnalysis}
              disabled={aiAnalyzing}
              className={`w-full group relative flex items-center gap-4 px-5 py-5 rounded-[2rem] transition-all duration-500 overflow-hidden ${aiAnalyzing ? 'bg-indigo-600 scale-[0.98]' : 'bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 shadow-lg shadow-indigo-500/5'}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <Sparkles size={22} className={`relative z-10 ${aiAnalyzing ? "animate-spin text-white" : "text-indigo-400 group-hover:text-white"}`} />
              <span className={`relative z-10 font-black text-xs uppercase tracking-[0.15em] ${aiAnalyzing ? "text-white" : "text-indigo-400 group-hover:text-white"}`}>
                {aiAnalyzing ? "Analyzing..." : "AI Auto-Pick"}
              </span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-[#080808] via-[#050505] to-[#0a0a0f] relative">
        <header className="p-10 sticky top-0 z-20 bg-[#050505]/60 backdrop-blur-xl flex justify-between items-center">
          <div>
            <h2 className="text-6xl font-black mb-3 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-zinc-600">
              AI READY.
            </h2>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">Optimized Synthesis Experience</p>
          </div>
        </header>

        <div className="px-10 pb-48">
          <section className="mb-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-20">
              <div className="h-64 rounded-[3rem] bg-gradient-to-br from-indigo-600 to-purple-900 p-12 flex flex-col justify-end relative overflow-hidden group shadow-2xl shadow-indigo-500/10 cursor-pointer transition-transform hover:scale-[1.01]">
                <Sparkles className="absolute -top-10 -right-10 text-white/10 group-hover:scale-125 transition-transform duration-1000 group-hover:rotate-12" size={240} />
                <h3 className="text-4xl font-black relative z-10 italic tracking-tighter">AI MIX VOL.1</h3>
                <p className="text-white/60 text-[11px] font-black uppercase tracking-widest mt-3 relative z-10">Machine-Learned Curation</p>
              </div>
              <div className="h-64 rounded-[3rem] bg-zinc-900/40 border border-zinc-800/50 p-12 flex flex-col justify-end group cursor-pointer hover:border-zinc-700 transition-all hover:bg-zinc-900/60 shadow-xl">
                <h3 className="text-4xl font-black italic tracking-tighter">DISCOVER</h3>
                <p className="text-zinc-500 text-[11px] font-black uppercase tracking-widest mt-3">Latest Neural Synthesis</p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-10">
              <h3 className="text-xl font-black flex items-center gap-4 tracking-[0.2em] uppercase">
                <Wand2 size={20} className="text-indigo-500" /> AI Suggestions
              </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-10">
              {tracks.map(track => (
                <div 
                  key={track.id} 
                  onClick={() => handleTrackSelect(track)}
                  className={`group p-6 rounded-[3rem] transition-all duration-700 cursor-pointer border ${currentTrack?.id === track.id ? 'bg-indigo-600/10 border-indigo-500/30 shadow-2xl shadow-indigo-500/10 scale-[1.03]' : 'bg-zinc-900/20 border-transparent hover:bg-zinc-900/50 hover:border-zinc-800 hover:translate-y-[-4px]'}`}
                >
                  <div className="relative aspect-square mb-8 overflow-hidden rounded-[2.2rem] shadow-2xl ring-1 ring-white/5">
                    <img src={track.cover} className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110" alt="" />
                    <div className={`absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center transition-all duration-500 ${currentTrack?.id === track.id && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      {currentTrack?.id === track.id && isPlaying ? 
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-black shadow-2xl scale-110"><Pause fill="black" size={36} /></div> : 
                        <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-all duration-500"><Play fill="white" size={36} className="ml-1" /></div>
                      }
                    </div>
                  </div>
                  <div className="px-2">
                    <h4 className="font-black truncate text-base mb-1.5 tracking-tight">{track.title}</h4>
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.25em]">{track.artist}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Player Bar */}
      <footer className="fixed bottom-0 left-0 right-0 h-36 bg-black/50 backdrop-blur-3xl border-t border-zinc-800/40 px-12 flex items-center justify-between z-50">
        <div className="flex items-center gap-8 w-1/3">
          {currentTrack && (
            <>
              <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 ring-1 ring-white/10 shrink-0">
                <img src={currentTrack.cover} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="overflow-hidden">
                <h4 className="font-black text-lg truncate tracking-tighter leading-tight">{currentTrack.title}</h4>
                <p className="text-[11px] text-zinc-500 font-black uppercase tracking-[0.2em] mt-2">{currentTrack.artist}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-5 flex-1 max-w-2xl px-12">
          <div className="flex items-center gap-12">
            <button onClick={handlePrev} className="text-zinc-600 hover:text-white transition-all hover:scale-110 active:scale-90"><SkipBack size={28} /></button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-black shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:scale-105 active:scale-95 transition-all duration-500"
            >
              {isPlaying ? <Pause size={36} fill="black" /> : <Play size={36} fill="black" className="ml-1" />}
            </button>
            <button onClick={handleNext} className="text-zinc-600 hover:text-white transition-all hover:scale-110 active:scale-90"><SkipForward size={28} /></button>
          </div>
          
          <div className="w-full flex items-center gap-4 group">
            <span className="text-[10px] text-zinc-600 font-black w-10 text-right">
              {audioRef.current.currentTime ? Math.floor(audioRef.current.currentTime / 60) + ":" + ("0" + Math.floor(audioRef.current.currentTime % 60)).slice(-2) : "0:00"}
            </span>
            <div className="flex-1 relative h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <input 
                type="range" min="0" max="100" value={progress} onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="h-full bg-indigo-500 transition-all duration-100 rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] text-zinc-600 font-black w-10">
              {audioRef.current.duration ? Math.floor(audioRef.current.duration / 60) + ":" + ("0" + Math.floor(audioRef.current.duration % 60)).slice(-2) : "0:00"}
            </span>
          </div>
        </div>

        <div className="w-1/3 flex justify-end items-center gap-6">
          <Volume2 size={22} className="text-zinc-600" />
          <input 
            type="range" min="0" max="1" step="0.01" value={volume} 
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-32 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white hover:accent-indigo-400 transition-all" 
          />
        </div>
      </footer>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        input[type=range]::-webkit-slider-thumb {
          appearance: none;
        }
      `}</style>
    </div>
  );
}

/**
 * サイドバーアイテム
 */
function NavItem({ icon, label, active = false }) {
  return (
    <div className={`flex items-center gap-5 px-5 py-4.5 rounded-[1.5rem] cursor-pointer transition-all duration-500 ${active ? 'bg-indigo-600/10 text-white shadow-inner ring-1 ring-white/5' : 'text-zinc-600 hover:text-zinc-200 hover:bg-white/5'}`}>
      <span className={active ? 'text-indigo-500' : ''}>{icon}</span>
      <span className="font-black text-[12px] uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
}
