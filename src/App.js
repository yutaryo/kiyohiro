
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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const audioRef = useRef(new Audio());

  // プレイリストカラーをより明るくエネルギッシュに変更
  const playlists = [
    { id: 'All', label: 'All Songs', icon: <Home size={20} />, color: 'from-fuchsia-400 to-indigo-500', glow: 'rgba(192, 38, 211, 0.4)', text: 'fuchsia' },
    { id: 'Chill', label: 'Chill Beats', icon: <Coffee size={18} />, color: 'from-rose-400 to-pink-600', glow: 'rgba(251, 113, 133, 0.4)', text: 'rose' },
    { id: 'Energy', label: 'Energy Mix', icon: <Zap size={18} />, color: 'from-yellow-300 to-orange-500', glow: 'rgba(253, 224, 71, 0.4)', text: 'yellow' },
    { id: 'Focus', label: 'Focus Mode', icon: <Sparkles size={18} />, color: 'from-cyan-300 to-blue-500', glow: 'rgba(103, 232, 249, 0.4)', text: 'cyan' },
    { id: 'Night', label: 'Midnight City', icon: <Moon size={18} />, color: 'from-violet-400 to-purple-800', glow: 'rgba(167, 139, 250, 0.4)', text: 'violet' },
    { id: 'Nature', label: 'Nature Sounds', icon: <Waves size={18} />, color: 'from-emerald-300 to-teal-500', glow: 'rgba(110, 231, 183, 0.4)', text: 'emerald' },
  ];

  useEffect(() => {
    const handleMove = (e) => {
      setMousePos({ x: (e.clientX / window.innerWidth - 0.5) * 30, y: (e.clientY / window.innerHeight - 0.5) * 30 });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

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
          setError("Playback Error");
          setIsPlaying(false);
        });
      }
    }
  }, [currentTrack]);

  useEffect(() => {
    if (isPlaying) {
      audioRef.current.play().catch(e => {
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

  const currentPlaylistStyle = playlists.find(p => p.id === activePlaylist) || playlists[0];

  return (
    <div className="flex h-screen bg-[#020202] text-white font-sans overflow-hidden transition-colors duration-1000">
      
      {/* Background Glows */}
      <div 
        className="fixed top-[-10%] left-[-10%] w-[80%] h-[80%] blur-[200px] rounded-full pointer-events-none transition-all duration-1000 opacity-60" 
        style={{ 
          backgroundColor: currentPlaylistStyle.glow,
          transform: `translate(${mousePos.x}px, ${mousePos.y}px)`
        }}
      />
      <div 
        className="fixed bottom-[-10%] right-[-10%] w-[80%] h-[80%] blur-[200px] rounded-full pointer-events-none transition-all duration-1000 opacity-60" 
        style={{ 
          backgroundColor: currentPlaylistStyle.glow,
          transform: `translate(${-mousePos.x}px, ${-mousePos.y}px)`
        }}
      />

      {/* Dynamic Background Text (Colored) */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
        <h2 key={currentTrack?.id} className={`text-[30vw] font-black uppercase whitespace-nowrap leading-none tracking-tighter opacity-[0.03] animate-text-reveal transition-colors duration-1000 text-${currentPlaylistStyle.text}-400`}>
          {currentTrack?.artist || "AKIKO"}
        </h2>
      </div>

      {/* Sidebar */}
      <aside className="w-72 bg-black/60 backdrop-blur-3xl p-8 flex flex-col gap-10 hidden lg:flex border-r border-white/5 z-20 relative">
        <div className="flex items-center gap-3 px-2">
          <div className={`w-11 h-11 bg-gradient-to-tr ${currentPlaylistStyle.color} rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all duration-1000 ring-2 ring-white/20`}>
            <Sparkles size={22} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-xl tracking-tight leading-none">AKIKO</span>
            <span className="text-[10px] text-neutral-500 font-bold tracking-[0.2em] uppercase mt-1">Sound Vision</span>
          </div>
        </div>
        
        <nav className="flex flex-col gap-10 text-sm">
          <div className="space-y-4">
            <p className="text-[11px] font-black text-neutral-600 uppercase tracking-[0.2em] px-3">Main</p>
            <div className="space-y-2">
              <NavItem 
                icon={playlists[0].icon} 
                label={playlists[0].label} 
                active={activePlaylist === 'All'} 
                onClick={() => setActivePlaylist('All')} 
              />
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[11px] font-black text-neutral-600 uppercase tracking-[0.2em] px-3">Filter by Vibe</p>
            <div className="space-y-2">
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

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-transparent p-8 lg:p-14 pb-64 z-10 relative scroll-smooth">
        <header className="mb-14 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="flex-1 animate-slide-in">
            <div className={`inline-block px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-[11px] font-black uppercase tracking-widest mb-6 backdrop-blur-xl`}>
              {tracks.length} Masterpieces
            </div>
            <h1 className="text-7xl lg:text-9xl font-black tracking-tighter leading-none">
              {currentPlaylistStyle.label} <br/>
              <span className={`bg-clip-text text-transparent bg-gradient-to-r ${currentPlaylistStyle.color} italic transition-all duration-1000`}>
                Flow
              </span>
            </h1>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-12 h-12 border-4 border-white/5 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-x-10 gap-y-16">
            {filteredTracks.map(track => (
              <div 
                key={track.id} 
                onClick={() => handleTrackClick(track)}
                className="group relative cursor-pointer"
              >
                {/* Image & Glow Effect */}
                <div className="relative mb-6">
                  
                  {/* Active Aura Glow (後ろで光る) */}
                  <div className={`absolute -inset-4 bg-gradient-to-tr ${currentPlaylistStyle.color} blur-3xl opacity-0 transition-opacity duration-700 pointer-events-none rounded-full ${currentTrack?.id === track.id && isPlaying ? 'opacity-40 animate-pulse-slow' : 'group-hover:opacity-20'}`} />
                  
                  {/* Main Cover Card */}
                  <div className={`relative z-10 aspect-square w-full overflow-hidden rounded-[2rem] transition-all duration-500 ${currentTrack?.id === track.id ? `scale-105 shadow-[0_20px_60px_rgba(0,0,0,0.8)] ring-4 ring-white/30` : 'hover:scale-105 shadow-2xl ring-1 ring-white/5 group-hover:ring-white/20'}`}>
                    {track.cover ? (
                      <img src={track.cover} alt="" className={`w-full h-full object-cover transition-all duration-1000 group-hover:scale-110`} />
                    ) : (
                      <div className="w-full h-full bg-neutral-900 flex items-center justify-center"><Music size={48} className="text-neutral-700" /></div>
                    )}
                    
                    {/* Active Overlay Tint */}
                    {currentTrack?.id === track.id && (
                      <div className={`absolute inset-0 bg-gradient-to-t ${currentPlaylistStyle.color} opacity-40 mix-blend-overlay`} />
                    )}

                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-all duration-500 ${currentTrack?.id === track.id && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <div className="w-20 h-20 bg-white/20 backdrop-blur-3xl rounded-full flex items-center justify-center border border-white/40 shadow-2xl scale-90 group-hover:scale-100 transition-transform">
                        {currentTrack?.id === track.id && isPlaying ? <Pause fill="white" size={32} /> : <Play fill="white" size={32} className="ml-1" />}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-2 transition-transform duration-300 group-hover:translate-x-1">
                  <h3 className={`font-black truncate text-lg tracking-tight transition-all duration-300 ${currentTrack?.id === track.id ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'text-neutral-400 group-hover:text-white'}`}>
                    {track.title}
                  </h3>
                  <p className="text-[11px] text-neutral-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                    {track.artist}
                    {currentTrack?.id === track.id && isPlaying && <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${currentPlaylistStyle.color} animate-ping`} />}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Control Bar */}
      <footer className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[94%] max-w-7xl h-24 bg-black/70 backdrop-blur-[50px] border border-white/10 rounded-[3.5rem] px-14 flex items-center justify-between z-50 shadow-[0_50px_120px_rgba(0,0,0,1)] ring-1 ring-white/10">
        
        <div className="flex items-center gap-6 w-1/4 min-w-0">
          {currentTrack && (
            <>
              <div className={`w-14 h-14 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(255,255,255,0.1)] ring-2 ring-white/20 shrink-0 ${isPlaying ? 'animate-pulse' : ''}`}>
                <img src={currentTrack.cover} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="hidden sm:block overflow-hidden">
                <p className="text-[15px] font-black truncate text-white leading-tight">{currentTrack.title}</p>
                <p className="text-[10px] text-neutral-500 font-black uppercase tracking-[0.2em] mt-1.5">{currentTrack.artist}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 flex-1 max-w-2xl px-12 relative">
          
          {/* Fake Visualizer (Luminous) */}
          <div className="flex gap-1.5 items-end h-7 mb-1 opacity-40 pointer-events-none">
            {[...Array(28)].map((_, i) => (
              <div 
                key={i}
                className={`w-[3px] bg-gradient-to-t ${currentPlaylistStyle.color} transition-all duration-300 rounded-full ${isPlaying ? 'animate-fake-bounce' : 'h-1'}`}
                style={{ 
                  animationDelay: `${i * 0.03}s`,
                  height: isPlaying ? 'auto' : '3px'
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-12">
            <button onClick={handlePrev} className="text-neutral-500 hover:text-white transition-all hover:scale-125 active:scale-90"><SkipBack size={22} fill="currentColor" /></button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              className={`w-16 h-16 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition shadow-[0_0_40px_rgba(255,255,255,0.4)] active:scale-95`}
            >
              {isPlaying ? <Pause size={28} fill="black" /> : <Play size={28} fill="black" className="ml-1" />}
            </button>
            <button onClick={handleNext} className="text-neutral-500 hover:text-white transition-all hover:scale-125 active:scale-90"><SkipForward size={22} fill="currentColor" /></button>
          </div>
          
          <div className="w-full flex items-center gap-4 group">
            <span className="text-[10px] font-black text-neutral-500 w-10 text-right tabular-nums">
              {Math.floor(audioRef.current.currentTime / 60)}:{String(Math.floor(audioRef.current.currentTime % 60)).padStart(2, '0')}
            </span>
            <div className="flex-1 bg-white/10 h-2 rounded-full overflow-hidden relative cursor-pointer ring-1 ring-white/5">
              <div className={`h-full rounded-full transition-all duration-300 bg-gradient-to-r ${currentPlaylistStyle.color} shadow-[0_0_20px_white]`} style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] font-black text-neutral-500 w-10 tabular-nums">
              {audioRef.current.duration ? `${Math.floor(audioRef.current.duration / 60)}:${String(Math.floor(audioRef.current.duration % 60)).padStart(2, '0')}` : '0:00'}
            </span>
          </div>
        </div>

        <div className="w-1/4 flex justify-end items-center gap-6">
          <div className="flex items-center gap-4">
            <Volume2 size={20} className="text-neutral-500" />
            <div className="w-28 bg-white/10 h-1.5 rounded-full overflow-hidden relative group cursor-pointer border border-white/5">
               <div className="bg-white/40 h-full rounded-full group-hover:bg-white transition-colors" style={{ width: `${volume * 100}%` }} />
            </div>
          </div>
        </div>
      </footer>

      {/* Global Styles & Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(3%, 4%) scale(1.1); }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-3%, -4%) scale(1.1); }
        }
        @keyframes fake-bounce {
          0%, 100% { height: 3px; opacity: 0.2; }
          50% { height: 26px; opacity: 1; }
        }
        @keyframes text-reveal {
          from { transform: translateY(40px) scale(0.9); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 0.04; }
        }
        @keyframes slide-in {
          from { transform: translateX(-20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.4; filter: blur(40px); }
          50% { transform: scale(1.1); opacity: 0.6; filter: blur(60px); }
        }
        .animate-float { animation: float 25s ease-in-out infinite; }
        .animate-float-reverse { animation: float-reverse 30s ease-in-out infinite; }
        .animate-fake-bounce { animation: fake-bounce 0.5s ease-in-out infinite; }
        .animate-text-reveal { animation: text-reveal 2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-in { animation: slide-in 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick, colorClass = "from-fuchsia-600 to-violet-600" }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between px-6 py-4 cursor-pointer transition-all duration-500 rounded-[2rem] group relative overflow-hidden ${active ? 'bg-white/10 text-white shadow-[0_0_40px_rgba(255,255,255,0.05)] ring-2 ring-white/20' : 'text-neutral-500 hover:text-neutral-100 hover:bg-white/5'}`}
    >
      <div className="flex items-center gap-5 z-10">
        <div className={`transition-all duration-500 ${active ? 'scale-125 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'group-hover:scale-110 group-hover:text-neutral-100'}`}>
          {icon}
        </div>
        <span className={`font-black uppercase tracking-[0.2em] text-[11px] ${active ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`}>{label}</span>
      </div>
      {active && (
        <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${colorClass} shadow-[0_0_20px_rgba(255,255,255,1)] z-10 animate-pulse`} />
      )}
    </div>
  );
}
