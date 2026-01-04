/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, Home, Library, ListMusic, Sparkles, Heart, Mic2, Search, Filter, MoreVertical, LayoutGrid, PlusSquare, Waves, Moon, Zap, Coffee, Ghost, AlertCircle } from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDaGkRiRbe54qV85-32ZS09AALS8KlGrLU",
  authDomain: "mymusicplayer-ef8f0.firebaseapp.com",
  projectId: "mymusicplayer-ef8f0",
  storageBucket: "mymusicplayer-ef8f0.firebasestorage.app",
  messagingSenderId: "305125896450",
  appId: "1:305125896450:web:eb15f3650452fe442f521b",
  measurementId: "G-4M73KXLS97"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'akiko-music-v1'; 

export default function App() {
  const [user, setUser] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [filteredTracks, setFilteredTracks] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [loading, setLoading] = useState(true);
  const [activePlaylist, setActivePlaylist] = useState('All');
  const [error, setError] = useState(null);
  
  const audioRef = useRef(new Audio());

  const playlists = [
    { id: 'All', label: 'All Songs', icon: <Home size={20} />, color: 'from-fuchsia-600 to-violet-600', glow: 'rgba(192, 38, 211, 0.1)' },
    { id: 'Chill', label: 'Chill Beats', icon: <Coffee size={18} />, color: 'from-rose-500 to-orange-400', glow: 'rgba(244, 63, 94, 0.1)' },
    { id: 'Energy', label: 'Energy Mix', icon: <Zap size={18} />, color: 'from-amber-500 to-yellow-300', glow: 'rgba(245, 158, 11, 0.1)' },
    { id: 'Focus', label: 'Focus Mode', icon: <Sparkles size={18} />, color: 'from-violet-500 to-cyan-400', glow: 'rgba(139, 92, 246, 0.1)' },
    { id: 'Night', label: 'Midnight City', icon: <Moon size={18} />, color: 'from-indigo-600 to-blue-400', glow: 'rgba(79, 70, 229, 0.1)' },
    { id: 'Nature', label: 'Nature Sounds', icon: <Waves size={18} />, color: 'from-emerald-500 to-teal-400', glow: 'rgba(16, 185, 129, 0.1)' },
  ];

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const tracksRef = collection(db, 'artifacts', appId, 'public', 'data', 'tracks');
    
    const unsubscribe = onSnapshot(query(tracksRef), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTracks(data);
      setLoading(false);
      if (data.length > 0 && !currentTrack) setCurrentTrack(data[0]);
    }, (error) => {
      console.error("Firestore Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (activePlaylist === 'All') {
      setFilteredTracks(tracks);
    } else {
      setFilteredTracks(tracks.filter(t => t.genre === activePlaylist));
    }
  }, [tracks, activePlaylist]);

  const handleTrackClick = (track) => {
    setError(null);
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  };

  const handleNext = () => {
    const list = filteredTracks.length > 0 ? filteredTracks : tracks;
    const idx = list.findIndex(t => t.id === currentTrack?.id);
    if (idx !== -1) {
      setCurrentTrack(list[(idx + 1) % list.length]);
      setIsPlaying(true);
    }
  };

  const handlePrev = () => {
    const list = filteredTracks.length > 0 ? filteredTracks : tracks;
    const idx = list.findIndex(t => t.id === currentTrack?.id);
    if (idx !== -1) {
      setCurrentTrack(list[(idx - 1 + list.length) % list.length]);
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (currentTrack?.url) {
      const audio = audioRef.current;
      audio.pause();
      audio.src = currentTrack.url;
      audio.load();
      if (isPlaying) {
        audio.play().catch(e => {
          setError("Playback Error: File unavailable");
          setIsPlaying(false);
        });
      }
    }
  }, [currentTrack]);

  useEffect(() => {
    if (isPlaying) {
      audioRef.current.play().catch(e => {
        setError("Playback Error: Failed to play");
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = volume;
    const up = () => audio.duration && setProgress((audio.currentTime / audio.duration) * 100);
    audio.addEventListener('timeupdate', up);
    audio.addEventListener('ended', handleNext);
    return () => {
      audio.removeEventListener('timeupdate', up);
      audio.removeEventListener('ended', handleNext);
    };
  }, [tracks, currentTrack, volume, filteredTracks]);

  // 現在のプレイリストの設定を取得
  const currentPlaylistStyle = playlists.find(p => p.id === activePlaylist) || playlists[0];

  return (
    <div className="flex h-screen bg-neutral-950 text-white font-sans overflow-hidden transition-colors duration-1000">
      
      {/* 1. 動く背景エフェクト (Background Glows) */}
      <div 
        className="fixed top-[-10%] left-[-10%] w-[60%] h-[60%] blur-[140px] rounded-full pointer-events-none animate-float transition-colors duration-1000" 
        style={{ backgroundColor: currentPlaylistStyle.glow }}
      />
      <div 
        className="fixed bottom-[-10%] right-[-10%] w-[60%] h-[60%] blur-[140px] rounded-full pointer-events-none animate-float-reverse transition-colors duration-1000" 
        style={{ backgroundColor: currentPlaylistStyle.glow }}
      />

      {/* 3. タイポグラフィ・デコレーション (Background Text) */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-[0.03] z-0">
        <h2 className="text-[25vw] font-black uppercase whitespace-nowrap leading-none tracking-tighter">
          {currentTrack?.artist || "AKIKO"}
        </h2>
      </div>

      {/* Sidebar */}
      <aside className="w-72 bg-black/40 backdrop-blur-3xl p-8 flex flex-col gap-10 hidden lg:flex border-r border-white/5 z-20">
        <div className="flex items-center gap-3 px-2">
          <div className={`w-10 h-10 bg-gradient-to-tr ${currentPlaylistStyle.color} rounded-xl flex items-center justify-center shadow-lg transition-all duration-1000`}>
            <Sparkles size={22} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-lg tracking-tight leading-none">AKIKO</span>
            <span className="text-[10px] text-neutral-500 font-bold tracking-[0.2em] uppercase">Sound System</span>
          </div>
        </div>
        
        <nav className="flex flex-col gap-8 text-sm">
          <div className="space-y-4">
            <p className="text-[11px] font-black text-neutral-600 uppercase tracking-[0.2em] px-3">Explore</p>
            <div className="space-y-1">
              <NavItem 
                icon={playlists[0].icon} 
                label={playlists[0].label} 
                active={activePlaylist === 'All'} 
                onClick={() => setActivePlaylist('All')} 
              />
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[11px] font-black text-neutral-600 uppercase tracking-[0.2em] px-3">Playlists</p>
            <div className="space-y-1">
              {playlists.filter(p => p.id !== 'All').map(p => (
                <NavItem 
                  key={p.id}
                  icon={p.icon} 
                  label={p.label} 
                  active={activePlaylist === p.id} 
                  onClick={() => setActivePlaylist(p.id)}
                  colorClass={p.color}
                />
              ))}
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-transparent p-8 lg:p-12 pb-44 z-10 relative">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-1">
            <div className={`inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 transition-all`}>
              Current Collection
            </div>
            <h1 className="text-5xl lg:text-7xl font-black tracking-tighter">
              {currentPlaylistStyle.label} <span className={`bg-clip-text text-transparent bg-gradient-to-r ${currentPlaylistStyle.color} italic transition-all duration-1000`}>Vibe</span>
            </h1>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-white/20" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
            {filteredTracks.map(track => (
              <div 
                key={track.id} 
                onClick={() => handleTrackClick(track)}
                className="group relative cursor-pointer"
              >
                {/* 2. レコード回転エフェクト (Record Spin) */}
                <div className="relative mb-5 flex items-center justify-center">
                  {/* Vinyl Disk Background (Hidden initially, slides out if current) */}
                  <div className={`absolute left-4 w-full h-full bg-neutral-900 rounded-full border-[8px] border-neutral-800 flex items-center justify-center transition-all duration-700 shadow-2xl z-0 ${currentTrack?.id === track.id && isPlaying ? 'translate-x-6 rotate-180 animate-slow-spin opacity-100' : 'translate-x-0 opacity-0'}`}>
                     <div className="w-12 h-12 rounded-full border-2 border-neutral-700 bg-neutral-900" />
                  </div>
                  
                  {/* Main Cover */}
                  <div className={`relative z-10 aspect-square w-full overflow-hidden rounded-[2.5rem] transition-all duration-700 ${currentTrack?.id === track.id ? 'scale-105 shadow-[0_25px_60px_rgba(0,0,0,0.6)] ring-2 ring-white/20' : 'hover:scale-[1.03] shadow-2xl'}`}>
                    {track.cover ? (
                      <img src={track.cover} alt="" className={`w-full h-full object-cover transition-all duration-1000 group-hover:scale-110 ${currentTrack?.id === track.id && isPlaying ? 'animate-slow-spin' : ''}`} />
                    ) : (
                      <div className="w-full h-full bg-neutral-900 flex items-center justify-center"><Music size={40} className="text-neutral-700" /></div>
                    )}
                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-500 ${currentTrack?.id === track.id && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <div className="w-16 h-16 bg-white/10 backdrop-blur-2xl rounded-full flex items-center justify-center border border-white/20">
                        {currentTrack?.id === track.id && isPlaying ? <Pause fill="white" size={28} /> : <Play fill="white" size={28} className="ml-1" />}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-3">
                  <h3 className={`font-black truncate text-base tracking-tight transition-colors ${currentTrack?.id === track.id ? 'text-white' : 'text-neutral-400 group-hover:text-white'}`}>{track.title}</h3>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                    {track.artist}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Player Bar */}
      <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[94%] max-w-6xl h-24 bg-neutral-900/60 backdrop-blur-3xl border border-white/5 rounded-[3rem] px-10 flex items-center justify-between z-50 shadow-[0_40px_100px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-5 w-1/4">
          {currentTrack && (
            <>
              <div className={`w-14 h-14 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 shrink-0 ${isPlaying ? 'animate-pulse' : ''}`}>
                <img src={currentTrack.cover} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="hidden sm:block overflow-hidden">
                <p className="text-sm font-black truncate">{currentTrack.title}</p>
                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">{currentTrack.artist}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 flex-1 max-w-xl px-6 relative">
          
          {/* 5. メカニカル・レベルメーター (Fake Mechanical Meter) */}
          <div className="flex gap-1 items-end h-8 mb-1 opacity-20 pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div 
                key={i}
                className={`w-1 bg-white transition-all duration-300 ${isPlaying ? 'animate-fake-bounce' : 'h-1'}`}
                style={{ 
                  animationDelay: `${i * 0.05}s`,
                  height: isPlaying ? 'auto' : '4px'
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-8">
            <button onClick={handlePrev} className="text-neutral-500 hover:text-white transition active:scale-75"><SkipBack size={20} fill="currentColor" /></button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              className={`w-12 h-12 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition active:scale-95 shadow-xl`}
            >
              {isPlaying ? <Pause size={22} fill="black" /> : <Play size={22} fill="black" className="ml-1" />}
            </button>
            <button onClick={handleNext} className="text-neutral-500 hover:text-white transition active:scale-75"><SkipForward size={20} fill="currentColor" /></button>
          </div>
          
          <div className="w-full flex items-center gap-3">
            <span className="text-[9px] font-black text-neutral-600 w-8 text-right tabular-nums">
              {Math.floor(audioRef.current.currentTime / 60)}:{String(Math.floor(audioRef.current.currentTime % 60)).padStart(2, '0')}
            </span>
            <div className="flex-1 bg-white/5 h-1.5 rounded-full overflow-hidden relative">
              <div className={`h-full rounded-full transition-all duration-300 bg-gradient-to-r ${currentPlaylistStyle.color}`} style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[9px] font-black text-neutral-600 w-8 tabular-nums">
              {audioRef.current.duration ? `${Math.floor(audioRef.current.duration / 60)}:${String(Math.floor(audioRef.current.duration % 60)).padStart(2, '0')}` : '0:00'}
            </span>
          </div>
        </div>

        <div className="w-1/4 flex justify-end items-center gap-4">
          <Volume2 size={16} className="text-neutral-600" />
          <div className="w-20 bg-white/5 h-1 rounded-full overflow-hidden">
             <div className="bg-white/20 h-full" style={{ width: `${volume * 100}%` }} />
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(5%, 10%) scale(1.1); }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-5%, -10%) scale(1.1); }
        }
        @keyframes slow-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fake-bounce {
          0%, 100% { height: 4px; }
          50% { height: 24px; }
        }
        .animate-float { animation: float 15s ease-in-out infinite; }
        .animate-float-reverse { animation: float-reverse 20s ease-in-out infinite; }
        .animate-slow-spin { animation: slow-spin 10s linear infinite; }
        .animate-fake-bounce { animation: fake-bounce 0.6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick, colorClass = "from-fuchsia-600 to-violet-600" }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-all duration-300 rounded-2xl group ${active ? 'bg-white/5 text-white ring-1 ring-white/10 shadow-lg' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'}`}
    >
      <div className="flex items-center gap-4">
        <div className={`transition-all ${active ? 'text-white' : 'group-hover:text-neutral-300'}`}>
          {icon}
        </div>
        <span className={`font-black uppercase tracking-[0.1em] text-[10px] ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
      </div>
      {active && <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${colorClass} shadow-lg`} />}
    </div>
  );
}
