# 前端在干什么，后端在干什么

DrainLens · TA28 · 2026 年 10 月 13 日写，对着 `develop`

[FRONTEND-AND-BACKEND.md](./FRONTEND-AND-BACKEND.md) 的中文版，写法不一样：英文那份是给队友和 mentor 看的，这份是给自己看的，所以多了一节「点一下发生了什么」和一节「演示前检查」，少了客套。

---

## 一句话

**这个产品主要是前端。**

地图、图层、水路、低洼区、堵塞对比、雨前计划、报修单，全部是在读者自己的浏览器里算出来或者画出来的。用到的数据是 Python 流水线在**部署之前**就算好、提交进仓库的文件。

服务端存在的理由只有两个：

1. 让地图能是**整个 City of Melbourne**（21,113 个雨水口，76.5 km²），而不是容器里自带的那一平方公里 Kensington（895 个）。
2. 让**提交一次**的地址搜索走到跟其他数据同一个 Postgres 上，而不是只有浏览器里的索引。

没有这两条，整个产品照样能跑。这不是夸张，是设计：9 月 5 日之前它是纯静态站点，加数据库那天定的规矩是「可以改变它能显示多少，不能改变它能不能用」。

---

## 五个部分

| 部分 | 跑在哪 | 一句话 |
|---|---|---|
| **前端** | 读者的浏览器 | 画所有地图，拿着地址，跑对比，生成计划和报修单 |
| **API** | Cloud Run `drainlens-api` | 七条路由，仅此而已 |
| **数据库** | Cloud SQL Postgres 16 | 存那些 artefact 的行。**故意是派生的，所以没有备份** |
| **助手** | Cloud Run `drainlens-ai` | 私有，只能经 API 到达 |
| **流水线** | 某人的笔记本，部署之前 | 真正重的计算都在这里。**不在请求期发生** |

### 前端：`apps/web`

Vite + React + TypeScript，构建出静态文件，装进一个带 nginx 的容器（`deploy/nginx.conf`），跑在 Cloud Run `drainlens-dev` 上，整站有 basic auth 门。

三个共享包一起打进去：

- `@drainlens/address` 地址索引和匹配器。**浏览器和 API 用的是同一个**，所以 API 挂了退回本地，答案一模一样，不是降级版。
- `@drainlens/scenario` 堵塞对比的引擎。纯计算，不碰 DOM，Web Worker 只是个薄壳。
- `@drainlens/schema` 两端共用的类型和过线的载荷定义。

**所有地图都是 `<canvas>`，浏览器自己画的。** 没有第三方瓦片，没有截图。

### API：`apps/api`

Hono 跑在 Node 上，`pg` 连 Postgres，`google-auth-library` 换 ID token。七条路由：

| 路由 | 干什么 |
|---|---|
| `GET /health` | `{"status":"ok","pits":21113,"areas":30,"scopeAreas":281}` |
| `GET /api/map/:extent` | 排水管网几何，从数据库行重建 |
| `GET /api/derived/:extent` | 算出来的图层（水路、低洼、数据空洞） |
| `GET /api/trace/:extent` | 管道图，前端用它往下游走 |
| `GET /api/flood-history` | 洪水历史排名 |
| `POST /api/addresses/search` | 提交一次的地址搜索 |
| `POST /api/chat` | 把一个问题转给助手 |

重建过的 artefact 按路由缓存十分钟（`REBUILT_FOR_MS = 600_000`），因为之前 map 和 derived 两条路由分别要 2.5 秒和 3 秒。`/api/*` 开了压缩，整市地图上线变成原来的 1/5.7。

### 数据库为什么没备份

**每一行都是从 `apps/web/public/data/*.json` 派生出来的，那些文件在仓库里。** migration job 一次执行就能把整个库重建出来。给派生库做备份，等于花钱复制一份 git 里已经有的东西。

`deploy/API-DEPLOYMENT.md` 记了这个理由，也记了什么时候这个判断会失效：**哪天有任何不在仓库里的东西被写进去**。目前没有用户表、没有会话表、没有搜索日志。

### 助手：`assistant/`

队友的那套，部署成 `drainlens-ai`。从 VICSES、Melbourne Water、City of Melbourne 的官方指南里检索相关段落再生成回答。

API 的 `/api/chat` 只是个**代理**：收 `{message}`，拒绝空的或者非字符串的，拿一个 Google ID token，POST 到助手自己的 `/chat`，超时 280 秒。上游任何失败都变成一个干巴巴的 `502` 加一句通用的话，**上游的错误信息不会漏到浏览器**。助手本身在公网上打不到，只能经过这条路由。

### 流水线：`pipeline/`

Python，在部署之前在笔记本上跑。这是最容易被忘记算后端的部分。

| 产出 | 来自 |
|---|---|
| `map.json` 雨水口、管道、道路、街名 | City of Melbourne 开放数据 |
| `derived.json` 水路、低洼区、数据空洞 | 2018 年三维点云，4.33 GB 瓦片 |
| 地面高程瓦片和等高线标记 | 同一批点云 |
| `trace.json` 管道图 | 记录在案的管网 |
| `warnings/<extent>.json` 街面上的深低洼 | 地形运算，加上「必须在道路走廊内、两两间隔 150 米」的规则 |
| `subcatchments.json`、`address-catchments.json` | Melbourne Water 的汇水区边界 |
| `flood-history.json`、`population.json`、`sa2-*.json` | SES 出动记录和 ABS 边界 |
| `scenario-differences.json`、scene 瓦片 | 地形，给堵塞对比用 |

**有一件事它在构建期做掉了，否则会变成运行期的 bug：** `reframe.py` 把每个 artefact 搬到它将要被画在上面的那张地图的坐标系里。坐标都是「距本 extent 左下角多少米」，Kensington 的原点在整市坐标里是 (1500, 6000)。Kensington 坐标系的图形画到整市地图上，会**偏西 1.5 公里、偏南 6 公里**，而且悄无声息，看上去还像一张地图。

---

## 点一下发生了什么

以「输入 46 Gatehouse Drive，看雨前检查」为例，按时间顺序：

1. **打开站点。** nginx 返回静态文件。`index.html` 里的 `index-<hash>.js` 就是核对线上版本用的那个哈希。
2. **开始打字。** 每一次按键都只在**内存里的索引**上匹配，不发任何请求。原因：一个字符一个请求等于把人家家庭住址一个字母一个字母送到服务器上，去回答一个本地已经能答的问题。
3. **按回车提交。** 这时才发**一次** `POST /api/addresses/search`。API 挂了就退回本地同一个 matcher，答案相同。
4. **地图要数据。** 四个 artefact（map / derived / trace / flood-history）先问 API，问不到就用容器里自带的那份，**页脚会说是哪边答的**。这条就是「API 答了就是整市，没答就是一平方公里」。
5. **其他文件只从容器拿。** 地形瓦片、警示点、汇水区、SA2 边界、洪水事件、scene 瓦片，API 根本没有这些路由。
6. **画。** canvas 自己画。200 米的虚线圈、编号三角、低洼区、水路，全是浏览器算的。
7. **点「Check before heavy rain」。** 200 米内的标记在浏览器里挑出来、编号、最多三个。
8. **答「Applies to me」。** 只存在 React 状态里。**不进 localStorage，不进 URL，不发请求。**
9. **打印计划。** 在页面里拼成一段 HTML，塞进一个隐藏 iframe 调 `print()`。不上传，不下载，不请求。

整条链里**离开浏览器的只有第 3 步那一次请求和第 4 步那四个 GET**。

---

## 边界是怎么划的

三条规则。基本能回答所有「这个为什么不做成 API」。

1. **关于读者的一切留在浏览器。** 地址、选择、计划、打印页。隐私是三个 iteration 里都有的验收标准，而守住一个承诺最便宜的办法是压根不持有那份数据。
2. **能算一次的就在部署前算完。** 流水线慢、要 4.33 GB 输入、要 Python 工具链，而且答案在两次访问之间不会变。放到请求期等于让每个读者为同一份工作付一次钱。
3. **服务端只负责浏览器装不下的东西。** 21,113 个雨水口、17,242 根管、76.5 km²，没人该为了看自己那条街把这些下载下来。这就是 API 的全部职责。

---

## 哪一块挂了会怎样

| 挂的是 | 读者看到什么 |
|---|---|
| API 或 Cloud SQL 停了 | 地图照画，用容器自带的那一平方公里，页脚说明来源。**这是计划内状态**，演示之间数据库本来就会停掉省钱 |
| API，但正在搜地址 | 同一个 matcher 在本地索引上跑，答案一样 |
| 助手 | 一个 502 加一句「助手暂时不可用」。站点其他部分不受影响 |
| 地形瓦片 | 地面高程什么都不画，也不乱说。其他图层不受影响 |
| 除容器外的一切 | 站点照常工作。除了整市地图和提交式搜索，整个产品都跑在它已经有的文件上 |

最后一行是这个结构的意义所在。

---

## 演示前检查

```bash
# 1. 线上是哪个版本（这条要你的密码，在真终端里跑）
curl -s -u drainlens https://drainlens-dev-205559161217.australia-southeast1.run.app/ \
  | grep -o 'assets/[A-Za-z0-9._-]*' | sort -u

# 2. 本地构建出同样的哈希来比
VITE_API_BASE=https://drainlens-api-205559161217.australia-southeast1.run.app \
  npm run build --workspace @drainlens/web
grep -o 'assets/[A-Za-z0-9._-]*' apps/web/dist/index.html | sort -u

# 3. API 活着吗，数据库是不是整市
curl -s https://drainlens-api-205559161217.australia-southeast1.run.app/health
# 要看到 "pits":21113。如果 API 不通，站点会退回一平方公里

# 4. 哪些服务被动过
gcloud run services list --project=fit5120-504507 --region=australia-southeast1 \
  --format="table(metadata.name,status.latestReadyRevisionName,status.conditions[0].lastTransitionTime)"
```

**第五件事没有命令：先问助手一个问题把它暖起来。** 它没设最小实例，冷启动要抓一个 79 MB 的模型，**第一个问题超过一分钟**，热的时候 11 到 15 秒。面板全程显示「Finding an answer in the official guides…」，所以不会白屏，但一分钟就是一分钟。`--min-instances=1` 能解决，代价是一直付钱。

---

## 几个自己容易问的问题

**地址搜索不是说不离开浏览器吗？**
9 月 9 日 mentor 指出地址搜索没有 API，团队决定建一个。从那天起：**输入时的联想仍然全在本地**，一次请求都不发；**按回车提交时**会发一次 `POST /api/addresses/search`。屏幕上那两句「地址不会离开你的设备」在同一次改动里撤掉了，没有留着变成假话。记录在 `DECISIONS-PENDING.md` §14。

**为什么容器里是 Kensington，数据库里是整市？**
因为 Kensington 在整市里面，它的 895 个雨水口就是整市里同样那 895 个，`asset_number` 是全局主键，同一个资产不能在两个坐标系里存成两行。两边都要的场景不存在。

**`INTERFACE-CONTRACT.md` 里说边界几乎是空的，还算数吗？**
那份写于 8 月 30 日、9 月 14 日复核，**早于两条 POST 路由**。它那句话对它当时描述的产品是真的。引用前先看日期。

**前端还有多少测试撑着？**
1,797 个 Node 测试，两个 typecheck（源码和测试分开）。有两个测试不稳定：`apps/web/src/ui/sources.test.ts` 的 "has no link that nothing on the site renders"（它会真发网络请求，跑 7.9 秒）和 `apps/api/src/server.chat.test.ts:99`。**CI 在这两个上红了，先重跑再信。**
