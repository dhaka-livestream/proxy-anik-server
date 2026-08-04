// ============================================================
//  সর্বজনীন মিডিয়া প্রোক্সি (HLS / DASH / TS) - আপডেটেড ভার্সন
//  Cloudflare Workers-এর জন্য
// ============================================================

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    // ১. 'url' প্যারামিটার ছাড়া রিকোয়েস্ট বাতিল
    if (!targetUrl) {
      return new Response('Missing "url" parameter', { status: 400 });
    }

    // ২. টার্গেট URL থেকে কন্টেন্ট ফেচ করা (HTTP ও HTTPS দুই-ই সাপোর্ট করবে)
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': new URL(targetUrl).origin,
        'Referer': targetUrl,
      }
    });

    // ৩. কন্টেন্টের ধরণ (MIME Type) বের করা
    const contentType = response.headers.get('Content-Type') || '';
    const isM3U8 = contentType.includes('mpegurl') || targetUrl.includes('.m3u8');
    const isMPD  = contentType.includes('dash') || targetUrl.includes('.mpd');
    const isTS   = contentType.includes('video/MP2T') || targetUrl.includes('.ts');

    // ৪. যদি এটি প্লেলিস্ট (M3U8 বা MPD) হয়, তাহলে তার ভেতরের লিংকগুলো পুনর্লিখন করবো
    if (isM3U8 || isMPD) {
      let content = await response.text();

      // প্রোক্সি বেস URL তৈরি করা (যে URL দিয়ে পরবর্তী রিকোয়েস্ট গুলো পাঠানো হবে)
      const proxyBase = url.protocol + '//' + url.host + url.pathname + '?url=';

      // ক) সম্পূর্ণ URL (http/https) যুক্ত লিংক খুঁজে প্রোক্সি করা
      content = content.replace(/(https?:\/\/[^\s<>"']+\.(?:ts|m3u8|mpd|key))/gi, (match) => {
        return proxyBase + encodeURIComponent(match);
      });

      // খ) আপেক্ষিক (relative) পাথ যুক্ত লিংক খুঁজে প্রোক্সি করা
      const baseUrl = new URL(targetUrl);
      content = content.replace(/(?<=["'\s]|^)([^"'\s<>]+\.(?:ts|m3u8|mpd|key))(?=["'\s]|$)/gi, (match) => {
        try {
          const absoluteUrl = new URL(match, baseUrl).href;
          return proxyBase + encodeURIComponent(absoluteUrl);
        } catch (e) {
          return match; // যদি কনভার্ট না হয়, তাহলে অপরিবর্তিত রাখুন
        }
      });

      // গ) শুধু ফাইলনাম (যেমন: "segment_001.ts") যুক্ত লিংক খুঁজে প্রোক্সি করা
      content = content.replace(/(?<=["'\s]|^)([a-zA-Z0-9_\-]+\.(?:ts|m3u8|mpd|key))(?=["'\s]|$)/gi, (match) => {
        const absoluteUrl = new URL(match, baseUrl).href;
        return proxyBase + encodeURIComponent(absoluteUrl);
      });

      // প্লেলিস্টের কন্টেন্ট টাইপ সেট করা
      const finalContentType = isM3U8 ? 'application/vnd.apple.mpegurl' : 'application/dash+xml';

      return new Response(content, {
        headers: {
          'Content-Type': finalContentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }

    // ৫. যদি এটি সরাসরি .ts বা অন্য কোনো মিডিয়া সেগমেন্ট হয়
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', '*');
    newHeaders.set('Cache-Control', 'public, max-age=86400');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
};
