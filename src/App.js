/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query } from 'firebase/firestore';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, Music, Home, 
  Sparkles, Search, ArrowUpDown, Menu, X, Ghost, 
  Waves, Moon, Zap, Coffee 
} from 'lucide-react';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const audioRef = useRef(new Audio());
  const scrollContainerRef = useRef(null);
  const activeTrackRef = useRef(null);

  const playlists = [
    { id: 'All', label: 'All Songs', icon: <Home size={20} />, color: 'from-fuchsia-400 to-indigo-500', glow: 'rgba(192, 38, 211, 0.4)' },
    { id: 'Chill', label: 'Chill Beats', icon: <Coffee size={18} />, color: 'from-rose-400 to-pink-600', glow: 'rgba(251, 113, 133, 0.4)' },
    { id: 'Energy', label: 'Energy Mix', icon: <Zap size={18} />, color: 'from-yellow-300 to-orange-500', glow: 'rgba(253, 224, 71, 0.4)' },
    { id: 'Focus', label: 'Focus Mode', icon: <Sparkles size={18} />, color: 'from-cyan-300 to-blue-500', glow: 'rgba(103, 232, 249, 0.4)' },
    { id: 'Night', label: 'Midnight City', icon: <Moon size={18} />, color: 'from-violet-400 to-purple-800', glow: 'rgba(167, 139, 250, 0.4)' },
    { id: 'Nature', label: 'Nature Sounds', icon: <Waves size={18} />, color: 'from-emerald-300 to-teal-500', glow: 'rgba(110, 231, 183, 0.4)' },
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
    if (activeTrackRef.current) {
      activeTrackRef.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
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

  // --- Bluetooth/OS Media Session Integration ---
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentTrack.title || 'Unknown Title',
        artist: currentTrack.artist || 'Unknown Artist',
        album: 'Akiko Music',
        artwork: [
          { src: currentTrack.cover || '', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
      navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
      navigator.mediaSession.setActionHandler('nexttrack', handleNext);
    }
  }, [currentTrack, handlePrev, handleNext]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

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

  const SidebarContent = () => (
    <div className="flex flex-col h-full gap-10">
      <div className="flex items-center gap-3 px-2">
        <div className={`w-10 h-10 bg-gradient-to-tr ${currentPlaylistStyle.color} rounded-2xl flex items-center justify-center shadow-xl ring-2 ring-white/10`}>
          <Sparkles size={20} className="text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-black text-lg tracking-tight leading-none text-white">AKIKO</span>
          <span className="text-[9px] text-neutral-500 font-bold tracking-[0.2em] uppercase mt-1">Music Player</span>
        </div>
      </div>
      
      <nav className="flex flex-col gap-8 text-sm">
        <div className="space-y-4">
          <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] px-3">Explore</p>
          <NavItem icon={playlists[0].icon} label={playlists[0].label} active={activePlaylist === 'All'} onClick={() => { setActivePlaylist('All'); setIsMobileMenuOpen(false); }} />
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] px-3">Moods</p>
          <div className="space-y-1">
            {playlists.filter(p => p.id !== 'All').map(p => (
              <NavItem key={p.id} icon={p.icon} label={p.label} active={activePlaylist === p.id} onClick={() => { setActivePlaylist(p.id); setIsMobileMenuOpen(false); }} colorClass={p.color} />
            ))}
          </div>
        </div>
      </nav>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#020202] text-white font-sans overflow-hidden transition-colors duration-1000">
      
      {/* Background Glows */}
      <div className="fixed inset-0 pointer-events-none transition-all duration-1000 opacity-30" 
        style={{ backgroundColor: currentPlaylistStyle.glow, filter: 'blur(150px)' }}
      />

      {/* Desktop Sidebar */}
      <aside className="w-64 bg-black/60 backdrop-blur-3xl p-6 hidden lg:flex flex-col border-r border-white/5 z-30 relative">
        <SidebarContent />
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="absolute top-0 left-0 w-72 h-full bg-[#0a0a0a] p-6 shadow-2xl border-r border-white/10 animate-slide-in">
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-6 right-6 p-2 text-neutral-400 hover:text-white"
            >
              <X size={24} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 z-20 relative overflow-hidden pb-28 lg:pb-32">
        
        {/* Background Artist Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
          <h2 className="text-[25vw] font-black uppercase whitespace-nowrap leading-none tracking-tighter opacity-[0.03] animate-fade-in text-white">
            {currentTrack?.artist || "AKIKO"}
          </h2>
        </div>

        {/* Header with Mobile Menu Trigger */}
        <div className="p-4 lg:p-6 lg:px-12 z-20 relative bg-gradient-to-b from-black/50 to-transparent">
          <header className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center justify-between w-full sm:w-auto gap-4">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-2 -ml-2 lg:hidden text-white bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <Menu size={24} />
                </button>
                <div className="flex flex-col lg:flex-row lg:items-center lg:gap-4">
                  <h1 className="text-lg lg:text-2xl font-black tracking-tighter">
                    {currentPlaylistStyle.label}
                  </h1>
                  <span className={`text-xs lg:text-lg bg-clip-text text-transparent bg-gradient-to-r ${currentPlaylistStyle.color} italic font-black`}>
                    / Collection
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-40 lg:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={12} />
                <input 
                  type="text" 
                  placeholder="Quick search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-9 pr-4 text-[11px] focus:outline-none focus:ring-1 focus:ring-white/20 transition-all backdrop-blur-xl"
                />
              </div>
              <button onClick={() => setSortBy(sortBy === 'title' ? 'newest' : 'title')} className="p-2.5 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all">
                <ArrowUpDown size={14} className={sortBy === 'title' ? 'text-white' : 'text-neutral-500'} />
              </button>
            </div>
          </header>
        </div>

        {/* Scrollable Tracks */}
        <div className="relative flex-1 flex flex-col justify-center min-h-0 z-10">
          <div 
            ref={scrollContainerRef}
            className="flex gap-6 lg:gap-12 px-6 lg:px-24 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory h-full items-center"
          >
            {filteredTracks.map(track => {
              const isActive = currentTrack?.id === track.id;
              return (
                <div 
                  key={track.id} 
                  ref={isActive ? activeTrackRef : null}
                  onClick={() => handleTrackClick(track)}
                  className="flex-none w-60 sm:w-64 lg:w-72 snap-center group/card cursor-pointer relative"
                >
                  <div className={`absolute -inset-6 bg-gradient-to-tr ${currentPlaylistStyle.color} blur-[60px] opacity-0 transition-opacity duration-700 pointer-events-none rounded-full ${isActive && isPlaying ? 'opacity-20 animate-pulse-slow' : ''}`} />
                  
                  <div className={`relative z-10 aspect-square w-full overflow-hidden rounded-[2rem] transition-all duration-500 ${isActive ? 'scale-105 shadow-2xl ring-2 ring-white/30' : 'opacity-60 hover:opacity-100 hover:scale-102 ring-1 ring-white/10'}`}>
                    {track.cover ? (
                      <img src={track.cover} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-110" />
                    ) : (
                      <div className="w-full h-full bg-neutral-900 flex items-center justify-center"><Music size={30} className="text-neutral-700" /></div>
                    )}
                    
                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300 ${isActive && isPlaying ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'}`}>
                      <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shadow-xl">
                        {isActive && isPlaying ? <Pause fill="white" size={24} /> : <Play fill="white" size={24} className="ml-1" />}
                      </div>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-5 lg:p-7 bg-gradient-to-t from-black via-black/60 to-transparent">
                       <h3 className="font-black truncate text-base lg:text-lg tracking-tight text-white mb-0.5">
                        {track.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest truncate">
                          {track.artist}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {filteredTracks.length === 0 && (
              <div className="w-full flex flex-col items-center justify-center text-neutral-600 gap-4 opacity-30">
                <Ghost size={48} />
                <p className="font-bold uppercase tracking-widest text-xs">No tracks found</p>
              </div>
            )}
            <div className="flex-none w-20 h-full" />
          </div>
        </div>
      </main>

      {/* Responsive Player Footer */}
      <footer className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-4xl h-16 sm:h-20 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-3xl sm:rounded-full px-4 sm:px-8 flex items-center justify-between z-50 shadow-2xl ring-1 ring-white/5">
        
        <div className="flex items-center gap-3 w-1/4 sm:w-1/3">
          {currentTrack && (
            <>
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10 shrink-0">
                <img src={currentTrack.cover} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="hidden sm:block overflow-hidden">
                <p className="text-[12px] font-black truncate text-white leading-tight">{currentTrack.title}</p>
                <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">{currentTrack.artist}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 flex-1 max-w-sm">
          <div className="flex items-center gap-4 sm:gap-8">
            <button onClick={handlePrev} className="text-neutral-500 hover:text-white transition-all active:scale-90"><SkipBack size={16} fill="currentColor" /></button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 active:scale-95 transition shadow-lg shadow-white/10"
            >
              {isPlaying ? <Pause size={18} fill="black" /> : <Play size={18} fill="black" className="ml-0.5" />}
            </button>
            <button onClick={handleNext} className="text-neutral-500 hover:text-white transition-all active:scale-90"><SkipForward size={16} fill="currentColor" /></button>
          </div>
          
          <div className="w-full flex items-center gap-2">
            <span className="text-[8px] font-bold text-neutral-500 w-8 text-right tabular-nums">
              {Math.floor(audioRef.current.currentTime / 60)}:{String(Math.floor(audioRef.current.currentTime % 60)).padStart(2, '0')}
            </span>
            <div className="flex-1 bg-white/10 h-1 rounded-full overflow-hidden relative">
              <div className={`h-full rounded-full bg-white/60 transition-all duration-300`} style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[8px] font-bold text-neutral-500 w-8 tabular-nums">
              {audioRef.current.duration ? `${Math.floor(audioRef.current.duration / 60)}:${String(Math.floor(audioRef.current.duration % 60)).padStart(2, '0')}` : '0:00'}
            </span>
          </div>
        </div>

        <div className="w-1/4 sm:w-1/3 flex justify-end">
          <div className="hidden sm:flex items-center gap-2 w-24">
            <Volume2 size={14} className="text-neutral-600" />
            <div className="flex-1 bg-white/10 h-1 rounded-full overflow-hidden">
               <div className="bg-white/40 h-full rounded-full" style={{ width: `${volume * 100}%` }} />
            </div>
          </div>
          <div className="sm:hidden">
            {isPlaying && (
              <div className="flex gap-0.5 items-end h-3">
                {[0.4, 0.8, 0.5].map((d, i) => (
                  <div key={i} className="w-0.5 bg-white/60 rounded-full animate-bar-dance" style={{ animationDelay: `${d}s` }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </footer>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 0.03; transform: scale(1); } }
        @keyframes bar-dance { 0%, 100% { height: 4px; } 50% { height: 12px; } }
        @keyframes pulse-slow { 0%, 100% { transform: scale(1); opacity: 0.2; } 50% { transform: scale(1.05); opacity: 0.3; } }
        @keyframes slide-in { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        .animate-fade-in { animation: fade-in 2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-bar-dance { animation: bar-dance 1s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        .animate-slide-in { animation: slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick, colorClass = "from-fuchsia-600 to-violet-600" }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between px-4 py-3.5 cursor-pointer transition-all duration-300 rounded-2xl group ${active ? 'bg-white/10 text-white shadow-lg ring-1 ring-white/10' : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/5'}`}
    >
      <div className="flex items-center gap-4">
        <div className={`transition-all duration-300 ${active ? 'scale-110 text-white' : 'group-hover:scale-105'}`}>{icon}</div>
        <span className={`font-bold uppercase tracking-widest text-[11px] ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
      </div>
    </div>
  );
}
