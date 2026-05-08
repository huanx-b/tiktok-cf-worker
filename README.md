# TikTok CF Worker

可部署到 Cloudflare Workers 的 TikTok 视频解析接口。

## 功能
- 输入 TikTok 短链/长链
- **默认代理下载视频**（CF 中转，绕过 GFW）
- `?data` 返回 JSON 元数据
- `?raw` 返回原始直链 URL

## 接口

```bash
# 1) 代理下载（默认）
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
从视频页面的 `__UNIVERSAL_DATA_FOR_REHYDRATION__` JSON 提取元数据。默认模式通过 Worker fetch 视频内容并流式返回，利用 CF 网络的国内可达性绕过 GFW。

## 同类项目
- [douyin-cf-worker](https://github.com/huanxherta/douyin-cf-worker) - 抖音解析 Worker

## 致谢
TikTok 视频链接解析，受抖音同类方案启发。