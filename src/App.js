/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, query, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, Heart, Search, Home, Library, AlertCircle, Sparkles, Plus, Mic2 } from 'lucide-react';

// --- Firebase Configuration ---
const getEnv = (key, defaultValue) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  return defaultValue;
};

const firebaseConfig = {
  apiKey: getEnv("REACT_APP_FIREBASE_API_KEY", "AIzaSyDaGkRiRbe54qV85-32ZS09AALS8KlGrLU"),
  authDomain: getEnv("REACT_APP_FIREBASE_AUTH_DOMAIN", "mymusicplayer-ef8f0.firebaseapp.com"),
  projectId: getEnv("REACT_APP_FIREBASE_PROJECT_ID", "mymusicplayer-ef8f0"),
  storageBucket: getEnv("REACT_APP_FIREBASE_STORAGE_BUCKET", "mymusicplayer-ef8f0.firebasestorage.app"),
  messagingSenderId: getEnv("REACT_APP_FIREBASE_MESSAGING_SENDER_ID", "305125896450"),
  appId: getEnv("REACT_APP_FIREBASE_APP_ID", "1:305125896450:web:eb15f3650452fe442f521b")
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'firebeat-pro-v1';

export default function App() {
  const [user, setUser] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [filteredTracks, setFilteredTracks] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  
  const audioRef = useRef(new Audio());

  // --- 再生・一時停止の制御関数 ---
  const togglePlay = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log("Toggle Play clicked, current state:", isPlaying);
    setIsPlaying(!isPlaying);
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

  const selectTrack = (track) => {
    console.log("Track selected:", track.title);
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  // 1. Auth Init
  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Auth Failed", err));
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Fetching
  useEffect(() => {
    if (!user) return;
    const tracksRef = collection(db, 'artifacts', appId, 'public', 'data', 'tracks');
    
    const seedData = async () => {
      try {
        const snap = await getDocs(tracksRef);
        if (snap.empty) {
          const samples = [
            { title: "Dreamy Night", artist: "AI Composer", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", cover: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&h=400&fit=crop" },
            { title: "Cyber City", artist: "Synth Wave", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", cover: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=400&h=400&fit=crop" }
          ];
          for (const s of samples) {
            await addDoc(tracksRef, { ...s, createdAt: serverTimestamp() });
          }
        }
      } catch (err) { console.error("Seed failed", err); }
    };
    seedData();

    const unsubscribe = onSnapshot(query(tracksRef), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTracks(data);
      setFilteredTracks(data);
      setLoading(false);
      if (data.length > 0 && !currentTrack) setCurrentTrack(data[0]);
    }, (err) => {
      console.error("Firestore error", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 3. Search logic
  useEffect(() => {
    const results = tracks.filter(t => 
      (t.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || 
      (t.artist?.toLowerCase() || "").includes(searchQuery.toLowerCase())
    );
    setFilteredTracks(results);
  }, [searchQuery, tracks]);

  // 4. Audio Engine
  useEffect(() => {
    const audio = audioRef.current;
    if (currentTrack?.url) {
      audio.src = currentTrack.url;
      if (isPlaying) {
        audio.play().catch(e => {
          console.warn("Autoplay blocked or failed", e);
          setIsPlaying(false);
        });
      }
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (isPlaying) {
      audio.play().catch(e => {
        console.warn("Play failed", e);
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    const onTimeUpdate = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
    };
    const onEnded = () => handleNext();
    
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [handleNext]);

  useEffect(() => {
    audioRef.current.volume = volume;
  }, [volume]);

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-zinc-100 font-sans overflow-hidden select-none">
      {/* Sidebar */}
      <aside className="w-72 bg-black flex flex-col border-r border-zinc-800/50 p-6 hidden lg:flex">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Music size={24} className="text-white" />
          </div>
          <span className="text-xl font-black tracking-tight italic uppercase">FIREBEAT<span className="text-indigo-500">PRO</span></span>
        </div>
        
        <nav className="space-y-6">
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2">Menu</p>
            <NavItem icon={<Home size={20} />} label="ホーム" active />
            <NavItem icon={<Search size={20} />} label="AI検索" />
            <NavItem icon={<Library size={20} />} label="ライブラリ" />
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-tr from-black via-zinc-900 to-indigo-950/20 relative">
        <header className="sticky top-0 z-40 bg-black/40 backdrop-blur-md p-6 flex items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="text" 
              placeholder="AIに曲を探してもらう..."
              className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-zinc-800 transition-all text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition active:scale-95 shadow-lg shadow-indigo-600/20">
              <Plus size={18} /> 曲を追加
            </button>
          </div>
        </header>

        <div className="p-8">
          <div className="mb-10">
            <h2 className="text-4xl font-black mb-2 tracking-tight">Hello, Listener.</h2>
            <p className="text-zinc-400">今日はどんな気分で音楽を楽しみますか？</p>
          </div>

          <section>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
              <Sparkles size={20} className="text-indigo-400" />
              AI Curated Mix
            </h3>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {[1,2,3,4,5].map(i => <div key={i} className="aspect-square bg-zinc-800 rounded-3xl animate-pulse" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {filteredTracks.map(track => (
                  <div 
                    key={track.id} 
                    onClick={() => selectTrack(track)}
                    className={`group p-4 rounded-3xl transition-all duration-300 cursor-pointer ${currentTrack?.id === track.id ? 'bg-indigo-600/20 ring-1 ring-indigo-500' : 'bg-white/5 hover:bg-white/10'}`}
                  >
                    <div className="relative aspect-square mb-4 overflow-hidden rounded-2xl shadow-xl">
                      {track.cover && <img src={track.cover} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />}
                      <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-all duration-300 ${currentTrack?.id === track.id && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {currentTrack?.id === track.id && isPlaying ? <Pause fill="white" size={40} className="text-white" /> : <Play fill="white" size={40} className="text-white" />}
                      </div>
                    </div>
                    <h4 className="font-bold truncate text-sm mb-1">{track.title}</h4>
                    <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-tight">{track.artist}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Player Bar */}
      <footer className="fixed bottom-0 left-0 right-0 h-28 bg-black/80 backdrop-blur-2xl border-t border-zinc-800/50 px-8 flex items-center justify-between z-50">
        <div className="flex items-center gap-5 w-1/3">
          {currentTrack && (
            <>
              <div className="w-16 h-16 rounded-xl overflow-hidden shadow-2xl border border-zinc-700/50 flex-shrink-0">
                <img src={currentTrack.cover} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="overflow-hidden">
                <h4 className="font-bold text-sm truncate mb-1">{currentTrack.title}</h4>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{currentTrack.artist}</p>
              </div>
              <button className="text-zinc-600 hover:text-rose-500 transition-colors ml-2">
                <Heart size={20} />
              </button>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 flex-1 max-w-2xl px-10">
          <div className="flex items-center gap-8">
            <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className="text-zinc-500 hover:text-white transition-transform active:scale-90 p-2">
              <SkipBack size={24} />
            </button>
            <button 
              onClick={togglePlay} 
              className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              {isPlaying ? <Pause size={28} fill="black" /> : <Play size={28} fill="black" className="ml-1" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="text-zinc-500 hover:text-white transition-transform active:scale-90 p-2">
              <SkipForward size={24} />
            </button>
          </div>
          <div className="w-full flex items-center gap-3">
            <span className="text-[10px] font-mono text-zinc-500 w-10 text-right">
              {Math.floor(audioRef.current.currentTime / 60)}:{(Math.floor(audioRef.current.currentTime % 60)).toString().padStart(2, '0')}
            </span>
            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden relative">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-100" 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <span className="text-[10px] font-mono text-zinc-500 w-10">
              {audioRef.current.duration ? `${Math.floor(audioRef.current.duration / 60)}:${(Math.floor(audioRef.current.duration % 60)).toString().padStart(2, '0')}` : "0:00"}
            </span>
          </div>
        </div>

        <div className="w-1/3 flex justify-end items-center gap-4">
          <Volume2 size={20} className="text-zinc-500" />
          <input 
            type="range" min="0" max="1" step="0.01" value={volume} 
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-24 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
          />
        </div>
      </footer>
    </div>
  );
}

function NavItem({ icon, label, active = false }) {
  return (
    <div className={`flex items-center gap-4 px-3 py-3 rounded-2xl cursor-pointer transition-all duration-300 ${active ? 'bg-indigo-600/10 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
      {icon}
      <span className="font-bold text-sm">{label}</span>
    </div>
  );
}
