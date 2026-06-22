<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Like;
use App\Models\MediaItem;
use App\Models\PlaybackHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LibraryController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'liked_ids' => Like::where('user_id', $user->id)->pluck('media_item_id'),
            'history' => PlaybackHistory::with('mediaItem')
                ->where('user_id', $user->id)
                ->latest('last_played_at')
                ->limit(24)
                ->get(),
        ]);
    }

    public function toggleLike(Request $request, MediaItem $mediaItem): JsonResponse
    {
        $user = $request->user();
        $like = Like::where('user_id', $user->id)
            ->where('media_item_id', $mediaItem->id)
            ->first();

        if ($like) {
            $like->delete();

            return response()->json(['liked' => false]);
        }

        Like::create([
            'user_id' => $user->id,
            'media_item_id' => $mediaItem->id,
        ]);

        return response()->json(['liked' => true]);
    }

    public function liked(Request $request): JsonResponse
    {
        $items = MediaItem::query()
            ->whereIn('id', Like::where('user_id', $request->user()->id)->select('media_item_id'))
            ->latest()
            ->get();

        return response()->json(['data' => $items]);
    }

    public function recordPlay(Request $request, MediaItem $mediaItem): JsonResponse
    {
        $history = PlaybackHistory::firstOrNew([
            'user_id' => $request->user()->id,
            'media_item_id' => $mediaItem->id,
        ]);

        $history->play_count = $history->exists ? $history->play_count + 1 : 1;
        $history->last_played_at = now();
        $history->save();

        return response()->json(['data' => $history]);
    }

    public function history(Request $request): JsonResponse
    {
        return response()->json([
            'data' => PlaybackHistory::with('mediaItem')
                ->where('user_id', $request->user()->id)
                ->latest('last_played_at')
                ->limit(50)
                ->get(),
        ]);
    }
}
