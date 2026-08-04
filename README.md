# Universal Media Proxy for Cloudflare Workers

This Worker proxies HLS (.m3u8), DASH (.mpd), and TS segments.

## How to use

Deploy to Cloudflare Workers and use the following URL format:

`https://your-worker.workers.dev/?url=YOUR_M3U8_OR_MPD_URL`

Example:
`https://my-proxy.workers.dev/?url=https://example.com/stream.m3u8`

## Features
- Handles both absolute and relative URLs in playlists.
- Adds CORS headers to all responses.
- Caches segments for faster playback.
- Supports .key files for encrypted streams.
