/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, Home, Library, ListMusic, Sparkles, Heart, Mic2, Search, Filter, MoreVertical, LayoutGrid } from 'lucide-react';

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
  
  const audioRef = useRef(new Audio());

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const tracksRef = collection(db, 'artifacts', appId, 'public', 'data', 'tracks');
    
    // データ読み取りのみを実行し、自動書き込み(addDoc)は行わない設定に変更
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
      audioRef.current.src = currentTrack.url;
      if (isPlaying) audioRef.current.play().catch(() => {});
    }
  }, [currentTrack]);

  useEffect(() => {
    isPlaying ? audioRef.current.play().catch(() => setIsPlaying(false)) : audioRef.current.pause();
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

  return (
    <div className="flex h-screen bg-neutral-950 text-white font-sans overflow-hidden">
      {/* Background Glow - Dynamic colors based on play state */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-fuchsia-600/10 blur-[140px] rounded-full pointer-events-none animate-pulse" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/10 blur-[140px] rounded-full pointer-events-none animate-pulse" />

      {/* Sidebar */}
      <aside className="w-72 bg-black/40 backdrop-blur-3xl p-8 flex flex-col gap-10 hidden lg:flex border-r border-white/5 z-20">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-gradient-to-tr from-fuchsia-600 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-fuchsia-500/20">
            <Sparkles size={22} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-lg tracking-tight leading-none">AKIKO</span>
            <span className="text-[10px] text-fuchsia-400 font-bold tracking-[0.2em] uppercase">Music Player</span>
          </div>
        </div>
        
        <nav className="flex flex-col gap-8 text-sm">
          <div className="space-y-4">
            <p className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.2em] px-3">Main Menu</p>
            <div className="space-y-1">
              <NavItem icon={<Home size={20} />} label="Home" active={activePlaylist === 'All'} onClick={() => setActivePlaylist('All')} />
              <NavItem icon={<Library size={20} />} label="Library" active={false} />
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.2em] px-3">Playlists</p>
            <div className="space-y-1">
              <NavItem icon={<div className="w-2 h-2 rounded-full bg-rose-500" />} label="Chill" active={activePlaylist === 'Chill'} onClick={() => setActivePlaylist('Chill')} />
              <NavItem icon={<div className="w-2 h-2 rounded-full bg-fuchsia-500" />} label="Energy" active={activePlaylist === 'Energy'} onClick={() => setActivePlaylist('Energy')} />
              <NavItem icon={<div className="w-2 h-2 rounded-full bg-violet-500" />} label="Focus" active={activePlaylist === 'Focus'} onClick={() => setActivePlaylist('Focus')} />
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-transparent p-8 lg:p-12 pb-40 z-10">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-1">
            <div className="inline-block px-3 py-1 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-full text-fuchsia-400 text-[10px] font-black uppercase tracking-widest mb-4">
              Now Browsing
            </div>
            <h1 className="text-5xl lg:text-6xl font-black tracking-tighter">
              {activePlaylist === 'All' ? 'Akiko' : activePlaylist} <span className="bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-500 to-violet-400 italic">Library</span>
            </h1>
          </div>

          {/* Akiko Library Menu - Removed "Add" button for security */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/5 border border-white/10 rounded-full px-4 py-2 text-neutral-400 focus-within:text-white focus-within:bg-white/10 transition-all mr-2">
              <Search size={16} className="mr-2" />
              <input type="text" placeholder="Search music..." className="bg-transparent border-none outline-none text-xs w-32 md:w-48 placeholder:text-neutral-600" />
            </div>
            <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition-all">
              <LayoutGrid size={18} />
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition-all">
              <Filter size={18} />
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition-all">
              <MoreVertical size={18} />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.5)]" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
            {filteredTracks.map(track => (
              <div 
                key={track.id} 
                onClick={() => handleTrackClick(track)}
                className="group relative cursor-pointer"
              >
                <div className={`relative aspect-square mb-5 overflow-hidden rounded-[2.5rem] transition-all duration-700 ${currentTrack?.id === track.id ? 'scale-105 shadow-[0_25px_60px_rgba(217,70,239,0.4)] ring-2 ring-fuchsia-500/50' : 'hover:scale-[1.03] shadow-2xl hover:shadow-fuchsia-500/10'}`}>
                  {track.cover ? (
                    <img src={track.cover} alt="" className="w-full h-full object-cover transition duration-1000 group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full bg-neutral-900 flex items-center justify-center"><Music size={40} className="text-neutral-700" /></div>
                  )}
                  <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex items-center justify-center transition-opacity duration-500 ${currentTrack?.id === track.id && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-2xl rounded-full flex items-center justify-center border border-white/20 shadow-2xl transition-transform duration-500 group-hover:scale-110">
                      {currentTrack?.id === track.id && isPlaying ? <Pause fill="white" size={28} /> : <Play fill="white" size={28} className="ml-1" />}
                    </div>
                  </div>
                </div>
                <div className="px-3">
                  <h3 className={`font-black truncate text-base tracking-tight transition-colors duration-300 ${currentTrack?.id === track.id ? 'text-fuchsia-400' : 'group-hover:text-fuchsia-400'}`}>{track.title}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest flex items-center gap-2">
                      <Mic2 size={10} className="text-fuchsia-500/50" /> {track.artist}
                    </p>
                    <Heart size={14} className="text-neutral-700 hover:text-rose-500 transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Player Bar */}
      <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[94%] max-w-6xl h-24 bg-neutral-900/40 backdrop-blur-[40px] border border-white/5 rounded-[3rem] px-10 flex items-center justify-between z-50 shadow-[0_40px_100px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-5 w-1/4">
          {currentTrack && (
            <>
              <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 shrink-0 relative group">
                <img src={currentTrack.cover} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="" />
                {isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="flex gap-0.5 items-end h-4">
                      <div className="w-0.5 bg-white animate-[music-bar_0.8s_ease-in-out_infinite]" />
                      <div className="w-0.5 bg-white animate-[music-bar_1.2s_ease-in-out_infinite]" />
                      <div className="w-0.5 bg-white animate-[music-bar_1.0s_ease-in-out_infinite]" />
                    </div>
                  </div>
                )}
              </div>
              <div className="hidden sm:block overflow-hidden">
                <p className="text-sm font-black truncate tracking-tight">{currentTrack.title}</p>
                <p className="text-[10px] text-fuchsia-500 font-bold uppercase tracking-widest mt-0.5">{currentTrack.artist}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 flex-1 max-w-xl px-6">
          <div className="flex items-center gap-8">
            <button onClick={handlePrev} className="text-neutral-500 hover:text-white transition transform active:scale-75"><SkipBack size={22} fill="currentColor" /></button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)]"
            >
              {isPlaying ? <Pause size={24} fill="black" /> : <Play size={24} fill="black" className="ml-1" />}
            </button>
            <button onClick={handleNext} className="text-neutral-500 hover:text-white transition transform active:scale-75"><SkipForward size={22} fill="currentColor" /></button>
          </div>
          <div className="w-full flex items-center gap-3">
            <span className="text-[10px] font-bold text-neutral-600 tabular-nums w-8 text-right font-mono">
              {Math.floor(audioRef.current.currentTime / 60)}:
              {String(Math.floor(audioRef.current.currentTime % 60)).padStart(2, '0')}
            </span>
            <div className="flex-1 bg-white/5 h-1.5 rounded-full overflow-hidden group cursor-pointer relative">
              <div className="bg-gradient-to-r from-fuchsia-600 to-violet-500 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] font-bold text-neutral-600 tabular-nums w-8 font-mono">
              {audioRef.current.duration ? `${Math.floor(audioRef.current.duration / 60)}:${String(Math.floor(audioRef.current.duration % 60)).padStart(2, '0')}` : '--:--'}
            </span>
          </div>
        </div>

        <div className="w-1/4 flex justify-end items-center gap-5">
          <div className="hidden md:flex items-center gap-3">
            <Volume2 size={18} className="text-neutral-500" />
            <div className="w-24 bg-white/5 h-1.5 rounded-full overflow-hidden">
              <div className="bg-white/40 h-full transition-all" style={{ width: `${volume * 100}%` }} />
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes music-bar {
          0%, 100% { height: 4px; }
          50% { height: 12px; }
        }
      `}</style>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-all duration-500 rounded-2xl group ${active ? 'bg-gradient-to-r from-fuchsia-600/20 to-transparent text-white ring-1 ring-fuchsia-500/30 shadow-[0_10px_30px_rgba(217,70,239,0.1)]' : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/5'}`}
    >
      <div className={`transition-all duration-500 ${active ? 'text-fuchsia-500 scale-110' : 'group-hover:text-neutral-300'}`}>
        {icon}
      </div>
      <span className={`font-black uppercase tracking-[0.15em] text-[11px] transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
    </div>
  );
}
