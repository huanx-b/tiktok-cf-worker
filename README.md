# TikTok CF Worker

可部署到 Cloudflare Workers 的 TikTok 视频解析 + 代理下载接口。

## 功能
- 输入 TikTok 短链/长链
- 自动识别**视频**与**图集（photo / slideshow）**
- **视频默认：CF 代理下载**（绕过 GFW）
- **图集默认：返回全部图片直链**（每行一个）；`?i=N` 下载第 N 张
- `?data` 返回 JSON 元数据
- `?raw` 返回原始直链 URL（图集为每行一个图片直链）

## 接口

```bash
# 1) 视频：代理下载（默认）- 浏览器直接打开即可下载
curl -O "https://tk.0d000721.cv/?url=https://vt.tiktok.com/xxx/"

# 2) 图集：默认返回全部图片直链（每行一个）
curl "https://tk.0d000721.cv/?url=https://vt.tiktok.com/xxx/"

# 3) JSON 元数据（视频含 video 字段，图集含 images 数组）
curl "https://tk.0d000721.cv/?url=https://vt.tiktok.com/xxx/&data"

# 4) 原始直链（图集为每行一个图片 URL）
curl "https://tk.0d000721.cv/?url=https://vt.tiktok.com/xxx/&raw"

# 5) 图集：下载第 2 张图片
curl -O "https://tk.0d000721.cv/?url=https://vt.tiktok.com/xxx/&i=2"
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
3. 判断帖子类型：
   - **视频**：读取 `itemStruct.video.downloadAddr`
   - **图集**：读取 `itemStruct.imagePost.images[].imageURL.urlList[0]`
4. 用同一 cookie 代理请求对应直链，流式返回

> 核心突破：TikTok CDN（Akamai）的签名校验绑定了 session cookie（`tt_chain_token`），只要全程复用即可正常下载。视频与图片走的是同一套签名机制，因此图集下载复用相同的 cookie 逻辑即可。

## 同类项目
- [douyin-cf-worker](https://github.com/huanxherta/douyin-cf-worker) - 抖音解析 Worker

## 致谢
TikTok 视频链接解析 + 代理下载，受抖音同类方案启发。