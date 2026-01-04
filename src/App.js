/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, Search, Home, Library, AlertCircle, RefreshCcw } from 'lucide-react';

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Use a fallback for the appId to ensure it works in any environment
const appId = "firebeat-v2-production";

export default function App() {
  const [user, setUser] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [errorLog, setErrorLog] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const audioRef = useRef(new Audio());

  // 1. Authentication
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Handle custom tokens if present, else fallback to anonymous
        if (typeof window !== 'undefined' && window.__initial_auth_token) {
          try {
            await signInWithCustomToken(auth, window.__initial_auth_token);
          } catch (e) {
            await signInAnonymously(auth);
          }
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        setErrorLog("Auth Error: " + error.message);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // 2. Firestore Sync & Data Seeding
  useEffect(() => {
    if (!user) return;

    // Use the exact path structure required: /artifacts/{appId}/public/data/{collection}
    const tracksRef = collection(db, 'artifacts', appId, 'public', 'data', 'tracks');
    
    const setupData = async () => {
      try {
        const snapshot = await getDocs(tracksRef);
        if (snapshot.empty) {
          await addDoc(tracksRef, {
            title: "Neon Horizon",
            artist: "SynthWave AI",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            cover: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400",
            createdAt: serverTimestamp()
          });
        }
      } catch (e) {
        console.error("Setup error:", e);
      }
    };

    setupData();

    const unsubscribeTracks = onSnapshot(query(tracksRef), (snapshot) => {
      const trackData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sortedTracks = trackData.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setTracks(sortedTracks);
      setLoading(false);
      if (sortedTracks.length > 0 && !currentTrack) {
        setCurrentTrack(sortedTracks[0]);
      }
    }, (err) => {
      setErrorLog("Sync Error: " + err.message);
      setLoading(false);
    });

    return () => unsubscribeTracks();
  }, [user]);

  // 3. Audio Controls
  const handleNext = () => {
    if (tracks.length === 0) return;
    const currentIndex = tracks.findIndex(t => t.id === currentTrack?.id);
    const nextIndex = (currentIndex + 1) % tracks.length;
    setCurrentTrack(tracks[nextIndex]);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    if (tracks.length === 0) return;
    const currentIndex = tracks.findIndex(t => t.id === currentTrack?.id);
    const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    setCurrentTrack(tracks[prevIndex]);
    setIsPlaying(true);
  };

  useEffect(() => {
    if (currentTrack?.url) {
      const audio = audioRef.current;
      if (audio.src !== currentTrack.url) {
        audio.src = currentTrack.url;
      }
      if (isPlaying) {
        audio.play().catch(() => setIsPlaying(false));
      }
    }
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    const updateProgress = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
    };
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleNext);
    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', handleNext);
    };
  }, [tracks, currentTrack]);

  useEffect(() => {
    audioRef.current.volume = volume;
  }, [volume]);

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-950 p-8 flex flex-col gap-10 hidden md:flex border-r border-zinc-900">
        <div className="flex items-center gap-3 text-white font-black text-2xl tracking-tighter">
          <div className="bg-white text-black p-1 rounded">
            <Music size={24} />
          </div>
          <span>FIREBEAT</span>
        </div>
        <nav className="flex flex-col gap-6 text-sm font-bold text-zinc-500 uppercase tracking-widest">
          <NavItem icon={<Home size={20} />} label="Home" active />
          <NavItem icon={<Search size={20} />} label="Search" />
          <NavItem icon={<Library size={20} />} label="Library" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-zinc-900 to-black p-10 pb-40">
        <header className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-black italic tracking-tighter">EXPLORE</h1>
          <div className="flex items-center gap-4">
             <div className="px-4 py-2 bg-white/5 rounded-full text-[10px] font-bold text-zinc-400 border border-white/10 uppercase tracking-widest">
               {user ? `System Active` : 'Initializing...'}
             </div>
          </div>
        </header>

        {errorLog && (
          <div className="mb-8 p-4 bg-red-900/20 border border-red-500/30 rounded-2xl flex items-center gap-4 text-red-400 text-xs font-bold uppercase tracking-widest">
            <AlertCircle size={18} />
            <p>{errorLog}</p>
          </div>
        )}

        <section>
          <div className="flex justify-between items-end mb-8">
            <h2 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-500">Your Discovery</h2>
            <button 
              onClick={() => window.location.reload()} 
              className="text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-white flex items-center gap-2 transition"
            >
              <RefreshCcw size={12} /> Sync Database
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[1,2,3,4].map(i => (
                <div key={i} className="aspect-square bg-white/5 rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
              {tracks.map(track => (
                <div 
                  key={track.id} 
                  onClick={() => { setCurrentTrack(track); setIsPlaying(true); }}
                  className={`group p-6 rounded-[2.5rem] transition-all duration-500 cursor-pointer relative ${currentTrack?.id === track.id ? 'bg-white/10 ring-1 ring-white/20' : 'bg-zinc-900/40 hover:bg-zinc-900 border border-transparent hover:border-white/10'}`}
                >
                  <div className="relative aspect-square mb-6 overflow-hidden rounded-[2rem] bg-zinc-800 shadow-2xl">
                    {track.cover ? (
                      <img src={track.cover} alt="" className="w-full h-full object-cover transition duration-700 group-hover:scale-110" />
                    ) : (
                      <Music className="text-zinc-700" size={40} />
                    )}
                    <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-300 ${currentTrack?.id === track.id && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      {currentTrack?.id === track.id && isPlaying ? (
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black">
                          <Pause fill="black" size={28} />
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                          <Play fill="white" size={28} className="ml-1" />
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 className="font-black truncate text-sm tracking-tight mb-1">{track.title || "Untitled"}</h3>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">{track.artist || "Unknown"}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Player Bar */}
      <footer className="fixed bottom-0 left-0 right-0 h-28 bg-black/80 backdrop-blur-2xl border-t border-white/5 px-10 flex items-center justify-between z-50">
        <div className="flex items-center gap-6 w-1/3">
          {currentTrack && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 overflow-hidden border border-white/5 flex-shrink-0">
                {currentTrack.cover && <img src={currentTrack.cover} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="overflow-hidden">
                <p className="font-black text-sm truncate tracking-tight">{currentTrack.title}</p>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">{currentTrack.artist}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-4 flex-1 max-w-2xl px-10">
          <div className="flex items-center gap-10">
            <button onClick={handlePrev} className="text-zinc-500 hover:text-white transition-all"><SkipBack size={24} /></button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition active:scale-95 shadow-xl shadow-white/5"
            >
              {isPlaying ? <Pause size={28} fill="black" /> : <Play size={28} fill="black" className="ml-1" />}
            </button>
            <button onClick={handleNext} className="text-zinc-500 hover:text-white transition-all"><SkipForward size={24} /></button>
          </div>
          <div className="w-full flex items-center gap-4 group">
             <div className="flex-1 bg-zinc-800 h-1 rounded-full overflow-hidden relative">
                <div className="bg-white h-full transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
             </div>
          </div>
        </div>

        <div className="w-1/3 flex justify-end items-center gap-4">
          <Volume2 size={18} className="text-zinc-500" />
          <div className="w-24 bg-zinc-800 h-1 rounded-full overflow-hidden">
            <div className="bg-zinc-400 h-full" style={{ width: `${volume * 100}%` }} />
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavItem({ icon, label, active = false }) {
  return (
    <div className={`flex items-center gap-4 cursor-pointer transition-all duration-300 ${active ? 'text-white' : 'hover:text-white hover:translate-x-1'}`}>
      <span className={active ? 'text-white' : 'text-zinc-600'}>{icon}</span>
      <span className="text-[11px]">{label}</span>
    </div>
  );
}
