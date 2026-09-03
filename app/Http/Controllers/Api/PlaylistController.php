<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaItem;
use App\Models\Playlist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlaylistController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => Playlist::with(['items.mediaItem'])
                ->where('user_id', $request->user()->id)
                ->latest()
                ->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_public' => ['boolean'],
        ]);

        $playlist = Playlist::create([
            'user_id' => $request->user()->id,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_public' => $validated['is_public'] ?? false,
        ]);

        return response()->json(['data' => $playlist->load('items.mediaItem')], 201);
    }

    public function addItem(Request $request, Playlist $playlist): JsonResponse
    {
        abort_unless($playlist->user_id === $request->user()->id, 403);

        $mediaItemId = $request->input('media_item_id');

        if (!$mediaItemId && ($request->filled('source_url') || $request->filled('url'))) {
            $sourceUrl = $request->input('source_url') ?: $request->input('url');
            $sourceId = $request->input('source_id');
            if (!$sourceId && preg_match('/(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/|\/v\/)([^&#?]+)/', $sourceUrl, $matches)) {
                $sourceId = $matches[1];
            }
            $sourceId = $sourceId ?: md5($sourceUrl);

            $mediaItem = MediaItem::firstOrCreate(
                ['source' => 'youtube', 'source_id' => $sourceId],
                [
                    'title' => $request->input('title') ?: 'YouTube Track',
                    'artist' => $request->input('artist') ?: 'YouTube',
                    'album' => 'Online Tracks',
                    'genre' => 'Online',
                    'type' => $request->input('type', 'audio'),
                    'media_path' => 'youtube:' . $sourceId,
                    'external_cover_url' => $request->input('thumbnail_url') ?: $request->input('cover_url'),
                    'source_url' => $sourceUrl,
                    'duration_seconds' => $request->input('duration_seconds'),
                    'processing_status' => 'ready',
                ]
            );
            $mediaItemId = $mediaItem->id;
        }

        if (!$mediaItemId) {
            $validated = $request->validate([
                'media_item_id' => ['required', 'exists:media_items,id'],
            ]);
            $mediaItemId = $validated['media_item_id'];
        }

        $position = $playlist->items()->max('position') ?? 0;
        $playlist->items()->firstOrCreate(
            ['media_item_id' => $mediaItemId],
            ['position' => $position + 1]
        );

        return response()->json(['data' => $playlist->fresh('items.mediaItem')]);
    }

    public function removeItem(Request $request, Playlist $playlist, MediaItem $mediaItem): JsonResponse
    {
        abort_unless($playlist->user_id === $request->user()->id, 403);

        $playlist->items()->where('media_item_id', $mediaItem->id)->delete();

        return response()->json(['data' => $playlist->fresh('items.mediaItem')]);
    }

    public function destroy(Request $request, Playlist $playlist): JsonResponse
    {
        abort_unless($playlist->user_id === $request->user()->id, 403);

        $playlist->items()->delete();
        $playlist->delete();

        return response()->json(['message' => 'Playlist deleted successfully.']);
    }
}
