// TikTok CF Worker - 视频解析 + 代理下载
// 关键：TikTok CDN 签名校验需要匹配 session cookie
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range",
  "Access-Control-Expose-Headers": "Content-Length, Content-Type, Content-Disposition",
};

const UA =
  "Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36";

function parseCookies(headers) {
  const cookies = {};
  const setCookie = headers.get("set-cookie");
  if (!setCookie) return cookies;
  // CF Workers 合并多个 Set-Cookie 用逗号分隔
  // 简单解析：匹配 name=value 对
  const parts = setCookie.split(",");
  for (const part of parts) {
    const match = part.match(/^\s*([^=;]+)=([^;]*)/);
    if (match) cookies[match[1].trim()] = match[2].trim();
  }
  return cookies;
}

function cookieString(cookies) {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function formatDate(ts) {
  const d = new Date(parseInt(ts) * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function getVideoData(inputUrl) {
  // 1. 先访问首页，建立 session cookie
  const homeResp = await fetch("https://www.tiktok.com/", {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });
  const cookies = parseCookies(homeResp.headers);

  const cookieStr = cookieString(cookies);
  const fetchHeaders = {
    "User-Agent": UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "identity",
    Cookie: cookieStr,
  };

  // 2. 短链重定向
  let resolved = inputUrl;
  if (inputUrl.includes("vt.tiktok.com") || inputUrl.includes("vm.tiktok.com")) {
    const r = await fetch(inputUrl, {
      headers: { "User-Agent": UA, Cookie: cookieStr },
      redirect: "follow",
    });
    resolved = r.url;
  }

  // 3. 抓取视频页面
  const pageResp = await fetch(resolved, { headers: fetchHeaders, redirect: "follow" });
  const html = await pageResp.text();

  // 4. 提取数据
  const rehydrateMatch = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>\s*(\{.*?\})\s*<\/script>/s
  );
  if (!rehydrateMatch) throw new Error("无法找到视频数据");

  const universal = JSON.parse(rehydrateMatch[1]);
  const scope = universal.__DEFAULT_SCOPE__ || {};
  // 短链 reflow 页用 reflow.video.detail；普通详情页用 video-detail，兜底兼容
  const detail =
    scope["webapp.reflow.video.detail"] || scope["webapp.video-detail"];
  if (!detail || detail.statusCode !== 0) throw new Error("视频数据状态异常");

  const item = detail.itemInfo.itemStruct;

  // 图片帖子（photo / slideshow）：
  //  web rehydration 用 camelCase：imagePost.images[].imageURL.urlList[]
  //  API/aweme 风格用 snake_case：image_post_info.images[].thumbnail.url_list[] / display_image
  const pickImg = (img) =>
    img?.imageURL?.urlList?.[0] ||
    img?.urlList?.[0] ||
    img?.displayImage?.urlList?.[0] ||
    img?.display_image?.url_list?.[0] ||
    img?.thumbnail?.url_list?.[0] ||
    img?.url_list?.[0] ||
    null;
  const images = (
    (item.imagePost?.images || item.image_post_info?.images || [])
      .map(pickImg)
      .filter(Boolean)
  );
  const isImage = images.length > 0;

  return {
    source_url: inputUrl,
    resolved_url: resolved,
    desc: item.desc || null,
    create_time: item.createTime ? formatDate(item.createTime) : null,
    author: {
      unique_id: item.author?.uniqueId || null,
      nickname: item.author?.nickname || null,
    },
    statistics: {
      digg_count: item.stats?.diggCount ?? 0,
      play_count: item.stats?.playCount ?? 0,
      comment_count: item.stats?.commentCount ?? 0,
      share_count: item.stats?.shareCount ?? 0,
    },
    video:
      !isImage && item.video
        ? {
            duration: item.video.duration,
            download_addr: item.video.downloadAddr || null,
            play_addr: item.video.playAddr || null,
          }
        : null,
    // 图片帖子：所有图片直链 + 标题
    images: isImage ? images : null,
    image_title: isImage ? item.imagePost?.title || null : null,
    music: item.music
      ? {
          title: item.music.title || null,
          play_url: item.music.playUrl || null,
        }
      : null,
    type: isImage ? "image" : item.video ? "video" : "unknown",
    _cookies: cookies, // 传递给下载用
  };
}

async function handler(req) {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });

  const url = new URL(req.url);

  if (!url.searchParams.has("url")) {
    return new Response(
      JSON.stringify(
        {
          error: "请提供 url 参数",
          usage: "?url=TikTok链接",
          examples: [
            "?url=https://vt.tiktok.com/xxx",
            "?url=https://vt.tiktok.com/xxx&data",
            "?url=https://vt.tiktok.com/xxx&raw",
          ],
        },
        null,
        2
      ),
      { headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } }
    );
  }

  const inputUrl = url.searchParams.get("url");
  const returnData = url.searchParams.has("data");
  const returnRaw = url.searchParams.has("raw");
  // 图片帖子下载指定第几张（1 起）；缺省 1
  const imgIndex = parseInt(url.searchParams.get("i") || "1", 10);

  try {
    const data = await getVideoData(inputUrl);

    // JSON 模式
    if (returnData) {
      const { _cookies, ...safe } = data;
      return new Response(JSON.stringify(safe, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // raw 模式：返回原始直链
    if (returnRaw) {
      if (data.type === "video" && data.video?.download_addr) {
        return new Response(data.video.download_addr, { headers: corsHeaders });
      }
      // 图片帖子：每行一个图片直链
      if (data.type === "image" && data.images?.length) {
        return new Response(data.images.join("\n"), {
          headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      return new Response("无法获取直链", { headers: corsHeaders, status: 500 });
    }

    // 默认：CF 代理下载
    if (data.type === "video" && data.video?.download_addr) {
      const cookieStr = cookieString(data._cookies);
      const videoHeaders = {
        "User-Agent": UA,
        Referer: "https://www.tiktok.com/",
        Cookie: cookieStr,
      };
      // Only pass Range if actually provided
      const rangeHeader = req.headers.get("Range");
      if (rangeHeader) videoHeaders["Range"] = rangeHeader;

      const videoResp = await fetch(data.video.download_addr, {
        headers: videoHeaders,
        redirect: "follow",
      });
      if (!videoResp.ok) throw new Error(`TikTok CDN 返回 ${videoResp.status}`);

      return new Response(videoResp.body, {
        status: videoResp.status,
        headers: {
          ...corsHeaders,
          "Content-Type": videoResp.headers.get("Content-Type") || "video/mp4",
          "Content-Length": videoResp.headers.get("Content-Length") || "",
          "Content-Disposition": `attachment; filename="tiktok_${data.author?.unique_id || "video"}.mp4"`,
          "Accept-Ranges": "bytes",
        },
      });
    }

    // 默认：图片帖子 CF 代理下载（?i=N 指定第几张，1 起；缺省第 1 张）
    if (data.type === "image" && data.images?.length) {
      const idx = Number.isFinite(imgIndex) && imgIndex >= 1 ? imgIndex : 1;
      const imgUrl = data.images[idx - 1];
      if (!imgUrl) {
        return new Response(
          `图片序号超出范围（共 ${data.images.length} 张）`,
          { headers: corsHeaders, status: 400 }
        );
      }
      const cookieStr = cookieString(data._cookies);
      const imgResp = await fetch(imgUrl, {
        headers: {
          "User-Agent": UA,
          Referer: "https://www.tiktok.com/",
          Cookie: cookieStr,
        },
        redirect: "follow",
      });
      if (!imgResp.ok) throw new Error(`TikTok CDN 返回 ${imgResp.status}`);

      const ct = imgResp.headers.get("Content-Type") || "image/jpeg";
      const ext = ct.includes("png")
        ? "png"
        : ct.includes("webp")
        ? "webp"
        : ct.includes("avif")
        ? "avif"
        : "jpg";
      return new Response(imgResp.body, {
        status: imgResp.status,
        headers: {
          ...corsHeaders,
          "Content-Type": ct,
          "Content-Length": imgResp.headers.get("Content-Length") || "",
          "Content-Disposition": `attachment; filename="tiktok_${data.author?.unique_id || "image"}_${idx}.${ext}"`,
        },
      });
    }

    return new Response("无法获取视频", { headers: corsHeaders, status: 500 });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }, null, 2),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
        status: 500,
      }
    );
  }
}

export default { fetch: handler };