export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/account/sites/") || ["/account/profile/","/forgot/","/reset/","/signin/","/signup/","/recover/","/signout/","/account/recovery/","/account/","/account/publish/"].includes(url.pathname) || /^\/(?:api|members|creators)(?:\/|$)/.test(url.pathname)) {
      return memberApp.fetch(request, env, context);
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method not allowed', {status: 405, headers: {Allow: 'GET, HEAD'}});
    }
    let path = url.pathname;
    if (path.endsWith('/')) {
      path += 'index.html';
    } else if (Object.hasOwn(assets, path + '/index.html')) {
      url.pathname += '/';
      return Response.redirect(url.toString(), 301);
    }
    if (!Object.hasOwn(assets, path)) {
      return new Response('File not found', {status: 404});
    }
    const [type, hash, encoded] = assets[path];
    const etag = '"' + hash + '"';
    const headers = {'Content-Type': type, ETag: etag, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff'};
    if (request.headers.get('If-None-Match') === etag) return new Response(null, {status: 304, headers});
    if (request.method === 'HEAD') return new Response(null, {headers});
    const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    return new Response(bytes, {headers});
  }
};
