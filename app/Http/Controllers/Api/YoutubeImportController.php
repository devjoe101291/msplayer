<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaItem;
use App\Services\NewPipeClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class YoutubeImportController extends Controller
{
    public function search(Request $request, NewPipeClient $client): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:160'],
        ]);


        try {
            return response()->json(['data' => $client->search($validated['q'])]);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage(), 'data' => []], 503);
        }
    }

    public function import(Request $request, NewPipeClient $client): JsonResponse
    {
        $validated = $request->validate([

            'url' => ['required', 'url', 'max:500'],
            'title' => ['nullable', 'string', 'max:180'],
            'artist' => ['nullable', 'string', 'max:140'],
            'thumbnail_url' => ['nullable', 'url', 'max:1000'],
            'duration_seconds' => ['nullable', 'integer', 'min:1', 'max:86400'],
        ]);

        $details = [];

        try {
            $details = $client->details($validated['url']);
        } catch (RuntimeException) {
            // Search result metadata is enough to create a catalog reference.
        }

        $sourceId = $details['id'] ?? md5($validated['url']);
        $streamUrl = $details['stream_url'] ?? null;
        $streamUrl = is_string($streamUrl) && $streamUrl !== '' ? $streamUrl : null;
        $streamType = in_array($details['stream_type'] ?? null, ['audio', 'video'], true)
            ? $details['stream_type']
            : 'audio';

        $item = MediaItem::updateOrCreate(
            ['source' => 'youtube', 'source_id' => $sourceId],
            [
                'title' => $details['title'] ?? $validated['title'] ?? 'YouTube Import',
                'artist' => $details['uploader'] ?? $validated['artist'] ?? 'YouTube',
                'album' => 'YouTube Imports',
                'genre' => 'Imported',
                'description' => $details['description'] ?? null,
                'type' => $streamType,
                'media_path' => 'youtube:'.$sourceId,
                'thumbnail_path' => null,
                'cover_path' => null,
                'external_cover_url' => $details['thumbnail_url'] ?? $validated['thumbnail_url'] ?? null,
                'source_url' => $validated['url'],
                'external_stream_url' => $streamUrl,
                'mime_type' => $details['mime_type'] ?? ($streamType === 'audio' ? 'audio/mp4' : 'video/mp4'),
                'size' => 0,
                'duration_seconds' => $details['duration_seconds'] ?? $validated['duration_seconds'] ?? null,
                'waveform' => null,
                'processing_status' => $streamUrl ? 'ready' : 'reference',
            ]
        );

        return response()->json(['data' => $item], 201);
    }
}
