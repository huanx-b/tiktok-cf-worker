# TikTok CF Worker

可部署到 Cloudflare Workers 的 TikTok 视频解析接口。

## 功能
- 输入 TikTok 短链/长链
- 默认返回视频直链
- `?data` 返回 JSON 元数据
- 提取视频页面中的结构化数据

## 接口

### 1) 直链模式
```bash
curl "https://tk.YOUR_DOMAIN/?url=https://vt.tiktok.com/xxx/"
```

### 2) JSON 模式
```bash
curl "https://tk.YOUR_DOMAIN/?url=https://vt.tiktok.com/xxx/&data"
```

## 部署
```bash
npm i -g wrangler
wrangler deploy
```

## 配置
见 `wrangler.toml`：
- Worker 名称：`tiktokvd`
- 自定义域名：按需配置

## 原理
从视频页面的 `__UNIVERSAL_DATA_FOR_REHYDRATION__` JSON 中提取视频元数据，TikTok 原生提供 `downloadAddr` 直链无需拼接。

## 同类项目
- [douyin-cf-worker](https://github.com/huanxherta/douyin-cf-worker) - 抖音解析 Worker

## 致谢
TikTok 视频链接解析，受抖音同类方案启发。