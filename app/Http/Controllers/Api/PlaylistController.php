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

        $validated = $request->validate([
            'media_item_id' => ['required', 'exists:media_items,id'],
        ]);

        $position = $playlist->items()->max('position') ?? 0;
        $playlist->items()->firstOrCreate(
            ['media_item_id' => $validated['media_item_id']],
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
}
