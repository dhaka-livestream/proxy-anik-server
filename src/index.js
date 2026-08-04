// ============================================================
//  অ্যাডভান্সড মিডিয়া প্রোক্সি (হেডার ও রিডিরেক্ট সহ)
// ============================================================

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Missing "url" parameter', { status: 400 });
    }

    // ১. রিডিরেক্ট ফলো করতে এবং হেডার পাঠাতে fetch-এর অপশন
    const fetchOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': new URL(targetUrl).origin,
        'Referer': targetUrl,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      redirect: 'follow' // রিডিরেক্ট ফলো করবে
    };

    // ২. টার্গেট URL থেকে কন্টেন্ট ফেচ করা
    const response = await fetch(targetUrl, fetchOptions);

    // ৩. কন্টেন্ট টাইপ চেক করা
    const contentType = response.headers.get('Content-Type') || '';
    const isM3U8 = contentType.includes('mpegurl') || targetUrl.includes('.m3u8');
    const isMPD  = contentType.includes('dash') || targetUrl.includes('.mpd');

    // ৪. প্লেলিস্ট (M3U8/MPD) প্রক্রিয়াকরণ
    if (isM3U8 || isMPD) {
      let content = await response.text();

      const proxyBase = url.protocol + '//' + url.host + url.pathname + '?url=';
      const baseUrl = new URL(targetUrl);

      // সব ধরণের লিংক রিপ্লেস করার জন্য শক্তিশালী রেগুলার এক্সপ্রেশন
      content = content.replace(/(https?:\/\/[^\s<>"']+\.(?:ts|m3u8|mpd|key|m4s))/gi, (match) => {
        return proxyBase + encodeURIComponent(match);
      });

      content = content.replace(/(?<=["'\s]|^)([^"'\s<>]+\.(?:ts|m3u8|mpd|key|m4s))(?=["'\s]|$)/gi, (match) => {
        try {
          const absoluteUrl = new URL(match, baseUrl).href;
          return proxyBase + encodeURIComponent(absoluteUrl);
        } catch (e) {
          return match;
        }
      });

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

    // ৫. অন্যান্য ফাইল (TS, M4S, ইত্যাদি) সরাসরি পাস করা
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
