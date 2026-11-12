# 项目错误与规则冲突审计

- 日期：2026-11-12（Asia/Shanghai）
- 修复前审计基线版本：`8cfe088a1c5f7cd9dea726abc5b960e007ac43be`
- 范围：答题、听写、周复习、复习任务、本地存储、学习统计和音频路由。

## 修复状态

F1–F8 已完成本地修复和回归验证。听写与普通练习通过统一学习记录更新长期已学资格、复习任务和统计；展示及判题问题已修正，清空后重新创建独立初始状态，基础题慢速使用独立本地音频。

- `npm run lint`、246 项测试和 `npm run build` 已通过。
- 主代理已完成真实浏览器的 17 词、34/34 全对听写，家长页显示 1 轮、17 个已学词；不以函数模拟替代这项浏览器验证。
- 基础题普通/慢速资源共 117 组、234 个 WAV；全站 334 个 WAV。普通与慢速分别合成，播放器速率固定为 1，未提供对应慢速时明确提示。
- [修复后 smoke 脚本](I:/xiuxiuyingyu/deliverables/review-audit-20261112.mjs) 直接调用真实 `recordCompletedTraining`，检查全对听写的已学资格、到期任务、星星、长期保留及清空后的隔离状态。脚本只使用进程内模拟存储。
- 发布渠道：推送 `main` 后由 [Cloudflare Pages 工作流](https://github.com/fengfengfeng132/xiuxiuyingyu-site/actions/workflows/pages-deploy.yml) 发布；线上核验以本次 `dist` 的 JS/CSS 与音频 SHA256 一致为准，执行结果在本次交付回复中说明。

## 修复前审计基线

以下保留最初确认的 8 项错误、触发条件和根因，作为修复前证据。详细位置及行号对应上述基线版本，当前代码行号可能已经变化；不表示这些问题仍然存在。

| 编号 | 优先级 | 问题 | 证据方式 |
| --- | --- | --- | --- |
| F1 | P1 | 听写全对的新词没有进入已学记录和复习任务进度 | 真实 helper 与页面完成分支的隔离复现 |
| F2 | P1 | 中译英在作答前展示正确英文 | 题型转换与渲染代码直接对应 |
| F3 | P1 | 跟读只识别到目标中的单个字母或短词也会通过 | 运行真实判定函数 |
| F4 | P2 | 清空本地记录后可恢复已污染的默认错题和任务 | 内存存储隔离复现 |
| F5 | P2 | 拼写练习与听写对 iPad 弯撇号判定不一致 | 两种实际判题路径对照 |
| F6 | P2 | 仅保留 30 轮答案会使已学词失去周复习资格 | 实际选择器前后对照 |
| F7 | P2 | 无本地音频的部分基础词仍使用前端伪慢速 | 实际模块与音频边界桩复现 |
| F8 | P2 | 学习统计仍混有示例值和错误的累计口径 | 静态数据流确认 |

P1 表示直接破坏学习或判题关键行为，P2 表示需要修正的功能一致性或数据问题；本次未发现需要立即停站的 P0。

## 修复前详细发现

### F1：听写正确记录与周复习、统计没有接通

- 位置：[DictationPage.tsx:283](I:/xiuxiuyingyu/src/pages/DictationPage.tsx:283)、[reviewSelection.ts:153](I:/xiuxiuyingyu/src/lib/reviewSelection.ts:153)、[ParentPage.tsx:25](I:/xiuxiuyingyu/src/pages/ParentPage.tsx:25)。
- 触发：孩子只使用每日听写，把当前 17 个新词的 34 道辨义/拼写题全部做对，再进入一周再背。
- 根因：听写完成分支只保存星星和非空错词摘要，没有保存各词的正确答案或已学 ID，也没有调用任务答题进度更新。周复习只从普通练习答案等来源识别已学词，家长统计也只读取普通练习轮次。
- 实测：完成分支得到 `perfectAnswers=34, stars=1, sessions=0, dictationHistory=0`；将这 17 个当前新词交给真实周复习选择器，候选结果为 `0`。一个此前已到期的 baby 任务，在这轮正确听写后仍为未完成。
- 影响：页面仍可能选出归档旧词，并非整个周复习页面空白；问题是这些刚正确学完的新词没有进入复习资格。正确听写也不能为复习降权或完成对应到期任务，家长端漏计这轮学习。
- 建议：统一保存普通练习与听写的分词答题事件，同时保存全对轮次；由相同事件源更新已学资格、复习任务与统计，保留题型差异，避免再建互不联通的计数。

### F2：中译英提前展示正确英文

- 位置：[PracticePage.tsx:306](I:/xiuxiuyingyu/src/pages/PracticePage.tsx:306)、[PracticePage.tsx:879](I:/xiuxiuyingyu/src/pages/PracticePage.tsx:879)。
- 触发：学习中心进入“中译英”。
- 证据：该模式把 `question.prompt` 作为英文正确选项，但题卡标题只对听力和拼写特殊处理，中译英仍直接显示 `question.prompt`。
- 例子：题干是“请选择‘婴儿’对应的英文单词”，标题却直接写出 `baby`。
- 影响：孩子可以照抄答案，正确率无法代表中译英掌握情况；同一基础题在不同模式的显示规则不一致。
- 建议：按题型定义统一的作答前/提交后展示策略，中译英提交前显示中文或通用题名，并检查音标等线索是否也应隐藏。

### F3：跟读判定接受过短子串，绕过分数阈值

- 位置：[speechAssessment.ts:139](I:/xiuxiuyingyu/src/lib/speechAssessment.ts:139)。听写与普通练习均复用此函数。
- 真实函数输出：`assessSpokenText('elephant', 'a')` 返回 `score=13, passed=true`；整句 `The zebras are scared and they run away.` 仅识别出 `the`，仍返回 `score=9, passed=true`。
- 根因：除分数阈值外，还允许 `normalizedTarget.includes(normalizedTranscript)` 直接通过，因此一个匹配字母就能越过 78/70 分要求。
- 影响：没有完整读出单词或句子也会显示判定通过，削弱跟读训练的反馈可信度。
- 建议：移除无约束子串通过条件，统一要求足够的词/字符覆盖率；对识别遗漏与额外口头词的容错分别定义，补充单字母、单短词和完整读音的回归场景。

### F4：清空记录后，旧错题和复习任务可能恢复

- 位置：[storage.ts:22](I:/xiuxiuyingyu/src/lib/storage.ts:22)、[storage.ts:55](I:/xiuxiuyingyu/src/lib/storage.ts:55)、[SettingsPage.tsx:13](I:/xiuxiuyingyu/src/pages/SettingsPage.tsx:13)。
- 触发：当前页面生命周期从空存储直接进入听写，首次答错后在设置中清空记录。
- 根因：无存储时 `loadState()` 返回同一个可变 `initialState`。首次听写错误写回流程会修改这个默认对象；清空只移除 localStorage 键并跳转，未重建内存中的默认状态。
- 隔离实测：清空后存储键确实不存在，但再次 `loadState()` 仍返回 `remainingWrongWords=1, remainingTasks=4`，后续保存还可将它们重新写回。
- 影响：清空行为与页面承诺不一致，用户会看见已经删除的错词/任务重新出现。
- 建议：用工厂函数每次创建独立初始状态，读取失败也不得返回共享可变对象；验证清空后继续使用应用、重新保存及刷新等完整路径。

### F5：iPad 弯撇号在拼写练习与听写中判定相反

- 位置：[PracticePage.tsx:810](I:/xiuxiuyingyu/src/pages/PracticePage.tsx:810)、[DictationPage.tsx:365](I:/xiuxiuyingyu/src/pages/DictationPage.tsx:365)、[spellingFeedback.ts](I:/xiuxiuyingyu/src/lib/spellingFeedback.ts)。
- 触发：旧词 `isn't` / `aren't` 在拼写练习中出题，iPad 智能标点将普通撇号转换成弯撇号。
- 实测：输入 `isn’t`，普通拼写的 `trim().toLowerCase()` 相等判断返回 `false`，听写复用的 `buildSpellingFeedback` 返回 `isCorrect=true`。
- 影响：同样的正确输入，在一个入口正确、另一个入口被加入错题本，并进一步提高复习权重。
- 建议：两个入口共用现有拼写判定函数，不再单独比较字符串；保留孩子原始输入用于错误复盘。

### F6：最近 30 轮之外的已学词可能失去周复习资格

- 位置：[PracticePage.tsx:728](I:/xiuxiuyingyu/src/pages/PracticePage.tsx:728)、[reviewSelection.ts:60](I:/xiuxiuyingyu/src/lib/reviewSelection.ts:60)、[reviewSelection.ts:153](I:/xiuxiuyingyu/src/lib/reviewSelection.ts:153)。
- 触发：一个未被归档、从未答错的基础词曾经正确学过，随后又完成 30 轮其他练习。
- 根因：完整轮次只保留最近 30 条，周复习将这些记录中的答案当作长期“已学”依据，没有独立、持久的分词学习状态。
- 实测：用真实基础词 keyboard 和真实选择器做前后对照，保留其学习记录时有复习资格，后续 30 轮截断该记录后，资格从 `1` 变为 `0`；这时该词是在五天前学的，并非时间过久。
- 影响：历史保留策略改变了复习资格；学得更多反而会让部分旧词不再被识别为学过。
- 建议：完整轮次可以设保留上限，但应先将长期已学状态和分词答题摘要归并保存，不能直接用有限的展示历史推断全部学习经历。

### F7：部分基础词的慢速仍违反独立音频规则

- 位置：[PracticePage.tsx:596](I:/xiuxiuyingyu/src/pages/PracticePage.tsx:596)、[phonetic.ts:324](I:/xiuxiuyingyu/src/lib/phonetic.ts:324)、[AGENTS.md](I:/xiuxiuyingyu/AGENTS.md)。
- 触发：基础词不在每日/归档词音频映射，也不在 question-bank 本地音频 catalog 中；例如真实题 hit（ID 11），点击慢速且词典服务提供了音频。
- 证据：该分支将 `0.75` 传给词典音频播放器，最终设置 `player.playbackRate=0.75`。真实模块与 fetch/Audio 边界桩复现得到本地映射缺失、词典回退播放成功、实际播放速率 0.75。
- 影响：部分基础词采用前端拉慢，与项目明确禁止伪慢速的规则冲突；本次新课的独立本地音频路径不受该发现影响。
- 建议：为受支持的基础词补足独立慢速资源；缺失时明确提示，不把词典原速录音拉慢冒充独立慢速。

### F8：学习中心和今日页仍显示示例统计，实际累计口径也不准确

- 位置：[ModeHubPage.tsx:23](I:/xiuxiuyingyu/src/pages/ModeHubPage.tsx:23)、[HomePage.tsx:45](I:/xiuxiuyingyu/src/pages/HomePage.tsx:45)、[HomePage.tsx:83](I:/xiuxiuyingyu/src/pages/HomePage.tsx:83)。
- 静态确定：根页面的“今日学习路线”固定显示 `6/10 分钟`、`8/10 题`；`/today` 页面在无记录时仍显示 98% 正确率、12 天连续学习、156 个已掌握词、12 个错词及 60% 进度。
- 有记录时也不正确：连续学习天数直接取轮次数，同一天两轮会算成两天；已掌握数用轮次乘 10 再加本轮分数，重复练同一批词也会持续增加。
- 影响：这些文案看起来是孩子的真实数据，却与实际学习记录不符；再叠加 F1 的听写漏计，家长难以判断真实进步。
- 建议：空状态显示真实的 0 或暂无数据，连续天数按本地日期去重计算，掌握数按词和明确的掌握规则聚合；学习中心、今日页与家长页使用同一份统计口径。

## 回归验证与边界

- 修复前，28 个文件的 206 项测试虽全部通过，仍未覆盖这些跨页面与存储生命周期问题。修复后测试扩充为 246 项，并通过 lint、构建和真实浏览器验证。
- 在项目根目录执行 `node deliverables/review-audit-20261112.mjs`。脚本保留 Node `registerHooks` 与进程内模拟存储，不读取、清空或修改浏览器及线上学习记录，失败时抛出断言并以非零状态退出。
- smoke 不复制旧听写完成分支：直接向真实记录接口提交 17 词、34 次正确作答，验证全部当前词具有周复习资格、到期任务完成、只发 1 颗星；保存并重新加载后仍成立。
- 再完成 30 轮实际记录，并截断仅用于展示的旧会话缓存，确认早期 keyboard 仍有周复习资格；首次错题后清空，错题和任务均为空，重新保存也不恢复旧记录。
- 原审计中 F3/F5 直接运行实际判定函数，F2/F8 由数据流确认，F7 使用音频边界桩。新增基础音频已做 PCM、非零信号、削波和慢速时长检查；系统播放器完成普通/慢速试听。上述检查不代表真实 iPad Safari 硬件验证或自然真人音色评估。
- 音频离线播放另属设计限制：`public/sw.js` 明确绕过 `/audio/` 缓存，当前不能保证断网听音。仓库仅声明 PWA 基础，本报告未将它算作已承诺功能的缺陷。
