/* eslint-disable no-undef */

/**
 * FireBeat AI Pro v2 - Integrated Logic
 * すべてのロジックを app.js に集約。
 */

const { useState, useEffect, useRef } = React;

// --- Firebase Configuration ---
const getFirebaseConfig = () => {
    try {
        const configStr = typeof window !== 'undefined' && window.__firebase_config 
            ? window.__firebase_config 
            : (typeof __firebase_config !== 'undefined' ? __firebase_config : null);
        
        if (configStr) return JSON.parse(configStr);
    } catch (e) {}
    
    // Default fallback
    return {
        apiKey: "AIzaSyDaGkRiRbe54qV85-32ZS09AALS8KlGrLU",
        authDomain: "mymusicplayer-ef8f0.firebaseapp.com",
        projectId: "mymusicplayer-ef8f0",
        storageBucket: "mymusicplayer-ef8f0.firebasestorage.app",
        messagingSenderId: "305125896450",
        appId: "1:305125896450:web:eb15f3650452fe442f521b"
    };
};

const firebaseConfig = getFirebaseConfig();
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Canvas環境のグローバルIDを取得
const getAppId = () => {
    if (typeof window !== 'undefined' && window.__app_id) return window.__app_id;
    if (typeof __app_id !== 'undefined') return __app_id;
    return 'firebeat-ai-pro-v2';
};
const appId = getAppId();

function App() {
    const [user, setUser] = useState(null);
    const [tracks, setTracks] = useState([]);
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [volume, setVolume] = useState(0.7);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const audioRef = useRef(new Audio());

    // 1. Authentication
    useEffect(() => {
        const initAuth = async () => {
            try {
                const token = (typeof window !== 'undefined' && window.__initial_auth_token) || (typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null);
                if (token) {
                    await auth.signInWithCustomToken(token);
                } else {
                    await auth.signInAnonymously();
                }
            } catch (err) {
                console.error("Auth Error:", err);
                setError("認証エラーが発生しました。");
            }
        };
        initAuth();
        const unsubscribe = auth.onAuthStateChanged((u) => {
            setUser(u);
        });
        return () => unsubscribe();
    }, []);

    // 2. Data Fetching (Path: /artifacts/{appId}/public/data/tracks)
    useEffect(() => {
        if (!user) return;

        const collectionPath = `artifacts/${appId}/public/data/tracks`;
        console.log("Listening to Firestore path:", collectionPath);
        
        const tracksRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('tracks');

        const unsubscribe = tracksRef.onSnapshot((snap) => {
            if (snap.empty) {
                console.warn("No documents found in:", collectionPath);
                setTracks([]);
            } else {
                const data = snap.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data() 
                }));
                console.log("Fetched Tracks:", data);
                setTracks(data);
                if (data.length > 0 && !currentTrack) setCurrentTrack(data[0]);
            }
            setLoading(false);
            setError(null);
        }, (err) => {
            console.error("Firestore Permission/Path Error:", err);
            setError(`データの取得に失敗しました。`);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, appId]);

    // 3. Audio Handlers
    useEffect(() => {
        const audio = audioRef.current;
        if (currentTrack?.url && audio.src !== currentTrack.url) {
            audio.src = currentTrack.url;
            audio.load();
        }
        if (isPlaying && currentTrack) {
            audio.play().catch(e => {
                console.warn("Playback prevented:", e);
                setIsPlaying(false);
            });
        } else {
            audio.pause();
        }
    }, [currentTrack, isPlaying]);

    useEffect(() => {
        const audio = audioRef.current;
        const update = () => {
            if (audio.duration) {
                setProgress((audio.currentTime / audio.duration) * 100);
            }
        };
        audio.addEventListener('timeupdate', update);
        audio.addEventListener('ended', () => setIsPlaying(false));
        return () => {
            audio.removeEventListener('timeupdate', update);
            audio.removeEventListener('ended', () => setIsPlaying(false));
        };
    }, []);

    useEffect(() => { 
        audioRef.current.volume = volume; 
    }, [volume]);

    return (
        <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-black border-r border-zinc-800 p-6 hidden md:flex flex-col">
                <div className="flex items-center gap-3 mb-12">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <i data-lucide="zap" className="w-6 h-6 fill-white"></i>
                    </div>
                    <span className="font-black tracking-tighter text-xl italic uppercase">FireBeat<span className="text-indigo-400">AI</span></span>
                </div>
                <nav className="space-y-6">
                    <div className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em] px-2">Library</div>
                    <div className="flex items-center gap-4 text-white font-bold bg-indigo-600/10 p-4 rounded-2xl cursor-pointer border border-indigo-500/20">
                        <i data-lucide="music" className="w-5 h-5 text-indigo-400"></i>
                        <span className="text-xs uppercase tracking-widest">すべての曲</span>
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-gradient-to-b from-[#0a0a0a] to-[#050505] p-10 pb-40">
                <header className="mb-12">
                    <h1 className="text-6xl font-black mb-3 italic tracking-tighter uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">
                        {loading ? "Syncing..." : "Player."}
                    </h1>
                    <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${user ? 'bg-indigo-500 animate-pulse' : 'bg-red-500'}`}></span>
                        <p className="text-zinc-500 text-[10px] font-black tracking-[0.4em] uppercase">
                            {user ? `App ID: ${appId}` : "Authentication Required"}
                        </p>
                    </div>
                </header>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-3xl text-red-500 text-xs font-black mb-10 flex flex-col gap-2">
                        <div className="flex items-center gap-3 italic">
                            <i data-lucide="alert-circle" className="w-4 h-4"></i>
                            <span>DATABASE ERROR</span>
                        </div>
                        <p className="opacity-70 font-normal">{error}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {loading ? (
                        [1,2,3,4].map(i => <div key={i} className="aspect-square bg-zinc-900/50 rounded-[3rem] animate-pulse" />)
                    ) : tracks.length === 0 ? (
                        <div className="col-span-full py-32 text-center border border-dashed border-zinc-800 rounded-[3rem] bg-zinc-900/5">
                            <i data-lucide="database-zap" className="w-10 h-10 text-zinc-800 mx-auto mb-4"></i>
                            <p className="text-zinc-600 text-[10px] font-black tracking-[0.3em] uppercase">No Data Found</p>
                        </div>
                    ) : (
                        tracks.map(track => (
                            <div 
                                key={track.id} 
                                onClick={() => { setCurrentTrack(track); setIsPlaying(true); }}
                                className={`group p-5 rounded-[3rem] border transition-all duration-500 cursor-pointer ${currentTrack?.id === track.id ? 'bg-indigo-600/10 border-indigo-500/40 shadow-2xl scale-[1.02]' : 'bg-zinc-900/20 border-transparent hover:bg-zinc-800/40 hover:border-zinc-700'}`}
                            >
                                <div className="aspect-square bg-zinc-800 rounded-[2.2rem] overflow-hidden mb-5 relative shadow-xl">
                                    {track.cover ? (
                                        <img src={track.cover} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                            <i data-lucide="disc" className="text-zinc-800 w-12 h-12"></i>
                                        </div>
                                    )}
                                    <div className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center transition-all duration-500 ${currentTrack?.id === track.id && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                        <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-2xl">
                                            {currentTrack?.id === track.id && isPlaying ? <i data-lucide="pause" className="text-black fill-black w-5 h-5"></i> : <i data-lucide="play" className="text-black fill-black ml-1 w-5 h-5"></i>}
                                        </div>
                                    </div>
                                </div>
                                <h3 className="font-black text-xs truncate mb-1 tracking-tight text-white">{track.title || "Untitled"}</h3>
                                <p className="text-zinc-600 text-[9px] uppercase font-black tracking-widest">{track.artist || "Unknown Artist"}</p>
                            </div>
                        ))
                    )}
                </div>
            </main>

            {/* Player Bar */}
            <footer className="fixed bottom-0 inset-x-0 h-32 bg-black/80 backdrop-blur-3xl border-t border-zinc-800/30 px-10 flex items-center justify-between z-50">
                <div className="w-1/3 flex items-center gap-5">
                    {currentTrack && (
                        <>
                            <div className="w-16 h-16 bg-zinc-800 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800/50">
                                {currentTrack.cover && <img src={currentTrack.cover} className="w-full h-full object-cover" />}
                            </div>
                            <div className="overflow-hidden">
                                <div className="font-black text-xs truncate tracking-tight">{currentTrack.title}</div>
                                <div className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mt-2">{currentTrack.artist}</div>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex-1 max-w-2xl flex flex-col items-center gap-4 px-10">
                    <div className="flex items-center gap-10">
                        <button className="text-zinc-600 hover:text-white transition-all"><i data-lucide="shuffle" className="w-4 h-4"></i></button>
                        <button 
                            onClick={() => setIsPlaying(!isPlaying)} 
                            className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
                            disabled={!currentTrack}
                        >
                            {isPlaying ? <i data-lucide="pause" className="w-6 h-6 fill-black"></i> : <i data-lucide="play" className="w-6 h-6 fill-black ml-1"></i>}
                        </button>
                        <button className="text-zinc-600 hover:text-white transition-all"><i data-lucide="repeat" className="w-4 h-4"></i></button>
                    </div>
                    <div className="w-full h-1 bg-zinc-800/50 rounded-full relative overflow-hidden group">
                        <div className="absolute inset-y-0 left-0 bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
                        <input 
                            type="range" min="0" max="100" value={progress} 
                            onChange={(e) => {
                                const audio = audioRef.current;
                                if (audio.duration) {
                                    audio.currentTime = (e.target.value / 100) * audio.duration;
                                    setProgress(e.target.value);
                                }
                            }}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer" 
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                        />
                    </div>
                </div>

                <div className="w-1/3 flex justify-end items-center gap-4">
                    <i data-lucide="volume-2" className="w-4 h-4 text-zinc-600"></i>
                    <input 
                        type="range" min="0" max="1" step="0.01" value={volume} 
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="w-24 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white" 
                    />
                </div>
            </footer>
        </div>
    );
}

// React Mounting
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

// Lucide Icons Refresh
const updateIcons = () => {
    if (window.lucide) window.lucide.createIcons();
};
setTimeout(updateIcons, 500);
setInterval(updateIcons, 3000);
