// ============================================================
//  সর্বজনীন মিডিয়া প্রোক্সি (HLS / DASH / TS)
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

    // ২. টার্গেট URL থেকে কন্টেন্ট ফেচ করা
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
      //    যেমন: "segment_001.ts" বা "../videos/playlist.m3u8"
      const baseUrl = new URL(targetUrl);
      content = content.replace(/(?<=["'\s]|^)([^"'\s<>]+\.(?:ts|m3u8|mpd|key))(?=["'\s]|$)/gi, (match) => {
        // আপেক্ষিক পাথকে সম্পূর্ণ URL-এ রূপান্তর
        const absoluteUrl = new URL(match, baseUrl).href;
        return proxyBase + encodeURIComponent(absoluteUrl);
      });

      // প্লেলিস্টের কন্টেন্ট টাইপ সেট করা
      const finalContentType = isM3U8 ? 'application/vnd.apple.mpegurl' : 'application/dash+xml';

      return new Response(content, {
        headers: {
          'Content-Type': finalContentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300' // ৫ মিনিট ক্যাশে
        }
      });
    }

    // ৫. যদি এটি সরাসরি .ts বা অন্য কোনো মিডিয়া সেগমেন্ট হয়
    //    তাহলে সেটিকে CORS হেডার যোগ করে ফেরত দেওয়া
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    // ক্যাশিং বাড়ানোর জন্য (ঐচ্ছিক)
    newHeaders.set('Cache-Control', 'public, max-age=86400'); // ১ দিন

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
};
