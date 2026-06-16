# 维护经验记录

本文件记录项目在实际修改过程中遇到的问题、根因、处理方式和验证结果。  
后续 AI 只要涉及代码、音频、题目、交互或配置修改，就需要在完成后补充一条新记录。

## 记录格式

每次新增记录时，尽量包含下面几个部分：

- 日期
- 范围
- 问题现象
- 根因
- 处理
- 验证
- 后续提醒

不要只写结论，要写出这次踩坑的原因和最终确认有效的处理方式。

---

## 2026-06-16 听写词同步替换为周末与自然身体词

### 范围

- 今日听写词表
- 日常学习题
- 学习中心听写入口文案
- 本地普通/慢速单词音频
- `src/data/dictationWords.ts`
- `src/data/dailyLearningQuestions.ts`
- `src/pages/ModeHubPage.tsx`
- `public/audio/words/us`
- `public/audio/words/us-slow`
- `tests/dailyWordSync.test.ts`

### 问题现象

- 用户要求把听写单词里的词放入日常学习，并替换为 `Friday / Saturday / Sunday / teeth / peel / leaf`。
- 如果只改词表或题目，不替换两套本地 wav，听写页普通播放和慢速播放会继续使用上一轮星期词音频。

### 根因

1. 听写词、日常学习题、入口词数和本地音频是四处独立维护，必须一起同步。
2. 本地音频 URL 会按词表文本生成文件名，本次 `Friday / Saturday / Sunday` 保留首字母大写，`teeth / peel / leaf` 保留小写。
3. 学习中心入口文案写死今日词数，4 个词换成 6 个词后需要同步改成“今日 6 词”。

### 处理

1. 先把 `dailyWordSync` 测试改为 6 个目标词，并确认旧词表、旧日常题、旧音频和旧入口文案都会触发失败。
2. 替换 `dictationWords`，为 6 个词补儿童化释义、note 和 `imageHint`。
3. 替换 `dailyLearningQuestions`，让日常学习直接复用同一套 6 个词、中文释义和播放文本。
4. 学习中心听写入口改成“今日 6 词”。
5. 使用 `tools/New-DailyWordAudio.ps1` 生成 `Microsoft Zira Desktop` 普通/慢速两套 wav，再整体替换正式音频目录。

### 验证

- `npm run test -- tests/dailyWordSync.test.ts`
- PowerShell WAV 头检查：6 个慢速音频都长于普通音频，慢速/普通时长比约 1.55 到 1.56。
- 后续执行完整 `npm run lint`、`npm run test`、`npm run build`。
- 使用 `System.Media.SoundPlayer` 试听至少 1 个普通版和 1 个慢速版音频。

### 后续提醒

- 大小写继续以词表文本为准，音频文件名必须和 URL 映射完全一致。
- 新词暂未补固定 `public/images/dictation-words/*.webp` 词图，页面会继续按 `imageHint` 走现有出图链路；如果反馈词图不稳定，再单独补固定图。
- 每次改每日词，先让同步测试红灯，再改数据和音频，能避免只替换一边入口。

---

## 2026-06-12 星期词播放无声的大小写修复

### 范围

- 听写页本地普通/慢速单词播放
- 本地音频 URL 映射
- `src/lib/phonetic.ts`
- `tests/dailyWordSync.test.ts`

### 问题现象

- 用户反馈新替换的星期词点击播放没有声音。
- 当前音频目录里存在 `Monday.wav / Tuesday.wav / Wednesday.wav / Thursday.wav`，但线上播放仍然失败。

### 根因

1. `phonetic.ts` 生成本地音频 URL 时把单词统一转成小写，因此 `Monday` 实际请求的是 `/audio/words/us/monday.wav`。
2. 这次入库的文件名保留首字母大写，例如 `Monday.wav`。
3. Windows 本地文件系统大小写不敏感，简单用 `existsSync('monday.wav')` 会误判通过；Cloudflare Pages 静态资源路径大小写敏感，所以线上会 404。

### 处理

1. 保留查找 key 的小写归一化，确保传入 `Monday` 或 `monday` 都能命中。
2. URL 文件名改用词表里的原始单词文本，生成 `/audio/words/us/Monday.wav` 和 `/audio/words/us-slow/Monday.wav`。
3. 在 `dailyWordSync` 测试里新增精确文件名检查：本地音频 URL 解码后的文件名必须和目录里的 wav 文件名字符串完全一致，避免再被 Windows 大小写容错掩盖。

### 验证

- `npm run test -- tests/dailyWordSync.test.ts`
- `npm run test -- tests/phonetic.test.ts tests/dictationAudioRouting.test.ts`
- 后续执行完整 `npm run lint`、`npm run test`、`npm run build`。

### 后续提醒

- 对线上静态资源，不能只用 Windows 的文件存在检查验证大小写；要用目录文件名集合做精确字符串匹配。
- 如果未来词表再次使用大写、空格或特殊字符，必须同时检查“生成的 URL 文件名”和“真实 wav 文件名”完全一致。

---

## 2026-06-11 听写词同步替换为星期词

### 范围

- 今日听写词表
- 日常学习题
- 学习中心听写入口文案
- 本地普通/慢速单词音频
- `src/data/dictationWords.ts`
- `src/data/dailyLearningQuestions.ts`
- `src/pages/ModeHubPage.tsx`
- `public/audio/words/us`
- `public/audio/words/us-slow`
- `tests/dailyWordSync.test.ts`

### 问题现象

- 用户要求把听写单词里的词放入日常学习，并替换为 `Monday / Tuesday / Wednesday / Thursday`。
- 如果只改词表或题目，不替换两套本地 wav，听写页普通播放和慢速播放仍会命中上一轮旧词音频。

### 根因

1. 听写词、日常学习题、入口词数和本地音频是四处独立维护，必须一起同步。
2. 本地音频文件名按英文词本身匹配，本次星期词需要保留首字母大写的 `Monday.wav` 等文件名。
3. 学习中心入口文案写死今日词数，9 个词换成 4 个词后需要同步改成“今日 4 词”。

### 处理

1. 先把 `dailyWordSync` 测试改为 4 个星期词，并确认旧词表、旧日常题、旧音频和旧入口文案都会触发失败。
2. 替换 `dictationWords`，为 4 个星期词补儿童化释义、note 和 `imageHint`。
3. 替换 `dailyLearningQuestions`，让日常学习直接复用同一套 4 个词、中文释义和播放文本。
4. 学习中心听写入口改成“今日 4 词”。
5. 使用 `tools/New-DailyWordAudio.ps1` 生成 `Microsoft Zira Desktop` 普通/慢速两套 wav，再整体替换正式音频目录。

### 验证

- `npm run test -- tests/dailyWordSync.test.ts`
- PowerShell WAV 头检查：4 个慢速音频都长于普通音频，慢速/普通时长比约 1.56。
- 后续执行完整 `npm run lint`、`npm run test`、`npm run build`。
- 使用 `System.Media.SoundPlayer` 试听至少 1 个普通版和 1 个慢速版音频。

### 后续提醒

- 星期词文件名这次保留首字母大写，例如 `Monday.wav`；不要在数据和音频文件名之间引入大小写不一致。
- 新词暂未补固定 `public/images/dictation-words/*.webp` 词图，页面会继续按 `imageHint` 走现有出图链路；如果反馈词图不稳定，再单独补固定图。
- 每次改每日词，先让同步测试红灯，再改数据和音频，能避免只替换一边入口。

---

## 2026-06-01 听写词同步替换为零食与动作词

### 范围

- 今日听写词表
- 日常学习题
- 学习中心听写入口文案
- 本地普通/慢速单词音频
- `src/data/dictationWords.ts`
- `src/data/dailyLearningQuestions.ts`
- `src/pages/ModeHubPage.tsx`
- `public/audio/words/us`
- `public/audio/words/us-slow`
- `tests/dailyWordSync.test.ts`

### 问题现象

- 用户要求把听写单词里的词放入日常学习，并替换为 `chocolate / sandwich / nuts / candy / potato chips / cupcake / dive / nose / ride`。
- 这次仍包含 `potato chips` 这种带空格短语，如果只改数据不改音频目录，听写播放会继续找旧 wav 或缺少新 wav。

### 根因

1. 听写页和日常学习页分别读取 `dictationWords` 与 `dailyLearningQuestions`，需要双入口同步。
2. 听写普通播放和慢速播放都依赖本地 wav，文件名必须和词表英文完全一致。
3. 学习中心入口文案写死了今日词数，词表从 8 个改成 9 个后也要一起更新。

### 处理

1. 先把 `dailyWordSync` 测试改成 9 个目标词，确认旧词表、旧日常题、旧音频和旧入口词数都会触发失败。
2. 重建 `dictationWords`，为 9 个词补儿童化中文释义、note 和 `imageHint`。
3. 替换 `dailyLearningQuestions`，让日常学习直接使用同一套 9 个词、中文释义和 `audioText`。
4. 学习中心听写入口改成“今日 9 词”。
5. 使用 `tools/New-DailyWordAudio.ps1` 生成 `Microsoft Zira Desktop` 普通/慢速两套 wav，再整体替换正式音频目录。

### 验证

- `npm run test -- tests/dailyWordSync.test.ts`
- PowerShell WAV 头检查：9 个慢速音频都长于普通音频，慢速/普通时长比约 1.55。
- 后续执行完整 `npm run lint`、`npm run test`、`npm run build`。
- 使用 `System.Media.SoundPlayer` 试听至少 1 个普通版和 1 个慢速版音频。

### 后续提醒

- `potato chips.wav` 继续保留空格文件名，不要改成 `potato-chips.wav` 或 `potato_chips.wav`。
- 新词暂未补固定 `public/images/dictation-words/*.webp` 词图，页面会继续按 `imageHint` 走现有出图链路；如果反馈词图不稳定，再单独补固定图。
- 每次改每日词，都要同步检查入口词数和两套音频目录，不要只看 TypeScript 数据。

---

## 2026-05-29 听写词同步替换为零食与基础功能词

### 范围

- 今日听写词表
- 日常学习题
- 学习中心听写入口文案
- 本地普通/慢速单词音频
- `src/data/dictationWords.ts`
- `src/data/dailyLearningQuestions.ts`
- `src/pages/ModeHubPage.tsx`
- `public/audio/words/us`
- `public/audio/words/us-slow`
- `tests/dailyWordSync.test.ts`

### 问题现象

- 用户要求把听写单词同步放入日常学习，并替换为 `potato chips / cupcake / balloon / from / for / yes / cube / time`。
- 这批词里包含 `potato chips` 这种带空格短语，如果只改数据不改音频目录，听写普通/慢速播放会找不到对应 wav。

### 根因

1. 听写页和日常学习页仍然分别从 `dictationWords` 与 `dailyLearningQuestions` 读取，必须两边同步。
2. 本地音频文件名直接跟英文词一致，短语要保留空格文件名。
3. 学习中心入口文案之前写死为“今日 20 词”，换成 8 个词后也要一起改，不然入口数量会误导。

### 处理

1. 先更新 `dailyWordSync` 测试到 8 个新词，并确认旧词表、旧题目、旧音频和旧入口文案都会触发红灯。
2. 替换 `dictationWords`，为每个词补儿童化释义、note 和 `imageHint`。
3. 替换 `dailyLearningQuestions`，让日常学习直接复用同一套 8 个词、释义和播放文本。
4. 学习中心听写入口改成“今日 8 词”。
5. 使用已验证的 `tools/New-DailyWordAudio.ps1` 生成 `Microsoft Zira Desktop` 普通/慢速两套音频，再整体替换正式目录。

### 验证

- `npm run test -- tests/dailyWordSync.test.ts`
- PowerShell WAV 头检查：8 个慢速音频都长于普通音频，慢速/普通时长比约 1.55。
- `npm run lint`
- `npm run test`
- `npm run build`
- `System.Media.SoundPlayer` 播放 `potato chips.wav` 普通版与慢速版，确认文件可正常打开播放。

### 后续提醒

- 带空格短语继续保留空格文件名，例如 `potato chips.wav`，不要改成连字符或下划线。
- 新词暂未补固定 `public/images/dictation-words/*.webp` 词图，页面会继续按 `imageHint` 走现有在线/缓存出图链路；如果用户反馈词图不稳定，再单独补固定图片。
- 后续再改每日词，不要忘记入口文案里的词数。

---

## 2026-05-22 iPad 首次打开卡顿排查与加载优化

### 范围

- 生产站 `https://xiuxiuyingyu.pages.dev/` 的 iPad 首屏加载
- Service Worker 注册与缓存策略
- 学习中心首屏图片加载
- `src/main.tsx`
- `public/sw.js`
- `src/pages/ModeHubPage.tsx`
- `src/components/AppLayout.tsx`
- `index.html`
- `tests/performanceLoading.test.ts`

### 问题现象

- iPad 打开站点时体感较卡，像是页面刚打开又停住重新加载。
- 线上测量时，同一批 HTML、JS、CSS 和首屏图片请求出现两轮，请求数量和资源解码压力被放大。

### 根因

1. `main.tsx` 监听 `navigator.serviceWorker` 的 `controllerchange` 后直接 `window.location.reload()`。
2. `sw.js` 使用 `skipWaiting()` 和 `clients.claim()`，首次安装或更新 Service Worker 时会更容易触发控制权切换；配合前端 reload 监听，就会造成打开/更新时自动刷新一遍。
3. 学习中心首屏同时渲染多张 PNG 图标，默认都按普通图片加载和解码；iPad Safari 在网络与图片解码同时发生时体感更明显。
4. 静态资源线上响应头偏向 `must-revalidate`，原 Service Worker 对多数资源是 network-first，重复打开时仍会先走网络确认。

### 处理

1. 移除 `controllerchange` 自动刷新逻辑，也不再每次 load 后手动 `registration.update()`。
2. Service Worker 改为静态资源 `cacheFirst` 并后台刷新缓存，只对页面导航等继续使用 network-first；`/audio/`、`/api/` 和 Range 请求仍直接放行，避免影响音频播放。
3. Service Worker 更新时不再主动 `skipWaiting()` / `clients.claim()` 抢占当前页面，降低当前页面中途换控制器的概率。
4. 学习中心关键 hero 图标记 `fetchPriority="high"` 和异步解码；路线/模式/底部导航图标增加 `decoding="async"`，非关键模式图标延后 lazy 加载。
5. 补充 `mobile-web-app-capable`，消除 Chromium 对旧 Apple-only PWA meta 的兼容警告。
6. 新增性能回归测试，锁住“不再自动 reload”“静态资源 cache-first”“装饰图不阻塞关键解码路径”。

### 验证

- 先运行 `npm run test -- tests/performanceLoading.test.ts`，确认旧实现下 3 条测试失败。
- 修改后同一组测试通过。
- `npm run lint`
- `npm run test`：28 个测试文件、94 个测试通过。
- `npm run build`

### 后续提醒

- 不要为了“让用户马上拿到新版”再把 `controllerchange -> reload` 加回来；儿童学习场景里首次打开稳定比热更新即时性更重要。
- 继续改 Service Worker 时，音频路径 `/audio/` 和 Range 请求必须保持绕过缓存代理，否则会重新影响单词播放首播稳定性。
- 新增首页/学习中心图片时，先判断是否首屏关键图；装饰图默认 `decoding="async"`，非关键图尽量 lazy。

---

## 2026-05-20 听写词和日常学习替换为游戏与代词词组

### 范围

- 今日听写词表
- 日常学习题
- 本地普通/慢速单词音频
- `src/data/dictationWords.ts`
- `src/data/dailyLearningQuestions.ts`
- `public/audio/words/us`
- `public/audio/words/us-slow`
- `tests/dailyWordSync.test.ts`

### 问题现象

- 用户要求把听写单词模块里的词同步放入日常学习，并替换为 `video games / board games / win / lose / want / ring / song / bang / them / they / you / her`。
- 这批词包含两个带空格的短语，如果只改词表不改音频，听写普通播放会找不到本地生成的 wav。

### 根因

1. 听写页和日常学习使用两份数据源，必须同时替换。
2. 听写普通播放和慢速播放都已切到本地音频，所以 `public/audio/words/us` 与 `public/audio/words/us-slow` 也必须只保留当前词表对应文件。
3. IndexTTS2 本次生成到第 2 个短语后超过 15 分钟仍未完成，且临时生成的 `board games` 慢速版比普通版短，不适合入库。

### 处理

1. 先更新 `dailyWordSync` 测试到新的 12 个词，并确认旧词表、旧题目、旧音频会触发红灯。
2. 替换 `dictationWords` 和 `dailyLearningQuestions`，为每个词补儿童化释义、提示和单选题。
3. 尝试使用 IndexTTS2 生成到 `tmp/daily-word-audio-index`，超时后停止残留 Python 进程，未采用不完整候选。
4. 使用已验证的 `tools/New-DailyWordAudio.ps1` 生成完整普通/慢速两套 Zira 音频到临时目录，再整体替换正式音频目录。
5. 短语音频文件保留空格文件名，例如 `video games.wav`，前端会通过 `encodeURIComponent` 请求为 `/audio/words/us/video%20games.wav`。

### 验证

- `npm run test -- tests/dailyWordSync.test.ts`
- 12 个慢速 wav 均大于普通版 1.1 倍
- `npm run lint`
- `npm run test`
- `npm run build`

### 后续提醒

- 新词里如果有空格短语，不要改成连字符文件名；当前本地音频映射会按原词生成带空格的 wav，并由浏览器 URL 编码请求。
- IndexTTS2 超过合理时间仍未完整生成时，不要继续硬等；先检查临时文件时长和残留 Python 进程，再走已验证的兜底脚本。
- 整体替换音频目录时，通配符复制不要用 `-LiteralPath` 搭配 `*.wav`，否则不会展开文件。

---

## 2026-05-16 听写普通播放误走词典接口

### 范围

- 今日听写播放发音
- `src/pages/DictationPage.tsx`
- `src/lib/phonetic.ts`
- `docs/product-conventions.md`
- `tests/dictationAudioRouting.test.ts`
- `tests/phonetic.test.ts`

### 问题现象

- 听写单词已经生成了本地普通音频和慢速音频，但点击“播放发音”时仍可能提示“当前单词词典发音加载失败”。
- 这会让用户以为本地生成音频没有生效，也会造成普通播放和慢速播放声音来源不统一。

### 根因

1. `DictationPage` 的普通播放仍调用 `playUsWordAudio(...)`，该函数会请求线上词典接口。
2. 只有“慢速播放”调用了本地 `playLocalUsSlowWordAudio(...)`。
3. 之前虽然同步生成了 `public/audio/words/us/*.wav`，但听写页普通播放入口没有切到这套本地资源。

### 处理

1. 将听写页普通播放改为调用 `playLocalUsWordAudio(...)`。
2. 新增 `getLocalWordAudioFeedback(...)`，普通本地音频缺失或播放失败时显示本地语音相关提示，不再提示词典接口失败。
3. 补充音频路由测试，锁定听写页普通播放必须使用本地生成音频。
4. 更新产品约定：听写单词模块普通和慢速播放都走本地生成音频。

### 验证

- `npm run test -- tests/dictationAudioRouting.test.ts tests/phonetic.test.ts`
- `npm run lint`
- `npm run test`
- `npm run build`
- 本地 `/dictation` 页面打开后，播放请求不再访问词典音频接口

### 后续提醒

- 听写单词模块不要再把普通播放改回 `playUsWordAudio(...)`，否则会重新出现词典接口不稳定和声音不统一。
- 更新听写词表时，仍要同步维护 `public/audio/words/us` 和 `public/audio/words/us-slow` 两套文件。

---

## 2026-05-16 今日听写长单词标题换行

### 范围

- 今日听写新词卡片
- `src/pages/DictationPage.tsx`
- `src/index.css`
- `tests/dictationVisualLayout.test.ts`

### 问题现象

- `hide-and-seek` 在今日听写“新词”大标题里被拆成多行显示。
- 小朋友看词时需要先认完整单词，拆行会破坏整体词形，也让页面显得拥挤。

### 根因

1. 大标题在 iPad 布局里固定 `width: 330px`，短词可以居中展示，但带连字符的长词会在连字符处自动换行。
2. 之前只处理了字母间距，没有同时处理“长词需要缩字号并保持一行”的规则。

### 处理

1. 给词卡标题传入 `--lesson-word-title-fit-length`，让 CSS 可以按当前标题长度计算字号。
2. `.lesson-word-card h1` 增加 `white-space: nowrap`，禁止 `hide-and-seek` 这类词在连字符处断开。
3. 大屏布局将标题宽度从固定 330px 改为更宽的安全区域，并用 `clamp()` 对长词自动缩小字号。
4. 补充视觉布局回归测试，锁定长词必须单行且大屏使用长度变量缩放。

### 验证

- `npm run test -- tests/dictationVisualLayout.test.ts`
- `npm run lint`
- `npm run test`
- `npm run build`

### 后续提醒

- 以后新增带连字符或更长的听写单词时，要同时检查新词阶段的大标题是否一行显示完。
- 只调字距不能解决长词排版，长词要同时考虑不换行、可用宽度和字号缩放。

---

## 2026-05-16 今日听写新词大标题字母过挤

### 范围

- 今日听写新词卡片
- `src/index.css`
- `tests/dictationVisualLayout.test.ts`

### 问题现象

- 今日听写“新词”阶段的大号英文单词字母间距太小。
- `frisbee` 这类单词在大字号下看起来字母连在一起，影响小朋友辨认。

### 根因

1. `.lesson-word-card h1` 使用了 `letter-spacing: -0.08em`，在超大字号下会把字母压得过紧。
2. 拼写题标题需要保持正常紧凑排版，但新词学习态的大英文词更需要清晰可读。

### 处理

1. 将 `.lesson-word-card h1` 的字距改为 `0.02em`，给大号英文词留出更清楚的字母间隔。
2. 保留 `.lesson-word-card h1.lesson-spell-title` 的 `letter-spacing: 0`，避免影响“听音拼写”标题。
3. 补充视觉布局测试，锁定新词大标题不再使用负字距。

### 验证

- `npm run test -- tests/dictationVisualLayout.test.ts`
- `npm run lint`
- `npm run test`
- `npm run build`

### 后续提醒

- 今日听写新词大标题使用超大字号时，不要再用明显负字距；优先保证儿童可辨认。
- 如果后续调整大字号词卡宽度，要同时看 `frisbee / hide-and-seek` 这类较长词的实际效果。

---

## 2026-05-10 听写词同步到日常学习并替换本地音频

### 范围

- 今日听写词表
- 日常学习题
- 本地单词音频
- `src/data/dictationWords.ts`
- `src/data/dailyLearningQuestions.ts`
- `public/audio/words/us`
- `public/audio/words/us-slow`
- `tests/dailyWordSync.test.ts`
- `tools/New-DailyWordAudio.ps1`
- `tools/generate_daily_word_audio.py`

### 问题现象

- 用户要求把听写单词放入日常学习，并替换为 `tag / frisbee / hide-and-seek / limboo / we / put / to / king / long / hand`，随后确认 `limboo` 要改为标准拼写 `limbo`。
- 只改词表会让日常学习、听写页、本地慢速音频不同步。

### 根因

1. 每日听写和日常学习是两份数据源，需要同时替换。
2. 本地慢速播放依赖 `public/audio/words/us-slow` 的文件名，换词后必须同步音频目录。
3. 本次尝试使用 IndexTTS2 生成新音频时，模型加载阶段触发 Windows 虚拟内存不足 `os error 1455`，未生成 WAV。

### 处理

1. 先更新 `dailyWordSync` 测试为新的 10 个词，并确认红灯能抓到旧词表和旧音频。
2. 同步替换 `dictationWords` 和 `dailyLearningQuestions`。
3. 使用固定本机女声 `Microsoft Zira Desktop` 生成正常/慢速两套 WAV 到临时目录，再整体替换正式音频目录。
4. 先按用户给定拼写保留 `limboo`，后续确认后已统一改为 `limbo` 并重生对应音频。

### 验证

- `npm run test -- tests/dailyWordSync.test.ts`
- 正式音频时长检查：10 个词的慢速版均明显长于正常版。
- `npm run lint`
- `npm run test`
- `npm run build`

### 后续提醒

- 换每日词时继续先改同步测试，红灯后再改数据和音频。
- 如果 IndexTTS2 再次报 `os error 1455`，不要硬等；先确认没有残留 Python 进程，再考虑分批、释放内存或使用固定系统女声作为临时兜底。
- `hide-and-seek` 的音频生成需要按 `hide and seek` 朗读，但文件名和题目文本必须保留连字符。

---

## 2026-04-28 题库音频按 10 个一组接入本地统一语音

### 范围

- 题库单词正常/慢速音频
- `public/audio/question-bank/us`
- `public/audio/question-bank/us-slow`
- `src/lib/phonetic.ts`
- `src/pages/PracticePage.tsx`
- `src/data/questionBankLocalAudio.ts`
- `tools/generate_question_bank_audio_batch.py`
- `tools/repair_question_bank_slow_audio.py`

### 问题现象

- 每日听写词已经使用本地统一音频，但普通题库里的其他单词和句子仍然混用词典接口或浏览器语音。
- 同一套练习里发音来源不统一，慢速播放也不方便逐批质检。

### 根因

1. 本地音频映射只覆盖了每日听写词，题库音频没有独立 catalog。
2. 练习页播放逻辑没有先查题库本地音频，所以即使生成了文件也不会自动使用。
3. IndexTTS2 生成慢速短词时偶尔会输出比正常版更短或等长的音频，不能只检查“文件存在”。

### 处理

1. 新增题库音频生成脚本，按题库顺序排除每日听写词，默认每批最多 10 个。
2. 先生成第 1 批：`keyboard / guitar / trumpet / drum / xylophone / recorder / violin / piano / throw / catch`。
3. 新增题库本地音频 catalog，练习页播放时优先使用本地生成音频，缺失时再回退到原有词典/浏览器语音。
4. 对慢速音频做时长质检，要求慢速至少明显长于正常版；`trumpet / xylophone / throw` 的慢速初稿不合格，已用同一模型生成的本地正常 WAV 做离线慢速修复。
5. 新增测试，锁定题库本地音频映射、文件存在和慢速时长规则。

### 验证

- 题库音频时长检查：10 个词全部通过，慢速均大于正常版 1.1 倍。
- `npm run test -- tests/questionBankLocalAudio.test.ts`
- `npm run lint`
- `npm run test`
- `npm run build`

### 后续提醒

- 后续继续按 10 个一组生成，不要一次性跑完 81 个题库音频，避免模型初始化或推理长时间卡住。
- 每批生成后必须跑慢速时长检查；不能只看 WAV 文件是否存在。
- 继续下一批时，需要把新条目追加到 `questionBankLocalAudioEntries`，否则前端仍会回退到词典或浏览器语音。
- 句子题后续也要按同样方式进入 catalog；重复朗读如果拆成多句，需要确认播放文本和 catalog 文本完全一致。

---

## 2026-04-27 听写拼写态输入区过小

### 范围

- 听写单词拼写步骤
- `src/index.css`
- `tests/dictationSpellInputVisibility.test.ts`
- `.omx/state/ui-redesign/ralph-progress.json`

### 问题现象

- 线上听写页进入“听音拼写”时，标题文字过大，输入区域显得太小。
- 输入框不够像主要作答区域，孩子的注意力容易先被大标题和底部按钮吸走。

### 根因

1. 拼写态已经把标题从真实单词改成“听音拼写”，但大屏样式仍然给了偏大的标题权重。
2. 输入框高度、内边距和输入字号仍偏辅助控件，和“这里要写答案”的任务不匹配。

### 处理

1. 将拼写态标题字号继续下调，避免“听音拼写”压住页面主任务。
2. 放大拼写输入框：
   - 大屏宽度改为 `min(820px, 100%)`
   - 最小高度提升到 `132px`
   - 输入字号提升到 `46px`
   - 提示文字、边框和阴影一起增强
3. 手机/窄屏输入区同步加高，让输入框在小屏也更像主答题控件。
4. 更新视觉记录，截图为 `dictation-spell-input-large-v1.png`。

### 验证

- `npm run test -- tests/dictationSpellInputVisibility.test.ts tests/dictationVisualLayout.test.ts` 通过
- Playwright 959×855 截图：`dictation-spell-input-large-v1.png`
- `npm run lint` 通过
- `npm run test` 通过：24 个测试文件、80 个测试
- `npm run build` 通过

### 后续提醒

- 拼写态的主视觉应服务于“输入答案”，不要让标题重新变成最大元素。
- 短视口下要同时看输入框、提交按钮、底部导航三者关系，避免输入区又被压小或遮住。

---

## 2026-04-26 听写和日常学习同步切换到 11 个新词

### 范围

- 今日听写页 `/dictation`
- 日常学习题库 `/practice`
- `src/data/dictationWords.ts`
- `src/data/dailyLearningQuestions.ts`
- `public/audio/words/us/*.wav`
- `public/audio/words/us-slow/*.wav`
- `tests/dailyWordSync.test.ts`

### 问题现象

- 用户要求把之前听写单词模块对应的词，同步换进日常学习，并整体替换成 `full / empty / same / different / gate / cave / safe / heavy / light / short / tall`。
- 仓库里原来的听写词表、日常学习题目、本地普通音频、本地慢速音频还是上一轮的 12 个旧词。
- 如果只改题库不改音频，听写页和练习页的慢速播放会直接命中缺失文件。

### 根因

1. 项目把“听写词表”和“日常学习题目”分在两个独立数据文件里维护，手改时很容易漏掉其中一个入口。
2. 本地普通/慢速音频的文件名由英文单词本身决定，只要词表变了，`public/audio/words/us` 和 `public/audio/words/us-slow` 就必须同步替换。
3. IndexTTS2 用慢速参考提示批量生成单词时，个别单词的首轮慢速版本仍可能比普通版短，不能直接整批入库。

### 处理

1. 先新增 `tests/dailyWordSync.test.ts`，锁住三件事：
   - 听写词表必须等于这 11 个新词
   - 日常学习题目必须复用同一套词
   - 普通/慢速本地音频文件名必须与当前词表完全一致
2. 更新 `src/data/dictationWords.ts`，把 11 个词的释义、提示文案和 `imageHint` 全部切成新集合。
3. 更新 `src/data/dailyLearningQuestions.ts`，把 `prompt / explanation / audioText` 和选择题选项一起切到同一套词。
4. 先用 `tools/New-IndexTtsReferencePrompts.ps1` 生成 `Microsoft Zira Desktop` 的普通/慢速参考提示音频。
5. 用本机 `D:\\AI\\index-tts-nolfs` 的 IndexTTS2 先在 `tmp/generated-daily-audio/` 生成全部 22 个候选，再整体替换正式目录，避免中途失败造成新旧混杂。
6. 对 `empty / full / light / tall` 的慢速版本额外用更高 `length_penalty` 再生成一轮候选，替换掉首轮不够慢或几乎不慢的版本。

### 验证

- 先运行 `npm run test -- tests/dailyWordSync.test.ts`，确认旧词状态下测试失败。
- 改完数据和音频后，同一组回归测试通过。
- 核对 `public/audio/words/us` 与 `public/audio/words/us-slow`，两边都只剩这 11 个词的 `.wav`。
- 用脚本检查最终音频时长，慢速版全部不短于普通版，例如：
  - `empty` 从 `normal=1.091s / slow=0.778s` 的首轮异常，修正到 `slow=2.148s`
  - `tall` 从 `normal=1.207s / slow=1.068s` 的首轮异常，修正到 `slow=1.753s`

### 后续提醒

- 以后再换每日词汇时，先补“词表 + 题库 + 音频目录”的同步测试，再动正式数据，能明显减少漏改。
- IndexTTS2 的慢速批量生成不要默认首轮全收；至少抽查一下“慢速版是否真的比普通版更长”。
- 如果后续还要追求词图稳定性，除了换词和换音频，也要补齐对应固定图片资源，否则新词会回退到在线/本地兜底出图。

## 2026-04-25 练习模块增加返回入口并限制每轮 10 题

### 范围

- 练习页 `/practice`
- 学习中心 `/`
- 听力选择、拼写练习、中译英、对话填空等 PracticePage 训练入口
- `src/lib/practiceUtils.ts`
- `src/pages/PracticePage.tsx`
- `src/pages/ModeHubPage.tsx`
- `src/index.css`
- `tests/practiceUtils.test.ts`
- `tests/practicePageStructure.test.ts`

### 问题现象

- 从学习中心进入听力选择、拼写练习等训练后，页面顶部没有明确的返回按钮，孩子只能依赖底部导航或浏览器返回。
- 部分训练直接拿完整题库或 20 题入口进入，一轮太长，不适合低龄孩子一次完成。
- 学习中心文案仍显示“每日 20 题 / 今日 20 题”，和新的短练习节奏不一致。

### 根因

1. `PracticePage` 原来只提供上一题、提交、下一题操作，没有像听写页那样提供稳定的“返回首页”入口。
2. 题目数量控制分散在 `today10`、`daily20`、`level10` 等少数分支里，听力选择、拼写练习等模式没有统一的会话题量上限。
3. 入口文案和实际练习轮次没有集中维护，容易出现“页面说 20 题，产品要求每次 10 题”的错位。

### 处理

1. 新增 `pickPracticeSessionQuestions`，所有 PracticePage 模式在生成当前题库后统一抽取最多 10 题。
2. 将 `daily20` 旧入口保留为兼容 query，但展示标题和实际题量都改成 10 题。
3. 在练习页和空状态页加入 `.practice-back-button`，统一返回首页。
4. 学习中心把听力选择、中译英、对话填空等入口文案改为 10 题节奏。
5. 新增回归测试锁住抽样数量、题库不被原地修改、练习页返回入口和学习中心文案。

### 验证

- 先运行新增回归测试，确认旧行为失败：`npm run test -- tests/practiceUtils.test.ts tests/practicePageStructure.test.ts`
- 实现后同一组回归测试通过。
- `npm run lint` 通过。
- `npm run test` 通过：13 个测试文件、44 个测试。
- `npm run build` 通过。
- 浏览器检查 `/practice?mode=all&train=audio` 与 `/practice?mode=vocab&train=spelling`，确认页面有“返回首页”，并显示“共 10 题 / 第 1 题 / 共 10 题”。

### 后续提醒

- 后续新增 PracticePage 训练分支时，不要在分支里各自写题量规则，最后统一走 `pickPracticeSessionQuestions`。
- 如果保留历史 query 名称（例如 `daily20`），要同步确认展示文案、实际题量和结果页总题数一致。
- 低龄练习页的返回入口要显式可见，不要只依赖底部导航或浏览器返回。

---

## 2026-04-25 听写拼写阶段隐藏答案并放大输入区

### 范围

- 今日听写页 `/dictation`
- 第 3 轮“听音拼写”
- `src/pages/DictationPage.tsx`
- `src/lib/dictationDisplay.ts`
- `src/index.css`

### 问题现象

- 进入拼写阶段时，页面主标题直接显示要拼的英文单词，例如 `too`。
- 音标、中文释义和词条 note 也会在提交前显示，孩子不需要听写就能推断答案。
- 大屏样式里输入单词的位置偏小，短视口下固定底部操作条容易跑到输入区附近，视觉顺序不稳定。

### 根因

1. 听写三轮共用同一个单词卡标题，`<h1>` 始终渲染 `currentStep.word.word`。
2. 上一轮只隐藏了辨义阶段的释义，没有把拼写阶段也纳入“提交前隐藏答案线索”的规则。
3. 提示文案继续复用 `word.note`，而 note 常常直接包含英文单词和中文释义。
4. iPad 大屏输入框沿用早期占位条尺寸，短视口仍使用固定底部操作条，容易和卡片内容抢位置。

### 处理

1. 新增 `getDictationWordCardTitle`：拼写题提交前标题显示“听音拼写”，提交后才显示正确单词。
2. 调整 `shouldShowDictationMeaningLine`：只有学习阶段或已提交答案后才显示释义。
3. 新增 `shouldShowDictationPhoneticLine`：拼写题提交前隐藏音标。
4. 拼写题提交前提示改为通用文案“听发音，把这个单词拼出来。”，不再复用含答案的 note。
5. 大屏拼写输入区放大到 `760px × 96px`，输入文字加大到 `34px`。
6. 在 `max-height: 900px` 的大屏短视口下，让底部操作条回到内容流，避免盖住或跑到输入框前面。
7. 更新回归测试，锁住拼写提交前不泄题、输入区尺寸和短视口操作条布局。

### 验证

- 先运行新增/调整的回归测试，确认旧行为失败。
- `npm run test -- tests/dictationMeaningReveal.test.ts tests/dictationSpellInputVisibility.test.ts` 通过。
- `npm run test -- tests/dictationVisualLayout.test.ts` 通过。
- Chrome headless 进入第 3 轮拼写，确认标题为“听音拼写”，音标和释义数量为 0，提示不包含答案，输入框为 `760 × 108`、输入字号 `34px`。
- Chrome headless 复查 `1024 × 768` 短视口，提交按钮位于卡片后方，不再压在输入区上。

### 后续提醒

- 拼写阶段提交前不要展示英文单词、音标、中文释义或包含答案的 note。
- 听写页的固定底部操作条要同时检查高屏和短屏，短屏优先保证输入区和操作区的阅读顺序。

---

## 2026-04-25 听写非拼写阶段移除输入占位并下移小狗

### 范围

- 今日听写页 `/dictation`
- “听写单词”模块第 1 轮认识、第 2 轮辨义、第 3 轮拼写
- `src/pages/DictationPage.tsx`
- `src/index.css`

### 问题现象

- “点击输入你听到的单词”在认识和辨义阶段也显示，但这两个阶段不能输入，视觉上像一个摆设。
- 辨义阶段小狗位置偏上，压到右侧选项区域，干扰孩子选答案。

### 根因

1. 页面用 `isSpellStep ? 输入框 : 占位条` 渲染，导致所有非拼写阶段都会出现占位条。
2. 小狗虽然已经从单词卡内容里移到页面背景层，但大屏 `top` 坐标仍靠上，和辨义选项区域太接近。
3. 选项网格没有显式层级，背景小狗靠近时容易视觉上压住可点击选项。

### 处理

1. 改成只有拼写阶段渲染 `.lesson-spell-field`，认识和辨义阶段不再渲染输入占位。
2. 删除不用的 `.lesson-answer-placeholder` 样式，避免后续误用。
3. 大屏小狗从 `top: 760px` 下移到 `top: 900px`，默认小屏位置也下移到草地区域。
4. 给 `.lesson-choice-grid` 加 `position: relative; z-index: 2;`，确保选项始终在背景装饰之上。
5. 新增 `tests/dictationSpellInputVisibility.test.ts`，锁住“听到的单词输入框只在拼写阶段出现”。

### 验证

- `npm run test -- tests/dictationVisualLayout.test.ts tests/dictationSpellInputVisibility.test.ts` 通过
- Chrome headless 跳到第 2 轮“辨义”确认占位条不存在，小狗位于选项下方草地/爱心区域

### 后续提醒

- 非交互控件不要用“像输入框”的样式占位，孩子会误以为可以点。
- 背景装饰图靠近题目选项时，必须给选项显式层级并截图确认不遮挡。

---

## 2026-04-24 听音辨义阶段隐藏释义答案

### 范围

- 今日听写页 `/dictation`
- “听写单词”模块第 2 轮“听音辨义”
- `src/pages/DictationPage.tsx`
- `src/lib/dictationDisplay.ts`

### 问题现象

- 进入“辨义”阶段时，单词下方直接显示 `释义：软的`，孩子还没作答就能看到正确答案。
- 词条提示里也可能出现 `soft 表示柔软` 这类说明，等于另一处泄题。

### 根因

1. `.lesson-meaning` 之前在所有阶段统一渲染，没有区分“认识单词”和“听音辨义”。
2. 提示文案直接复用词表 `note`，而 `note` 本身包含中文释义或近义说明。
3. 页面把普通提示 `feedback` 和“本题已提交答案”混在一起判断，音频加载失败这类普通提示也可能误触发答案展示。

### 处理

1. 新增 `shouldShowDictationMeaningLine`：听音辨义未提交前不显示释义，提交后才允许展示。
2. 新增 `getDictationHintText`：听音辨义未提交前使用通用提示“听发音，选出它的意思。”，不复用含答案的词条 note。
3. 用当前题是否已有答题记录判断“已提交”，不再用普通 `feedback` 判断答案是否可见。
4. 新增 `tests/dictationMeaningReveal.test.ts`，锁住辨义未提交前不泄露释义和提示答案。

### 验证

- `npm run test -- tests/dictationMeaningReveal.test.ts` 通过
- Chrome headless 跳到第 2 轮“辨义”后确认 `.lesson-meaning` 为空，提示为通用提示

### 后续提醒

- 听音辨义阶段所有中文释义、词条 note、选项高亮都必须等孩子提交后再展示。
- 不要再用普通 `feedback` 代表“已答题”，因为它也承载音频失败、播放失败等非答题提示。

---

## 2026-04-24 今日听写小狗放回听写页背景层

### 范围

- 今日听写页 `/dictation`
- “听写单词”模块小狗插画层级、背景位置与滚动行为
- `src/pages/DictationPage.tsx`
- `src/index.css`

### 问题现象

- 听写单词模块里的小狗插画会跟着页面内容滑动。
- 用户期望小狗放在提示文案右侧的小爱心旁、草地上方的位置，不要跟底部 UI 栏绑定。
- 后续调整时曾用 `position: fixed` + `bottom` 贴视口底部，导致小狗看起来又和底部按钮、底部导航绑定在一起。

### 根因

1. 小狗图片原来挂在 `.lesson-word-card` 内部，天然属于单词卡内容层。
2. 大屏样式虽然给了 `position: fixed`，但坐标仍靠上，视觉上没有贴到用户标注的模块右下位置。
3. 小屏样式没有单独接管小狗位置，结构一挪动就容易变成普通流式图片。
4. `fixed + bottom` 和底部操作区共用视口底部坐标系，视觉上会被误认为绑定到 UI 栏。

### 处理

1. 把小狗图片移到听写页根节点下，和单词卡分离。
2. 用 `.dictation-lesson-page > .lesson-dog-image` 做页面背景层定位，让小狗脱离单词卡内容层。
3. 大屏下改用 `absolute + top/right` 锚到听写模块背景右下：小爱心右侧、草地上方，不再使用 `bottom` 贴底栏。
4. 将播放区层级抬高，避免小狗盖住乌龟慢速播放图标；底部操作仍保持最高层。
5. 新增 `tests/dictationVisualLayout.test.ts`，用静态回归测试锁住“小狗不在单词卡内”和“大屏背景坐标不用 bottom”的约束。

### 验证

- `npm run test -- tests/dictationVisualLayout.test.ts` 通过
- Chrome headless 截图确认小狗在听写单词模块背景右下、小爱心旁边，没有贴着底部 UI 栏

### 后续提醒

- 后续再调听写页陪伴插画时，不要把小狗重新塞回 `.lesson-word-card`。
- 听写页背景小狗不要用 `bottom` 贴视口底部，否则会再次看起来和底部按钮、底部导航绑定。
- 调小狗位置时要先确认和播放按钮、底部按钮、底部导航的层级关系，避免装饰图盖住可点击控件。
---

## 2026-04-23 右上角星星接入真实奖励记录

### 范围

- 本地状态 `starRecords`
- 星星奖励规则
- 首页右上角星星入口
- 星星记录页 `/stars`
- 练习满分奖励
- 每日听写满分奖励
- `src/lib/starRewards.ts`
- `src/pages/ModeHubPage.tsx`
- `src/pages/StarsPage.tsx`
- `src/pages/PracticePage.tsx`
- `src/pages/DictationPage.tsx`
- `src/schema/studySchema.ts`
- `src/types/schema.ts`

### 问题现象

- 学习中心右上角星星之前是写死的展示数字，不能反映孩子真实获得的奖励。
- 星星没有可点击记录页，家长和孩子无法知道每颗星是在哪次训练里获得的。

### 根因

1. 之前星星只是视觉稿里的装饰元素，没有进入本地状态模型。
2. 训练完成逻辑只保存 session 和错题，没有在满分完成时写奖励记录。
3. 每日听写有自己独立的完成流程，如果只改 `PracticePage`，听写满分不会获得星星。

### 处理

1. 新增 `StarRecord` 和 `starRecords` 本地状态字段，并在 schema 解析里兼容旧缓存。
2. 新增 `starRewards` 纯函数模块：
   - 只有 `score === total` 且 `total > 0` 才算满分训练。
   - 同一个 `sourceType + sourceId` 只发一次星星，防止刷新重复加星。
3. `PracticePage` 在训练完成时，如果本轮满分，就写入 1 条练习星星记录。
4. `DictationPage` 在每日听写完成时，如果测验题全对，也写入 1 条听写星星记录。
5. `ModeHubPage` 右上角星星改为真实计数，并链接到 `/stars`。
6. 新增 `StarsPage`，展示星星总数、获得时间、训练来源和满分分数。
7. 更新 `docs/product-conventions.md` 和设计说明，明确星星不能再写死。

### 验证

- `npm run test -- tests/starRewards.test.ts` 通过
- `npm run lint` 通过
- `npm run test` 通过：9 个测试文件、25 个测试
- 浏览器确认首页右上角星星为可点击入口，跳转到 `/stars`
- `npm run build` 通过

### 后续提醒

- 后续如果新增新的训练完成入口，必须调用 `awardPerfectTrainingStar`，不要在页面里手写加星逻辑。
- 不要用展示数字冒充星星数量，右上角必须从 `starRecords.length` 读取。
- 同一轮训练的 `sourceId` 要稳定唯一，否则可能重复发星或漏发。

---

## 2026-04-23 学习中心首页化

### 范围

- 首页路由 `/`
- 兼容入口 `/modes`
- 底部导航激活态
- `src/router/AppRouter.tsx`
- `src/components/AppLayout.tsx`
- `docs/design/ui-generation-to-figma-workflow.md`

### 问题现象

- 学习中心已经承载了日常学习和其他学习模式，但真实首页 `/` 仍然是旧“今日任务”页。
- 底部导航的“词表”此前指向 `/modes`，如果直接把学习中心当首页，会出现“首页”和“词表”两个导航项都进入同一个页面的混乱。

### 根因

1. 上一轮为了不破坏旧首页，先把学习中心放在 `/modes`。
2. 底部导航还沿用了“词表 = 学习入口”的临时映射。

### 处理

1. 将 `/` 改为渲染 `ModeHubPage`，学习中心正式成为首页。
2. 保留旧今日任务页到 `/today`，作为临时兜底入口。
3. 将 `/modes` 改为重定向到 `/`，避免历史链接失效。
4. 底部导航中：
   - “首页”负责学习中心、听写、练习和结果页激活态。
   - “词表”改为指向 `/wrong`，并覆盖错题与复习相关页激活态。

### 验证

- Playwright 1024×1366 截图：`ipad-home-modehub-v1.png`
- 浏览器确认访问 `/modes` 会重定向到 `/`
- `npm run lint` 通过
- `npm run test` 通过：8 个测试文件、22 个测试
- `npm run build` 通过

### 后续提醒

- 后续如果要做真正的完整词表页，应新建明确的词表路由，不要再把 `/modes` 复用成第二个首页。
- 首页已经是学习中心，新增学习入口优先改 `ModeHubPage`，不要回到旧 `HomePage` 上加入口。

---

## 2026-04-23 日常学习和其他学习模式接入

### 范围

- 学习中心入口 `/modes`
- 日常学习路线：今日 10 分钟、每日 20 题、等级闯关
- 其他学习模式：听力选择、拼写练习、中译英、对话填空、错题优先、间隔复习、收藏单词
- `src/pages/ModeHubPage.tsx`
- `src/pages/PracticePage.tsx`
- `src/router/AppRouter.tsx`
- `src/components/AppLayout.tsx`
- `src/index.css`
- `docs/design/ui-generation-to-figma-workflow.md`

### 问题现象

- 首页和听写页已经贴近参考图，但“日常学习”和其他训练模式仍然缺少统一入口。
- 如果继续把每个训练模式散落在首页按钮里，孩子不容易判断今天该点哪里。
- 练习页原本同时显示“上一题 / 下一题”和底部提交按钮，在 iPad 固定导航下容易被遮住。

### 根因

1. 原 UI 只针对首页和听写两个关键屏幕做了视觉重排，没有把模式入口做成独立学习中心。
2. `PracticePage` 已经支持多种 `train` 分支，但入口层没有清晰暴露这些分支。
3. 固定底部导航在 iPad 大屏上高度更大，练习页没有把操作区压缩成单层按钮条。

### 处理

1. 先使用生图功能生成“学习中心 + 每日练习”的 iPad Pro 概念图，保存到 `docs/design/woe-l2-study-modes-ui-concept.png`。
2. 新增 `/modes` 学习中心，把“今日学习路线”和“学习模式”分开：
   - 日常学习路线进入 `/practice?mode=all&train=today10|daily20|level10`
   - 听写单词继续进入 `/dictation`
   - 其他学习模式统一进入现有 `/practice` 的 `train` 分支
3. 底部导航的“词表”改为指向 `/modes`，同时把 `/dictation`、`/practice`、`/wrong`、`/review`、`/result` 视为同一学习区激活态。
4. 练习页 iPad 样式接入生图插画，并把底部操作改成单层操作条：上一题 / 提交 / 下一题，避免被固定导航遮住。
5. 将 `/modes` 和每日练习页捕获到 Figma 文件：
   - 学习中心节点：`node-id=8-2`
   - 每日练习节点：`node-id=7-2`
6. 新增 `docs/design/ui-generation-to-figma-workflow.md`，把“生图 -> 资产拆分 -> Figma 捕获 -> 项目落地 -> 视觉验证 -> 文档维护”固化为后续流程。

### 验证

- Playwright 1024×1366 截图：
  - `ipad-modes-hub-v3.png`
  - `ipad-practice-daily-v3.png`
- Figma 捕获成功写入：`https://www.figma.com/design/6vPBHMOfSH7TqMqZFXMsbk`
- `npm run lint` 通过
- `npm run test` 通过：8 个测试文件、22 个测试
- `npm run build` 通过

### 后续提醒

- 后续新增学习模式时，优先复用 `/practice?mode=...&train=...`，不要为了入口新建重复练习页。
- 只要使用 Figma capture 脚本，完成后必须从 `index.html` 移除。
- iPad 固定底部导航会遮挡页面下缘，新增按钮区时先在 `1024 x 1366` 检查是否被压住。

---

## 2026-04-23 生图资产拆分与 iPad Pro 比例落地

### 范围

- 首页 iPad Pro 视觉稿落地
- 听写页 iPad Pro 视觉稿落地
- Figma 捕获文件
- `public/images/ui-ipad/`
- `src/pages/HomePage.tsx`
- `src/pages/DictationPage.tsx`
- `src/components/AppLayout.tsx`
- `src/index.css`

### 问题现象

- 仅靠 CSS 画兔子、小狗和装饰图标，和用户给的参考图仍然不像同一套视觉资产。
- 之前主要按手机宽度调 UI，但用户新要求明确要 iPad Pro 屏幕比例。
- Figma 里需要保留能对照的设计稿，而不是只在代码里调样式。

### 根因

1. CSS 插画适合占位，不适合追求“和图里一模一样”的儿童插画质感。
2. 参考图是大屏竖向平板比例，继续用 390px 手机布局会导致卡片、字号、间距全部失真。
3. Figma MCP 的 `use_figma` headless 环境不支持 `fetch` 和 `createImageAsync`，不能直接从本地 dev server 拉 PNG 组装图片节点。

### 处理

1. 使用生图功能生成两组资产：
   - 儿童、兔子、小狗、星星、钟表、礼物、耳机、复习书、爱心气泡、草地云朵
   - 慢速乌龟、统计 check/fire/medal、底部导航图标、铅笔等小图标
2. 将生图资产裁切成单独 PNG，保存到 `public/images/ui-ipad/`，项目和 Figma 捕获共用同一批资源。
3. 首页和听写页新增 iPad Pro 断点，按 1024×1366 比例重排：
   - 首页保持参考图的 WOE L2、今日任务、两张主入口、统计卡、薄弱词卡、底部导航。
   - 听写页保持参考图的顶部栏、5/20 进度、大单词卡、双播放按钮、输入提示、小狗和底部操作。
4. 用 Figma `generate_figma_design` 把首页和听写页捕获到新文件：
   - `https://www.figma.com/design/6vPBHMOfSH7TqMqZFXMsbk`
   - 首页节点：`node-id=4-2`
   - 听写页节点：`node-id=5-2`
5. 捕获用脚本只临时加入 `index.html`，完成后已移除，避免进入正式项目。

### 验证

- Playwright 1024×1366 截图：
  - `ipad-home-assets-v2.png`
  - `ipad-dictation-assets-v2.png`
- Figma 首页节点截图验证通过。
- 听写页已成功写入 Figma；第二次 Figma 截图受 Starter 计划 MCP 调用上限影响未能再次拉取，但本地同尺寸截图已验证。
- `.omx/state/ui-redesign/ralph-progress.json` 更新为视觉分数 94，结论 pass。

### 后续提醒

- 以后继续改这套 UI，优先改 `public/images/ui-ipad/` 的资产和 1024×1366 断点，不要回到 CSS 手绘插画。
- 捕获 Figma 时如果需要再加脚本，完成后必须移除，不要把 `https://mcp.figma.com/.../capture.js` 留在正式 HTML。
- 听写页展示层为了贴参考图显示 `5 / 20`，但内部三轮听写流程仍然是原来的业务逻辑；后续如果要产品真实进度，也要先确认用户是否还要求视觉完全一致。

---

## 2026-04-23 按参考图重排首页与听写页

### 范围

- 首页首屏
- 听写页学习态
- 底部四栏导航
- `src/pages/HomePage.tsx`
- `src/pages/DictationPage.tsx`
- `src/components/AppLayout.tsx`
- `src/index.css`

### 问题现象

- 之前的 UI 虽然已经比原型更柔和，但还没有完全贴住用户给的参考图。
- 首页首屏信息偏高，“需要加强的单词”不能像参考图那样在底部导航上方露出。
- 听写页缺少参考图里最关键的大单词卡、双圆形播放按钮和陪伴插画氛围。

### 根因

1. 上一轮更偏通用设计系统收敛，没有把参考图当作逐屏约束来排版。
2. 首页保留了太多通用入口信息，导致首屏密度和参考图不一致。
3. 听写页仍沿用旧卡片组件结构，业务信息完整但视觉不像参考图右侧屏幕。

### 处理

1. 首页改成参考图结构：
   - 顶部 `WOE L2` 标识
   - 橙色今日任务插画卡
   - 听写 / 复习两个主入口
   - 学习统计三列卡
   - 薄弱单词 chips
2. 原“更多训练模式”没有删除，折叠放到首屏之后，避免为了视觉丢功能。
3. 听写页学习态改成参考图结构：
   - 顶部返回按钮、标题、星星数量
   - 进度条
   - 大单词卡
   - 正常播放 / 慢速播放双按钮
   - 输入提示、提示句、小狗插画
   - 底部“我记住了 / 不会”操作条
4. 底部导航从六项收敛成四项，并用 CSS 图标模拟参考图里的首页、词表、统计、我的。

### 验证

- `npm run lint`
- `npm run test`
- `npm run build`
- Playwright 手机视口截图：
  - `home-reference-implementation-v2.png`
  - `dictation-reference-implementation-v4.png`
- `$visual-verdict` 结果写入 `.omx/state/ui-redesign/ralph-progress.json`，分数 91，结论 pass。

### 后续提醒

- 用户这轮明确要“按图片一比一复制”，以后不要再从通用 UI 审美重新发散，先保住参考图的屏幕结构。
- 如果继续追求更像，下一步应把参考图里的兔子、小狗拆成固定 SVG/PNG 资产，而不是继续堆 CSS 装饰。
- 首页首屏高度要持续关注，底部导航上方至少要露出薄弱词 chips，否则又会回到“看起来不像图”的问题。

---

## 2026-04-23 首页与学习页视觉层级偏平

### 范围

- 首页
- 听写页
- 练习页
- 结果 / 复习 / 错题本 / 家长看板 / 设置页
- `src/index.css`
- 多个页面组件的结构化信息展示

### 问题现象

- 页面虽然能用，但首页“今天先做什么”和“其它入口是什么”视觉差异不够明显。
- 学习页、结果页、家长页之间缺少统一的视觉语言，像一组能用但没收过口的原型页。
- 原来的蓝紫渐变和白卡片组合偏平，儿童学习产品该有的温暖感、节奏感和鼓励感不够。

### 根因

1. 全局样式之前更像“把基础组件先摆出来”，缺少统一的颜色 token、卡片层级和页面头部结构。
2. 首页和信息页大多直接堆 `p` 标签，重点数据没有被整理成能一眼扫清的统计块。
3. 不同页面各自长自己的样子，导致用户每进一页都要重新适应信息分布。

### 处理

1. 参考 `awesome-design-md` 里的暖色卡片层级和 `huashu-design` 的“反 AI slop”思路，重做了全局视觉 token：
   - 暖底色
   - 卡片顶部分色条
   - 更清晰的统计块
   - 统一的页面 hero 区
2. 首页改成“今日主线 + 听写入口 + 学习总览 + 快捷入口”的结构，保持原功能和路由不变。
3. 听写页、练习页、结果页、家长页等统一成同一套卡片、标签、进度条和按钮语言。
4. 没有改题库、播放逻辑、错题逻辑和数据结构，只调整展示结构与样式。

### 验证

- `npm run lint`
- `npm run test`
- `npm run build`
- 本地浏览器查看首页、听写页、设置页
- 额外检查了手机宽度下首页布局没有挤坏，底部导航仍可点击

### 后续提醒

- 以后再改 UI，优先保持“今日主线入口最醒目、统计信息块次之、次级入口更轻”的层级，不要把所有按钮做成同等视觉重量。
- 儿童学习场景尽量保持暖色、短句和大触达面积，不要又退回成人工具站那种冷白 + 细字 + 密集信息墙。
- 如果继续扩展页面，优先复用这一轮建立的 page hero、stats grid、card tone 这些结构，不要重新各页各画一套。

---

## 2026-04-23 滚动时底部导航层级不稳定

### 范围

- 底部导航浮层
- 移动端滚动安全区
- `src/index.css`

### 问题现象

- 手机宽度下滚动页面时，底部导航和内容卡片的层级关系不够稳定。
- 页面底部内容靠近导航时，视觉上容易觉得导航被内容抢层级，或者最后一个入口离导航太近。

### 根因

1. 页面主体设置了定位和 `z-index`，但底部导航没有明确的顶层 `z-index`。
2. 底部导航贴着视口底部，缺少独立浮动距离和安全区处理。
3. 页面底部留白只按旧导航高度估算，改成浮动 dock 后需要同步补足滚动末端空间。

### 处理

1. 给 `.bottom-nav` 增加明确 `z-index: 100` 和 `isolation: isolate`，确保滚动时始终浮在内容上方。
2. 把底部导航改成居中的玻璃浮动 dock，增加四角圆角、阴影和 active 状态。
3. 新增 `--bottom-nav-space`，页面底部 padding 使用 `env(safe-area-inset-bottom)`，避免移动端最后内容被导航压住。

### 验证

- 手机宽度滚动到首页底部，`elementFromPoint` 命中 `.bottom-nav`，确认导航在最上层。
- 手机宽度滚动到页面最底部，最后一个入口和底部导航之间仍保留可读留白。
- `npm run lint`
- `npm run test`
- `npm run build`

### 后续提醒

- 以后只要继续改固定底栏，必须同时检查 `z-index`、安全区、页面底部 padding 三件事。
- 不要只调底栏外观而忘记滚动末端留白，否则手机端最下面的按钮会被半遮住。

---

## 2026-04-23 生图 + Figma 后的 UI 二次收敛

### 范围

- UI 方向稿
- Figma 画布
- 首页与听写页视觉落地
- `src/index.css`
- `docs/design/woe-l2-ui-concept.png`

### 问题现象

- 第一轮 UI 优化虽然比原来更丰富，但整体还是偏散，背景装饰、卡片阴影和底部导航都在抢注意力。
- 视觉没有先经过稳定稿约束，导致项目里直接调 CSS 容易越调越像“元素堆叠”。

### 根因

1. 没有先把首页和听写页作为关键屏做视觉定稿。
2. 全局样式里的装饰性 radial 和卡片浮层太多，儿童学习产品需要温暖但不应该杂乱。
3. 底部 dock 需要像独立导航控件，而不是页面内容的一部分。

### 处理

1. 先生成 UI 方向图，并保存到 `docs/design/woe-l2-ui-concept.png`。
2. 新建 Figma 文件，把方向稿转成可执行的首页与听写页双屏画布：
   - 暖奶油背景
   - 纸感圆角主屏
   - 首页三块学习状态
   - 今日任务和听写主卡
   - 听写页大词卡和底部浮动 dock
3. 根据 Figma 方向回写 `src/index.css`：
   - 降低背景装饰噪音
   - 收敛阴影和卡片边框
   - 让底部 dock 更独立、更克制
   - 保留大按钮和大触达面积

### 验证

- 本地查看首页手机宽度
- 本地查看听写页手机宽度
- Figma 画布截图检查主要结构
- `npm run lint`
- `npm run test`
- `npm run build`

### 后续提醒

- 以后如果用户继续反馈“不好看”，不要直接在 CSS 里盲调，先补一张关键屏视觉稿或 Figma 画布再落地。
- 首页和听写页是本项目的视觉锚点，别让设置页、家长页之类的次级页反向牵引整体风格。
- 底部 dock 要保持独立、轻、稳定，不要加太多颜色块或重阴影。

---

## 2026-04-22 播放竞态与 IndexTTS2 稳定化

### 范围

- 听写页/练习页慢速播放反馈
- 本地慢速音频播放链路
- `fast` / `hard` 的本地普通版与慢速版音频

### 问题现象

- 有些单词点击“慢速播放”时，页面先显示“当前单词暂无本地慢速语音”，过一会又真的播出来。
- `fast` 发音不完整。
- `hard` 尾音有抖动和拖尾感。

### 根因

1. 前端之前把所有播放失败都折叠成了布尔值，无法区分：
   - 文件真的不存在
   - 播放请求被新的请求打断
   - 首次加载还在预热
2. 听写页存在自动播放和手动慢速播放的竞态，两个请求共用同一个全局 `Audio` 实例时，旧请求会被打断。
3. Service Worker 会兜底拦截站内 GET 请求，音频的 `/audio/` 与 `Range` 请求也可能被带进缓存链路，不利于媒体首播稳定性。
4. IndexTTS2 如果持续拿“上一轮生成出来的单词音频”继续当提示源，会把伪影、拖尾和节奏漂移递归放大。

### 处理

1. 把播放结果改成显式区分：
   - `missing`
   - `stale`
   - `failed`
2. 对 `stale` 不再提示“暂无本地慢速语音”，只在真正 `missing` 时才显示缺文件提示。
3. 给本地慢速音频增加预热逻辑，并在手动播放前清掉自动播放定时器。
4. Service Worker 对 `/audio/` 与带 `Range` 头的请求直接放行，不走缓存代理。
5. 音频生成改用固定系统女声参考提示：
   - `Microsoft Zira Desktop`
6. 只替换通过筛查的候选，不整批盲目覆盖正式音频。

### 验证

- `npm run lint`
- `npm run test`
- `npm run build`
- 生产预览页点击听写页 `hot` 的“慢速播放”，不再先弹“暂无本地慢速语音”
- 替换后的 4 个正式音频文件测得尾部能量为 `0`，且慢速版时长不再短于普通版

### 后续提醒

- 以后再修本地音频时，不要把“试听感觉不好”的词整批重生后直接全量覆盖进仓库，先做候选筛查。
- 如果慢速版时长比普通版还短，先判定为可疑样本，不要直接入库。
- 如果用户再次反馈“先报没音频，过一会又能播”，优先排查请求竞态和误报逻辑，不要先怪网络。

---

## 2026-04-22 今日听写词图错配与固定词图接管

### 范围

- 今日听写页单词提示图
- 每日词汇拼写页提示图
- `src/lib/wordImage.ts`
- `functions/api/word-image.js`

### 问题现象

- 今日听写页里有些单词的提示图和单词意思对不上。
- 抽象词和功能词尤其容易出现“图能看，但不是这个词”的情况。

### 根因

1. 前端之前只按 `word` 做图片缓存键，没有把 `hint` 一起纳入缓存，同一个词一旦拿到一张图，后续不同上下文也会复用。
2. 线上 `/api/word-image` 之前也主要按单词本身固定 seed，提示词约束不够强，像 `too`、`but`、`same` 这类词更容易生成偏题图。
3. 今日词汇本身数量固定，继续依赖每次在线即时生成，稳定性不如直接落成项目内固定资源。

### 处理

1. 用 GPT 为今日 12 个听写词生成统一风格的儿童词卡图片。
2. 把最终资源落到 `public/images/dictation-words/*.webp`，前端优先读取项目内固定图。
3. 前端图片缓存键改为同时包含 `word + hint`。
4. 服务端图片接口提升缓存版本，并把 `hint` 纳入 seed，同时加强提示词里的“按具体意思生成”约束。

### 验证

- `npm run lint`
- `npm run test`
- `npm run build`
- 核对今日 12 个词都能直接命中本地图，不再依赖在线随机出图

### 后续提醒

- 如果以后再更新“每日听写词”，要同步补上对应固定图，否则这些词会重新退回在线即时生成。
- 抽象词、功能词、语法词不要只信“随机生图第一次看着还行”，最好直接改成固定图资产。
- 如果再次出现“同一个词在不同页面显示成同一张不对的图”，先查缓存键是否遗漏上下文字段。

---

## 2026-04-22 今日听写拼写题缺少错字高亮

### 范围

- 听写页第 3 轮“听音拼写”
- `src/pages/DictationPage.tsx`
- `src/lib/spellingFeedback.ts`

### 问题现象

- 孩子在今日听写的拼写题里写错单词后，只看到一条普通文字提示。
- 页面没有告诉孩子具体错在哪个字母，也没有把正确单词直观显示出来。

### 根因

1. 之前拼写提交流程只记录对错和一条字符串反馈，没有单独保存逐字比对结果。
2. 页面层也没有红绿高亮区块，所以即使知道“拼错了”，孩子还是不容易看出具体差异。

### 处理

1. 新增 `buildSpellingFeedback`，按字母位置生成逐字比对结果。
2. 拼写题答错后保留孩子输入内容。
3. 在输入框下新增两行反馈：
   - “你写的”：错误字母红色，正确位置保持默认色
   - “正确单词”：整词绿色
4. 题目仍停留当前页，按钮继续显示“下一题”。

### 验证

- `npm run test -- tests/spellingFeedback.test.ts`
- `npm run lint`
- `npm run test`
- `npm run build`

### 后续提醒

- 以后如果再改拼写判题，不要只改提示文案，先确认“逐字反馈数据”和“页面显示”两层是否一起改了。
- 对低龄学习场景，单独告诉“答错了”通常不够，要优先给出能直接看懂的红绿差异提示。

---

## 2026-04-22 今日听写结算页错误信息过于笼统

### 范围

- 今日听写完成页错题汇总
- `src/pages/DictationPage.tsx`
- `src/lib/dictationSummary.ts`

### 问题现象

- 每日听写全部完成后，只能看到“哪些单词错了几次”。
- 页面没有明确告诉用户：这个词是意思错了，还是拼写错了，也看不到当时具体答了什么。

### 根因

1. 结算页之前只按单词聚合了 `wrongCount`，没有把不同题型的错误细节继续保留下来。
2. 虽然原始 `answers` 里已经有 `type`、`userAnswer`、`correctAnswer`，但完成页没有把这些信息结构化展示。

### 处理

1. 新增 `summarizeWrongDictationAnswers`，按单词汇总错误，并拆分为：
   - `meaningMistakes`
   - `spellingMistakes`
2. 完成页错题卡片改为按单词展示详细记录：
   - 意思错了：显示孩子选了什么，正确中文是什么
   - 拼写错了：显示孩子写了什么，正确单词是什么
3. 顶部继续保留“本轮错了几次”的总览信息。

### 验证

- `npm run test -- tests/dictationSummary.test.ts`
- `npm run lint`
- `npm run test`
- `npm run build`

### 后续提醒

- 以后如果再扩展听写题型，结算页不要只补计数，先确认“完成页是否还能看出错题类型和错误内容”。
- 对复习页和结果页来说，孩子和家长最关心的是“错在哪”，不是单纯“错了几次”。

---

## 2026-04-22 今日听写缺少最近一周薄弱词统计

### 范围

- 今日听写完成页
- 本地听写历史持久化
- `src/lib/dictationHistory.ts`
- `src/pages/DictationPage.tsx`

### 问题现象

- 每次做完每日听写，只能看到本轮错题，没法立刻知道最近 7 天里哪些词反复出错。
- 家长也看不到这些高频错词主要是“意思错”还是“拼写错”。

### 根因

1. 原有本地状态只保存了通用练习 `sessions` 和错题本 `wrongBook`，没有单独保存听写页自己的分词错误历史。
2. 听写页虽然能在本轮完成时生成详细错题信息，但这些数据没有跨天累计，所以做不了真实的一周统计。

### 处理

1. 新增 `dictationHistory` 本地状态字段，按轮次保存听写错词历史。
2. 每轮每日听写完成后，把本轮错词及其错误类型计数写入本地历史。
3. 新增最近 7 天汇总逻辑，按词累计：
   - 本周总错误次数
   - 意思错了几次
   - 拼写错了几次
   - 主要错在什么部分
4. 在听写完成页新增“本周高频错词”卡片，做完就能直接看到。

### 验证

- `npm run test -- tests/dictationWeeklySummary.test.ts`
- `npm run lint`
- `npm run test`
- `npm run build`

### 后续提醒

- 以后如果再改听写历史结构，必须同步更新本地状态解析，不然旧浏览器缓存里的数据会直接丢掉新字段。
- 做“最近 7 天”类统计时，不要直接拿错题本 `wrongBook` 推断，它没有题型维度，也不能准确区分意思错和拼写错。

---

## 2026-04-26 今日听写拼写题提前露出答案

### 范围

- 今日听写拼写题词卡
- `src/pages/DictationPage.tsx`
- `src/lib/dictationDisplay.ts`

### 问题现象

- 孩子进入“听音拼写”题时，还没作答就直接在词卡上看到英文单词、音标和中文释义。
- 这样会把拼写答案提前暴露出来，拼写题就失去练习意义了。

### 根因

1. 拼写题词卡继续复用了新词学习页的展示方式，默认直接渲染 `word / phonetic / meaning`。
2. 之前本地已经有一版“提交前隐藏答案”的修复，但它停留在本地工作区，没有真正进入生产分支，所以线上一直还是旧行为。

### 处理

1. 新增 `dictationDisplay` helper，统一收口听写页不同阶段该显示什么内容。
2. 拼写题未提交前：
   - 主标题改成“听音拼写”
   - 隐藏音标
   - 隐藏中文释义
   - 提示语改成不含答案的通用引导
3. 提交后再恢复单词、音标、释义和正常提示，保持复盘反馈完整。
4. 新增回归测试，专门锁定“拼写题提交前不能露答案”这条规则。

### 验证

- `npm run test -- tests/dictationMeaningReveal.test.ts`
- `npm run lint`
- `npm run test`
- `npm run build`

### 后续提醒

- 以后修听写页展示逻辑时，不要只在本地改到“看起来对”，必须确认补丁已经提交、推送并完成部署。
- 对“辨义 / 拼写 / 学习”三种阶段，显示内容要分开约束，不能共用同一套默认词卡展示。

---

## 2026-04-26 Cloudflare Pages 部署步骤依赖隐式 Wrangler 版本

### 范围

- GitHub Actions 部署流程
- `.github/workflows/pages-deploy.yml`

### 问题现象

- 本地 `lint / test / build` 全部通过。
- GitHub Actions 里的 `Install deps` 和 `Build` 也通过了，但 `Deploy to Cloudflare Pages` 单独失败，导致修复代码虽然进了 `main`，站点却没有更新。

### 根因

1. 工作流把 `wrangler-action` 的运行细节完全交给默认值处理，没有显式固定 Wrangler 主版本。
2. 该 action 还会根据仓库锁文件自动判断包管理器，出问题时日志信息很少，定位成本高。

### 处理

1. 在部署步骤里显式指定：
   - `wranglerVersion: "4"`
   - `packageManager: "npm"`
2. 保持其余部署命令不变，只收紧最容易漂移的默认配置。

### 验证

- 确认 GitHub Actions 重新触发 `pages-deploy.yml`
- 确认最新 run 针对修复 commit 重新执行
- 部署成功后再抓线上 HTML 校验静态资源 hash 更新

### 后续提醒

- 以后如果 Cloudflare 部署只在 `Deploy` 步骤报错，先看是不是 action 的默认 Wrangler 版本或包管理器推断漂移了。
- 对这种第三方部署 action，能显式写清楚的关键版本尽量不要完全依赖默认值。
