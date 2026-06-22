<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaItem;
use Illuminate\Http\JsonResponse;

class DiscoveryController extends Controller
{
    public function artists(): JsonResponse
    {
        $artists = MediaItem::query()
            ->selectRaw('artist, count(*) as media_count, sum(plays) as total_plays')
            ->groupBy('artist')
            ->orderBy('artist')
            ->get()
            ->map(function ($artist) {
                $artist->items = MediaItem::where('artist', $artist->artist)->latest()->limit(6)->get();

                return $artist;
            });

        return response()->json(['data' => $artists]);
    }

    public function albums(): JsonResponse
    {
        $albums = MediaItem::query()
            ->whereNotNull('album')
            ->where('album', '!=', '')
            ->selectRaw('album, artist, count(*) as media_count, sum(plays) as total_plays')
            ->groupBy('album', 'artist')
            ->orderBy('album')
            ->get()
            ->map(function ($album) {
                $album->items = MediaItem::where('album', $album->album)
                    ->where('artist', $album->artist)
                    ->latest()
                    ->limit(8)
                    ->get();

                return $album;
            });

        return response()->json(['data' => $albums]);
    }

    public function videoTheater(MediaItem $mediaItem): JsonResponse
    {
        abort_unless($mediaItem->type === 'video', 404);

        return response()->json([
            'data' => $mediaItem,
            'related' => MediaItem::where('type', 'video')
                ->where('id', '!=', $mediaItem->id)
                ->latest()
                ->limit(8)
                ->get(),
        ]);
    }
}
