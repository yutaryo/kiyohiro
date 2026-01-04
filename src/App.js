/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, Home, Library, ListMusic, Sparkles, Heart, Mic2, Search, Filter, MoreVertical, LayoutGrid, PlusSquare, Waves, Moon, Zap, Coffee, Ghost, AlertCircle, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const audioRef = useRef(new Audio());
  const scrollContainerRef = useRef(null);
  const activeTrackRef = useRef(null); // 再生中の要素を指すRef

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

  // 曲が変わったときに中央へスクロールさせる処理
  useEffect(() => {
    if (activeTrackRef.current) {
      activeTrackRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [currentTrack]);

  useEffect(() => {
    let result = [...tracks];
    if (activePlaylist !== 'All') result = result.filter(t => t.genre === activePlaylist);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.title?.toLowerCase().includes(q) || t.artist?.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      if (sortBy === 'title') return (a.title || "").localeCompare(b.title || "");
      if (sortBy === 'artist') return (a.artist || "").localeCompare(b.artist || "");
      return 0; 
    });
    setFilteredTracks(result);
  }, [tracks, activePlaylist, searchQuery, sortBy]);

  const handleTrackClick = (track) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  };

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const { scrollLeft, clientWidth } = scrollContainerRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth * 0.8 : scrollLeft + clientWidth * 0.8;
      scrollContainerRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
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
      if (isPlaying) audio.play().catch(() => setIsPlaying(false));
    }
  }, [currentTrack]);

  useEffect(() => {
    if (isPlaying) {
      audioRef.current.play().catch(() => setIsPlaying(false));
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
      
      {/* Background Effects */}
      <div 
        className="fixed top-[-10%] left-[-10%] w-[80%] h-[80%] blur-[200px] rounded-full pointer-events-none transition-all duration-1000 opacity-60" 
        style={{ backgroundColor: currentPlaylistStyle.glow, transform: `translate(${mousePos.x}px, ${mousePos.y}px)` }}
      />
      <div 
        className="fixed bottom-[-10%] right-[-10%] w-[80%] h-[80%] blur-[200px] rounded-full pointer-events-none transition-all duration-1000 opacity-60" 
        style={{ backgroundColor: currentPlaylistStyle.glow, transform: `translate(${-mousePos.x}px, ${-mousePos.y}px)` }}
      />

      {/* Sidebar */}
      <aside className="w-72 bg-black/60 backdrop-blur-3xl p-8 flex flex-col gap-10 hidden lg:flex border-r border-white/5 z-30 relative">
        <div className="flex items-center gap-3 px-2">
          <div className={`w-11 h-11 bg-gradient-to-tr ${currentPlaylistStyle.color} rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-1000 ring-2 ring-white/20`}>
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
            <NavItem icon={playlists[0].icon} label={playlists[0].label} active={activePlaylist === 'All'} onClick={() => setActivePlaylist('All')} />
          </div>

          <div className="space-y-4">
            <p className="text-[11px] font-black text-neutral-600 uppercase tracking-[0.2em] px-3">Filter by Vibe</p>
            <div className="space-y-2">
              {playlists.filter(p => p.id !== 'All').map(p => (
                <NavItem key={p.id} icon={p.icon} label={p.label} active={activePlaylist === p.id} onClick={() => setActivePlaylist(p.id)} colorClass={p.color} />
              ))}
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 z-20 relative overflow-hidden">
        
        {/* Header Section */}
        <div className="p-6 lg:p-14 pb-0">
          <header className="mb-8 lg:mb-12 animate-slide-in">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="flex-1">
                <div className="inline-block px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 backdrop-blur-xl">
                  {filteredTracks.length} tracks found
                </div>
                <h1 className="text-4xl lg:text-7xl font-black tracking-tighter leading-none">
                  {currentPlaylistStyle.label} <span className={`bg-clip-text text-transparent bg-gradient-to-r ${currentPlaylistStyle.color} italic ml-1 transition-all duration-1000`}>Flow</span>
                </h1>
              </div>

              {/* Search & Sort */}
              <div className="flex items-center gap-3">
                <div className="relative group flex-1 lg:w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
                  <input 
                    type="text" 
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-white/20 transition-all backdrop-blur-3xl"
                  />
                </div>
                <button onClick={() => setSortBy(sortBy === 'title' ? 'newest' : 'title')} className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                  <ArrowUpDown size={14} className={sortBy === 'title' ? 'text-white' : 'text-neutral-500'} />
                </button>
              </div>
            </div>
          </header>
        </div>

        {/* Horizontal Scroll Container */}
        <div className="relative flex-1 flex flex-col justify-center min-h-0">
          
          {/* Scroll Buttons (Desktop Only) */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 lg:px-10 pointer-events-none z-40 hidden lg:flex">
            <button 
              onClick={() => scroll('left')} 
              className="w-14 h-14 bg-black/40 backdrop-blur-3xl border border-white/10 rounded-full flex items-center justify-center text-white pointer-events-auto hover:bg-white hover:text-black transition-all shadow-2xl opacity-0 group-hover:opacity-100 group"
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={() => scroll('right')} 
              className="w-14 h-14 bg-black/40 backdrop-blur-3xl border border-white/10 rounded-full flex items-center justify-center text-white pointer-events-auto hover:bg-white hover:text-black transition-all shadow-2xl opacity-0 group-hover:opacity-100 group"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          <div className="group relative h-full flex items-center">
            {loading ? (
              <div className="w-full flex justify-center py-20"><div className="w-10 h-10 border-4 border-white/5 border-t-white/60 rounded-full animate-spin" /></div>
            ) : (
              <div 
                ref={scrollContainerRef}
                className="flex gap-6 lg:gap-12 px-6 lg:px-14 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory h-full items-center"
              >
                {filteredTracks.map(track => {
                  const isActive = currentTrack?.id === track.id;
                  return (
                    <div 
                      key={track.id} 
                      ref={isActive ? activeTrackRef : null} // アクティブな要素にRefをセット
                      onClick={() => handleTrackClick(track)}
                      className="flex-none w-64 lg:w-[26rem] snap-center group/card cursor-pointer"
                    >
                      <div className="relative mb-6 lg:mb-10">
                        {/* Selection Glow */}
                        <div className={`absolute -inset-4 lg:-inset-8 bg-gradient-to-tr ${currentPlaylistStyle.color} blur-[40px] lg:blur-[80px] opacity-0 transition-opacity duration-700 pointer-events-none rounded-full ${isActive && isPlaying ? 'opacity-40 animate-pulse-slow' : 'group-hover/card:opacity-20'}`} />
                        
                        <div className={`relative z-10 aspect-square w-full overflow-hidden rounded-[2rem] lg:rounded-[4rem] transition-all duration-700 ${isActive ? 'scale-105 shadow-[0_40px_100px_rgba(0,0,0,0.6)] ring-2 lg:ring-4 ring-white/40' : 'hover:scale-105 shadow-2xl ring-1 ring-white/10 group-hover/card:ring-white/30'}`}>
                          {track.cover ? (
                            <img src={track.cover} alt="" className={`w-full h-full object-cover transition-all duration-1000 group-hover/card:scale-110 ${isActive && isPlaying ? 'brightness-110' : ''}`} />
                          ) : (
                            <div className="w-full h-full bg-neutral-900 flex items-center justify-center"><Music size={48} className="text-neutral-700" /></div>
                          )}
                          
                          <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-all duration-500 ${isActive && isPlaying ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'}`}>
                            <div className="w-16 h-16 lg:w-32 lg:h-32 bg-white/20 backdrop-blur-3xl rounded-full flex items-center justify-center border border-white/40 shadow-2xl scale-90 group-hover/card:scale-100 transition-transform">
                              {isActive && isPlaying ? <Pause fill="white" size={48} /> : <Play fill="white" size={48} className="ml-2" />}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-center px-4 transition-transform duration-300 group-hover/card:-translate-y-2">
                        <h3 className={`font-black truncate text-lg lg:text-4xl tracking-tight transition-all duration-300 ${isActive ? 'text-white' : 'text-neutral-400 group-hover/card:text-white'}`}>
                          {track.title}
                        </h3>
                        <p className="text-[10px] lg:text-[14px] text-neutral-600 font-bold uppercase tracking-[0.2em] mt-2 lg:mt-4 flex items-center justify-center gap-3">
                          {track.artist}
                          {isActive && isPlaying && <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${currentPlaylistStyle.color} animate-ping`} />}
                        </p>
                      </div>
                    </div>
                  );
                })}
                
                {filteredTracks.length === 0 && (
                  <div className="w-full flex flex-col items-center justify-center text-neutral-600 gap-6 opacity-40">
                    <Ghost size={64} strokeWidth={1} />
                    <p className="font-black uppercase tracking-[0.3em] text-sm">No tracks in this vibe</p>
                  </div>
                )}
                {/* Spacer for last item */}
                <div className="flex-none w-10 lg:w-20 h-full" />
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Background Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden -z-10 opacity-[0.03]">
          <h2 key={currentTrack?.id} className={`text-[35vw] font-black uppercase whitespace-nowrap leading-none tracking-tighter animate-text-reveal text-${currentPlaylistStyle.text}-400`}>
            {currentTrack?.artist || "AKIKO"}
          </h2>
        </div>
      </main>

      {/* Control Bar */}
      <footer className="fixed bottom-4 lg:bottom-10 left-1/2 -translate-x-1/2 w-[94%] max-w-7xl h-20 lg:h-28 bg-black/80 backdrop-blur-3xl border border-white/10 rounded-3xl lg:rounded-[4rem] px-6 lg:px-16 flex items-center justify-between z-50 shadow-2xl">
        
        <div className="flex items-center gap-4 lg:gap-8 w-1/4 min-w-0">
          {currentTrack && (
            <>
              <div className={`w-12 h-12 lg:w-16 lg:h-16 rounded-xl lg:rounded-[1.5rem] overflow-hidden shadow-2xl ring-1 ring-white/20 shrink-0 ${isPlaying ? 'animate-pulse' : ''}`}>
                <img src={currentTrack.cover} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="hidden sm:block overflow-hidden">
                <p className="text-[14px] lg:text-[18px] font-black truncate text-white leading-tight">{currentTrack.title}</p>
                <p className="text-[9px] lg:text-[11px] text-neutral-500 font-black uppercase tracking-widest mt-1 lg:mt-2">{currentTrack.artist}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 flex-1 max-w-xl px-4 lg:px-12">
          <div className="flex items-center gap-8 lg:gap-14">
            <button onClick={handlePrev} className="text-neutral-600 hover:text-white transition-all transform active:scale-90"><SkipBack size={20} fill="currentColor" /></button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              className={`w-12 h-12 lg:w-16 lg:h-16 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition shadow-[0_0_30px_rgba(255,255,255,0.3)] active:scale-95`}
            >
              {isPlaying ? <Pause size={24} fill="black" /> : <Play size={24} fill="black" className="ml-1" />}
            </button>
            <button onClick={handleNext} className="text-neutral-600 hover:text-white transition-all transform active:scale-90"><SkipForward size={20} fill="currentColor" /></button>
          </div>
          
          <div className="w-full flex items-center gap-4">
            <span className="text-[10px] font-black text-neutral-600 w-10 text-right tabular-nums">
              {Math.floor(audioRef.current.currentTime / 60)}:{String(Math.floor(audioRef.current.currentTime % 60)).padStart(2, '0')}
            </span>
            <div className="flex-1 bg-white/10 h-1.5 rounded-full overflow-hidden relative cursor-pointer group/bar">
              <div className={`h-full rounded-full transition-all duration-300 bg-gradient-to-r ${currentPlaylistStyle.color}`} style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] font-black text-neutral-600 w-10 tabular-nums">
              {audioRef.current.duration ? `${Math.floor(audioRef.current.duration / 60)}:${String(Math.floor(audioRef.current.duration % 60)).padStart(2, '0')}` : '0:00'}
            </span>
          </div>
        </div>

        <div className="w-1/4 flex justify-end items-center gap-4">
          <div className="hidden lg:flex items-center gap-4 w-32">
            <Volume2 size={18} className="text-neutral-600" />
            <div className="flex-1 bg-white/10 h-1 rounded-full overflow-hidden relative border border-white/5">
               <div className="bg-white/60 h-full rounded-full" style={{ width: `${volume * 100}%` }} />
            </div>
          </div>
          <button className="lg:hidden text-neutral-600"><Volume2 size={18} /></button>
        </div>
      </footer>

      <style>{`
        @keyframes text-reveal {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 0.04; }
        }
        @keyframes slide-in {
          from { transform: translateX(-20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.05); opacity: 0.55; }
        }
        .animate-text-reveal { animation: text-reveal 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-in { animation: slide-in 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick, colorClass = "from-fuchsia-600 to-violet-600" }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between px-6 py-4 cursor-pointer transition-all duration-500 rounded-3xl group relative overflow-hidden ${active ? 'bg-white/10 text-white shadow-xl ring-1 ring-white/10' : 'text-neutral-500 hover:text-neutral-100 hover:bg-white/5'}`}
    >
      <div className="flex items-center gap-5 z-10">
        <div className={`transition-all duration-500 ${active ? 'scale-125 text-white' : 'group-hover:scale-110'}`}>{icon}</div>
        <span className={`font-black uppercase tracking-[0.2em] text-[11px] ${active ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`}>{label}</span>
      </div>
      {active && <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${colorClass} shadow-[0_0_15px_rgba(255,255,255,0.8)] z-10 animate-pulse`} />}
    </div>
  );
}
