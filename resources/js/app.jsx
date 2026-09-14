import './bootstrap';
import '../css/app.css';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import {
    Album,
    ArrowLeft,
    ArrowRight,
    Check,
    Clock,
    Compass,
    Disc,
    Film,
    Flame,
    Headphones,
    Heart,
    History,
    Home,
    Library,
    ListMusic,
    ListPlus,
    LogIn,
    LogOut,
    Maximize2,
    Mic2,
    Moon,
    MoreHorizontal,
    Music2,
    Pause,
    Play,
    Plus,
    Radio,
    Repeat,
    Repeat1,
    Search,
    ShieldCheck,
    Shuffle,
    SkipBack,
    SkipForward,
    Sparkles,
    Sun,
    Trash2,
    Tv,
    UploadCloud,
    User,
    UserRound,
    Video,
    Volume1,
    Volume2,
    VolumeX,
    X,
} from 'lucide-react';

function formatTime(seconds) {
    const s = Number(seconds);
    if (!Number.isFinite(s) || s <= 0) return '0:00';
    const m = Math.floor(s / 60);
    const rem = Math.floor(s % 60);
    return `${m}:${String(rem).padStart(2, '0')}`;
}

function extractYoutubeId(url) {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/|\/v\/)([^&#?]+)/);
    return match ? match[1] : null;
}

const CATEGORIES = [
    { id: 'pop', title: 'Pop', color: '#8d67ab', icon: Sparkles },
    { id: 'rock', title: 'Rock', color: '#e91429', icon: Flame },
    { id: 'hiphop', title: 'Hip-Hop', color: '#ba5d07', icon: Radio },
    { id: 'indie', title: 'Indie', color: '#608108', icon: Disc },
    { id: 'chill', title: 'Chill', color: '#477d95', icon: Music2 },
    { id: 'focus', title: 'Focus & Study', color: '#503750', icon: Mic2 },
    { id: 'electronic', title: 'Electronic & Dance', color: '#1e3264', icon: Disc },
    { id: 'podcasts', title: 'Podcasts', color: '#006450', icon: Radio },
];

function App() {
    const [theme, setTheme] = useState(() => localStorage.getItem('ventune_theme') || 'dark');
    const [activeView, setActiveView] = useState('home');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('ventune_theme', theme);
    }, [theme]);

    function toggleTheme() {
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    }
    const [items, setItems] = useState([]);
    const [query, setQuery] = useState('');
    const [current, setCurrent] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const currentYtId = current?.youtube_id || (current?.source === 'youtube' ? extractYoutubeId(current?.source_url || current?.url) : null);
    const isPlayingViaYt = Boolean(currentYtId && !current?.stream_url && !current?.audio_stream_url);
    const [uploading, setUploading] = useState(false);
    const [notice, setNotice] = useState('');
    const [authToken, setAuthToken] = useState(() => localStorage.getItem('ms_player_token') ?? '');
    const [user, setUser] = useState(null);
    
    // Auth Modal
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authMode, setAuthMode] = useState('login');
    const [authNotice, setAuthNotice] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    // Library & Playlists
    const [likedIds, setLikedIds] = useState([]);
    const [historyItems, setHistoryItems] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
    const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
    const [addToPlaylistTrack, setAddToPlaylistTrack] = useState(null);

    // Queue & Autoplay state (Ventune auto-queue style)
    const [queue, setQueue] = useState([]);
    const [autoQueue, setAutoQueue] = useState([]);
    const [isAutoplay, setIsAutoplay] = useState(() => localStorage.getItem('ms_player_autoplay') !== 'false');
    const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(false);

    // Catalog & Discovery
    const [artists, setArtists] = useState([]);
    const [albums, setAlbums] = useState([]);
    const [selectedArtist, setSelectedArtist] = useState(null);
    const [selectedAlbum, setSelectedAlbum] = useState(null);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [relatedVideos, setRelatedVideos] = useState([]);

    // Online Discovery
    const [youtubeResults, setYoutubeResults] = useState([]);
    const [youtubeNotice, setYoutubeNotice] = useState('');
    const [youtubeLoading, setYoutubeLoading] = useState(false);
    const [youtubeQuery, setYoutubeQuery] = useState('');

    // Playback state
    const [progress, setProgress] = useState({ currentTime: 0, duration: 0 });
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [isShuffle, setIsShuffle] = useState(false);
    const [repeatMode, setRepeatMode] = useState('off'); // 'off', 'all', 'one'
    const [libraryFilter, setLibraryFilter] = useState('all'); // 'all', 'playlists', 'artists', 'albums'

    const mediaRef = useRef(null);
    const ytPlayerRef = useRef(null);

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
        try {
            const response = await fetch('/api/media');
            const payload = await response.json();
            const list = payload.data?.data ?? [];
            setItems(list);
            setCurrent((existing) => existing ?? list[0] ?? null);
        } catch (e) {
            setNotice('Could not load library media.');
        }
    }

    async function loadDiscovery() {
        try {
            const [artistsRes, albumsRes] = await Promise.all([
                fetch('/api/artists'),
                fetch('/api/albums'),
            ]);
            const [artistsData, albumsData] = await Promise.all([
                artistsRes.json(),
                albumsRes.json(),
            ]);
            setArtists(artistsData.data ?? []);
            setAlbums(albumsData.data ?? []);
        } catch (e) {
            // Ignore
        }
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

        try {
            const [summaryRes, playlistRes] = await Promise.all([
                fetch('/api/library/summary', { headers }),
                fetch('/api/playlists', { headers }),
            ]);

            if (summaryRes.ok) {
                const summaryData = await summaryRes.json();
                setLikedIds(summaryData.liked_ids ?? []);
                setHistoryItems(summaryData.history ?? []);
            }
            if (playlistRes.ok) {
                const playlistData = await playlistRes.json();
                setPlaylists(playlistData.data ?? []);
            }
        } catch (e) {
            // Ignore
        }
    }

    useEffect(() => {
        loadItems();
        loadDiscovery();
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
                loadUserLibrary(authToken);
            })
            .catch(() => {
                localStorage.removeItem('ms_player_token');
                setAuthToken('');
                setUser(null);
            });
    }, [authToken]);

    const queueRef = useRef(queue);
    queueRef.current = queue;
    const autoQueueRef = useRef(autoQueue);
    autoQueueRef.current = autoQueue;
    const isAutoplayRef = useRef(isAutoplay);
    isAutoplayRef.current = isAutoplay;

    function addToQueue(item) {
        if (!item) return;
        setQueue((prev) => [...prev, item]);
        setNotice(`Added "${item.title}" to queue.`);
    }

    function removeFromQueue(index) {
        setQueue((prev) => prev.filter((_, i) => i !== index));
    }

    function clearQueue() {
        setQueue([]);
        setNotice('Cleared play queue.');
    }

    function toggleAutoplay() {
        setIsAutoplay((prev) => {
            const next = !prev;
            localStorage.setItem('ms_player_autoplay', String(next));
            setNotice(`Autoplay ${next ? 'enabled' : 'disabled'}.`);
            return next;
        });
    }

    async function generateAutoQueue(track) {
        if (!track) return;

        const recs = items.filter(
            (i) => i.id !== track.id && (i.artist === track.artist || i.genre === track.genre)
        );

        if (track.source_url || track.source === 'youtube' || recs.length < 5) {
            try {
                const token = authToken || (localStorage.getItem('ms_player_token') ?? '');
                if (token) {
                    const searchArtist = track.artist && track.artist !== 'Unknown Artist' ? track.artist : track.title;
                    const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchArtist)}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const ytResults = (data.results || []).filter(
                            (r) => r.id !== track.id && r.url !== track.source_url
                        );
                        ytResults.slice(0, 8).forEach((r) => {
                            recs.push({
                                id: r.id || r.url,
                                title: r.title,
                                artist: r.uploader || searchArtist,
                                url: r.url,
                                source_url: r.url,
                                source: 'youtube',
                                thumbnail_url: r.thumbnail_url,
                                cover_url: r.thumbnail_url,
                                duration_seconds: r.duration_seconds,
                                type: track.type || 'audio',
                            });
                        });
                    }
                }
            } catch (e) {
                // Ignore
            }
        }

        if (recs.length < 5) {
            items.forEach((item) => {
                if (item.id !== track.id && !recs.some((r) => r.id === item.id)) {
                    recs.push(item);
                }
            });
        }

        const unique = [];
        const seen = new Set();
        recs.forEach((item) => {
            const key = item.id || item.url || item.title;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(item);
            }
        });

        setAutoQueue(unique.slice(0, 10));
    }

    useEffect(() => {
        if (current) {
            generateAutoQueue(current);
        }
    }, [current?.id, current?.title]);

    async function removeFromPlaylist(playlistId, mediaItemId) {
        try {
            const res = await apiFetch(`/api/playlists/${playlistId}/items/${mediaItemId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setNotice('Removed track from playlist.');
                await loadUserLibrary();
            }
        } catch (e) {
            // Ignore
        }
    }

    async function deletePlaylist(playlistId) {
        if (!confirm('Are you sure you want to delete this playlist?')) return;
        try {
            const res = await apiFetch(`/api/playlists/${playlistId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setNotice('Playlist deleted.');
                setActiveView('library');
                await loadUserLibrary();
            }
        } catch (e) {
            // Ignore
        }
    }

    useEffect(() => {
        const el = mediaRef.current;
        if (!el) return;

        function handleLoadedMetadata() {
            setProgress((prev) => ({
                ...prev,
                duration: el.duration || 0,
            }));
        }

        function handleTimeUpdate() {
            setProgress({
                currentTime: el.currentTime || 0,
                duration: el.duration || 0,
            });
        }

        function handleEnded() {
            if (repeatMode === 'one') {
                el.currentTime = 0;
                el.play().catch(() => {});
            } else if (queueRef.current.length > 0) {
                const nextTrack = queueRef.current[0];
                setQueue((prev) => prev.slice(1));
                if (nextTrack.url && !nextTrack.stream_url) {
                    playYoutubeItem(nextTrack);
                } else {
                    playItem(nextTrack);
                }
                setNotice(`Playing from queue: "${nextTrack.title}"`);
            } else if (isAutoplayRef.current && autoQueueRef.current.length > 0) {
                const nextTrack = autoQueueRef.current[0];
                setAutoQueue((prev) => prev.slice(1));
                if (nextTrack.url && !nextTrack.stream_url) {
                    playYoutubeItem(nextTrack);
                } else {
                    playItem(nextTrack);
                }
                setNotice(`Autoplaying similar track: "${nextTrack.title}" (${nextTrack.artist})`);
            } else if (repeatMode === 'all') {
                jump(1);
            } else {
                jump(1);
            }
        }

        el.addEventListener('loadedmetadata', handleLoadedMetadata);
        el.addEventListener('timeupdate', handleTimeUpdate);
        el.addEventListener('ended', handleEnded);

        if (!isPlayingViaYt && (current?.stream_url || current?.audio_stream_url || current?.video_stream_url)) {
            if (isPlaying) {
                el.play().catch((err) => {
                    if (err.name !== 'AbortError') {
                        setIsPlaying(false);
                    }
                });
            } else {
                el.pause();
            }
        } else if (isPlayingViaYt) {
            try {
                el.pause();
            } catch (e) {}
        }

        return () => {
            el.removeEventListener('loadedmetadata', handleLoadedMetadata);
            el.removeEventListener('timeupdate', handleTimeUpdate);
            el.removeEventListener('ended', handleEnded);
        };
    }, [current, isPlaying, volume, isMuted, repeatMode, isPlayingViaYt]);

    function playItem(item) {
        if (!item) return;
        setCurrent(item);
        setIsPlaying(true);

        if (authToken && item.id && typeof item.id === 'number') {
            apiFetch(`/api/library/media/${item.id}/play`, { method: 'POST' })
                .then(() => loadUserLibrary())
                .catch(() => {});
        }
    }

    function handleTrackPlay(item) {
        if (!item) return;
        const ytId = item.youtube_id || (item.source === 'youtube' ? extractYoutubeId(item.source_url || item.url || item.media_path) : null);
        
        // If it's a YouTube track or has no direct stream, route to playYoutubeItem
        if (ytId || item.source === 'youtube' || (item.media_path && String(item.media_path).startsWith('youtube:')) || !item.stream_url) {
            playYoutubeItem(item);
        } else {
            playItem(item);
        }
    }

    function togglePlay() {
        if (!current && items.length > 0) {
            handleTrackPlay(items[0]);
            return;
        }
        setIsPlaying((val) => !val);
    }

    function handleSeek(nextTime) {
        if (!Number.isFinite(nextTime)) return;
        const validTime = Math.max(0, nextTime);
        if (mediaRef.current) {
            mediaRef.current.currentTime = validTime;
        }
        if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
            try {
                ytPlayerRef.current.seekTo(validTime, true);
            } catch (e) {}
        }
        setProgress((p) => ({
            ...p,
            currentTime: validTime,
        }));
    }

    function handleVolume(e) {
        const val = Number(e.target.value);
        setVolume(val);
        if (isMuted && val > 0) setIsMuted(false);
        if (mediaRef.current) {
            mediaRef.current.volume = val;
        }
        if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
            try {
                ytPlayerRef.current.setVolume(val * 100);
            } catch (e) {}
        }
    }

    function toggleMute() {
        if (isMuted) {
            setIsMuted(false);
            if (mediaRef.current) mediaRef.current.volume = volume;
            if (ytPlayerRef.current && typeof ytPlayerRef.current.unMute === 'function') {
                try {
                    ytPlayerRef.current.unMute();
                    ytPlayerRef.current.setVolume(volume * 100);
                } catch (e) {}
            }
        } else {
            setIsMuted(true);
            if (mediaRef.current) mediaRef.current.volume = 0;
            if (ytPlayerRef.current && typeof ytPlayerRef.current.mute === 'function') {
                try {
                    ytPlayerRef.current.mute();
                } catch (e) {}
            }
        }
    }

    function jump(direction) {
        if (direction === -1 && mediaRef.current && mediaRef.current.currentTime > 3) {
            mediaRef.current.currentTime = 0;
            return;
        }

        if (direction === 1 && queue.length > 0) {
            const nextTrack = queue[0];
            setQueue((prev) => prev.slice(1));
            handleTrackPlay(nextTrack);
            return;
        }

        if (
            direction === 1 &&
            isAutoplay &&
            autoQueue.length > 0 &&
            (!current ||
                items.findIndex((i) => i.id === current.id) === -1 ||
                items.findIndex((i) => i.id === current.id) === items.length - 1)
        ) {
            const nextTrack = autoQueue[0];
            setAutoQueue((prev) => prev.slice(1));
            handleTrackPlay(nextTrack);
            return;
        }

        if (!current || items.length === 0) return;

        const playable = items.filter((i) => i.type === current.type || !current.type);
        if (playable.length === 0) return;

        if (isShuffle) {
            const randomIndex = Math.floor(Math.random() * playable.length);
            handleTrackPlay(playable[randomIndex]);
            return;
        }

        const index = playable.findIndex((i) => i.id === current.id);
        const nextIndex = (index + direction + playable.length) % playable.length;
        handleTrackPlay(playable[nextIndex]);
    }

    function cycleRepeat() {
        setRepeatMode((prev) => {
            if (prev === 'off') return 'all';
            if (prev === 'all') return 'one';
            return 'off';
        });
    }

    useEffect(() => {
        if (!isPlayingViaYt || !currentYtId) {
            if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
                try {
                    ytPlayerRef.current.pauseVideo();
                } catch (e) {}
            }
            return;
        }

        let isCancelled = false;

        function initPlayer() {
            if (!window.YT || !window.YT.Player) {
                if (!document.getElementById('yt-iframe-api')) {
                    const tag = document.createElement('script');
                    tag.id = 'yt-iframe-api';
                    tag.src = 'https://www.youtube.com/iframe_api';
                    document.head.appendChild(tag);
                }
                const old = window.onYouTubeIframeAPIReady;
                window.onYouTubeIframeAPIReady = () => {
                    if (old) old();
                    if (!isCancelled) setupPlayer();
                };
            } else {
                setupPlayer();
            }
        }

        function setupPlayer() {
            if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
                try {
                    ytPlayerRef.current.loadVideoById(currentYtId);
                    if (isPlaying) ytPlayerRef.current.playVideo();
                } catch (e) {}
                return;
            }

            try {
                ytPlayerRef.current = new window.YT.Player('ventune-yt-player', {
                    height: '200',
                    width: '200',
                    videoId: currentYtId,
                    playerVars: {
                        autoplay: 1,
                        controls: 0,
                        disablekb: 1,
                        fs: 0,
                        rel: 0,
                    },
                    events: {
                        onReady: (e) => {
                            try {
                                e.target.setVolume(isMuted ? 0 : volume * 100);
                                if (isPlaying) e.target.playVideo();
                            } catch (err) {}
                        },
                        onStateChange: (e) => {
                            if (e.data === window.YT.PlayerState.PLAYING) {
                                setIsPlaying(true);
                            } else if (e.data === window.YT.PlayerState.PAUSED) {
                                setIsPlaying(false);
                            } else if (e.data === window.YT.PlayerState.ENDED) {
                                jump(1);
                            }
                        },
                    },
                });
            } catch (err) {}
        }

        initPlayer();

        return () => {
            isCancelled = true;
        };
    }, [currentYtId, isPlayingViaYt]);

    useEffect(() => {
        if (!isPlayingViaYt || !ytPlayerRef.current || typeof ytPlayerRef.current.getPlayerState !== 'function') {
            return;
        }
        try {
            if (isPlaying) {
                ytPlayerRef.current.playVideo();
            } else {
                ytPlayerRef.current.pauseVideo();
            }
        } catch (e) {}
    }, [isPlaying, isPlayingViaYt]);

    useEffect(() => {
        if (!isPlayingViaYt) return;
        const timer = setInterval(() => {
            if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
                try {
                    const c = ytPlayerRef.current.getCurrentTime() || 0;
                    const d = ytPlayerRef.current.getDuration() || current?.duration_seconds || 0;
                    if (d > 0) {
                        setProgress({ currentTime: c, duration: d });
                    }
                } catch (e) {}
            }
        }, 500);
        return () => clearInterval(timer);
    }, [isPlayingViaYt, current?.id]);

    // Media Session API for continuous background playing, lock screen, and media keys
    useEffect(() => {
        if (!('mediaSession' in navigator) || !current) return;

        const artworkSrc = current.cover_url || current.thumbnail_url || current.external_cover_url || '/favicon.ico';
        try {
            navigator.mediaSession.metadata = new window.MediaMetadata({
                title: current.title || 'Ventune Music',
                artist: current.artist || 'Ventune',
                album: current.album || 'Ventune',
                artwork: [
                    { src: artworkSrc, sizes: '96x96', type: 'image/jpeg' },
                    { src: artworkSrc, sizes: '128x128', type: 'image/jpeg' },
                    { src: artworkSrc, sizes: '256x256', type: 'image/jpeg' },
                    { src: artworkSrc, sizes: '512x512', type: 'image/jpeg' },
                ],
            });

            navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
            navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
            navigator.mediaSession.setActionHandler('previoustrack', () => jump(-1));
            navigator.mediaSession.setActionHandler('nexttrack', () => jump(1));
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime != null) handleSeek(details.seekTime);
            });
        } catch (e) {}
    }, [current?.id, current?.title, current?.artist]);

    useEffect(() => {
        if (!('mediaSession' in navigator)) return;
        try {
            navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        } catch (e) {}
    }, [isPlaying]);

    // Keyboard Shortcuts (Space to play/pause, Left/Right to seek, Up/Down for volume, M for mute)
    useEffect(() => {
        function handleKeyDown(e) {
            const tag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
                return;
            }

            if (e.code === 'Space') {
                e.preventDefault();
                togglePlay();
            } else if (e.code === 'ArrowRight' && e.shiftKey) {
                e.preventDefault();
                jump(1);
            } else if (e.code === 'ArrowLeft' && e.shiftKey) {
                e.preventDefault();
                jump(-1);
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                handleSeek((progress.currentTime || 0) + 5);
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                handleSeek((progress.currentTime || 0) - 5);
            } else if (e.code === 'ArrowUp') {
                e.preventDefault();
                handleVolume({ target: { value: Math.min(1, volume + 0.05) } });
            } else if (e.code === 'ArrowDown') {
                e.preventDefault();
                handleVolume({ target: { value: Math.max(0, volume - 0.05) } });
            } else if (e.code === 'KeyM') {
                e.preventDefault();
                toggleMute();
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [current, isPlaying, progress.currentTime, volume, isMuted]);

    async function toggleLike(item) {
        if (!item) return;
        if (!authToken) {
            setIsAuthModalOpen(true);
            setAuthNotice('Log in or register to like songs.');
            return;
        }

        try {
            const res = await apiFetch(`/api/library/media/${item.id}/like`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setLikedIds((prev) =>
                    data.liked ? [...prev, item.id] : prev.filter((id) => id !== item.id)
                );
            }
        } catch (e) {
            // Ignore
        }
    }

    async function handleAuth(event) {
        event.preventDefault();
        setAuthLoading(true);
        setAuthNotice('');

        const form = event.currentTarget;
        const payload = Object.fromEntries(new FormData(form).entries());
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
            setIsAuthModalOpen(false);
            setAuthNotice('');
            await loadUserLibrary(data.token);
        } catch (error) {
            setAuthNotice(error.message);
        } finally {
            setAuthLoading(false);
        }
    }

    async function handleLogout() {
        try {
            await apiFetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {
            // Ignore
        }
        localStorage.removeItem('ms_player_token');
        setAuthToken('');
        setUser(null);
        setLikedIds([]);
        setPlaylists([]);
        setHistoryItems([]);
    }

    async function searchYoutube(searchQuery) {
        const q = searchQuery || youtubeQuery;
        if (!q.trim()) return;

        if (!authToken) {
            setIsAuthModalOpen(true);
            setAuthNotice('Log in to search and stream music online.');
            return;
        }

        setYoutubeLoading(true);
        setYoutubeNotice('');

        try {
            const response = await apiFetch(`/api/youtube/search?q=${encodeURIComponent(q)}`);
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.message ?? 'Search failed.');
            }

            const res = payload.data ?? [];
            setYoutubeResults(res);
            if (res.length === 0) {
                setYoutubeNotice('No results found online.');
            }
        } catch (err) {
            setYoutubeResults([]);
            setYoutubeNotice(err.message ?? 'Search failed.');
        } finally {
            setYoutubeLoading(false);
        }
    }

    async function playYoutubeItem(result) {
        const fallbackId = result.youtube_id || extractYoutubeId(result.url || result.source_url || result.media_path);
        try {
            setNotice(`Loading "${result.title}"...`);
            const targetUrl = result.source_url || result.url || (fallbackId ? `https://www.youtube.com/watch?v=${fallbackId}` : null);
            let stream = {};
            if (targetUrl) {
                const res = await apiFetch('/api/youtube/play', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: targetUrl,
                        stream_mode: result.type === 'video' ? 'video' : 'audio',
                        title: result.title,
                        artist: result.uploader || result.artist,
                        thumbnail_url: result.thumbnail_url || result.cover_url,
                        duration_seconds: result.duration_seconds,
                    }),
                });
                if (res.ok) {
                    const payload = await res.json().catch(() => ({}));
                    stream = payload.data ?? {};
                }
            }

            const videoId = stream.youtube_id || fallbackId;

            const next = {
                id: result.id ?? result.url ?? videoId,
                type: result.type === 'video' ? 'video' : (stream.stream_type ?? 'audio'),
                title: stream.title ?? result.title,
                artist: stream.artist ?? (result.uploader ?? result.artist ?? 'Unknown Artist'),
                source_url: stream.source_url ?? targetUrl,
                stream_url: stream.stream_url || null,
                youtube_id: videoId,
                audio_stream_url: stream.audio_stream_url || null,
                video_stream_url: stream.video_stream_url || null,
                audio_mime_type: stream.audio_mime_type,
                video_mime_type: stream.video_mime_type,
                thumbnail_url: stream.thumbnail_url ?? result.thumbnail_url ?? (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null),
                cover_url: stream.thumbnail_url ?? result.cover_url ?? result.thumbnail_url ?? (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null),
                description: stream.description ?? result.description,
                duration_seconds: stream.duration_seconds || result.duration_seconds,
            };

            playItem(next);
            setNotice('');
        } catch (e) {
            if (fallbackId) {
                playItem({
                    ...result,
                    youtube_id: fallbackId,
                    type: result.type === 'video' ? 'video' : 'audio',
                    stream_url: null,
                    audio_stream_url: null,
                });
                setNotice('');
            } else {
                setNotice(e?.message ?? 'Could not play this stream.');
            }
        }
    }

    async function switchAudioVideo(targetMode) {
        if (!current) return;
        const nextMode = targetMode === 'video' ? 'video' : 'audio';

        const currentTime = mediaRef.current?.currentTime || progress.currentTime || 0;
        setNotice(`Switching to ${nextMode}...`);

        let nextStreamUrl = nextMode === 'video' ? current.video_stream_url : current.audio_stream_url;

        if (current.source_url) {
            try {
                const token = authToken || (localStorage.getItem('ms_player_token') ?? '');
                const res = await fetch('/api/youtube/play', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ url: current.source_url, stream_mode: nextMode }),
                });

                if (res.ok) {
                    const payload = await res.json();
                    const stream = payload.data ?? {};
                    nextStreamUrl = stream.stream_url;

                    setCurrent((prev) => ({
                        ...(prev ?? {}),
                        type: nextMode,
                        stream_url: nextStreamUrl || prev?.stream_url,
                        audio_stream_url: stream.audio_stream_url ?? prev?.audio_stream_url,
                        video_stream_url: stream.video_stream_url ?? prev?.video_stream_url,
                        audio_mime_type: stream.audio_mime_type ?? prev?.audio_mime_type,
                        video_mime_type: stream.video_mime_type ?? prev?.video_mime_type,
                    }));
                }
            } catch (e) {
                // Ignore
            }
        }

        setCurrent((prev) => {
            const updated = {
                ...(prev ?? current),
                type: nextMode,
                stream_url: nextStreamUrl || (nextMode === 'video' ? (prev?.video_stream_url || prev?.stream_url) : (prev?.audio_stream_url || prev?.stream_url)),
            };
            setSelectedVideo(updated);
            return updated;
        });

        if (nextMode === 'video') {
            setActiveView('video');
        }

        setIsPlaying(true);
        setNotice('');

        setTimeout(() => {
            if (mediaRef.current) {
                if (currentTime > 0) {
                    try {
                        mediaRef.current.currentTime = currentTime;
                    } catch (e) {}
                }
                mediaRef.current.play().catch(() => {});
            }
        }, 150);
    }

    async function importYoutube(result) {
        if (!authToken) {
            setIsAuthModalOpen(true);
            setAuthNotice('Log in to save songs to your library.');
            return;
        }

        try {
            setNotice(`Saving "${result.title}" to library...`);
            const response = await apiFetch('/api/youtube/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: result.url || result.source_url,
                    title: result.title,
                    artist: result.uploader || result.artist,
                    thumbnail_url: result.thumbnail_url || result.cover_url,
                    duration_seconds: result.duration_seconds,
                }),
            });

            if (response.ok) {
                setNotice(`Saved "${result.title}" to library!`);
                await loadItems();
                await loadDiscovery();
            } else {
                const data = await response.json().catch(() => ({}));
                setNotice(data.message ?? 'Save failed.');
            }
        } catch (e) {
            setNotice('Could not save track to library.');
        }
    }

    async function handleCreatePlaylist(e) {
        e.preventDefault();
        if (!newPlaylistName.trim()) return;

        try {
            const res = await apiFetch('/api/playlists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newPlaylistName, description: newPlaylistDesc }),
            });
            if (res.ok) {
                setNewPlaylistName('');
                setNewPlaylistDesc('');
                setIsCreatePlaylistOpen(false);
                await loadUserLibrary();
            }
        } catch (err) {
            // Ignore
        }
    }

    async function addToPlaylist(playlistId, track) {
        try {
            const isObj = track && typeof track === 'object';
            const id = isObj ? track.id : track;
            const payload = typeof id === 'number'
                ? { media_item_id: id }
                : {
                    media_item_id: typeof id === 'number' ? id : undefined,
                    source_url: isObj ? (track.source_url || track.url) : undefined,
                    title: isObj ? track.title : undefined,
                    artist: isObj ? (track.artist || track.uploader) : undefined,
                    thumbnail_url: isObj ? (track.thumbnail_url || track.cover_url) : undefined,
                    duration_seconds: isObj ? track.duration_seconds : undefined,
                };

            const res = await apiFetch(`/api/playlists/${playlistId}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                setNotice('Added track to playlist.');
                await loadUserLibrary();
            } else {
                const err = await res.json().catch(() => ({}));
                setNotice(err.message || 'Could not add to playlist.');
            }
        } catch (e) {
            setNotice('Could not add to playlist.');
        }
    }

    async function openVideo(item) {
        handleTrackPlay(item);
    }

    const filteredItems = useMemo(() => {
        if (!query.trim()) return items;
        const q = query.toLowerCase();
        return items.filter(
            (item) =>
                item.title?.toLowerCase().includes(q) ||
                item.artist?.toLowerCase().includes(q) ||
                item.album?.toLowerCase().includes(q) ||
                item.genre?.toLowerCase().includes(q)
        );
    }, [items, query]);

    const likedItems = useMemo(() => {
        return items.filter((item) => likedIds.includes(item.id));
    }, [items, likedIds]);

    const currentPlaylist = useMemo(() => {
        if (!selectedPlaylistId) return null;
        return playlists.find((p) => p.id === Number(selectedPlaylistId)) ?? null;
    }, [playlists, selectedPlaylistId]);

    // Greeting based on current time
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    }, []);

    function handleMediaError(e) {
        console.warn('HTML5 media stream error:', e);
        if (currentYtId) {
            setNotice('Audio stream unavailable, switching to YouTube playback...');
            setCurrent((prev) => ({
                ...(prev ?? {}),
                stream_url: null,
                audio_stream_url: null,
                video_stream_url: null,
                youtube_id: currentYtId,
            }));
            setIsPlaying(true);
        } else {
            setNotice('Could not play media stream.');
            setIsPlaying(false);
        }
    }

    return (
        <div className="app-shell">
            {/* Audio Media Element: Permanently mounted, never unmounts across view switches */}
            <audio
                id="ventune-main-audio"
                onError={handleMediaError}
                preload="auto"
                ref={mediaRef}
                src={!isPlayingViaYt ? (current?.audio_stream_url || current?.stream_url || '') : ''}
            />

            {/* YouTube Background Stream Dock: Pure background audio playback */}
            <div
                id="ventune-yt-player-container"
                className="ventune-yt-dock-bg"
            >
                <div id="ventune-yt-player" />
            </div>

            {/* Apple Music Categorized Sidebar */}
            <aside className="am-sidebar">
                {/* Brand Header */}
                <div className="am-brand">
                    <div className="am-brand-logo">
                        <Sparkles size={18} />
                    </div>
                    <span className="am-brand-name">Ventune</span>
                </div>

                {/* Apple Music Sidebar Search */}
                <div className="am-sidebar-search">
                    <Search size={14} />
                    <input
                        onChange={(e) => {
                            setQuery(e.target.value);
                            if (activeView !== 'search') setActiveView('search');
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                searchYoutube(query);
                            }
                        }}
                        placeholder="Search"
                        value={query}
                    />
                    {query && (
                        <button
                            className="am-search-clear"
                            onClick={() => setQuery('')}
                            type="button"
                        >
                            <X size={13} />
                        </button>
                    )}
                </div>

                {/* Apple Music Discovery Section */}
                <div className="am-nav-section">
                    <button
                        className={`am-nav-item ${activeView === 'home' ? 'active' : ''}`}
                        onClick={() => setActiveView('home')}
                        type="button"
                    >
                        <Home size={18} />
                        <span>Listen Now</span>
                    </button>
                    <button
                        className={`am-nav-item ${activeView === 'search' ? 'active' : ''}`}
                        onClick={() => setActiveView('search')}
                        type="button"
                    >
                        <Compass size={18} />
                        <span>Browse</span>
                    </button>
                    <button
                        className={`am-nav-item ${activeView === 'youtube' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveView('youtube');
                            if (!youtubeResults.length) searchYoutube('Coldplay');
                        }}
                        type="button"
                    >
                        <Radio size={18} />
                        <span>Radio & Online</span>
                    </button>
                </div>

                {/* Apple Music Library Section */}
                <div className="am-nav-section">
                    <div className="am-nav-header">Library</div>
                    <button
                        className={`am-nav-item ${activeView === 'library' ? 'active' : ''}`}
                        onClick={() => setActiveView('library')}
                        type="button"
                    >
                        <Music2 size={18} />
                        <span>Songs</span>
                    </button>
                    <button
                        className={`am-nav-item ${activeView === 'liked' ? 'active' : ''}`}
                        onClick={() => setActiveView('liked')}
                        type="button"
                    >
                        <Heart size={18} />
                        <span>Liked Songs ({likedIds.length})</span>
                    </button>
                    <button
                        className={`am-nav-item ${activeView === 'artists' ? 'active' : ''}`}
                        onClick={() => setActiveView('artists')}
                        type="button"
                    >
                        <UserRound size={18} />
                        <span>Artists</span>
                    </button>
                    <button
                        className={`am-nav-item ${activeView === 'albums' ? 'active' : ''}`}
                        onClick={() => setActiveView('albums')}
                        type="button"
                    >
                        <Album size={18} />
                        <span>Albums</span>
                    </button>
                    <button
                        className={`am-nav-item ${activeView === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveView('history')}
                        type="button"
                    >
                        <Clock size={18} />
                        <span>Recently Added</span>
                    </button>
                </div>

                {/* Apple Music Playlists Section */}
                <div className="am-nav-section">
                    <div className="am-nav-header am-nav-header-row">
                        <span>Playlists</span>
                        <button
                            className="am-add-playlist-btn"
                            onClick={() => {
                                if (!authToken) {
                                    setIsAuthModalOpen(true);
                                    setAuthNotice('Log in to create playlists.');
                                } else {
                                    setIsCreatePlaylistOpen(true);
                                }
                            }}
                            title="New Playlist"
                            type="button"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    <div className="am-playlists-list">
                        {playlists.map((pl) => (
                            <button
                                className={`am-nav-item ${
                                    activeView === 'playlist-detail' && selectedPlaylistId === pl.id
                                        ? 'active'
                                        : ''
                                }`}
                                key={pl.id}
                                onClick={() => {
                                    setSelectedPlaylistId(pl.id);
                                    setActiveView('playlist-detail');
                                }}
                                type="button"
                            >
                                <ListMusic size={16} />
                                <span>{pl.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Admin Studio Shortcut */}
                {isAdmin && (
                    <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--am-border)' }}>
                        <button
                            className={`am-nav-item ${activeView === 'upload' ? 'active' : ''}`}
                            onClick={() => setActiveView('upload')}
                            type="button"
                        >
                            <UploadCloud size={18} />
                            <span>Upload Studio</span>
                        </button>
                    </div>
                )}
            </aside>

            {/* Main Content Area */}
            <main className="main-view">
                {/* Apple Music Header / Top Navigation */}
                <header className="top-bar">
                    <div className="top-bar-left">
                        <button
                            className="nav-history-btn"
                            onClick={() => window.history.back()}
                            title="Go back"
                            type="button"
                        >
                            <ArrowLeft size={16} />
                        </button>
                        <button
                            className="nav-history-btn"
                            onClick={() => window.history.forward()}
                            title="Go forward"
                            type="button"
                        >
                            <ArrowRight size={16} />
                        </button>
                    </div>

                    <div className="top-bar-right">
                        {/* Apple Music Light/Dark Theme Switcher */}
                        <button
                            className="am-theme-toggle"
                            onClick={toggleTheme}
                            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
                            type="button"
                        >
                            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                        </button>

                        <button
                            className="am-nav-item"
                            style={{ width: 'auto', padding: '6px 12px', background: 'var(--am-sidebar)', border: '1px solid var(--am-border)' }}
                            onClick={() => {
                                setActiveView('youtube');
                                if (!youtubeResults.length) searchYoutube('Coldplay');
                            }}
                            type="button"
                        >
                            <Compass size={15} color="var(--am-accent)" />
                            <span>Online Music</span>
                        </button>

                        {user ? (
                            <div
                                className="am-profile-circle"
                                onClick={() => {
                                    if (window.confirm('Log out from Ventune?')) {
                                        handleLogout();
                                    }
                                }}
                                title={`${user.name} (Click to log out)`}
                            >
                                {user.name?.[0]?.toUpperCase() ?? 'U'}
                            </div>
                        ) : (
                            <button
                                className="am-login-btn"
                                onClick={() => {
                                    setAuthMode('login');
                                    setIsAuthModalOpen(true);
                                }}
                                type="button"
                            >
                                Sign In
                            </button>
                        )}
                    </div>
                </header>

                {notice && (
                    <div className="vt-notice-bar">
                        {notice}
                    </div>
                )}

                {/* View Switcher */}
                <div className="view-content">
                    {activeView === 'home' && (
                        <HomeView
                            greeting={greeting}
                            items={items}
                            likedIds={likedIds}
                            onLike={toggleLike}
                            onOpenVideo={openVideo}
                            onPlay={handleTrackPlay}
                            onSelectPlaylist={(id) => {
                                setSelectedPlaylistId(id);
                                setActiveView('playlist-detail');
                            }}
                            onSwitchView={setActiveView}
                            playlists={playlists}
                            recentHistory={historyItems}
                        />
                    )}

                    {activeView === 'search' && (
                        <SearchView
                            currentTrack={current}
                            isPlaying={isPlaying}
                            items={filteredItems}
                            likedIds={likedIds}
                            onAddToPlaylist={(item) => setAddToPlaylistTrack(item)}
                            onAddToQueue={addToQueue}
                            onImportYoutube={importYoutube}
                            onLike={toggleLike}
                            onPlay={handleTrackPlay}
                            onPlayYoutube={playYoutubeItem}
                            onSearchYoutube={searchYoutube}
                            playlists={playlists}
                            query={query}
                            setQuery={setQuery}
                            youtubeLoading={youtubeLoading}
                            youtubeNotice={youtubeNotice}
                            youtubeResults={youtubeResults}
                        />
                    )}

                    {activeView === 'liked' && (
                        <PlaylistDetailView
                            currentTrack={current}
                            isLikedView
                            isPlaying={isPlaying}
                            items={likedItems}
                            likedIds={likedIds}
                            onAddToPlaylist={(item) => setAddToPlaylistTrack(item)}
                            onAddToQueue={addToQueue}
                            onLike={toggleLike}
                            onPlay={handleTrackPlay}
                            onTogglePlay={togglePlay}
                            playlists={playlists}
                            title="Liked Songs"
                            totalSongs={likedItems.length}
                            user={user}
                        />
                    )}

                    {activeView === 'playlist-detail' && currentPlaylist && (
                        <PlaylistDetailView
                            currentTrack={current}
                            isPlaying={isPlaying}
                            items={currentPlaylist.items?.map((i) => i.media_item) ?? []}
                            likedIds={likedIds}
                            onAddToPlaylist={(item) => setAddToPlaylistTrack(item)}
                            onAddToQueue={addToQueue}
                            onDeletePlaylist={deletePlaylist}
                            onLike={toggleLike}
                            onPlay={handleTrackPlay}
                            onRemoveFromPlaylist={removeFromPlaylist}
                            onTogglePlay={togglePlay}
                            playlist={currentPlaylist}
                            playlists={playlists}
                            title={currentPlaylist.name}
                            totalSongs={currentPlaylist.items?.length ?? 0}
                            user={user}
                        />
                    )}

                    {activeView === 'library' && (
                        <LibraryListView
                            currentTrack={current}
                            isPlaying={isPlaying}
                            items={items}
                            likedIds={likedIds}
                            onAddToPlaylist={(item) => setAddToPlaylistTrack(item)}
                            onAddToQueue={addToQueue}
                            onLike={toggleLike}
                            onPlay={handleTrackPlay}
                            playlists={playlists}
                        />
                    )}

                    {activeView === 'artists' && (
                        <ArtistsView
                            artists={artists}
                            items={items}
                            onPlay={handleTrackPlay}
                            selectedArtist={selectedArtist}
                        />
                    )}

                    {activeView === 'albums' && (
                        <AlbumsView
                            albums={albums}
                            items={items}
                            onPlay={handleTrackPlay}
                            selectedAlbum={selectedAlbum}
                        />
                    )}

                    {activeView === 'history' && (
                        <HistoryListView
                            currentTrack={current}
                            historyItems={historyItems}
                            isPlaying={isPlaying}
                            likedIds={likedIds}
                            onAddToPlaylist={(item) => setAddToPlaylistTrack(item)}
                            onAddToQueue={addToQueue}
                            onLike={toggleLike}
                            onPlay={handleTrackPlay}
                            playlists={playlists}
                        />
                    )}

                    {activeView === 'youtube' && (
                        <YoutubeStudioView
                            isAdmin={isAdmin}
                            loading={youtubeLoading}
                            notice={youtubeNotice}
                            onImport={importYoutube}
                            onPlay={playYoutubeItem}
                            onSearch={searchYoutube}
                            results={youtubeResults}
                            user={user}
                        />
                    )}

                    {activeView === 'upload' && (
                        <UploadStudioView
                            isAdmin={isAdmin}
                            onUploadSuccess={() => {
                                loadItems();
                                loadDiscovery();
                                setActiveView('library');
                            }}
                            user={user}
                        />
                    )}
                </div>
            </main>

            {/* Apple Music Iconic LCD Player Bar */}
            <footer className="am-player-bar">
                {/* Left Section: Playback controls */}
                <div className="am-player-left">
                    <button
                        className={`am-ctrl-btn ${isShuffle ? 'active' : ''}`}
                        disabled={!current}
                        onClick={() => setIsShuffle((s) => !s)}
                        title={isShuffle ? 'Disable shuffle' : 'Enable shuffle'}
                        type="button"
                    >
                        <Shuffle size={17} />
                    </button>

                    <button
                        className="am-ctrl-btn"
                        disabled={!current}
                        onClick={() => jump(-1)}
                        title="Previous"
                        type="button"
                    >
                        <SkipBack size={20} />
                    </button>

                    <button
                        className="am-play-main"
                        disabled={!current}
                        onClick={togglePlay}
                        title={isPlaying ? 'Pause' : 'Play'}
                        type="button"
                    >
                        {isPlaying ? <Pause fill="currentColor" size={18} /> : <Play fill="currentColor" size={18} />}
                    </button>

                    <button
                        className="am-ctrl-btn"
                        disabled={!current}
                        onClick={() => jump(1)}
                        title="Next"
                        type="button"
                    >
                        <SkipForward size={20} />
                    </button>

                    <button
                        className={`am-ctrl-btn ${repeatMode !== 'off' ? 'active' : ''}`}
                        disabled={!current}
                        onClick={cycleRepeat}
                        title={`Repeat: ${repeatMode}`}
                        type="button"
                    >
                        {repeatMode === 'one' ? <Repeat1 size={17} /> : <Repeat size={17} />}
                    </button>
                </div>

                {/* Center Section: Apple Music LCD Screen */}
                <div className="am-lcd-display">
                    {current?.cover_url || current?.external_cover_url || current?.thumbnail_url ? (
                        <img
                            alt=""
                            className="am-lcd-thumb"
                            src={current.cover_url || current.external_cover_url || current.thumbnail_url}
                        />
                    ) : (
                        <div className="am-lcd-thumb placeholder">
                            <Music2 size={20} />
                        </div>
                    )}
                    <div className="am-lcd-content">
                        <div className="am-lcd-info">
                            <span className="am-lcd-title" title={current?.title ?? 'Not Playing'}>
                                {current?.title ?? 'Not Playing'}
                            </span>
                            {current && (
                                <>
                                    <span className="am-lcd-separator">•</span>
                                    <span className="am-lcd-artist" title={current?.artist ?? 'Ventune'}>
                                        {current?.artist ?? 'Ventune'}
                                    </span>
                                </>
                            )}
                            {isPlaying && (
                                <div className="am-soundwave" title="Playing">
                                    <span />
                                    <span />
                                    <span />
                                    <span />
                                </div>
                            )}
                        </div>
                        <div className="am-lcd-scrubber">
                            <span className="am-scrub-time">{formatTime(progress.currentTime)}</span>
                            <input
                                aria-label="Seek track"
                                className="am-range"
                                disabled={!current || !progress.duration}
                                max={progress.duration || 0}
                                min={0}
                                onChange={(e) => handleSeek(Number(e.target.value))}
                                step={0.25}
                                type="range"
                                value={Math.min(progress.currentTime, progress.duration || 0)}
                            />
                            <span className="am-scrub-time">
                                {progress.duration ? `-${formatTime(Math.max(0, progress.duration - progress.currentTime))}` : '0:00'}
                            </span>
                        </div>
                    </div>
                    {current && (
                        <button
                            className={`am-lcd-heart ${likedIds.includes(current.id) ? 'active' : ''}`}
                            onClick={() => toggleLike(current)}
                            title="Love this track"
                            type="button"
                        >
                            <Heart
                                fill={likedIds.includes(current.id) ? 'currentColor' : 'none'}
                                size={16}
                            />
                        </button>
                    )}
                </div>

                {/* Right Section: Queue & Volume */}
                <div className="am-player-right">

                    <button
                        className={`am-ctrl-btn ${isQueueDrawerOpen ? 'active' : ''}`}
                        onClick={() => setIsQueueDrawerOpen((prev) => !prev)}
                        style={{ color: isQueueDrawerOpen ? 'var(--am-accent)' : undefined }}
                        title="Play Queue & Autoplay"
                        type="button"
                    >
                        <ListMusic size={18} />
                    </button>

                    <div className="am-volume-wrap">
                        <button className="am-volume-icon" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'} type="button">
                            {isMuted || volume === 0 ? (
                                <VolumeX size={17} />
                            ) : volume < 0.5 ? (
                                <Volume1 size={17} />
                            ) : (
                                <Volume2 size={17} />
                            )}
                        </button>
                        <input
                            aria-label="Volume"
                            className="am-range am-vol-range"
                            max={1}
                            min={0}
                            onChange={handleVolume}
                            step={0.02}
                            type="range"
                            value={isMuted ? 0 : volume}
                        />
                    </div>
                </div>
            </footer>

            {/* Auth Modal (Login / Register) */}
            {isAuthModalOpen && (
                <div className="modal-backdrop" onClick={() => setIsAuthModalOpen(false)}>
                    <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setIsAuthModalOpen(false)} type="button">
                            <X size={20} />
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="brand-mark">
                                <Sparkles size={20} />
                            </div>
                            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
                                {authMode === 'register' ? 'Sign up for Ventune' : 'Log in to Ventune'}
                            </h2>
                        </div>

                        {authNotice && (
                            <div style={{ background: 'rgba(233,20,41,0.2)', color: '#ff5252', padding: '8px 12px', borderRadius: 4, fontSize: 13 }}>
                                {authNotice}
                            </div>
                        )}

                        <form className="flex flex-col gap-3" onSubmit={handleAuth}>
                            {authMode === 'register' && (
                                <input
                                    className="vt-input"
                                    name="name"
                                    placeholder="Your Name"
                                    required
                                />
                            )}
                            <input
                                className="vt-input"
                                name="email"
                                placeholder="Email address"
                                required
                                type="email"
                            />
                            <input
                                className="vt-input"
                                name="password"
                                placeholder="Password"
                                required
                                type="password"
                            />
                            <button
                                className="vt-btn-accent"
                                disabled={authLoading}
                                type="submit"
                            >
                                {authLoading ? 'Processing...' : authMode === 'register' ? 'Sign Up' : 'Log In'}
                            </button>
                        </form>

                        <div style={{ fontSize: 13, color: '#A8A3C8', textAlign: 'center' }}>
                            {authMode === 'register' ? (
                                <>
                                    Already have an account?{' '}
                                    <button
                                        onClick={() => setAuthMode('login')}
                                        style={{ color: '#fff', textDecoration: 'underline', fontWeight: 600 }}
                                        type="button"
                                    >
                                        Log in here
                                    </button>
                                </>
                            ) : (
                                <>
                                    Don't have an account?{' '}
                                    <button
                                        onClick={() => setAuthMode('register')}
                                        style={{ color: '#fff', textDecoration: 'underline', fontWeight: 600 }}
                                        type="button"
                                    >
                                        Sign up for free
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Create Playlist Modal */}
            {isCreatePlaylistOpen && (
                <div className="modal-backdrop" onClick={() => setIsCreatePlaylistOpen(false)}>
                    <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setIsCreatePlaylistOpen(false)} type="button">
                            <X size={20} />
                        </button>
                        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Create Playlist</h2>
                        <form className="flex flex-col gap-3" onSubmit={handleCreatePlaylist}>
                            <input
                                autoFocus
                                className="vt-input"
                                onChange={(e) => setNewPlaylistName(e.target.value)}
                                placeholder="Playlist name (e.g. Chill Vibes)"
                                required
                                value={newPlaylistName}
                            />
                            <input
                                className="vt-input"
                                onChange={(e) => setNewPlaylistDesc(e.target.value)}
                                placeholder="Description (optional)"
                                value={newPlaylistDesc}
                            />
                            <button className="vt-btn-accent" type="submit">
                                Create
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Add to Playlist Modal */}
            {/* Queue Drawer */}
            <QueueDrawer
                autoQueue={autoQueue}
                current={current}
                isAutoplay={isAutoplay}
                isOpen={isQueueDrawerOpen}
                onAddToQueue={addToQueue}
                onClearQueue={clearQueue}
                onClose={() => setIsQueueDrawerOpen(false)}
                onPlay={handleTrackPlay}
                onRemoveFromQueue={removeFromQueue}
                onToggleAutoplay={toggleAutoplay}
                queue={queue}
            />

            {addToPlaylistTrack && (
                <div className="modal-backdrop" onClick={() => setAddToPlaylistTrack(null)}>
                    <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setAddToPlaylistTrack(null)} type="button">
                            <X size={20} />
                        </button>
                        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Add to Playlist</h2>
                        <p style={{ color: '#A8A3C8', fontSize: 13, margin: '4px 0 12px 0' }}>
                            Choose a playlist for <strong style={{ color: '#fff' }}>{addToPlaylistTrack.title}</strong>
                        </p>

                        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                            {playlists.map((pl) => (
                                <button
                                    key={pl.id}
                                    className="flex items-center gap-3 p-3 rounded bg-[#242424] hover:bg-[#2A2850] text-left transition cursor-pointer"
                                    onClick={async () => {
                                        const trackTitle = addToPlaylistTrack.title;
                                        await addToPlaylist(pl.id, addToPlaylistTrack);
                                        setAddToPlaylistTrack(null);
                                        setNotice(`Added "${trackTitle}" to ${pl.name}!`);
                                    }}
                                    type="button"
                                >
                                    <div className="w-10 h-10 rounded bg-[#181818] flex items-center justify-center flex-shrink-0">
                                        <ListMusic size={20} color="#7C3AED" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold text-white truncate text-sm">{pl.name}</div>
                                        <div className="text-xs text-[#A8A3C8]">{pl.items?.length ?? 0} tracks</div>
                                    </div>
                                </button>
                            ))}
                            {playlists.length === 0 && (
                                <p style={{ color: '#A8A3C8', fontSize: 13 }}>No playlists created yet.</p>
                            )}
                        </div>

                        <button
                            className="vt-btn-accent mt-2"
                            onClick={() => {
                                setIsCreatePlaylistOpen(true);
                            }}
                            type="button"
                        >
                            + Create New Playlist
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ==========================================================================
   Home View: Apple Music "Listen Now" with Editorial Hero & Square Cards
   ========================================================================== */
function HomeView({
    greeting,
    items,
    likedIds,
    onLike,
    onOpenVideo,
    onPlay,
    onSelectPlaylist,
    onSwitchView,
    playlists,
    recentHistory,
}) {
    const featuredItems = useMemo(() => items.slice(0, 10), [items]);
    const popularSongs = useMemo(() => (items.length > 10 ? items.slice(10, 20) : items.slice(0, 10)), [items]);
    const newReleases = useMemo(() => [...items].reverse().slice(0, 10), [items]);

    const heroItem = items[0] || {
        title: 'Spatial Audio & Pure Acoustic Fidelity',
        artist: 'Ventune Curators',
        cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
    };

    return (
        <div className="flex flex-col">
            {/* Apple Music Editorial Hero Banner */}
            <div className="am-hero-banner">
                <div className="am-hero-content">
                    <span className="am-hero-badge">FEATURED STREAM</span>
                    <h1 className="am-hero-title">{heroItem.title}</h1>
                    <p className="am-hero-sub">
                        {heroItem.artist ? `${heroItem.artist} • ` : ''}Mastered for high-definition streaming. Experience Apple-inspired acoustic precision and spatial depth.
                    </p>
                    <button
                        className="am-hero-play-btn"
                        onClick={() => onPlay(heroItem)}
                        type="button"
                    >
                        <Play fill="white" size={17} />
                        <span>Listen Now</span>
                    </button>
                </div>
                {(heroItem.cover_url || heroItem.thumbnail_url || heroItem.external_cover_url) && (
                    <img
                        alt={heroItem.title}
                        className="am-hero-art"
                        src={heroItem.cover_url || heroItem.thumbnail_url || heroItem.external_cover_url}
                    />
                )}
            </div>

            {/* Apple Music Featured / Top Hits */}
            {items.length > 0 && (
                <section style={{ marginBottom: 36 }}>
                    <div className="am-section-title">
                        <h2>Top Hits</h2>
                        <button onClick={() => onSwitchView('library')} type="button">
                            See All
                        </button>
                    </div>
                    <div className="am-grid">
                        {featuredItems.map((item) => (
                            <VentuneCard
                                item={item}
                                key={item.id}
                                onPlay={() => onPlay(item)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Apple Music Popular Songs */}
            {popularSongs.length > 0 && (
                <section style={{ marginBottom: 36 }}>
                    <div className="am-section-title">
                        <h2>Popular Songs</h2>
                        <button onClick={() => onSwitchView('library')} type="button">
                            See All
                        </button>
                    </div>
                    <div className="am-grid">
                        {popularSongs.map((item) => (
                            <VentuneCard
                                item={item}
                                key={item.id}
                                onPlay={() => onPlay(item)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Apple Music New Releases & Albums */}
            {newReleases.length > 0 && (
                <section style={{ marginBottom: 36 }}>
                    <div className="am-section-title">
                        <h2>New Releases & Albums</h2>
                        <button onClick={() => onSwitchView('albums')} type="button">
                            See All
                        </button>
                    </div>
                    <div className="am-grid">
                        {newReleases.map((item) => (
                            <VentuneCard
                                item={item}
                                key={`release-${item.id}`}
                                onPlay={() => onPlay(item)}
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

/* ==========================================================================
   Apple Music Album Card (Pure square artwork with subtle hover elevation)
   ========================================================================== */
function VentuneCard({ item, onPlay }) {
    const coverSrc = item.cover_url || item.thumbnail_url || item.external_cover_url;

    return (
        <article className="am-card" onClick={onPlay}>
            <div className="am-card-cover-wrap">
                {coverSrc ? (
                    <img alt="" className="am-card-cover" src={coverSrc} />
                ) : (
                    <div className="am-card-cover placeholder">
                        <Music2 size={36} color="var(--am-text-tertiary)" />
                    </div>
                )}
                <button
                    className="am-card-play-overlay"
                    onClick={(e) => {
                        e.stopPropagation();
                        onPlay();
                    }}
                    title={`Play ${item.title}`}
                    type="button"
                >
                    <Play fill="currentColor" size={18} />
                </button>
            </div>
            <div className="am-card-meta">
                <h3 className="am-card-title" title={item.title}>{item.title}</h3>
                <p className="am-card-artist" title={item.artist}>{item.artist || 'Ventune'}</p>
            </div>
        </article>
    );
}

/* ==========================================================================
   Search View: Categories & Live Unified Results
   ========================================================================== */
function SearchView({
    currentTrack,
    isPlaying,
    items,
    likedIds,
    onAddToPlaylist,
    onAddToQueue,
    onImportYoutube,
    onLike,
    onPlay,
    onPlayYoutube,
    onSearchYoutube,
    playlists,
    query,
    setQuery,
    youtubeLoading,
    youtubeNotice,
    youtubeResults,
}) {
    return (
        <div className="flex flex-col gap-8">
            {/* If there's an active query */}
            {query.trim() ? (
                <>
                    {/* Local Songs Section */}
                    {items.length > 0 && (
                        <div>
                            <h2 className="shelf-title" style={{ marginBottom: 16 }}>
                                Songs in Library
                            </h2>
                            <TrackTable
                                currentTrack={currentTrack}
                                isPlaying={isPlaying}
                                items={items}
                                likedIds={likedIds}
                                onAddToPlaylist={onAddToPlaylist}
                                onAddToQueue={onAddToQueue}
                                onLike={onLike}
                                onPlay={onPlay}
                                playlists={playlists}
                            />
                        </div>
                    )}

                    {/* Online Results Section */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="shelf-title">
                                Online Results
                            </h2>
                            <button
                                className="pill-action-btn green-accent"
                                disabled={youtubeLoading}
                                onClick={() => onSearchYoutube(query)}
                                type="button"
                            >
                                <Compass size={16} />
                                {youtubeLoading ? 'Searching online...' : 'Search Online'}
                            </button>
                        </div>

                        {youtubeNotice && (
                            <p style={{ color: '#A8A3C8', fontSize: 13, marginBottom: 12 }}>{youtubeNotice}</p>
                        )}

                        {youtubeResults.length > 0 && (
                            <div className="shelf-grid">
                                {youtubeResults.map((yt) => (
                                    <article
                                        className="vt-card"
                                        key={yt.id || yt.url}
                                        onClick={() => onPlayYoutube(yt)}
                                    >
                                        <div className="vt-card-cover-wrap">
                                            {yt.thumbnail_url ? (
                                                <img alt="" className="vt-card-cover" src={yt.thumbnail_url} />
                                            ) : (
                                                <div className="vt-card-cover flex items-center justify-center bg-[#2A2850]">
                                                    <Music2 size={36} color="#A8A3C8" />
                                                </div>
                                            )}
                                            <button
                                                className="vt-card-play"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onPlayYoutube(yt);
                                                }}
                                                title={`Play ${yt.title}`}
                                                type="button"
                                            >
                                                <Play fill="black" size={22} />
                                            </button>
                                        </div>
                                        <div>
                                            <h3 className="vt-card-title" title={yt.title}>{yt.title}</h3>
                                            <p className="vt-card-desc">{yt.uploader || 'Unknown Artist'}</p>
                                            <div className="vt-card-footer">
                                                <span className="badge-tag online">YouTube</span>
                                                <div className="vt-card-actions">
                                                    {onAddToQueue && (
                                                        <button
                                                            className="vt-card-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onAddToQueue({
                                                                    id: yt.id || yt.url,
                                                                    title: yt.title,
                                                                    artist: yt.uploader || 'Unknown Artist',
                                                                    url: yt.url,
                                                                    source_url: yt.url,
                                                                    source: 'youtube',
                                                                    thumbnail_url: yt.thumbnail_url,
                                                                    cover_url: yt.thumbnail_url,
                                                                    duration_seconds: yt.duration_seconds,
                                                                    type: 'audio',
                                                                });
                                                            }}
                                                            title="Add to queue"
                                                            type="button"
                                                        >
                                                            <ListPlus size={14} />
                                                        </button>
                                                    )}
                                                    {onAddToPlaylist && (
                                                        <button
                                                            className="vt-card-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onAddToPlaylist({
                                                                    id: yt.id || yt.url,
                                                                    title: yt.title,
                                                                    artist: yt.uploader || 'Unknown Artist',
                                                                    url: yt.url,
                                                                    source_url: yt.url,
                                                                    source: 'youtube',
                                                                    thumbnail_url: yt.thumbnail_url,
                                                                    cover_url: yt.thumbnail_url,
                                                                    duration_seconds: yt.duration_seconds,
                                                                    type: 'audio',
                                                                });
                                                            }}
                                                            title="Add to playlist"
                                                            type="button"
                                                        >
                                                            <Plus size={14} />
                                                        </button>
                                                    )}
                                                    <button
                                                        className="vt-card-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onImportYoutube(yt);
                                                        }}
                                                        title="Save to library"
                                                        type="button"
                                                    >
                                                        <Heart size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                /* Browse Categories */
                <div>
                    <h2 className="shelf-title" style={{ marginBottom: 20 }}>
                        Browse all
                    </h2>
                    <div className="browse-categories-grid">
                        {CATEGORIES.map((cat) => {
                            const Icon = cat.icon;
                            return (
                                <div
                                    className="category-tile"
                                    key={cat.id}
                                    onClick={() => {
                                        setQuery(cat.title);
                                        onSearchYoutube(cat.title);
                                    }}
                                    style={{ backgroundColor: cat.color }}
                                >
                                    <h3 className="category-tile-title">{cat.title}</h3>
                                    <Icon className="category-tile-icon" />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ==========================================================================
   Ventune Track Table
   ========================================================================== */
function TrackTable({
    currentTrack,
    isPlaying,
    items,
    likedIds,
    onAddToPlaylist,
    onAddToQueue,
    onLike,
    onPlay,
    onRemoveFromPlaylist,
    playlistId,
    playlists = [],
}) {
    return (
        <div className="track-table">
            <div className="track-table-header">
                <div className="track-col-index">#</div>
                <div>Title</div>
                <div>Album</div>
                <div>Plays</div>
                <div style={{ textAlign: 'right' }}>
                    <Clock size={15} style={{ display: 'inline' }} />
                </div>
            </div>

            {items.map((item, index) => {
                const isCurrent = currentTrack?.id === item.id;
                const isItemPlaying = isCurrent && isPlaying;
                const isLiked = likedIds.includes(item.id);
                const thumb = item.cover_url || item.thumbnail_url || item.external_cover_url;

                return (
                    <div
                        className={`track-table-row ${isCurrent ? 'active' : ''}`}
                        key={`${item.id}-${index}`}
                        onClick={() => onPlay(item)}
                    >
                        <div className="track-col-index">
                            <span className="track-index-num">
                                {isItemPlaying ? (
                                    <Sparkles size={14} style={{ color: '#7C3AED' }} />
                                ) : (
                                    index + 1
                                )}
                            </span>
                            <button
                                className="track-row-play-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPlay(item);
                                }}
                                type="button"
                            >
                                <Play fill="currentColor" size={14} />
                            </button>
                        </div>

                        <div className="track-col-title">
                            {thumb ? (
                                <img alt="" className="track-table-thumb" src={thumb} />
                            ) : (
                                <div className="track-table-thumb flex items-center justify-center bg-[#2A2850]">
                                    <Music2 size={16} color="#A8A3C8" />
                                </div>
                            )}
                            <div className="track-meta-wrap">
                                <div className="track-title-text" title={item.title}>
                                    {item.title}
                                </div>
                                <div className="track-artist-text" title={item.artist}>
                                    {item.artist || 'Unknown Artist'}
                                </div>
                            </div>
                        </div>

                        <div className="track-col-album" title={item.album || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}>
                            {item.album || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}
                        </div>

                        <div className="track-col-plays">
                            {item.plays ? `${item.plays.toLocaleString()} plays` : 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}
                        </div>

                        <div className="track-col-duration">
                            <div className="track-row-actions">
                                <button
                                    className={`track-row-btn ${isLiked ? 'liked' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onLike(item);
                                    }}
                                    title="Save to your Liked Songs"
                                    type="button"
                                >
                                    <Heart fill={isLiked ? 'currentColor' : 'none'} size={16} />
                                </button>

                                {onAddToQueue && (
                                    <button
                                        className="track-row-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onAddToQueue(item);
                                        }}
                                        title="Add to queue"
                                        type="button"
                                    >
                                        <ListPlus size={16} />
                                    </button>
                                )}

                                <button
                                    className="track-row-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAddToPlaylist(item);
                                    }}
                                    title="Add to playlist"
                                    type="button"
                                >
                                    <Plus size={16} />
                                </button>

                                {playlistId && onRemoveFromPlaylist && (
                                    <button
                                        className="track-row-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveFromPlaylist(playlistId, item.id);
                                        }}
                                        title="Remove from playlist"
                                        type="button"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                )}
                            </div>
                            <span>{formatTime(item.duration_seconds)}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ==========================================================================
   Playlist Detail View
   ========================================================================== */
function PlaylistDetailView({
    currentTrack,
    isLikedView = false,
    isPlaying,
    items,
    likedIds,
    onAddToPlaylist,
    onAddToQueue,
    onDeletePlaylist,
    onLike,
    onPlay,
    onRemoveFromPlaylist,
    onTogglePlay,
    playlist,
    playlists,
    title,
    totalSongs,
    user,
}) {
    const totalSeconds = useMemo(() => {
        return items.reduce((acc, curr) => acc + (curr.duration_seconds || 0), 0);
    }, [items]);

    const totalMinutes = Math.floor(totalSeconds / 60);

    return (
        <div className="flex flex-col gap-6">
            {/* Ventune Hero Header */}
            <div className={`vt-hero ${isLikedView ? 'liked-gradient' : ''}`}>
                <div className={`vt-hero-cover ${isLikedView ? 'liked-gradient' : ''}`}>
                    {isLikedView ? (
                        <Heart fill="white" size={72} />
                    ) : (
                        <ListMusic color="#A8A3C8" size={72} />
                    )}
                </div>
                <div className="vt-hero-details">
                    <span className="vt-hero-type">Public Playlist</span>
                    <h1 className="vt-hero-title">{title}</h1>
                    <p style={{ margin: 0, color: '#A8A3C8', fontSize: 14 }}>
                        {playlist?.description || 'Your custom music collection on Ventune.'}
                    </p>
                    <div className="vt-hero-meta">
                        <strong>{user?.name ?? 'Ventune User'}</strong>
                        <span>â€¢</span>
                        <span>{totalSongs} songs,</span>
                        <span>about {totalMinutes} min</span>
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="hero-action-bar" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                    className="play-circle-lg"
                    disabled={items.length === 0}
                    onClick={() => {
                        if (items.length > 0) {
                            if (currentTrack && items.some((i) => i.id === currentTrack.id)) {
                                onTogglePlay();
                            } else {
                                onPlay(items[0]);
                            }
                        }
                    }}
                    title="Play playlist"
                    type="button"
                >
                    {isPlaying && currentTrack && items.some((i) => i.id === currentTrack.id) ? (
                        <Pause fill="currentColor" size={26} />
                    ) : (
                        <Play fill="currentColor" size={26} />
                    )}
                </button>

                {!isLikedView && playlist && onDeletePlaylist && (
                    <button
                        className="track-row-btn"
                        onClick={() => onDeletePlaylist(playlist.id)}
                        style={{
                            width: 42,
                            height: 42,
                            borderRadius: '50%',
                            background: '#242424',
                            color: '#ff5252',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                        }}
                        title="Delete Playlist"
                        type="button"
                    >
                        <Trash2 size={18} />
                    </button>
                )}
            </div>

            {/* Track Table */}
            {items.length > 0 ? (
                <TrackTable
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    items={items}
                    likedIds={likedIds}
                    onAddToPlaylist={onAddToPlaylist}
                    onAddToQueue={onAddToQueue}
                    onLike={onLike}
                    onPlay={onPlay}
                    onRemoveFromPlaylist={onRemoveFromPlaylist}
                    playlistId={playlist?.id}
                    playlists={playlists}
                />
            ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#A8A3C8' }}>
                    <p style={{ fontSize: 18, fontWeight: 700 }}>This playlist is empty</p>
                    <p style={{ fontSize: 14 }}>Add songs from Search or the Library to build your playlist.</p>
                </div>
            )}
        </div>
    );
}

/* ==========================================================================
   Library List View
   ========================================================================== */
function LibraryListView({ currentTrack, isPlaying, items, likedIds, onAddToPlaylist, onAddToQueue, onLike, onPlay, playlists }) {
    return (
        <div className="flex flex-col gap-6">
            <h1 className="shelf-title">All Library Tracks</h1>
            <TrackTable
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                items={items}
                likedIds={likedIds}
                onAddToPlaylist={onAddToPlaylist}
                onAddToQueue={onAddToQueue}
                onLike={onLike}
                onPlay={onPlay}
                playlists={playlists}
            />
        </div>
    );
}

/* ==========================================================================
   Artists View
   ========================================================================== */
function ArtistsView({ artists, items, onPlay, selectedArtist }) {
    return (
        <div className="flex flex-col gap-6">
            <h1 className="shelf-title">Artists</h1>
            <div className="shelf-grid">
                {artists.map((art) => (
                    <article
                        className="vt-card"
                        key={art.artist}
                        onClick={() => {
                            const artistTracks = items.filter((i) => i.artist === art.artist);
                            if (artistTracks.length > 0) onPlay(artistTracks[0]);
                        }}
                    >
                        <div className="vt-card-cover-wrap">
                            <div className="vt-card-cover flex items-center justify-center bg-[#2A2850] artist-round">
                                <UserRound size={48} color="#A8A3C8" />
                            </div>
                            <button className="vt-card-play" type="button">
                                <Play fill="black" size={22} />
                            </button>
                        </div>
                        <div>
                            <h3 className="vt-card-title">{art.artist}</h3>
                            <p className="vt-card-desc">{art.count} tracks</p>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
}

/* ==========================================================================
   Albums View
   ========================================================================== */
function AlbumsView({ albums, items, onPlay, selectedAlbum }) {
    return (
        <div className="flex flex-col gap-6">
            <h1 className="shelf-title">Albums</h1>
            <div className="shelf-grid">
                {albums.map((alb) => (
                    <article
                        className="vt-card"
                        key={alb.album}
                        onClick={() => {
                            const albTracks = items.filter((i) => i.album === alb.album);
                            if (albTracks.length > 0) onPlay(albTracks[0]);
                        }}
                    >
                        <div className="vt-card-cover-wrap">
                            <div className="vt-card-cover flex items-center justify-center bg-[#2A2850]">
                                <Album size={48} color="#A8A3C8" />
                            </div>
                            <button className="vt-card-play" type="button">
                                <Play fill="black" size={22} />
                            </button>
                        </div>
                        <div>
                            <h3 className="vt-card-title">{alb.album}</h3>
                            <p className="vt-card-desc">{alb.count} tracks</p>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
}

/* ==========================================================================
   History List View
   ========================================================================== */
function HistoryListView({ currentTrack, historyItems, isPlaying, likedIds, onAddToPlaylist, onAddToQueue, onLike, onPlay, playlists }) {
    const mediaList = useMemo(() => historyItems.map((h) => h.media_item).filter(Boolean), [historyItems]);

    return (
        <div className="flex flex-col gap-6">
            <h1 className="shelf-title">Listening History</h1>
            <TrackTable
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                items={mediaList}
                likedIds={likedIds}
                onAddToPlaylist={onAddToPlaylist}
                onAddToQueue={onAddToQueue}
                onLike={onLike}
                onPlay={onPlay}
                playlists={playlists}
            />
        </div>
    );
}

/* ==========================================================================
   Online Discovery View
   ========================================================================== */
function YoutubeStudioView({ isAdmin, loading, notice, onImport, onPlay, onSearch, results, user }) {
    const [searchTerm, setSearchTerm] = useState('Coldplay');

    useEffect(() => {
        if (!results || results.length === 0) {
            onSearch('Coldplay');
        }
    }, []);

    return (
        <div className="flex flex-col gap-6">
            <div className="vt-hero online-gradient">
                <div className="vt-hero-cover" style={{ background: '#7C3AED', color: 'white' }}>
                    <Compass size={72} />
                </div>
                <div className="vt-hero-details">
                    <span className="vt-hero-type">Online Discovery</span>
                    <h1 className="vt-hero-title">Online Streaming</h1>
                    <p style={{ margin: 0, color: '#A8A3C8', fontSize: 14 }}>
                        Search any song online and stream directly in Ventune.
                    </p>
                </div>
            </div>

            {/* Search Bar */}
            <form
                className="flex gap-3 max-w-xl"
                onSubmit={(e) => {
                    e.preventDefault();
                    onSearch(searchTerm);
                }}
            >
                <input
                    className="vt-input"
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search songs or artists (e.g. Queen, Billie Eilish)"
                    value={searchTerm}
                />
                <button className="pill-action-btn green-accent" disabled={loading} type="submit">
                    <Search size={16} />
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </form>

            {notice && <p style={{ color: '#7C3AED', fontSize: 14 }}>{notice}</p>}

            {/* Results Grid */}
            <div className="shelf-grid">
                {results.map((result) => (
                    <article className="vt-card" key={result.id || result.url}>
                        <div className="vt-card-cover-wrap">
                            {result.thumbnail_url ? (
                                <img alt="" className="vt-card-cover" src={result.thumbnail_url} />
                            ) : (
                                <div className="vt-card-cover flex items-center justify-center bg-[#2A2850]">
                                    <Music2 size={36} color="#A8A3C8" />
                                </div>
                            )}
                            <button
                                className="vt-card-play"
                                onClick={() => onPlay(result)}
                                type="button"
                            >
                                <Play fill="black" size={22} />
                            </button>
                        </div>
                        <div>
                            <h3 className="vt-card-title" title={result.title}>{result.title}</h3>
                            <p className="vt-card-desc">{result.uploader || 'Unknown Artist'}</p>
                            <div className="flex items-center justify-between mt-3">
                                <span className="badge-tag online">Online</span>
                                {isAdmin && (
                                    <button
                                        onClick={() => onImport(result)}
                                        style={{ fontSize: 11, color: '#7C3AED', fontWeight: 700 }}
                                        type="button"
                                    >
                                        + Import
                                    </button>
                                )}
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
}

/* ==========================================================================
   Upload Studio View (Creator / Admin)
   ========================================================================== */
function UploadStudioView({ isAdmin, onUploadSuccess, user }) {
    const [uploading, setUploading] = useState(false);
    const [notice, setNotice] = useState('');

    if (!user || !isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center p-16 text-[#A8A3C8]">
                <ShieldCheck size={48} style={{ marginBottom: 12, color: '#7C3AED' }} />
                <h2 style={{ fontSize: 24, color: '#fff', fontWeight: 800 }}>Admin Access Required</h2>
                <p>Only verified administrators can upload local media files to the public library.</p>
            </div>
        );
    }

    async function handleUpload(e) {
        e.preventDefault();
        setUploading(true);
        setNotice('');

        const token = localStorage.getItem('ms_player_token');
        const formData = new FormData(e.currentTarget);

        try {
            const res = await fetch('/api/media', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message ?? 'Upload failed.');
            }

            setNotice('Track uploaded successfully!');
            e.currentTarget.reset();
            onUploadSuccess?.();
        } catch (err) {
            setNotice(err.message);
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="flex flex-col gap-6 max-w-xl">
            <h1 className="shelf-title">Creator Upload Studio</h1>
            <p style={{ color: '#A8A3C8', fontSize: 14 }}>
                Upload original songs or music videos with artwork to add to the Ventune library.
            </p>

            {notice && (
                <div style={{ background: '#7C3AED', color: '#000', padding: '10px 16px', borderRadius: 4, fontWeight: 700 }}>
                    {notice}
                </div>
            )}

            <form className="flex flex-col gap-4" onSubmit={handleUpload}>
                <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#A8A3C8', marginBottom: 6 }}>
                        Track Title *
                    </label>
                    <input className="vt-input" name="title" placeholder="Song or video title" required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#A8A3C8', marginBottom: 6 }}>
                            Artist
                        </label>
                        <input className="vt-input" name="artist" placeholder="Artist name" />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#A8A3C8', marginBottom: 6 }}>
                            Album
                        </label>
                        <input className="vt-input" name="album" placeholder="Album or EP" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#A8A3C8', marginBottom: 6 }}>
                            Genre
                        </label>
                        <input className="vt-input" name="genre" placeholder="Pop, Rock, Indie..." />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#A8A3C8', marginBottom: 6 }}>
                            Duration (seconds)
                        </label>
                        <input className="vt-input" name="duration_seconds" placeholder="Optional" type="number" />
                    </div>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#A8A3C8', marginBottom: 6 }}>
                        Media File (Audio/Video) *
                    </label>
                    <input
                        accept="audio/*,video/*"
                        className="vt-input"
                        name="media"
                        required
                        style={{ paddingTop: 10 }}
                        type="file"
                    />
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#A8A3C8', marginBottom: 6 }}>
                        Cover Image (Optional)
                    </label>
                    <input
                        accept="image/*"
                        className="vt-input"
                        name="cover"
                        style={{ paddingTop: 10 }}
                        type="file"
                    />
                </div>

                <button className="vt-btn-accent" disabled={uploading} type="submit">
                    {uploading ? 'Uploading...' : 'Publish to Library'}
                </button>
            </form>
        </div>
    );
}

/* ==========================================================================
   Ventune Queue Drawer
   ========================================================================== */
function QueueDrawer({
    autoQueue,
    current,
    isAutoplay,
    isOpen,
    onAddToQueue,
    onClearQueue,
    onClose,
    onPlay,
    onRemoveFromQueue,
    onToggleAutoplay,
    queue,
}) {
    if (!isOpen) return null;

    return (
        <aside className="queue-panel">
            <div className="queue-header">
                <div className="flex items-center gap-2">
                    <ListMusic color="#7C3AED" size={20} />
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>Play Queue</h3>
                </div>
                <button className="modal-close" onClick={onClose} style={{ position: 'static' }} type="button">
                    <X size={18} />
                </button>
            </div>

            <div className="queue-body">
                {/* Autoplay Toggle Card */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#242424]">
                    <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                            <Radio color="#7C3AED" size={14} />
                            <span>Autoplay similar songs</span>
                        </div>
                        <div className="text-xs text-[#A8A3C8]">
                            Automatically queues next songs based on what was played
                        </div>
                    </div>
                    <button
                        className={`queue-toggle-wrap ${isAutoplay ? 'bg-[#7C3AED] text-black' : 'bg-[#32305A] text-[#A8A3C8]'}`}
                        onClick={onToggleAutoplay}
                        style={{ border: 'none' }}
                        type="button"
                    >
                        {isAutoplay ? 'ON' : 'OFF'}
                    </button>
                </div>

                {/* Now Playing */}
                {current && (
                    <div>
                        <div className="queue-section-title">
                            <span>Now Playing</span>
                            <span className="badge-tag standard text-[10px]">Active</span>
                        </div>
                        <div className="queue-item-card bg-[#2A2850]">
                            <img
                                alt=""
                                className="w-10 h-10 rounded object-cover flex-shrink-0"
                                src={current.cover_url || current.thumbnail_url || current.external_cover_url}
                            />
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-bold text-[#7C3AED] truncate">{current.title}</div>
                                <div className="text-xs text-[#A8A3C8] truncate">{current.artist}</div>
                            </div>
                            <Sparkles color="#7C3AED" size={16} />
                        </div>
                    </div>
                )}

                {/* Next in Queue */}
                <div>
                    <div className="queue-section-title">
                        <span>Next in Queue ({queue.length})</span>
                        {queue.length > 0 && (
                            <button
                                className="text-xs text-[#A8A3C8] hover:text-white"
                                onClick={onClearQueue}
                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                                type="button"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    {queue.length > 0 ? (
                        <div className="flex flex-col gap-1">
                            {queue.map((item, idx) => (
                                <div className="queue-item-card" key={`${item.id}-${idx}`}>
                                    <span className="text-xs text-[#A8A3C8] w-4">{idx + 1}</span>
                                    <img
                                        alt=""
                                        className="w-9 h-9 rounded object-cover flex-shrink-0"
                                        src={item.cover_url || item.thumbnail_url || item.external_cover_url}
                                    />
                                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onPlay(item)}>
                                        <div className="text-xs font-semibold text-white truncate hover:underline">
                                            {item.title}
                                        </div>
                                        <div className="text-[11px] text-[#A8A3C8] truncate">{item.artist}</div>
                                    </div>
                                    <button
                                        className="track-row-btn"
                                        onClick={() => onRemoveFromQueue(idx)}
                                        title="Remove from queue"
                                        type="button"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-[#727272] my-1">
                            Queue is empty. Add songs with the queue button, or let Autoplay play similar tracks.
                        </p>
                    )}
                </div>

                {/* Autoplay / Recommended Up Next */}
                {isAutoplay && (
                    <div>
                        <div className="queue-section-title">
                            <span>Autoplay • Similar to {current?.artist || 'this song'}</span>
                            <Sparkles color="#7C3AED" size={14} />
                        </div>
                        <div className="flex flex-col gap-1">
                            {autoQueue.map((item, idx) => (
                                <div className="queue-item-card" key={`auto-${item.id || item.url}-${idx}`}>
                                    <img
                                        alt=""
                                        className="w-9 h-9 rounded object-cover flex-shrink-0"
                                        src={item.cover_url || item.thumbnail_url || item.external_cover_url}
                                    />
                                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onPlay(item)}>
                                        <div className="text-xs font-semibold text-white truncate hover:underline">
                                            {item.title}
                                        </div>
                                        <div className="text-[11px] text-[#A8A3C8] truncate">{item.artist}</div>
                                    </div>
                                    <button
                                        className="track-row-btn"
                                        onClick={() => onAddToQueue(item)}
                                        title="Add to queue"
                                        type="button"
                                    >
                                        <ListPlus size={15} />
                                    </button>
                                </div>
                            ))}
                            {autoQueue.length === 0 && (
                                <p className="text-xs text-[#727272]">Discovering similar songs...</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Ventune Error Boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 32, background: '#09090D', color: '#fff', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
                    <h2 style={{ color: '#F87171', fontSize: 24, marginBottom: 12 }}>Ventune Playback Notice</h2>
                    <p style={{ color: '#A8A3C8', marginBottom: 16 }}>An unexpected error occurred while loading:</p>
                    <pre style={{ background: '#1E1B32', padding: 16, borderRadius: 8, color: '#A78BFA', overflowX: 'auto' }}>
                        {String(this.state.error?.stack || this.state.error)}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ marginTop: 16, padding: '10px 20px', background: '#8B5CF6', color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600 }}
                        type="button"
                    >
                        Reload Application
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// React Mounting
const rootEl = document.getElementById('root');
if (rootEl) {
    createRoot(rootEl).render(
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    );
}
