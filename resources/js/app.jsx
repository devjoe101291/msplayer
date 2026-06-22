import './bootstrap';
import '../css/app.css';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import {
    Album,
    Clapperboard,
    Clock3,
    Compass,
    Heart,
    History,
    Home,
    Library,
    ListMusic,
    LogOut,
    Music2,
    Pause,
    Play,
    Plus,
    Search,
    ShieldCheck,
    Shuffle,
    SkipBack,
    SkipForward,
    UploadCloud,
    UserRound,
    Video,
    Volume2,
} from 'lucide-react';

function formatTime(seconds) {
    const s = Number(seconds);
    if (!Number.isFinite(s) || s <= 0) return '0:00';
    const m = Math.floor(s / 60);
    const rem = Math.floor(s % 60);
    return `${m}:${String(rem).padStart(2, '0')}`;
}


const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'library', label: 'Library', icon: Library },
    { id: 'liked', label: 'Liked', icon: Heart },
    { id: 'playlists', label: 'Playlists', icon: ListMusic },
    { id: 'artists', label: 'Artists', icon: UserRound },
    { id: 'albums', label: 'Albums', icon: Album },
    { id: 'history', label: 'History', icon: History },
    { id: 'youtube', label: 'YouTube', icon: Compass },
    { id: 'upload', label: 'Upload', icon: UploadCloud },
];

const accentCovers = [
    ['#24463f', '#d7e7d7'],
    ['#45526c', '#d9e0f1'],
    ['#805f43', '#f1dfc8'],
    ['#5a6b55', '#e5ead9'],
    ['#324653', '#d5e4e8'],
    ['#6f5359', '#ead9dc'],
];

function App() {
    const [activeView, setActiveView] = useState('home');
    const [items, setItems] = useState([]);
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [current, setCurrent] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [notice, setNotice] = useState('');
    const [authToken, setAuthToken] = useState(() => localStorage.getItem('ms_player_token') ?? '');
    const [user, setUser] = useState(null);
    const [authMode, setAuthMode] = useState('login');
    const [authNotice, setAuthNotice] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [likedIds, setLikedIds] = useState([]);
    const [historyItems, setHistoryItems] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [artists, setArtists] = useState([]);
    const [albums, setAlbums] = useState([]);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [relatedVideos, setRelatedVideos] = useState([]);
    const [libraryNotice, setLibraryNotice] = useState('');
    const [youtubeResults, setYoutubeResults] = useState([]);
    const [youtubeNotice, setYoutubeNotice] = useState('');
    const [youtubeLoading, setYoutubeLoading] = useState(false);

    const [progress, setProgress] = useState({ currentTime: 0, duration: 0 });
    const [mediaStatus, setMediaStatus] = useState({ canPlay: false, error: '' });

    const mediaRef = useRef(null);


    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            const matchesType = typeFilter === 'all' || item.type === typeFilter;
            const haystack = `${item.title} ${item.artist} ${item.album ?? ''} ${item.genre ?? ''}`.toLowerCase();
            return matchesType && haystack.includes(query.toLowerCase());
        });
    }, [items, query, typeFilter]);

    const audioItems = filteredItems.filter((item) => item.type === 'audio');
    const videoItems = filteredItems.filter((item) => item.type === 'video');
    const featured = items.filter((item) => item.is_featured).slice(0, 4);
    const isAdmin = Boolean(user?.is_admin);

    async function apiFetch(url, options = {}) {
        const headers = {
            Accept: 'application/json',
            ...(options.headers ?? {}),
        };

        if (authToken) {
            headers.Authorization = `Bearer ${authToken}`;
        }

        return fetch(url, {
            ...options,
            headers,
        });
    }

    async function loadItems() {
        const response = await fetch('/api/media');
        const payload = await response.json();
        setItems(payload.data.data);
        setCurrent((existing) => existing ?? payload.data.data[0] ?? null);
    }

    async function loadDiscovery() {
        const [artistsResponse, albumsResponse] = await Promise.all([
            fetch('/api/artists'),
            fetch('/api/albums'),
        ]);
        const [artistPayload, albumPayload] = await Promise.all([
            artistsResponse.json(),
            albumsResponse.json(),
        ]);

        setArtists(artistPayload.data);
        setAlbums(albumPayload.data);
    }

    async function loadUserLibrary(token = authToken) {
        if (!token) {
            setLikedIds([]);
            setHistoryItems([]);
            setPlaylists([]);
            return;
        }

        const headers = {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
        };

        const [summaryResponse, playlistResponse] = await Promise.all([
            fetch('/api/library/summary', { headers }),
            fetch('/api/playlists', { headers }),
        ]);

        if (!summaryResponse.ok || !playlistResponse.ok) {
            return;
        }

        const [summaryPayload, playlistPayload] = await Promise.all([
            summaryResponse.json(),
            playlistResponse.json(),
        ]);

        setLikedIds(summaryPayload.liked_ids ?? []);
        setHistoryItems(summaryPayload.history ?? []);
        setPlaylists(playlistPayload.data ?? []);
    }

    useEffect(() => {
        loadItems().catch(() => setNotice('Could not load your library yet.'));
        loadDiscovery().catch(() => {});
    }, []);

    useEffect(() => {
        if (!authToken) {
            setUser(null);
            return;
        }

        apiFetch('/api/auth/me')
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('Session expired.');
                }

                const payload = await response.json();
                setUser(payload.data);
                loadUserLibrary(authToken).catch(() => {});
            })
            .catch(() => {
                localStorage.removeItem('ms_player_token');
                setAuthToken('');
                setUser(null);
                setLikedIds([]);
                setHistoryItems([]);
                setPlaylists([]);
            });
    }, [authToken]);

    useEffect(() => {
        if (!mediaRef.current || !current) return;

        // Reset progress when changing tracks
        setProgress({ currentTime: 0, duration: 0 });

        const el = mediaRef.current;

        const handleLoadedMetadata = () => {
            setProgress((p) => ({
                ...p,
                duration: el.duration || 0,
            }));
        };

        const handleDurationChange = () => {
            setProgress((p) => ({
                ...p,
                duration: el.duration || 0,
            }));
        };

        const handleTimeUpdate = () => {
            setProgress({
                currentTime: el.currentTime || 0,
                duration: el.duration || 0,
            });
        };

        const handleCanPlay = () => {
            setMediaStatus({ canPlay: true, error: '' });
        };

        const handleError = () => {
            let msg = '';
            try {
                msg = el.error?.message || 'Media failed to load.';
            } catch (e) {
                msg = 'Media failed to load.';
            }
            setMediaStatus({ canPlay: false, error: msg });
        };

        el.addEventListener('loadedmetadata', handleLoadedMetadata);
        el.addEventListener('durationchange', handleDurationChange);
        el.addEventListener('timeupdate', handleTimeUpdate);
        el.addEventListener('canplay', handleCanPlay);
        el.addEventListener('error', handleError);

        // Start/stop
        if (isPlaying) {
            el.play().catch(() => setIsPlaying(false));
        } else {
            el.pause();
        }

        return () => {
            el.removeEventListener('loadedmetadata', handleLoadedMetadata);
            el.removeEventListener('durationchange', handleDurationChange);
            el.removeEventListener('timeupdate', handleTimeUpdate);
            el.removeEventListener('canplay', handleCanPlay);
            el.removeEventListener('error', handleError);
        };
    }, [current, isPlaying]);

    function handleSeek(nextTime) {
        if (!mediaRef.current) return;
        if (!Number.isFinite(nextTime)) return;
        mediaRef.current.currentTime = Math.max(0, nextTime);
        setProgress((p) => ({
            ...p,
            currentTime: Math.max(0, nextTime),
        }));
    }


    function playItem(item) {
        setCurrent(item);
        setIsPlaying(true);

        if (authToken) {
            apiFetch(`/api/library/media/${item.id}/play`, { method: 'POST' })
                .then(() => loadUserLibrary())
                .catch(() => {});
        }
    }

    async function openVideo(item) {
        setSelectedVideo(item);
        setActiveView('video');
        playItem(item);

        const response = await fetch(`/api/videos/${item.id}/theater`);
        if (response.ok) {
            const payload = await response.json();
            setSelectedVideo(payload.data);
            setRelatedVideos(payload.related);
        }
    }

    function jump(direction) {
        if (!current || items.length === 0) {
            return;
        }

        const playable = items.filter((item) => item.type === current.type);
        const index = playable.findIndex((item) => item.id === current.id);
        const nextIndex = (index + direction + playable.length) % playable.length;
        playItem(playable[nextIndex]);
    }

    function shuffle() {
        if (!current || items.length === 0) {
            return;
        }

        const playable = items.filter((item) => item.type === current.type);
        if (playable.length === 0) return;

        const index = playable.findIndex((item) => item.id === current.id);
        if (playable.length === 1) {
            playItem(playable[0]);
            return;
        }

        let nextIndex = Math.floor(Math.random() * playable.length);
        if (nextIndex === index) {
            nextIndex = (nextIndex + 1) % playable.length;
        }

        playItem(playable[nextIndex]);
    }


    async function handleUpload(event) {
        event.preventDefault();
        const form = event.currentTarget;
        setUploading(true);
        setNotice('');

        const formData = new FormData(form);

        try {
            const response = await fetch('/api/media', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    Accept: 'application/json',
                },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message ?? 'Upload failed.');
            }

            form.reset();
            setNotice('Upload complete. Your track is ready to stream.');
            await loadItems();
            setActiveView('library');
        } catch (error) {
            setNotice(error.message);
        } finally {
            setUploading(false);
        }
    }

    async function handleAuth(event) {
        event.preventDefault();
        setAuthLoading(true);
        setAuthNotice('');

        const formData = new FormData(event.currentTarget);
        const payload = Object.fromEntries(formData.entries());
        const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message ?? 'Authentication failed.');
            }

            localStorage.setItem('ms_player_token', data.token);
            setAuthToken(data.token);
            setUser(data.user);
            setAuthNotice(data.user.is_admin ? 'Admin studio unlocked.' : 'Signed in as listener.');
            await loadUserLibrary(data.token);
        } catch (error) {
            setAuthNotice(error.message);
        } finally {
            setAuthLoading(false);
        }
    }

    async function logout() {
        if (authToken) {
            await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        }

        localStorage.removeItem('ms_player_token');
        setAuthToken('');
        setUser(null);
        setAuthNotice('');
        setLikedIds([]);
        setHistoryItems([]);
        setPlaylists([]);
    }

    async function toggleLike(item) {
        if (!authToken) {
            setLibraryNotice('Login to like songs and videos.');
            return;
        }

        setLikedIds((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id]);
        const response = await apiFetch(`/api/library/media/${item.id}/like`, { method: 'POST' });

        if (!response.ok) {
            await loadUserLibrary();
        }
    }

    async function createPlaylist(event) {
        event.preventDefault();

        if (!authToken) {
            setLibraryNotice('Login to create playlists.');
            return;
        }

        const form = event.currentTarget;
        const payload = Object.fromEntries(new FormData(form).entries());
        const response = await apiFetch('/api/playlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            form.reset();
            setLibraryNotice('Playlist created.');
            await loadUserLibrary();
        }
    }

    async function addToPlaylist(playlistId, mediaItemId) {
        const response = await apiFetch(`/api/playlists/${playlistId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ media_item_id: mediaItemId }),
        });

        if (response.ok) {
            setLibraryNotice('Added to playlist.');
            await loadUserLibrary();
        }
    }

    async function removeFromPlaylist(playlistId, mediaItemId) {
        const response = await apiFetch(`/api/playlists/${playlistId}/items/${mediaItemId}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            await loadUserLibrary();
        }
    }

    async function searchYoutube(event) {
        event.preventDefault();

        if (!isAdmin) {
            setYoutubeNotice('Only the admin account can import YouTube references.');
            return;
        }

        const query = new FormData(event.currentTarget).get('q');
        setYoutubeLoading(true);
        setYoutubeNotice('');

        try {
            const response = await apiFetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.message ?? 'YouTube search failed.');
            }

            setYoutubeResults(payload.data ?? []);
            if ((payload.data ?? []).length === 0) {
                setYoutubeNotice('No results returned. Make sure the NewPipe service is running.');
            }
        } catch (error) {
            setYoutubeResults([]);
            setYoutubeNotice(error?.message ?? 'YouTube search failed.');
        } finally {
            setYoutubeLoading(false);
        }
    }

    async function importYoutube(payload) {
        if (!isAdmin) {
            setYoutubeNotice('Only the admin account can import YouTube references.');
            return;
        }

        setYoutubeLoading(true);
        setYoutubeNotice('');

        try {
            const response = await apiFetch('/api/youtube/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message ?? 'Import failed.');
            }

            setYoutubeNotice('YouTube reference imported into the library.');
            await loadItems();
            await loadDiscovery();
        } catch (error) {
            setYoutubeNotice(error.message);
        } finally {
            setYoutubeLoading(false);
        }
    }

    async function importYoutubeManual(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const payload = Object.fromEntries(new FormData(form).entries());
        await importYoutube(payload);
        form.reset();
    }

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="brand">
                    <div className="brand-mark"><Music2 size={22} /></div>
                    <div>
                        <strong>MS Player</strong>
                        <span>Creator streaming</span>
                    </div>
                </div>

                <nav className="nav-list" aria-label="Main navigation">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button
                                className={activeView === item.id ? 'nav-item active' : 'nav-item'}
                                key={item.id}
                                onClick={() => setActiveView(item.id)}
                                type="button"
                            >
                                <Icon size={19} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="sidebar-card">
                    <span>Studio mode</span>
                    <strong>{isAdmin ? 'Admin' : 'Listen'}</strong>
                    <small>{items.length} published uploads</small>
                </div>
            </aside>

            <main className="main-content">
                <header className="topbar">
                    <div className="search-wrap">
                        <Search size={18} />
                        <input
                            aria-label="Search songs, videos, artists, albums"
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search songs, videos, artists..."
                            value={query}
                        />
                    </div>

                    <div className="filter-tabs" aria-label="Media filter">
                        {['all', 'audio', 'video'].map((filter) => (
                            <button
                                className={typeFilter === filter ? 'tab active' : 'tab'}
                                key={filter}
                                onClick={() => setTypeFilter(filter)}
                                type="button"
                            >
                                {filter}
                            </button>
                        ))}
                    </div>

                    <AccountPanel
                        authLoading={authLoading}
                        authMode={authMode}
                        authNotice={authNotice}
                        onAuthMode={setAuthMode}
                        onLogout={logout}
                        onSubmit={handleAuth}
                        user={user}
                    />
                </header>

                {activeView === 'home' && (
                    <HomeView
                        featured={featured}
                        items={items}
                        onPlay={playItem}
                        onUpload={() => setActiveView('upload')}
                        onVideo={openVideo}
                    />
                )}

                {activeView === 'search' && (
                    <LibraryView
                        audioItems={audioItems}
                        emptyTitle="No matches yet"
                        likedIds={likedIds}
                        onAddToPlaylist={addToPlaylist}
                        onLike={toggleLike}
                        onPlay={playItem}
                        onVideo={openVideo}
                        playlists={playlists}
                        title="Search Results"
                        videoItems={videoItems}
                    />
                )}

                {activeView === 'library' && (
                    <LibraryView
                        audioItems={audioItems}
                        emptyTitle="Your library is empty"
                        likedIds={likedIds}
                        onAddToPlaylist={addToPlaylist}
                        onLike={toggleLike}
                        onPlay={playItem}
                        onVideo={openVideo}
                        playlists={playlists}
                        title="Library"
                        videoItems={videoItems}
                    />
                )}

                {activeView === 'liked' && (
                    <LibraryView
                        audioItems={items.filter((item) => likedIds.includes(item.id) && item.type === 'audio')}
                        emptyTitle="No liked songs yet"
                        likedIds={likedIds}
                        onAddToPlaylist={addToPlaylist}
                        onLike={toggleLike}
                        onPlay={playItem}
                        onVideo={openVideo}
                        playlists={playlists}
                        title="Liked Songs"
                        videoItems={items.filter((item) => likedIds.includes(item.id) && item.type === 'video')}
                    />
                )}

                {activeView === 'playlists' && (
                    <PlaylistsView
                        items={items}
                        notice={libraryNotice}
                        onCreate={createPlaylist}
                        onPlay={playItem}
                        onRemove={removeFromPlaylist}
                        playlists={playlists}
                        user={user}
                    />
                )}

                {activeView === 'artists' && (
                    <GroupedView groups={artists} groupKey="artist" onPlay={playItem} title="Artists" />
                )}

                {activeView === 'albums' && (
                    <GroupedView groups={albums} groupKey="album" onPlay={playItem} title="Albums" />
                )}

                {activeView === 'history' && (
                    <HistoryView historyItems={historyItems} onPlay={playItem} user={user} />
                )}

                {activeView === 'youtube' && (
                    <YoutubeImportView
                        isAdmin={isAdmin}
                        loading={youtubeLoading}
                        notice={youtubeNotice}
                        onImport={importYoutube}
                        onManualImport={importYoutubeManual}
                        onSearch={searchYoutube}
                        results={youtubeResults}
                        user={user}
                        onSetNotice={setYoutubeNotice}
                        onPlayResult={({ stream, result }) => {
                                    const next = {
                                id: result.id ?? result.url,
                                type: stream.stream_type ?? 'audio',
                                title: stream.title ?? result.title,
                                artist: stream.artist ?? (result.uploader ?? result.artist ?? 'YouTube'),
                                source_url: stream.source_url ?? result.url,
                                stream_url: stream.stream_url,
                                audio_stream_url: stream.audio_stream_url,
                                video_stream_url: stream.video_stream_url,
                                audio_mime_type: stream.audio_mime_type,
                                video_mime_type: stream.video_mime_type,
                                thumbnail_url: stream.thumbnail_url ?? result.thumbnail_url,
                                cover_url: stream.thumbnail_url ?? result.thumbnail_url,
                                description: stream.description,
                                duration_seconds: stream.duration_seconds,
                            };

                            setCurrent(next);
                            setIsPlaying(true);
                        }}
                    />
                )}

                {activeView === 'video' && (
                    <VideoTheaterView current={selectedVideo} onPlay={openVideo} related={relatedVideos} />
                )}

                {activeView === 'upload' && (
                    <UploadView
                        isAdmin={isAdmin}
                        notice={notice}
                        onAuthMode={setAuthMode}
                        onSubmit={handleUpload}
                        uploading={uploading}
                        user={user}
                    />
                )}
            </main>

            <Player
                current={current}
                isPlaying={isPlaying}
                mediaRef={mediaRef}
                progress={progress}
                onJump={jump}
                onShuffle={shuffle}
                onToggle={() => setIsPlaying((value) => !value)}
                onSeek={handleSeek}
                onSwitchAudioVideo={async (mode) => {
                    if (!current?.source_url) return;

                    // Only YouTube items are guaranteed to have the extra streams.
                    // For other sources, we no-op.
                    if (!current?.stream_url) return;

                    const nextMode = mode === 'video' ? 'video' : 'audio';
                    const url = current.source_url;

                    try {
                        const token = localStorage.getItem('ms_player_token') ?? '';

                        const res = await fetch('/api/youtube/play', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                            },
                            body: JSON.stringify({ url, stream_mode: nextMode }),
                        });

                        if (!res.ok) {
                            return;
                        }

                        const payload = await res.json();
                        const stream = payload.data ?? {};

                        setCurrent((prev) => ({
                            ...(prev ?? {}),
                            type: stream.stream_type ?? nextMode,
                            stream_url: stream.stream_url,
                            audio_stream_url: stream.audio_stream_url ?? prev?.audio_stream_url,
                            video_stream_url: stream.video_stream_url ?? prev?.video_stream_url,
                            audio_mime_type: stream.audio_mime_type ?? prev?.audio_mime_type,
                            video_mime_type: stream.video_mime_type ?? prev?.video_mime_type,
                        }));

                        setIsPlaying(true);
                    } catch (e) {
                        // ignore
                    }
                }}
            />


            <nav className="mobile-nav" aria-label="Mobile navigation">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            className={activeView === item.id ? 'mobile-nav-item active' : 'mobile-nav-item'}
                            key={item.id}
                            onClick={() => setActiveView(item.id)}
                            type="button"
                        >
                            <Icon size={20} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}

function HomeView({ featured, items, onPlay, onUpload, onVideo }) {
    const latest = items.slice(0, 8);

    return (
        <section className="view-stack">
            <div className="hero-band">
                <div className="hero-copy">
                    <span className="eyebrow">Private streaming studio</span>
                    <h1>Upload once. Play instantly across music and video.</h1>
                    <p>
                        A clean Spotify and YouTube Music style experience for your own catalog, built around fast playback and simple publishing.
                    </p>
                    <div className="hero-actions">
                        <button className="primary-btn" onClick={onUpload} type="button">
                            <UploadCloud size={18} />
                            Upload Music
                        </button>
                        {items[0] && (
                            <button className="ghost-btn" onClick={() => onPlay(items[0])} type="button">
                                <Play size={18} />
                                Play Latest
                            </button>
                        )}
                    </div>
                </div>
                <div className="hero-panel">
                    <div className="hero-disc">
                        <Music2 size={48} />
                    </div>
                    <div>
                        <strong>Fast Range Streaming</strong>
                        <span>Seek-ready audio and video</span>
                    </div>
                </div>
            </div>

            <Shelf title="Featured Rotation" items={featured.length ? featured : latest} onPlay={onPlay} onVideo={onVideo} />

            <div className="insight-grid">
                <Metric icon={ListMusic} label="Tracks" value={items.filter((item) => item.type === 'audio').length} />
                <Metric icon={Clapperboard} label="Videos" value={items.filter((item) => item.type === 'video').length} />
                <Metric icon={Clock3} label="Fresh Uploads" value={latest.length} />
            </div>

            <Shelf title="Recently Added" items={latest} onPlay={onPlay} onVideo={onVideo} />
        </section>
    );
}

function LibraryView({ audioItems, emptyTitle, likedIds = [], onAddToPlaylist, onLike, onPlay, onVideo, playlists = [], title, videoItems }) {
    const hasItems = audioItems.length > 0 || videoItems.length > 0;

    return (
        <section className="view-stack">
            <div className="section-heading">
                <div>
                    <span className="eyebrow">Browse</span>
                    <h2>{title}</h2>
                </div>
            </div>

            {!hasItems && (
                <div className="empty-state">
                    <Music2 size={36} />
                    <h3>{emptyTitle}</h3>
                    <p>Upload audio or video from the studio panel to start building your streaming catalog.</p>
                </div>
            )}

            {audioItems.length > 0 && (
                <div className="track-list">
                    {audioItems.map((item, index) => (
                        <TrackRow
                            index={index + 1}
                            isLiked={likedIds.includes(item.id)}
                            item={item}
                            key={item.id}
                            onAddToPlaylist={onAddToPlaylist}
                            onLike={onLike}
                            onPlay={onPlay}
                            playlists={playlists}
                        />
                    ))}
                </div>
            )}

            {videoItems.length > 0 && (
                <div className="video-grid">
                    {videoItems.map((item) => (
                        <VideoTile
                            isLiked={likedIds.includes(item.id)}
                            item={item}
                            key={item.id}
                            onLike={onLike}
                            onPlay={onVideo}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

function AccountPanel({ authLoading, authMode, authNotice, onAuthMode, onLogout, onSubmit, user }) {
    if (user) {
        return (
            <div className="account-panel signed-in">
                <div className="account-badge">
                    {user.is_admin ? <ShieldCheck size={18} /> : <UserRound size={18} />}
                    <div>
                        <strong>{user.name}</strong>
                        <span>{user.is_admin ? 'Admin uploader' : 'Listener'}</span>
                    </div>
                </div>
                <button className="icon-btn" onClick={onLogout} title="Log out" type="button">
                    <LogOut size={18} />
                </button>
            </div>
        );
    }

    return (
        <form className="account-panel auth-form" onSubmit={onSubmit}>
            <div className="auth-switch">
                <button
                    className={authMode === 'login' ? 'mini-tab active' : 'mini-tab'}
                    onClick={() => onAuthMode('login')}
                    type="button"
                >
                    Login
                </button>
                <button
                    className={authMode === 'register' ? 'mini-tab active' : 'mini-tab'}
                    onClick={() => onAuthMode('register')}
                    type="button"
                >
                    Register
                </button>
            </div>
            {authMode === 'register' && <input name="name" placeholder="Name" required />}
            <input name="email" placeholder="Email" required type="email" />
            <input name="password" placeholder="Password" required type="password" />
            {authNotice && <span className="auth-notice">{authNotice}</span>}
            <button className="primary-btn compact" disabled={authLoading} type="submit">
                {authLoading ? 'Please wait...' : authMode === 'register' ? 'Create' : 'Login'}
            </button>
        </form>
    );
}

function UploadView({ isAdmin, notice, onAuthMode, onSubmit, uploading, user }) {
    if (!user) {
        return (
            <section className="locked-studio">
                <div className="lock-icon"><ShieldCheck size={32} /></div>
                <span className="eyebrow">Studio locked</span>
                <h2>Login or create the first account to upload music.</h2>
                <p>The first registered account becomes the admin uploader. Listener accounts can browse and play, but cannot publish media.</p>
                <div className="hero-actions">
                    <button className="primary-btn" onClick={() => onAuthMode('register')} type="button">
                        <UserRound size={18} />
                        Register Admin
                    </button>
                    <button className="ghost-btn" onClick={() => onAuthMode('login')} type="button">
                        Login
                    </button>
                </div>
            </section>
        );
    }

    if (!isAdmin) {
        return (
            <section className="locked-studio">
                <div className="lock-icon"><ShieldCheck size={32} /></div>
                <span className="eyebrow">Listener account</span>
                <h2>Uploads are limited to the admin account.</h2>
                <p>You can browse, search, and play the catalog. Ask the admin account owner to upload new music or videos.</p>
            </section>
        );
    }

    return (
        <section className="upload-layout">
            <div className="upload-copy">
                <span className="eyebrow">Creator upload</span>
                <h2>Publish audio and music videos into your own streaming library.</h2>
                <p>Supported media: MP3, WAV, OGG, M4A, MP4, WEBM, and MOV. Covers support JPG, PNG, and WEBP.</p>
            </div>

            <form className="upload-form" onSubmit={onSubmit}>
                <label>
                    Title
                    <input name="title" placeholder="Song or video title" required />
                </label>
                <label>
                    Artist
                    <input name="artist" placeholder="Artist name" />
                </label>
                <label>
                    Album
                    <input name="album" placeholder="Album or collection" />
                </label>
                <label>
                    Genre
                    <input name="genre" placeholder="Focus, pop, worship, indie..." />
                </label>
                <label>
                    Duration Seconds
                    <input min="1" name="duration_seconds" placeholder="Optional" type="number" />
                </label>
                <label>
                    Type
                    <select name="type" required>
                        <option value="audio">Audio</option>
                        <option value="video">Video</option>
                    </select>
                </label>
                <label>
                    Media File
                    <input accept="audio/*,video/*" name="media" required type="file" />
                </label>
                <label>
                    Cover Image
                    <input accept="image/*" name="cover" type="file" />
                </label>
                <label className="full-span">
                    Description
                    <textarea name="description" placeholder="Notes, mood, credits, or release info" rows="4" />
                </label>

                {notice && <p className="form-notice">{notice}</p>}

                <button className="primary-btn full-span" disabled={uploading} type="submit">
                    <Plus size={18} />
                    {uploading ? 'Uploading...' : 'Publish to Library'}
                </button>
            </form>
        </section>
    );
}

function PlaylistsView({ items, notice, onCreate, onPlay, onRemove, playlists, user }) {
    if (!user) {
        return (
            <section className="locked-studio">
                <div className="lock-icon"><ListMusic size={32} /></div>
                <span className="eyebrow">Playlists</span>
                <h2>Login to build your own playlists.</h2>
                <p>Your saved playlists stay tied to your account and can include both audio tracks and music videos.</p>
            </section>
        );
    }

    return (
        <section className="view-stack">
            <div className="section-heading">
                <div>
                    <span className="eyebrow">Library tools</span>
                    <h2>Playlists</h2>
                </div>
            </div>

            <form className="playlist-form" onSubmit={onCreate}>
                <input name="name" placeholder="New playlist name" required />
                <input name="description" placeholder="Description" />
                <button className="primary-btn" type="submit"><Plus size={18} />Create Playlist</button>
                {notice && <span>{notice}</span>}
            </form>

            {playlists.length === 0 && (
                <div className="empty-state">
                    <ListMusic size={36} />
                    <h3>No playlists yet</h3>
                    <p>Create one above, then use the Add control beside tracks to fill it.</p>
                </div>
            )}

            <div className="playlist-grid">
                {playlists.map((playlist) => (
                    <article className="playlist-card" key={playlist.id}>
                        <div className="section-heading">
                            <div>
                                <h3>{playlist.name}</h3>
                                <span>{playlist.items.length} items</span>
                            </div>
                        </div>
                        {playlist.description && <p>{playlist.description}</p>}
                        <div className="mini-track-list">
                            {playlist.items.map((entry, index) => (
                                <div className="mini-track" key={entry.id}>
                                    <span>{index + 1}</span>
                                    <Cover item={entry.media_item} small />
                                    <button onClick={() => onPlay(entry.media_item)} type="button">
                                        {entry.media_item.title}
                                    </button>
                                    <button className="icon-btn" onClick={() => onRemove(playlist.id, entry.media_item.id)} type="button">
                                        <LogOut size={15} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {playlist.items.length === 0 && (
                            <small>Add from any song row in the library.</small>
                        )}
                    </article>
                ))}
            </div>
        </section>
    );
}

function GroupedView({ groups, groupKey, onPlay, title }) {
    return (
        <section className="view-stack">
            <div className="section-heading">
                <div>
                    <span className="eyebrow">Catalog</span>
                    <h2>{title}</h2>
                </div>
            </div>

            {groups.length === 0 && (
                <div className="empty-state">
                    <Album size={36} />
                    <h3>No {title.toLowerCase()} yet</h3>
                    <p>Upload music with artist and album details to populate this section.</p>
                </div>
            )}

            <div className="group-grid">
                {groups.map((group) => (
                    <article className="group-card" key={`${group[groupKey]}-${group.artist ?? ''}`}>
                        <Cover item={group.items[0]} />
                        <div>
                            <h3>{group[groupKey]}</h3>
                            <span>{group.artist && groupKey === 'album' ? `${group.artist} - ` : ''}{group.media_count} uploads</span>
                        </div>
                        <div className="mini-track-list">
                            {group.items.map((item) => (
                                <button className="group-track" key={item.id} onClick={() => onPlay(item)} type="button">
                                    <Play size={15} />
                                    <span>{item.title}</span>
                                </button>
                            ))}
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}

function HistoryView({ historyItems, onPlay, user }) {
    if (!user) {
        return (
            <section className="locked-studio">
                <div className="lock-icon"><History size={32} /></div>
                <span className="eyebrow">History</span>
                <h2>Login to track your listening history.</h2>
                <p>MS Player remembers what you play and keeps a compact recent list for quick replay.</p>
            </section>
        );
    }

    return (
        <section className="view-stack">
            <div className="section-heading">
                <div>
                    <span className="eyebrow">Replay</span>
                    <h2>Listening History</h2>
                </div>
            </div>

            {historyItems.length === 0 && (
                <div className="empty-state">
                    <History size={36} />
                    <h3>No plays yet</h3>
                    <p>Start a song or video and it will appear here.</p>
                </div>
            )}

            <div className="track-list">
                {historyItems.map((entry, index) => (
                    <article className="history-row" key={entry.id}>
                        <span>{index + 1}</span>
                        <Cover item={entry.media_item} small />
                        <div>
                            <strong>{entry.media_item.title}</strong>
                            <span>{entry.play_count} plays - {new Date(entry.last_played_at).toLocaleString()}</span>
                        </div>
                        <button className="icon-btn" onClick={() => onPlay(entry.media_item)} type="button">
                            <Play size={18} />
                        </button>
                    </article>
                ))}
            </div>
        </section>
    );
}

function VideoTheaterView({ current, onPlay, related }) {
    if (!current) {
        return (
            <div className="empty-state">
                <Video size={36} />
                <h3>Select a video</h3>
                <p>Open a video from the library to use theater mode.</p>
            </div>
        );
    }

    return (
        <section className="theater-layout">
            <div className="theater-main">
                <video controls src={current.stream_url} poster={current.thumbnail_url ?? current.cover_url ?? ''} />
                <div className="theater-info">
                    <span className="eyebrow">Video theater</span>
                    <h2>{current.title}</h2>
                    <p>{current.artist} {current.album ? `- ${current.album}` : ''}</p>
                    {current.description && <p>{current.description}</p>}
                </div>
            </div>
            <aside className="theater-queue">
                <h3>More videos</h3>
                {related.map((item) => (
                    <button className="queue-video" key={item.id} onClick={() => onPlay(item)} type="button">
                        <Cover item={item} small />
                        <span>{item.title}</span>
                    </button>
                ))}
            </aside>
        </section>
    );
}

function YoutubeImportView({
    isAdmin,
    loading,
    notice,
    onImport,
    onManualImport,
    onSearch,
    results,
    user,
    onSetNotice,
    onPlayResult,
}) {
    if (!user || !isAdmin) {
        return (
            <section className="locked-studio">
                <div className="lock-icon"><Compass size={32} /></div>
                <span className="eyebrow">YouTube import</span>
                <h2>Admin access is required for YouTube imports.</h2>
                <p>Imported items are catalog references from public YouTube pages. Use this only for content you have rights to stream or reference.</p>
            </section>
        );
    }

    return (
        <section className="view-stack">
            <div className="section-heading">
                <div>
                    <span className="eyebrow">NewPipeExtractor bridge</span>
                    <h2>YouTube Import</h2>
                </div>
            </div>

            <div className="youtube-grid">
                <form className="youtube-panel" onSubmit={onSearch}>
                    <h3>Search YouTube</h3>
                    <input name="q" placeholder="Search songs or artist videos" required />
                    <button className="primary-btn" disabled={loading} type="submit">
                        <Search size={18} />
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                    <p>Requires the local NewPipe service at `NEWPIPE_SERVICE_URL`.</p>
                </form>

                <form className="youtube-panel" onSubmit={onManualImport}>
                    <h3>Manual Reference</h3>
                    <input name="url" placeholder="https://www.youtube.com/watch?v=..." required type="url" />
                    <input name="title" placeholder="Title" />
                    <input name="artist" placeholder="Artist or channel" />
                    <input name="thumbnail_url" placeholder="Thumbnail URL" type="url" />
                    <button className="ghost-btn" disabled={loading} type="submit">
                        <Plus size={18} />
                        Import URL
                    </button>
                </form>
            </div>

            {notice && <p className="form-notice">{notice}</p>}

            <div className="youtube-results">
                {results.map((result) => (
                    <article className="youtube-result" key={result.id ?? result.url}>
                        {result.thumbnail_url ? (
                            <img alt="" src={result.thumbnail_url} />
                        ) : (
                            <div className="cover generated"><span>YT</span></div>
                        )}
                        <div>
                            <strong>{result.title}</strong>
                            <span>{result.uploader ?? result.artist ?? 'YouTube'}</span>
                            <small>{result.url}</small>
                        </div>
                        <button
                            className="primary-btn"
                            disabled={loading}
                            onClick={async () => {
                                try {


                                    const token = localStorage.getItem('ms_player_token') ?? '';

                                    const res = await fetch('/api/youtube/play', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                        },
                                        body: JSON.stringify({ url: result.url }),
                                    });

                                    if (!res.ok) {
                                        const err = await res.json().catch(() => ({}));
                                        throw new Error(err.message ?? 'YouTube play failed.');
                                    }

                                    const payload = await res.json();
                                    const stream = payload.data ?? {};

                                    const next = {
                                        id: result.id ?? result.url,
                                        type: stream.stream_type ?? 'audio',
                                        title: stream.title ?? result.title,
                                        artist: stream.artist ?? (result.uploader ?? result.artist ?? 'YouTube'),
                                        stream_url: stream.stream_url,
                                        thumbnail_url: stream.thumbnail_url ?? result.thumbnail_url,
                                        cover_url: stream.thumbnail_url ?? result.thumbnail_url,
                                        description: stream.description,
                                        duration_seconds: stream.duration_seconds,
                                    };

                                    onPlayResult?.({ stream, result });
                                } catch (e) {
                                    onSetNotice?.(e?.message ?? 'YouTube play failed.');
                                }
                            }}
                            type="button"
                        >
                            Play
                        </button>


                    </article>
                ))}
            </div>
        </section>
    );
}

function Shelf({ items, onPlay, onVideo, title }) {
    if (!items.length) {
        return null;
    }

    return (
        <section>
            <div className="section-heading">
                <h2>{title}</h2>
            </div>
            <div className="shelf">
                {items.map((item, index) => (
                    <MediaCard item={item} key={item.id} onPlay={item.type === 'video' && onVideo ? onVideo : onPlay} tone={index} />
                ))}
            </div>
        </section>
    );
}

function MediaCard({ item, onPlay, tone = 0 }) {
    return (
        <article className="media-card">
            <Cover item={item} tone={tone} />
            <div className="media-card-body">
                <strong>{item.title}</strong>
                <span>{item.artist}</span>
            </div>
            <button aria-label={`Play ${item.title}`} className="play-chip" onClick={() => onPlay(item)} type="button">
                {item.type === 'video' ? <Video size={18} /> : <Play size={18} />}
            </button>
        </article>
    );
}

function TrackRow({ index, isLiked = false, item, onAddToPlaylist, onLike, onPlay, playlists = [] }) {
    return (
        <article className="track-row">
            <span className="track-index">{index}</span>
            <Cover item={item} small />
            <div className="track-meta">
                <strong>{item.title}</strong>
                <span>{item.artist} {item.album ? `- ${item.album}` : ''}</span>
            </div>
            <span className="hide-mobile">{item.genre ?? 'Unsorted'}</span>
            <span className="hide-mobile">{item.duration_label ?? item.formatted_size}</span>
            <button aria-label={`Like ${item.title}`} className={isLiked ? 'icon-btn active-heart' : 'icon-btn'} onClick={() => onLike?.(item)} type="button">
                <Heart size={18} />
            </button>
            {playlists.length > 0 && (
                <select
                    aria-label={`Add ${item.title} to playlist`}
                    className="playlist-select"
                    defaultValue=""
                    onChange={(event) => {
                        if (event.target.value) {
                            onAddToPlaylist?.(event.target.value, item.id);
                            event.target.value = '';
                        }
                    }}
                >
                    <option value="">Add</option>
                    {playlists.map((playlist) => (
                        <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
                    ))}
                </select>
            )}
            <button aria-label={`Play ${item.title}`} className="icon-btn" onClick={() => onPlay(item)} type="button">
                <Play size={18} />
            </button>
        </article>
    );
}

function VideoTile({ isLiked = false, item, onLike, onPlay }) {
    return (
        <article className="video-tile">
            <button className="video-thumb" onClick={() => onPlay(item)} type="button">
                <Cover item={item} />
                <span><Play size={18} /></span>
            </button>
            <div className="video-meta-line">
                <div>
                    <strong>{item.title}</strong>
                    <span>{item.artist}</span>
                </div>
                <button aria-label={`Like ${item.title}`} className={isLiked ? 'icon-btn active-heart' : 'icon-btn'} onClick={() => onLike?.(item)} type="button">
                    <Heart size={16} />
                </button>
            </div>
        </article>
    );
}

function Cover({ item, small = false, tone = 0 }) {
    const colors = accentCovers[tone % accentCovers.length];
    const initials = item.title.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase();

    if (item.cover_url) {
        return <img alt="" className={small ? 'cover small' : 'cover'} src={item.cover_url} />;
    }

    return (
        <div className={small ? 'cover generated small' : 'cover generated'} style={{ '--cover-a': colors[0], '--cover-b': colors[1] }}>
            <span>{initials || 'MS'}</span>
        </div>
    );
}

function Metric({ icon: Icon, label, value }) {
    return (
        <div className="metric">
            <Icon size={22} />
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function Player({
    current,
    isPlaying,
    mediaRef,
    onJump,
    onShuffle,
    onToggle,
    onSeek,
    progress = { currentTime: 0, duration: 0 },
    onSwitchAudioVideo,
}) {
    return (
        <footer className="player">

            <div className="player-track">
                {current ? <Cover item={current} small /> : <div className="cover small generated"><span>MS</span></div>}
                <div>
                    <strong>{current?.title ?? 'No track selected'}</strong>
                    <span>{current?.artist ?? 'Upload music to start playing'}</span>
                </div>
            </div>

            <div className="player-progress">
                <span>{formatTime(progress.currentTime)}</span>
                <input
                    aria-label="Seek"
                    type="range"
                    min={0}
                    max={progress.duration || 0}
                    step={0.25}
                    value={Math.min(progress.currentTime, progress.duration || 0)}
                    disabled={!current || !progress.duration}
                    onChange={(e) => {
                        const next = Number(e.target.value);
                        onSeek?.(next);
                    }}
                />
                <span>{formatTime(progress.duration)}</span>
            </div>

            <div className="player-controls">
                <button className="icon-btn" type="button" onClick={() => onShuffle?.()} disabled={!current}>
                    <Shuffle size={18} />
                </button>
                <button className="icon-btn" onClick={() => onJump(-1)} type="button" disabled={!current}>
                    <SkipBack size={19} />
                </button>
                <button className="play-main" disabled={!current} onClick={onToggle} type="button">
                    {isPlaying ? <Pause size={22} /> : <Play size={22} />}
                </button>
                <button className="icon-btn" onClick={() => onJump(1)} type="button" disabled={!current}>
                    <SkipForward size={19} />
                </button>
                <button className="icon-btn" type="button" disabled={!current}><Heart size={18} /></button>
            </div>

            <div className="player-extra">
                <Volume2 size={18} />
                <span>{current?.type === 'video' ? 'Video' : 'Audio'}</span>

                {(current?.type === 'video' || current?.type === 'audio') && (
                <div className="av-switch" role="group" aria-label="Audio/Video switch">
                    <button
                        type="button"
                        className={current?.type === 'audio' ? 'mini-tab active' : 'mini-tab'}
                        disabled={!(current?.audio_stream_url || current?.stream_url) || (current?.type !== 'audio' && !current?.audio_stream_url)}
                        onClick={() => onSwitchAudioVideo?.('audio')}
                    >
                        Audio
                    </button>
                    <button
                        type="button"
                        className={current?.type === 'video' ? 'mini-tab active' : 'mini-tab'}
                        disabled={!(current?.video_stream_url || current?.stream_url) || (current?.type !== 'video' && !current?.video_stream_url)}
                        onClick={() => onSwitchAudioVideo?.('video')}
                    >
                        Video
                    </button>
                </div>
                )}
            </div>


            {current?.type === 'video' ? (
                <video
                    className="hidden-media"
                    controls
                    key={`${current.id}-video-${current.stream_url ?? ''}`}
                    ref={mediaRef}
                    src={current.video_stream_url ?? current.stream_url}
                />
            ) : (
                <audio
                    key={`${current?.id ?? 'empty'}-audio-${current.stream_url ?? ''}`}
                    ref={mediaRef}
                    src={current.audio_stream_url ?? current.stream_url ?? ''}
                />
            )}
        </footer>
    );
}

const rootEl = document.getElementById('root');

if (!rootEl) {
    // eslint-disable-next-line no-console
    console.error('React root element #root not found. Page cannot be rendered.');
} else {
    try {
        createRoot(rootEl).render(<App />);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('React failed to render:', e);

        rootEl.innerHTML = `
            <div style="padding:24px;font-family:system-ui, -apple-system, Segoe UI, Roboto, Arial;">
                <h2 style="margin:0 0 8px;">MS Player failed to start</h2>
                <p style="margin:0 0 12px;">Check the browser console for the error.</p>
                <pre style="white-space:pre-wrap; background:#f3f3f3; padding:12px; border-radius:8px;">${String(e?.message ?? e)}</pre>
            </div>
        `;
    }
}

