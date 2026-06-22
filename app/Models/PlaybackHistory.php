<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlaybackHistory extends Model
{
    protected $fillable = ['user_id', 'media_item_id', 'play_count', 'last_played_at'];

    protected $casts = [
        'last_played_at' => 'datetime',
        'play_count' => 'integer',
    ];

    public function mediaItem(): BelongsTo
    {
        return $this->belongsTo(MediaItem::class);
    }
}
