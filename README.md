# TikTok CF Worker

可部署到 Cloudflare Workers 的 TikTok 视频解析 + 代理下载接口。

## 功能
- 输入 TikTok 短链/长链
- **默认：CF 代理下载视频**（绕过 GFW）
- `?data` 返回 JSON 元数据
- `?raw` 返回原始直链 URL

## 接口

```bash
# 1) 代理下载（默认）- 浏览器直接打开即可下载
curl -O "https://tk.0d000721.cv/?url=https://vt.tiktok.com/xxx/"

# 2) JSON 元数据
curl "https://tk.0d000721.cv/?url=https://vt.tiktok.com/xxx/&data"

# 3) 原始直链
curl "https://tk.0d000721.cv/?url=https://vt.tiktok.com/xxx/&raw"
```

## 部署
```bash
npm i -g wrangler
wrangler deploy
```

## 配置
见 `wrangler.toml`。

## 原理
1. 访问 TikTok 首页建立 session cookie
2. 用该 cookie 解析短链 → 提取 `__UNIVERSAL_DATA_FOR_REHYDRATION__` JSON
3. 用同一 cookie 代理请求 `downloadAddr`，流式返回视频

> 核心突破：TikTok CDN（Akamai）的签名校验绑定了 session cookie（`tt_chain_token`），只要全程复用即可正常下载。

## 同类项目
- [douyin-cf-worker](https://github.com/huanxherta/douyin-cf-worker) - 抖音解析 Worker

## 致谢
TikTok 视频链接解析 + 代理下载，受抖音同类方案启发。