/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, Home, Library, ListMusic, Sparkles, Heart, Mic2, Search, Filter, MoreVertical, LayoutGrid, PlusSquare, Waves, Moon, Zap, Coffee, Ghost } from 'lucide-react';

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
  const canvasRef = useRef(null);
  const analyzerRef = useRef(null);
  const animationRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);

  // 5つの再生リストをプリセット
  const playlists = [
    { id: 'All', label: 'All Songs', icon: <Home size={20} />, color: 'bg-white' },
    { id: 'Chill', label: 'Chill Beats', icon: <Coffee size={18} />, color: 'bg-rose-500' },
    { id: 'Energy', label: 'Energy Mix', icon: <Zap size={18} />, color: 'bg-amber-500' },
    { id: 'Focus', label: 'Focus Mode', icon: <Sparkles size={18} />, color: 'bg-violet-500' },
    { id: 'Night', label: 'Midnight City', icon: <Moon size={18} />, color: 'bg-indigo-600' },
    { id: 'Nature', label: 'Nature Sounds', icon: <Waves size={18} />, color: 'bg-emerald-500' },
  ];

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => {
      unsubscribe();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Visualizer Setup
  const initVisualizer = () => {
    if (audioContextRef.current) return;
    
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      const analyzer = context.createAnalyser();
      analyzer.fftSize = 256;
      
      const source = context.createMediaElementSource(audioRef.current);
      source.connect(analyzer);
      analyzer.connect(context.destination);
      
      audioContextRef.current = context;
      analyzerRef.current = analyzer;
      sourceRef.current = source;
      
      draw();
    } catch (e) {
      console.error("Visualizer initialization failed:", e);
    }
  };

  const draw = () => {
    if (!canvasRef.current || !analyzerRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyzer = analyzerRef.current;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const renderFrame = () => {
      animationRef.current = requestAnimationFrame(renderFrame);
      analyzer.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;
        
        // Gradient for bars
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, 'rgba(192, 38, 211, 0.2)'); // Fuchsia 600
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0.8)'); // Violet 500
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
        
        x += barWidth;
      }
    };
    
    renderFrame();
  };

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
    initVisualizer();
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
      audioRef.current.crossOrigin = "anonymous";
      audioRef.current.src = currentTrack.url;
      if (isPlaying) audioRef.current.play().catch(() => {});
    }
  }, [currentTrack]);

  useEffect(() => {
    if (isPlaying) {
      initVisualizer();
      audioRef.current.play().catch(() => setIsPlaying(false));
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
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

  return (
    <div className="flex h-screen bg-neutral-950 text-white font-sans overflow-hidden">
      {/* Background Glow */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-fuchsia-600/10 blur-[140px] rounded-full pointer-events-none animate-pulse" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/10 blur-[140px] rounded-full pointer-events-none animate-pulse" />

      {/* Sidebar */}
      <aside className="w-72 bg-black/40 backdrop-blur-3xl p-8 flex flex-col gap-10 hidden lg:flex border-r border-white/5 z-20 overflow-y-auto">
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
            <p className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.2em] px-3">Explore</p>
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
            <div className="flex items-center justify-between px-3">
              <p className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.2em]">Your Playlists</p>
            </div>
            <div className="space-y-1">
              {playlists.filter(p => p.id !== 'All').map(playlist => (
                <NavItem 
                  key={playlist.id}
                  icon={playlist.icon} 
                  label={playlist.label} 
                  active={activePlaylist === playlist.id} 
                  onClick={() => setActivePlaylist(playlist.id)}
                  indicatorColor={playlist.color}
                />
              ))}
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-transparent p-8 lg:p-12 pb-40 z-10">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-1">
            <div className="inline-block px-3 py-1 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-full text-fuchsia-400 text-[10px] font-black uppercase tracking-widest mb-4">
              Collection
            </div>
            <h1 className="text-5xl lg:text-6xl font-black tracking-tighter">
              {playlists.find(p => p.id === activePlaylist)?.label} <span className="bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-500 to-violet-400 italic">Library</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/5 border border-white/10 rounded-full px-4 py-2 text-neutral-400 focus-within:text-white focus-within:bg-white/10 transition-all mr-2">
              <Search size={16} className="mr-2" />
              <input type="text" placeholder="Search tracks..." className="bg-transparent border-none outline-none text-xs w-32 md:w-48 placeholder:text-neutral-600" />
            </div>
            <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition-all">
              <LayoutGrid size={18} />
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition-all">
              <Filter size={18} />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.5)]" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
            {filteredTracks.length > 0 ? filteredTracks.map(track => (
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
            )) : (
              <div className="col-span-full py-20 text-center opacity-40">
                <Music size={48} className="mx-auto mb-4" />
                <p className="font-bold uppercase tracking-widest text-xs">このプレイリストには曲がありません</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Player Bar */}
      <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[94%] max-w-6xl h-24 bg-neutral-900/40 backdrop-blur-[40px] border border-white/5 rounded-[3rem] px-10 flex items-center justify-between z-50 shadow-[0_40px_100px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-5 w-1/4 overflow-hidden">
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
              <div className="hidden sm:block overflow-hidden pr-2">
                <p className="text-sm font-black truncate tracking-tight">{currentTrack.title}</p>
                <p className="text-[10px] text-fuchsia-500 font-bold uppercase tracking-widest mt-0.5">{currentTrack.artist}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 flex-1 max-w-xl px-6 relative">
          {/* Visualizer Canvas */}
          <div className="absolute inset-x-0 -top-6 h-8 flex justify-center pointer-events-none opacity-50">
             <canvas ref={canvasRef} width="400" height="32" className="w-full max-w-md" />
          </div>

          <div className="flex items-center gap-8 mt-2">
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

function NavItem({ icon, label, active = false, onClick, indicatorColor = 'bg-fuchsia-500' }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-all duration-500 rounded-2xl group ${active ? 'bg-gradient-to-r from-white/10 to-transparent text-white ring-1 ring-white/10 shadow-xl' : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/5'}`}
    >
      <div className="flex items-center gap-4">
        <div className={`transition-all duration-500 ${active ? 'text-fuchsia-400 scale-110' : 'group-hover:text-neutral-300'}`}>
          {icon}
        </div>
        <span className={`font-black uppercase tracking-[0.15em] text-[11px] transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
      </div>
      {active && <div className={`w-1.5 h-1.5 rounded-full ${indicatorColor} shadow-[0_0_10px_currentColor] animate-pulse`} />}
    </div>
  );
}
