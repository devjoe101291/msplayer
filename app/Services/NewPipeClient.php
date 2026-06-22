<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Http\Client\ConnectionException;
use RuntimeException;

class NewPipeClient
{
    public function search(string $query): array
    {
        $baseUrl = config('services.newpipe.url');

        if (! $baseUrl) {
            throw new RuntimeException('NewPipe service URL is not configured.');
        }

        try {
            $response = Http::timeout(20)->get(rtrim($baseUrl, '/').'/search', [
                'q' => $query,
            ]);
        } catch (ConnectionException $exception) {
            throw new RuntimeException('NewPipe service is not reachable.', previous: $exception);
        }

        if (! $response->ok()) {
            throw new RuntimeException('NewPipe service did not return search results.');
        }

        return $response->json('results', []);
    }

    public function details(string $url): array
    {
        $baseUrl = config('services.newpipe.url');

        if (! $baseUrl) {
            throw new RuntimeException('NewPipe service URL is not configured.');
        }

        try {
            $response = Http::timeout(20)->get(rtrim($baseUrl, '/').'/details', [
                'url' => $url,
            ]);
        } catch (ConnectionException $exception) {
            throw new RuntimeException('NewPipe service is not reachable.', previous: $exception);
        }

        if (! $response->ok()) {
            throw new RuntimeException('NewPipe service did not return video details.');
        }

        return $response->json();
    }
}
