# TikTok CF Worker

可部署到 Cloudflare Workers 的 TikTok 视频解析接口。

## 功能
- 输入 TikTok 短链/长链
- 默认返回视频下载直链
- `?data` 返回 JSON 元数据

## 接口

```bash
# 1) 直链模式
curl "https://tk.0d000721.cv/?url=https://vt.tiktok.com/xxx/"

# 2) JSON 元数据
curl "https://tk.0d000721.cv/?url=https://vt.tiktok.com/xxx/&data"
```

## 部署
```bash
npm i -g wrangler
wrangler deploy
```

## 配置
见 `wrangler.toml`。

## 原理
从视频页面的 `__UNIVERSAL_DATA_FOR_REHYDRATION__` JSON 中提取视频元数据及 `downloadAddr` 直链。

> **注意**：TikTok CDN（Akamai）对下载链接做了签名校验，直链只能在获取后短时间内通过浏览器访问。CF Worker 代理下载因签名限制不可行，故采用返回直链 URL 的方式。

## 同类项目
- [douyin-cf-worker](https://github.com/huanxherta/douyin-cf-worker) - 抖音解析 Worker

## 致谢
TikTok 视频链接解析，受抖音同类方案启发。