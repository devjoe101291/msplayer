<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('likes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('media_item_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'media_item_id']);
        });

        Schema::create('playback_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('media_item_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('play_count')->default(1);
            $table->timestamp('last_played_at');
            $table->timestamps();

            $table->unique(['user_id', 'media_item_id']);
        });

        Schema::create('playlists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('is_public')->default(false);
            $table->timestamps();
        });

        Schema::create('playlist_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('playlist_id')->constrained()->cascadeOnDelete();
            $table->foreignId('media_item_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->unique(['playlist_id', 'media_item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('playlist_items');
        Schema::dropIfExists('playlists');
        Schema::dropIfExists('playback_histories');
        Schema::dropIfExists('likes');
    }
};
