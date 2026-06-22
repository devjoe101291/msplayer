<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_items', function (Blueprint $table) {
            if (! Schema::hasColumn('media_items', 'source')) {
                $table->string('source')->default('local')->after('processing_status');
            }

            if (! Schema::hasColumn('media_items', 'source_id')) {
                $table->string('source_id')->nullable()->after('source');
            }

            if (! Schema::hasColumn('media_items', 'source_url')) {
                $table->text('source_url')->nullable()->after('source_id');
            }

            if (! Schema::hasColumn('media_items', 'external_stream_url')) {
                $table->text('external_stream_url')->nullable()->after('source_url');
            }

            if (! Schema::hasColumn('media_items', 'external_cover_url')) {
                $table->text('external_cover_url')->nullable()->after('external_stream_url');
            }
        });
    }

    public function down(): void
    {
        Schema::table('media_items', function (Blueprint $table) {
            $columns = array_filter([
                Schema::hasColumn('media_items', 'source') ? 'source' : null,
                Schema::hasColumn('media_items', 'source_id') ? 'source_id' : null,
                Schema::hasColumn('media_items', 'source_url') ? 'source_url' : null,
                Schema::hasColumn('media_items', 'external_stream_url') ? 'external_stream_url' : null,
                Schema::hasColumn('media_items', 'external_cover_url') ? 'external_cover_url' : null,
            ]);

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
