
/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, Home, Library, ListMusic, Sparkles, Heart, Mic2, Search, Filter, MoreVertical, LayoutGrid, PlusSquare, Waves, Moon, Zap, Coffee, Ghost, AlertCircle, ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';

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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const audioRef = useRef(new Audio());
  const scrollContainerRef = useRef(null);
  const trackRefs = useRef({});

  const playlists = [
    { id: 'All', label: 'All Songs', icon: <Home size={22} />, color: 'from-fuchsia-400 to-indigo-500', glow: 'rgba(192, 38, 211, 0.4)', text: 'fuchsia' },
    { id: 'Chill', label: 'Chill Beats', icon: <Coffee size={20} />, color: 'from-rose-400 to-pink-600', glow: 'rgba(251, 113, 133, 0.4)', text: 'rose' },
    { id: 'Energy', label: 'Energy Mix', icon: <Zap size={20} />, color: 'from-yellow-300 to-orange-500', glow: 'rgba(253, 224, 71, 0.4)', text: 'yellow' },
    { id: 'Focus', label: 'Focus Mode', icon: <Sparkles size={20} />, color: 'from-cyan-300 to-blue-500', glow: 'rgba(103, 232, 249, 0.4)', text: 'cyan' },
    { id: 'Night', label: 'Midnight City', icon: <Moon size={20} />, color: 'from-violet-400 to-purple-800', glow: 'rgba(167, 139, 250, 0.4)', text: 'violet' },
    { id: 'Nature', label: 'Nature Sounds', icon: <Waves size={20} />, color: 'from-emerald-300 to-teal-500', glow: 'rgba(110, 231, 183, 0.4)', text: 'emerald' },
  ];

  // --- Bluetooth/Smartphone Media Session Sync ---
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: 'AKIKO Music',
        artwork: [
          { src: currentTrack.cover || '', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
      navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
      navigator.mediaSession.setActionHandler('nexttrack', handleNext);
    }
  }, [currentTrack]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

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

  useEffect(() => {
    if (currentTrack && trackRefs.current[currentTrack.id] && scrollContainerRef.current) {
      const element = trackRefs.current[currentTrack.id];
      const container = scrollContainerRef.current;
      
      // Calculate centering
      const containerHalfWidth = container.offsetWidth / 2;
      const elementHalfWidth = element.offsetWidth / 2;
      const targetScrollLeft = element.offsetLeft - containerHalfWidth + elementHalfWidth;

      container.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth'
      });
    }
  }, [currentTrack, filteredTracks]);

  const handleTrackClick = (track) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  };

  const handleNext = () => {
    const list = filteredTracks.length > 0 ? filteredTracks : tracks;
    if (list.length === 0) return;
    const idx = list.findIndex(t => t.id === currentTrack?.id);
    setCurrentTrack(list[(idx + 1) % list.length]);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    const list = filteredTracks.length > 0 ? filteredTracks : tracks;
    if (list.length === 0) return;
    const idx = list.findIndex(t => t.id === currentTrack?.id);
    setCurrentTrack(list[(idx - 1 + list.length) % list.length]);
    setIsPlaying(true);
  };

  useEffect(() => {
    if (currentTrack?.url) {
      const audio = audioRef.current;
      audio.pause();
      audio.src = currentTrack.url;
      audio.load();
      if (isPlaying) {
        audio.play().catch(() => setIsPlaying(false));
      }
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
      
      {/* Background Glows */}
      <div 
        className="fixed inset-0 blur-[150px] opacity-20 pointer-events-none transition-all duration-1000" 
        style={{ 
          background: `radial-gradient(circle at ${50 + mousePos.x}% ${50 + mousePos.y}%, ${currentPlaylistStyle.glow}, transparent 70%)`
        }}
      />

      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 w-72 bg-black/80 lg:bg-black/40 backdrop-blur-3xl p-8 flex flex-col gap-10 border-r border-white/5 z-[110] transition-transform duration-500
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 bg-gradient-to-tr ${currentPlaylistStyle.color} rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-1000 ring-2 ring-white/10`}>
              <Sparkles size={28} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-2xl tracking-tight leading-none uppercase">AKIKO</span>
              <span className="text-[10px] text-neutral-500 font-bold tracking-widest uppercase mt-1">Music Player</span>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-neutral-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex flex-col gap-8">
          <div className="space-y-4">
            <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] px-4">Collections</p>
            <div className="space-y-1">
              {playlists.map(p => (
                <button 
                  key={p.id}
                  onClick={() => {
                    setActivePlaylist(p.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 ${activePlaylist === p.id ? 'bg-white/10 text-white shadow-lg' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}
                >
                  <span className={activePlaylist === p.id ? 'text-white' : 'text-neutral-600'}>{p.icon}</span>
                  <span className="text-[11px] font-black uppercase tracking-wider">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative z-10 overflow-hidden">
        
        {/* Header */}
        <header className="px-6 lg:px-12 pt-6 lg:pt-8 flex items-end justify-between shrink-0">
          <div className="flex items-center gap-6 animate-slide-in">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors"
            >
              <Menu size={24} />
            </button>
            <div>
              <h1 className="text-2xl lg:text-5xl font-black tracking-tighter leading-none mb-2 truncate max-w-[200px] lg:max-w-none">
                {currentPlaylistStyle.label}
              </h1>
              <div className={`h-1 w-10 lg:w-16 bg-gradient-to-r ${currentPlaylistStyle.color} rounded-full shadow-lg shadow-white/5`} />
            </div>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-500 hidden sm:block pb-1">
            {filteredTracks.length} TRACKS
          </p>
        </header>

        {/* Artist Background Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none -z-10 overflow-hidden">
          <span className="text-[25vw] font-black opacity-[0.03] uppercase tracking-tighter transition-all duration-1000 whitespace-nowrap">
            {currentTrack?.artist || "AKIKO"}
          </span>
        </div>

        {/* Horizontal Track Slider */}
        <div className="flex-1 flex items-center relative min-h-0">
          <div 
            ref={scrollContainerRef}
            className="flex items-center gap-8 lg:gap-12 px-[30vw] lg:px-[40vw] overflow-x-auto no-scrollbar py-8 snap-x snap-mandatory h-full"
            style={{ scrollBehavior: 'smooth' }}
          >
            {loading ? (
              <div className="w-16 h-16 border-t-2 border-white rounded-full animate-spin mx-auto" />
            ) : (
              filteredTracks.map(track => {
                const isActive = currentTrack?.id === track.id;
                return (
                  <div 
                    key={track.id}
                    ref={el => trackRefs.current[track.id] = el}
                    onClick={() => handleTrackClick(track)}
                    className={`relative flex-shrink-0 transition-all duration-700 ease-out snap-center cursor-pointer
                      ${isActive ? 'w-[260px] lg:w-[320px] scale-100 opacity-100' : 'w-[160px] lg:w-[220px] scale-80 opacity-30 hover:opacity-60 hover:scale-85'}
                    `}
                  >
                    <div className={`relative aspect-square rounded-[2rem] lg:rounded-[2.5rem] overflow-hidden shadow-2xl transition-all duration-700 ${isActive ? 'ring-4 ring-white/20 shadow-[0_40px_80px_rgba(0,0,0,0.7)]' : 'ring-1 ring-white/5'}`}>
                      {track.cover ? (
                        <img src={track.cover} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full bg-neutral-900 flex items-center justify-center"><Music size={48} className="text-neutral-800" /></div>
                      )}
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent flex flex-col justify-end p-6 lg:p-8">
                        <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-2 transition-all duration-700 ${isActive ? 'text-white' : 'text-white/60'}`}>
                          {track.artist}
                        </p>
                        <h3 className={`font-black tracking-tight leading-tight transition-all duration-700 truncate ${isActive ? 'text-xl lg:text-2xl' : 'text-base lg:text-lg'}`}>
                          {track.title}
                        </h3>
                        
                        {isActive && isPlaying && (
                          <div className="mt-4 flex gap-1 h-4 items-end">
                            {[1, 2, 3, 4].map(i => (
                              <div key={i} className={`w-1 bg-white rounded-full animate-fake-bounce`} style={{ animationDelay: `${i * 0.15}s`, height: '100%' }} />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className={`absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-300 ${isActive ? '' : 'hover:opacity-100'}`}>
                        <div className="w-14 h-14 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20">
                          {isActive && isPlaying ? <Pause fill="white" size={20} /> : <Play fill="white" size={20} className="ml-1" />}
                        </div>
                      </div>
                    </div>

                    {isActive && (
                       <div className={`absolute -inset-8 bg-gradient-to-tr ${currentPlaylistStyle.color} blur-[80px] opacity-20 -z-10 animate-pulse-slow`} />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Nav Buttons (Hidden on Mobile) */}
          <button 
            onClick={handlePrev}
            className="absolute left-10 w-14 h-14 bg-white/5 hover:bg-white/10 backdrop-blur-2xl border border-white/10 rounded-full hidden lg:flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-20"
          >
            <ChevronLeft size={24} />
          </button>
          <button 
            onClick={handleNext}
            className="absolute right-10 w-14 h-14 bg-white/5 hover:bg-white/10 backdrop-blur-2xl border border-white/10 rounded-full hidden lg:flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-20"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Player Controls Bar */}
        <footer className="h-20 lg:h-28 px-4 lg:px-10 flex items-center justify-between bg-black/60 lg:bg-black/40 backdrop-blur-3xl mx-2 lg:mx-8 mb-4 lg:mb-8 rounded-[1.5rem] lg:rounded-[2.5rem] border border-white/10 shadow-2xl shrink-0 z-50">
          <div className="w-[30%] lg:w-1/3 flex items-center gap-3">
             {currentTrack && (
               <>
                 <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl overflow-hidden hidden sm:block ring-1 ring-white/10 flex-shrink-0">
                    <img src={currentTrack.cover} alt="" className="w-full h-full object-cover" />
                 </div>
                 <div className="flex flex-col min-w-0">
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-0.5 truncate">NOW PLAYING</span>
                    <span className="text-xs lg:text-lg font-black truncate text-white leading-none">{currentTrack.title}</span>
                 </div>
               </>
             )}
          </div>

          <div className="flex flex-col items-center gap-1 lg:gap-3 w-[40%] lg:w-1/3">
             <div className="flex items-center gap-4 lg:gap-8">
                <button onClick={handlePrev} className="text-neutral-500 hover:text-white active:scale-90">
                  <SkipBack fill="currentColor" className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
                </button>
                <button 
                  onClick={() => setIsPlaying(!isPlaying)} 
                  className={`w-10 h-10 lg:w-12 lg:h-12 bg-white text-black rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-90 shadow-xl shadow-white/10`}
                >
                  {isPlaying ? <Pause fill="black" className="w-[18px] h-[18px] lg:w-5 lg:h-5" /> : <Play fill="black" className="w-[18px] h-[18px] lg:w-5 lg:h-5 ml-0.5" />}
                </button>
                <button onClick={handleNext} className="text-neutral-500 hover:text-white active:scale-90">
                  <SkipForward fill="currentColor" className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
                </button>
             </div>
             
             <div className="w-full max-w-[200px] lg:max-w-xs flex items-center gap-2 lg:gap-3">
                <span className="text-[8px] font-black text-neutral-600 tabular-nums">
                  {Math.floor(audioRef.current.currentTime / 60)}:{String(Math.floor(audioRef.current.currentTime % 60)).padStart(2, '0')}
                </span>
                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                   <div className={`h-full bg-gradient-to-r ${currentPlaylistStyle.color} transition-all duration-300`} style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[8px] font-black text-neutral-600 tabular-nums">
                  {audioRef.current.duration ? `${Math.floor(audioRef.current.duration / 60)}:${String(Math.floor(audioRef.current.duration % 60)).padStart(2, '0')}` : '0:00'}
                </span>
             </div>
          </div>

          <div className="w-[30%] lg:w-1/3 flex justify-end items-center">
             <div className="hidden md:flex items-center gap-3">
                <Volume2 size={16} className="text-neutral-600" />
                <div className="w-16 lg:w-20 h-1 bg-white/5 rounded-full relative group overflow-hidden">
                   <input 
                    type="range" min="0" max="1" step="0.01" value={volume} 
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                   />
                   <div className="h-full bg-white/30 group-hover:bg-white transition-colors" style={{ width: `${volume * 100}%` }} />
                </div>
             </div>
             {/* Mobile Volume Icon Only */}
             <div className="md:hidden text-neutral-500">
               <Volume2 size={16} />
             </div>
          </div>
        </footer>

      </main>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes fake-bounce {
          0%, 100% { height: 4px; }
          50% { height: 100%; }
        }
        .animate-fake-bounce { animation: fake-bounce 0.8s ease-in-out infinite; }
        
        @keyframes slide-in {
          from { transform: translateY(15px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.1; }
          50% { transform: scale(1.1); opacity: 0.25; }
        }
        .animate-pulse-slow { animation: pulse-slow 5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
