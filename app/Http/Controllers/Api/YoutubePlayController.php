<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\NewPipeClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class YoutubePlayController extends Controller
{
    public function play(Request $request, NewPipeClient $client): JsonResponse
    {


        $validated = $request->validate([
            'url' => ['required', 'url', 'max:500'],
            'stream_mode' => ['nullable', 'string', 'in:audio,video,best'],
            'title' => ['nullable', 'string', 'max:255'],
            'artist' => ['nullable', 'string', 'max:255'],
            'thumbnail_url' => ['nullable', 'url', 'max:1000'],
            'duration_seconds' => ['nullable', 'integer', 'min:0'],
        ]);

        $videoId = $this->extractVideoId($validated['url']);
        $details = null;

        try {
            $details = $client->details($validated['url']);
        } catch (RuntimeException $e) {
            // NewPipe stream extraction failed (e.g. YouTube bot check on datacenter IP).
            // Fallback gracefully so the client can play the video via YouTube player without error.
            return response()->json([
                'data' => [
                    'title' => $validated['title'] ?? 'YouTube Track',
                    'artist' => $validated['artist'] ?? 'YouTube',
                    'stream_url' => null,
                    'stream_type' => 'youtube',
                    'youtube_id' => $videoId,
                    'audio_stream_url' => null,
                    'video_stream_url' => null,
                    'audio_mime_type' => null,
                    'video_mime_type' => null,
                    'thumbnail_url' => $validated['thumbnail_url'] ?? ($videoId ? "https://i.ytimg.com/vi/{$videoId}/hqdefault.jpg" : null),
                    'duration_seconds' => $validated['duration_seconds'] ?? null,
                    'source_url' => $validated['url'],
                    'is_fallback' => true,
                ]
            ]);
        }

        $streamMode = $validated['stream_mode'] ?? 'best';

        // NewPipeClient may return either:
        //  - a full audio+video result (with *_stream_url fields)
        //  - or only a single best stream (stream_type/stream_url)
        //
        // For the A/V toggle UI to work reliably, we return:
        //  - the specific stream URL requested when available
        //  - plus the other one as a best-effort fallback to the single stream
        //    so that the UI can switch even when only one stream was returned.

        $mimeType = $details['mime_type'] ?? null;

        $audioStreamUrl = $details['audio_stream_url'] ?? null;
        $videoStreamUrl = $details['video_stream_url'] ?? null;
        $audioMimeType = $details['audio_mime_type'] ?? null;
        $videoMimeType = $details['video_mime_type'] ?? null;

        $streamType = $details['stream_type'] ?? null;
        $streamUrl = $details['stream_url'] ?? null;
        $singleStreamType = in_array($streamType, ['audio', 'video'], true) ? $streamType : 'audio';

        // If we only got a single stream, map it into both fields as fallbacks.
        if (!$audioStreamUrl && !$videoStreamUrl && $streamUrl) {
            if ($singleStreamType === 'video') {
                $videoStreamUrl = $streamUrl;
                $videoMimeType = $mimeType;

                // best-effort fallback so toggle can still switch
                $audioStreamUrl = $streamUrl;
                $audioMimeType = $mimeType;
            } else {
                $audioStreamUrl = $streamUrl;
                $audioMimeType = $mimeType;

                // best-effort fallback so toggle can still switch
                $videoStreamUrl = $streamUrl;
                $videoMimeType = $mimeType;
            }
        }

        // Resolve legacy fields based on requested mode, with fallback.
        if ($streamMode === 'audio') {
            $resolvedStreamType = 'audio';
            $resolvedStreamUrl = $audioStreamUrl ?? $streamUrl;
            $resolvedMimeType = $audioMimeType ?? ($mimeType ?? 'audio/mp4');
        } elseif ($streamMode === 'video') {
            $resolvedStreamType = 'video';
            $resolvedStreamUrl = $videoStreamUrl ?? $streamUrl;
            $resolvedMimeType = $videoMimeType ?? ($mimeType ?? 'video/mp4');
        } else {
            $resolvedStreamType = $singleStreamType;
            $resolvedStreamUrl = $streamUrl;
            $resolvedMimeType = $mimeType ?? ($singleStreamType === 'video' ? 'video/mp4' : 'audio/mp4');
        }

        return response()->json([
            'data' => [
                'title' => $details['title'] ?? 'YouTube',
                'artist' => $details['uploader'] ?? 'YouTube',

                // Keep legacy fields for existing player.
                'stream_url' => $resolvedStreamUrl,
                'stream_type' => $resolvedStreamType,
                'mime_type' => $resolvedMimeType,

                // New fields for A/V toggle UI.
                'audio_stream_url' => $audioStreamUrl,
                'video_stream_url' => $videoStreamUrl,
                'audio_mime_type' => $audioMimeType,
                'video_mime_type' => $videoMimeType,

                'thumbnail_url' => $details['thumbnail_url'] ?? null,
                'duration_seconds' => $details['duration_seconds'] ?? null,
                'source_url' => $details['url'] ?? $validated['url'],
                'youtube_id' => $videoId,
            ]
        ]);
    }

    private function extractVideoId(string $url): ?string
    {
        if (preg_match('/(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/|\/v\/)([^&#?]+)/', $url, $matches)) {
            return $matches[1];
        }
        return null;
    }
}


