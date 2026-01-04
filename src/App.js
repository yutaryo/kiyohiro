/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, Home, Library, Heart, Disc, ListMusic, Search, MoreHorizontal } from 'lucide-react';

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

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'firebeat-prod-v1';

export default function App() {
  const [user, setUser] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSynced, setIsSynced] = useState(false);
  const [volume, setVolume] = useState(70);
  
  const audioRef = useRef(new Audio());

  // 1. Firebase Auth
  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Auth Error:", err));
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setIsSynced(true);
    });
    return () => unsubscribe();
  }, []);

  // 2. Firestore Sync
  useEffect(() => {
    if (!user) return;
    const tracksRef = collection(db, 'artifacts', appId, 'public', 'data', 'tracks');
    
    const unsubscribe = onSnapshot(query(tracksRef), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTracks(data);
      setLoading(false);
      if (data.length > 0 && !currentTrack) setCurrentTrack(data[0]);
    });
    
    return () => unsubscribe();
  }, [user]);

  // --- Rich Results (JSON-LD) ---
  useEffect(() => {
    if (!currentTrack) return;
    document.title = `${currentTrack.title} - ${currentTrack.artist} | FireBeat`;
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "MusicRecording",
      "name": currentTrack.title,
      "byArtist": { "@type": "MusicGroup", "name": currentTrack.artist },
      "image": currentTrack.cover,
      "url": window.location.href,
      "duration": "PT3M45S"
    };
    const scriptId = 'rich-result-script';
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.text = JSON.stringify(structuredData);
  }, [currentTrack]);

  // 3. Audio Control Logic
  const togglePlay = () => setIsPlaying(!isPlaying);

  // ジャケット写真クリック時のロジック（ここを修正しました）
  const handleTrackClick = (track) => {
    if (currentTrack?.id === track.id) {
      // 同じ曲なら再生/停止を切り替える
      setIsPlaying(!isPlaying);
    } else {
      // 別の曲なら新しく再生を開始する
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  };

  const handleNext = () => {
    if (tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.id === currentTrack?.id);
    setCurrentTrack(tracks[(idx + 1) % tracks.length]);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    if (tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.id === currentTrack?.id);
    setCurrentTrack(tracks[(idx - 1 + tracks.length) % tracks.length]);
    setIsPlaying(true);
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
    audio.volume = volume / 100;
    const up = () => audio.duration && setProgress((audio.currentTime / audio.duration) * 100);
    audio.addEventListener('timeupdate', up);
    audio.addEventListener('ended', handleNext);
    return () => {
      audio.removeEventListener('timeupdate', up);
      audio.removeEventListener('ended', handleNext);
    };
  }, [tracks, currentTrack, volume]);

  return (
    <div className="flex h-screen bg-black text-zinc-100 overflow-hidden font-['Inter'] selection:bg-indigo-500/30">
      
      {/* データベース同期インジケーター */}
      <div className="fixed top-6 right-6 z-[100] flex items-center gap-3 bg-black/40 backdrop-blur-xl border border-white/5 py-1.5 px-3.5 rounded-full shadow-2xl">
        <div className={`w-1.5 h-1.5 rounded-full ${isSynced ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 animate-pulse'}`} />
        <span className="text-[9px] font-black uppercase tracking-[0.15em] opacity-50">
          {isSynced ? 'Live' : 'Syncing'}
        </span>
      </div>

      {/* サイドバー */}
      <aside className="w-64 bg-black/60 backdrop-blur-2xl p-6 hidden lg:flex flex-col gap-10 border-r border-white/5 z-20">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-xl shadow-indigo-600/20">
            <Music size={20} className="text-white" />
          </div>
          <span className="font-black text-xl tracking-tighter italic">FIREBEAT</span>
        </div>
        <nav className="space-y-8">
          <div className="space-y-3">
            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] px-3">Discover</p>
            <NavItem icon={<Home size={18} />} label="Home" active />
            <NavItem icon={<Disc size={18} />} label="Explore" />
            <NavItem icon={<Library size={18} />} label="Library" />
          </div>
        </nav>
      </aside>

      {/* メインエリア */}
      <main className="flex-1 overflow-y-auto bg-transparent p-6 md:p-10 pb-36">
        <header className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase mb-2">
              Deep <span className="text-indigo-500 italic">Dark</span>
            </h1>
            <p className="text-zinc-500 text-[10px] font-black tracking-[0.3em] uppercase opacity-70">
              Aesthetic Audio Experience.
            </p>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 opacity-30">
            <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-6">
            {tracks.map(track => (
              <div 
                key={track.id} 
                onClick={() => handleTrackClick(track)}
                className="group relative cursor-pointer"
                role="button"
              >
                <div className={`relative aspect-square mb-4 rounded-3xl overflow-hidden transition-all duration-500 ease-out ${currentTrack?.id === track.id ? 'scale-105 shadow-[0_20px_40px_rgba(0,0,0,0.6)] ring-1 ring-indigo-500/50' : 'bg-zinc-900 shadow-lg group-hover:scale-[1.02]'}`}>
                  {track.cover ? (
                    <img src={track.cover} className={`w-full h-full object-cover transition duration-700 group-hover:scale-105 ${currentTrack?.id === track.id && isPlaying ? 'opacity-40' : 'group-hover:opacity-50'}`} alt={track.title} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-800"><Music size={32} /></div>
                  )}
                  <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${currentTrack?.id === track.id && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 shadow-2xl">
                      {currentTrack?.id === track.id && isPlaying ? <Pause fill="white" size={24} /> : <Play fill="white" size={24} className="ml-1" />}
                    </div>
                  </div>
                </div>
                <div className="px-1">
                   <h3 className={`font-bold truncate text-sm tracking-tight transition-colors ${currentTrack?.id === track.id ? 'text-indigo-400' : 'group-hover:text-indigo-400'}`}>{track.title}</h3>
                   <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.1em] mt-1">{track.artist}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* コンパクト・プレイヤーバー */}
      <footer className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-5xl h-20 bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-3xl px-8 flex items-center justify-between z-50 shadow-[0_30px_60px_rgba(0,0,0,0.8)]">
        <div className="w-1/4 flex items-center gap-4">
          {currentTrack && (
            <>
              <div className="w-12 h-12 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/5 shrink-0">
                <img src={currentTrack.cover} alt={currentTrack.title} className="w-full h-full object-cover" />
              </div>
              <div className="truncate hidden sm:block">
                <p className="text-[13px] font-bold truncate tracking-tight">{currentTrack.title}</p>
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-0.5">{currentTrack.artist}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center gap-2 px-6">
          <div className="flex items-center gap-6">
            <button onClick={handlePrev} className="text-zinc-600 hover:text-white transition-all transform active:scale-75"><SkipBack size={20} fill="currentColor" /></button>
            <button 
              onClick={togglePlay} 
              className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 active:scale-90 transition-all shadow-xl"
            >
              {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-0.5" />}
            </button>
            <button onClick={handleNext} className="text-zinc-600 hover:text-white transition-all transform active:scale-75"><SkipForward size={20} fill="currentColor" /></button>
          </div>
          <div className="w-full flex items-center gap-3 max-w-md">
             <div className="flex-1 bg-white/5 h-1 rounded-full overflow-hidden cursor-pointer group relative">
                <div className="bg-indigo-500 h-full transition-all duration-300 relative rounded-full" style={{ width: `${progress}%` }}>
                   <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
             </div>
          </div>
        </div>

        <div className="w-1/4 flex justify-end items-center gap-4">
          <div className="flex items-center gap-3 group hidden md:flex">
            <Volume2 size={16} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            <div className="w-20 bg-white/5 h-1 rounded-full overflow-hidden">
              <div className="bg-zinc-600 h-full group-hover:bg-indigo-500 transition-all" style={{ width: `${volume}%` }} />
            </div>
          </div>
          <button className="text-zinc-700 hover:text-white transition-colors">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
}

function NavItem({ icon, label, active = false }) {
  return (
    <div className={`flex items-center gap-3.5 py-1.5 px-3 cursor-pointer transition-all duration-300 rounded-xl group ${active ? 'bg-white/5 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-300'}`}>
      <div className={`transition-all duration-300 ${active ? 'text-indigo-500' : 'group-hover:text-zinc-300'}`}>
        {icon}
      </div>
      <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${active ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>{label}</span>
    </div>
  );
}
