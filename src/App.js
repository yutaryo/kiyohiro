/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, Search, Home, Library, ListMusic, Plus } from 'lucide-react';

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
const appId = 'firebeat-music-v2'; // バージョン管理用のID

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

  // 1. 認証
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. データ取得 & 初期サンプル曲の投入
  useEffect(() => {
    if (!user) return;

    const tracksRef = collection(db, 'artifacts', appId, 'public', 'data', 'tracks');
    
    const ensureInitialData = async () => {
      const snapshot = await getDocs(tracksRef);
      if (snapshot.empty) {
        const samples = [
          {
            title: "Chill Lofi Vibes",
            artist: "Lofi Girl",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            cover: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&h=400&fit=crop",
            genre: "Chill",
            createdAt: serverTimestamp()
          },
          {
            title: "Techno Energy",
            artist: "Cyber Sonic",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
            cover: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400&h=400&fit=crop",
            genre: "Energy",
            createdAt: serverTimestamp()
          },
          {
            title: "Deep Focus Piano",
            artist: "Mindfulness",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
            cover: "https://images.unsplash.com/photo-1520529682724-245b3dd3a48e?w=400&h=400&fit=crop",
            genre: "Focus",
            createdAt: serverTimestamp()
          }
        ];
        for (const s of samples) {
          await addDoc(tracksRef, s);
        }
      }
    };

    ensureInitialData();

    const unsubscribe = onSnapshot(query(tracksRef), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTracks(data);
      setLoading(false);
      if (data.length > 0 && !currentTrack) setCurrentTrack(data[0]);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. プレイリストによるフィルタリング
  useEffect(() => {
    if (activePlaylist === 'All') {
      setFilteredTracks(tracks);
    } else {
      setFilteredTracks(tracks.filter(t => t.genre === activePlaylist));
    }
  }, [tracks, activePlaylist]);

  // 4. 再生ロジック (同じ曲ならトグル停止)
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
    setCurrentTrack(list[(idx + 1) % list.length]);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    const list = filteredTracks.length > 0 ? filteredTracks : tracks;
    const idx = list.findIndex(t => t.id === currentTrack?.id);
    setCurrentTrack(list[(idx - 1 + list.length) % list.length]);
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
      {/* サイドバー */}
      <aside className="w-64 bg-black p-6 flex flex-col gap-8 hidden md:flex border-r border-neutral-800 overflow-y-auto">
        <div className="flex items-center gap-2 text-indigo-500 font-bold text-2xl px-2">
          <Music size={32} />
          <span>FireBeat</span>
        </div>
        
        <nav className="flex flex-col gap-6 text-sm">
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest px-2">メイン</p>
            <NavItem icon={<Home size={20} />} label="すべて表示" active={activePlaylist === 'All'} onClick={() => setActivePlaylist('All')} />
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest px-2">プレイリスト</p>
            <NavItem icon={<ListMusic size={20} />} label="Chill Beats" active={activePlaylist === 'Chill'} onClick={() => setActivePlaylist('Chill')} />
            <NavItem icon={<ListMusic size={20} />} label="Energy Mix" active={activePlaylist === 'Energy'} onClick={() => setActivePlaylist('Energy')} />
            <NavItem icon={<ListMusic size={20} />} label="Focus Mode" active={activePlaylist === 'Focus'} onClick={() => setActivePlaylist('Focus')} />
          </div>
        </nav>
      </aside>

      {/* メイン */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-neutral-900 to-black p-8 pb-32">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {activePlaylist === 'All' ? 'Your Library' : activePlaylist}
            </h1>
            <p className="text-neutral-500 text-xs mt-1">{filteredTracks.length} tracks found.</p>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredTracks.map(track => (
              <div 
                key={track.id} 
                onClick={() => handleTrackClick(track)}
                className={`group p-4 rounded-2xl transition-all cursor-pointer relative ${currentTrack?.id === track.id ? 'bg-indigo-600/20 ring-1 ring-indigo-500' : 'bg-neutral-900/40 hover:bg-neutral-800'}`}
              >
                <div className="relative aspect-square mb-4 overflow-hidden rounded-xl bg-neutral-800 shadow-xl">
                  {track.cover && <img src={track.cover} alt="" className="w-full h-full object-cover transition duration-500 group-hover:scale-110" />}
                  <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${currentTrack?.id === track.id && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {currentTrack?.id === track.id && isPlaying ? <Pause fill="white" size={32} /> : <Play fill="white" size={32} />}
                  </div>
                </div>
                <h3 className="font-bold truncate text-sm">{track.title}</h3>
                <p className="text-[10px] text-neutral-500 truncate mt-1 uppercase tracking-wider">{track.artist}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* プレイヤー */}
      <footer className="fixed bottom-0 left-0 right-0 h-24 bg-black/95 backdrop-blur-xl border-t border-neutral-900 px-6 flex items-center justify-between z-50">
        <div className="flex items-center gap-4 w-1/4">
          {currentTrack && (
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4">
              <img src={currentTrack.cover} className="w-12 h-12 rounded shadow-lg" alt="" />
              <div className="overflow-hidden">
                <p className="text-xs font-bold truncate">{currentTrack.title}</p>
                <p className="text-[10px] text-neutral-500 truncate">{currentTrack.artist}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 flex-1 max-w-2xl">
          <div className="flex items-center gap-6">
            <button onClick={handlePrev} className="text-neutral-500 hover:text-white transition"><SkipBack size={20} fill="currentColor" /></button>
            <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition active:scale-90 shadow-xl">
              {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-1" />}
            </button>
            <button onClick={handleNext} className="text-neutral-500 hover:text-white transition"><SkipForward size={20} fill="currentColor" /></button>
          </div>
          <div className="w-full bg-neutral-800 h-1 rounded-full overflow-hidden">
            <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="w-1/4 flex justify-end items-center gap-3">
          <Volume2 size={16} className="text-neutral-500" />
          <div className="w-24 bg-neutral-800 h-1 rounded-full">
            <div className="bg-white/60 h-full" style={{ width: `${volume * 100}%` }} />
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-4 px-3 py-2 cursor-pointer transition rounded-lg ${active ? 'bg-indigo-600/10 text-indigo-400' : 'text-neutral-500 hover:text-white hover:bg-neutral-900'}`}
    >
      {icon}
      <span className="font-semibold">{label}</span>
    </div>
  );
}
