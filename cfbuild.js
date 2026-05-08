// TikTok CF Worker - 视频解析接口
// short link → video download URL / JSON metadata
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const UA =
  "Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36";

const FETCH_HEADERS = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Accept-Encoding": "identity",
};

async function fetchHtml(url) {
  const resp = await fetch(url, { headers: FETCH_HEADERS, redirect: "follow" });
  return { html: await resp.text(), finalUrl: resp.url };
}

function formatDate(ts) {
  const d = new Date(parseInt(ts) * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function getVideoData(inputUrl) {
  let resolved = inputUrl;
  if (inputUrl.includes("vt.tiktok.com") || inputUrl.includes("vm.tiktok.com")) {
    const r = await fetch(inputUrl, {
      headers: { "User-Agent": UA },
      redirect: "follow",
    });
    resolved = r.url;
  }

  const { html } = await fetchHtml(resolved);

  const rehydrateMatch = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>\s*(\{.*?\})\s*<\/script>/s
  );
  if (!rehydrateMatch) throw new Error("无法找到视频数据");

  const universal = JSON.parse(rehydrateMatch[1]);
  const detail = universal.__DEFAULT_SCOPE__?.["webapp.reflow.video.detail"];
  if (!detail || detail.statusCode !== 0) throw new Error("视频数据状态异常");

  const item = detail.itemInfo.itemStruct;

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
    video: item.video
      ? {
          duration: item.video.duration,
          download_addr: item.video.downloadAddr || null,
          play_addr: item.video.playAddr || null,
        }
      : null,
    music: item.music
      ? {
          title: item.music.title || null,
          play_url: item.music.playUrl || null,
        }
      : null,
    type: item.video ? "video" : "image",
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

  try {
    const data = await getVideoData(inputUrl);

    if (returnData) {
      return new Response(JSON.stringify(data, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // 默认返回下载直链
    if (data.type === "video" && data.video?.download_addr) {
      return new Response(data.video.download_addr, { headers: corsHeaders });
    }

    return new Response("无法获取直链", { headers: corsHeaders, status: 500 });
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