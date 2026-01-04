/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, Search, Home, Library, AlertCircle, RefreshCcw } from 'lucide-react';

// --- あなたの Firebase 設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyDaGkRiRbe54qV85-32ZS09AALS8KlGrLU",
  authDomain: "mymusicplayer-ef8f0.firebaseapp.com",
  projectId: "mymusicplayer-ef8f0",
  storageBucket: "mymusicplayer-ef8f0.firebasestorage.app",
  messagingSenderId: "305125896450",
  appId: "1:305125896450:web:eb15f3650452fe442f521b",
  measurementId: "G-4M73KXLS97"
};

// Firebase 初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ローカル環境(GitHub/Vercel)で使うための固定ID
const appId = 'firebeat-music-v1';

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

  // 1. 認証処理 (カスタムトークンエラーを回避するフォールバック付き)
  useEffect(() => {
    const initAuth = async () => {
      try {
        // グローバル変数がない場合でも安全に匿名認証へ移行
        await signInAnonymously(auth);
      } catch (error) {
        setErrorLog("認証エラー: " + error.message);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Firestore同期 ＋ 自動修復機能
  useEffect(() => {
    if (!user) return;

    const tracksRef = collection(db, 'artifacts', appId, 'public', 'data', 'tracks');
    
    // データがない場合にサンプルを自動作成する
    const ensureInitialData = async () => {
      try {
        const snapshot = await getDocs(tracksRef);
        if (snapshot.empty) {
          await addDoc(tracksRef, {
            title: "Sample Song (SoundHelix)",
            artist: "SoundHelix Official",
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
            cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
            createdAt: serverTimestamp()
          });
        }
      } catch (e) {
        console.error("Auto-fix failed:", e);
      }
    };

    ensureInitialData();

    const unsubscribeTracks = onSnapshot(query(tracksRef), (snapshot) => {
      const trackData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTracks(trackData);
      setLoading(false);
      if (trackData.length > 0 && !currentTrack) {
        setCurrentTrack(trackData[0]);
      }
    }, (err) => {
      setErrorLog("Firestore読み込み失敗: " + err.message);
      setLoading(false);
    });

    return () => unsubscribeTracks();
  }, [user]);

  // 3. 再生制御
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
    if (currentTrack && currentTrack.url) {
      audioRef.current.src = currentTrack.url;
      if (isPlaying) audioRef.current.play().catch(e => console.error(e));
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

  return (
    <div className="flex h-screen bg-neutral-950 text-white font-sans overflow-hidden">
      {/* サイドバー */}
      <aside className="w-64 bg-black p-6 flex flex-col gap-8 hidden md:flex border-r border-neutral-800">
        <div className="flex items-center gap-2 text-indigo-500 font-bold text-2xl">
          <Music size={32} />
          <span>FireBeat</span>
        </div>
        <nav className="flex flex-col gap-4 text-sm text-neutral-400">
          <NavItem icon={<Home size={20} />} label="ホーム" active />
          <NavItem icon={<Search size={20} />} label="検索" />
          <NavItem icon={<Library size={20} />} label="ライブラリ" />
        </nav>
      </aside>

      {/* メインエリア */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-neutral-900 to-black p-8 pb-32">
        <header className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-bold italic tracking-tighter">Firestore Music</h1>
          <div className="px-4 py-2 bg-neutral-800 rounded-full text-[10px] font-mono text-neutral-400 border border-neutral-700">
            {user ? `Authenticated` : 'Connecting...'}
          </div>
        </header>

        {errorLog && (
          <div className="mb-8 p-4 bg-red-900/30 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200 text-sm">
            <AlertCircle size={20} />
            <p>{errorLog}</p>
          </div>
        )}

        <section>
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-xl font-bold">あなたのライブラリ</h2>
            <button 
              onClick={() => window.location.reload()} 
              className="text-xs text-neutral-500 hover:text-white flex items-center gap-1 transition"
            >
              <RefreshCcw size={12} /> 更新
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          ) : tracks.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-neutral-800 rounded-3xl bg-neutral-900/20">
              <Music size={48} className="mx-auto mb-4 text-neutral-800" />
              <p className="text-neutral-400 text-sm">曲データが見つかりません。</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {tracks.map(track => (
                <div 
                  key={track.id} 
                  onClick={() => { setCurrentTrack(track); setIsPlaying(true); }}
                  className={`group p-4 rounded-2xl transition-all cursor-pointer relative ${currentTrack?.id === track.id ? 'bg-indigo-600/20 ring-1 ring-indigo-500 shadow-lg shadow-indigo-500/10' : 'bg-neutral-900/50 hover:bg-neutral-800'}`}
                >
                  <div className="relative aspect-square mb-4 overflow-hidden rounded-xl bg-neutral-800 flex items-center justify-center shadow-lg">
                    {track.cover ? <img src={track.cover} alt="" className="w-full h-full object-cover transition duration-500 group-hover:scale-110" /> : <Music className="text-neutral-700" />}
                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${currentTrack?.id === track.id && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      {currentTrack?.id === track.id && isPlaying ? <Pause fill="white" size={32} /> : <Play fill="white" size={32} />}
                    </div>
                  </div>
                  <h3 className="font-bold truncate text-sm">{track.title || "Untitled"}</h3>
                  <p className="text-xs text-neutral-400 truncate mt-1">{track.artist || "Unknown Artist"}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* プレイヤーコントロール */}
      <footer className="fixed bottom-0 left-0 right-0 h-24 bg-black/90 backdrop-blur-xl border-t border-neutral-800 px-6 flex items-center justify-between z-50">
        <div className="flex items-center gap-4 w-1/4">
          {currentTrack && (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded bg-neutral-800 overflow-hidden shadow-inner border border-neutral-700 flex-shrink-0">
                {currentTrack.cover && <img src={currentTrack.cover} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold truncate">{currentTrack.title}</p>
                <p className="text-[10px] text-neutral-500 truncate">{currentTrack.artist}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 flex-1 max-w-xl">
          <div className="flex items-center gap-6">
            <button onClick={handlePrev} className="text-neutral-500 hover:text-white transition-colors"><SkipBack size={20} /></button>
            <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition active:scale-95 shadow-lg">
              {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-1" />}
            </button>
            <button onClick={handleNext} className="text-neutral-500 hover:text-white transition-colors"><SkipForward size={20} /></button>
          </div>
          <div className="w-full bg-neutral-800 h-1 rounded-full overflow-hidden mt-1">
            <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="w-1/4 flex justify-end items-center gap-3">
          <Volume2 size={16} className="text-neutral-500" />
          <div className="w-20 bg-neutral-800 h-1 rounded-full overflow-hidden">
            <div className="bg-white/70 h-full" style={{ width: `${volume * 100}%` }} />
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavItem({ icon, label, active = false }) {
  return (
    <div className={`flex items-center gap-4 cursor-pointer transition ${active ? 'text-white' : 'hover:text-white'}`}>
      {icon}
      <span className="font-medium">{label}</span>
    </div>
  );
}
