# 产品约定

本文件记录这个项目已经确认过的产品规则。  
后续 AI 在改题目、词表、播放行为、跟读判定、错题本前，先读这里。

## 项目定位

- 这是一个给小朋友用的英语学习项目。
- 交互优先简单、稳定、低认知负担。
- 文案、释义、提示都尽量短句化、儿童化。

## 每日词汇更新规则

用户经常会要求：

- “把之前的听写单词放到日常学习中”
- “把这次的新单词替换进去”
- “把相应发音也一起替换”

当前数据约定（2026-11-11 更新）：

- `src/data/dictationWords.json` 是当前每日词的唯一词源；`dictationWords.ts` 只负责类型和导出。
- 旧每日词保存在 `src/data/archivedDictationWords.json`，继续进入日常学习；归档时保留原 ID，后续新课使用未占用 ID，不能让旧错题记录指向新词。
- `src/data/dailyLearningQuestions.ts` 从这两份不同课次的数据自动生成题目，不另写一份手工词表。
- 两组词的普通/慢速音频都要保留；不能因为替换每日课而删除归档词音频。
- 首页“今日 10 分钟”优先抽当前每日词；“每日 10 题”优先抽归档词复习，不足 10 题时从常规题库补齐。
- `examples` 保存教材英文原句、中文翻译、音频键和来源。重复词合并，但不同例句都保留。

不要只改一个文件，否则容易出现：

- 听写页还是旧词
- 日常学习还是旧词
- 题目、释义、音频文件名不一致

## 当前播放策略

截至 `2026-11-11`，当前产品约定如下：

- 听写单词模块正常播放：走本地生成的 `public/audio/words/us/*.wav`
- 听写及归档单词慢速播放：走独立生成的 `public/audio/words/us-slow/*.wav`
- 例句正常/慢速播放：分别使用 `public/audio/examples/us/*.wav` 和 `public/audio/examples/us-slow/*.wav`
- 当前沿用已验证的 `New-DailyWordAudio.ps1` / Microsoft Zira Desktop 生成流程，正常和慢速分别合成，不做时间拉伸
- 其他未接入本地音频 catalog 的普通播放，才允许继续回退到统一的美式词典接口
- 不允许前端自己把音频拉慢来伪造慢速

相关代码主要看：

- `src/lib/phonetic.ts`
- `src/pages/PracticePage.tsx`
- `src/pages/DictationPage.tsx`

## 关于男女声不一致

- 词典接口的音频本身不是同一个说话人录制。
- 所以正常播放出现男声/女声混用，通常是上游音频源特性，不一定是本地 bug。
- 听写单词模块已经切回本地统一音频，不能再用词典接口做普通播放。
- 如果其他模块也明确要求“正常播放统一成一个女声”，同样要优先接入本地统一音频。

## 跟读识别约定

- 已接入基于浏览器 Web Speech API 的跟读判定。
- iPad 端优先提示使用 Safari。
- iPad 端需要开启 Siri，否则语音识别能力可能不可用。

相关文件：

- `src/lib/speechAssessment.ts`
- `src/pages/PracticePage.tsx`
- `src/pages/DictationPage.tsx`

## 星星奖励约定

- 右上角星星数量必须读取本地真实记录，不允许继续写死展示数字。
- 每满分完成一次训练，增加 1 颗星。
- 同一轮训练只能发放一次星星，刷新结果页或重复保存不能重复增加。
- 点击右上角星星进入 `/stars`，查看每颗星的获得时间、训练来源和满分记录。

相关文件：

- `src/lib/starRewards.ts`
- `src/pages/ModeHubPage.tsx`
- `src/pages/StarsPage.tsx`
- `src/pages/PracticePage.tsx`
- `src/pages/DictationPage.tsx`

## 错题反馈约定

- 练习或听写答错后，要有错误提示音。
- 完成本轮后，要汇总错误单词。
- 错误单词要进入错题本，方便后续集中复习。

相关逻辑：

- `src/lib/studyFeedback.ts`
- `src/pages/ResultPage.tsx`
- `src/pages/WrongPage.tsx`

## 常见需求的默认处理方式

### A. 用户让你替换一批新单词

默认流程：

1. 将旧每日词归档，保留 ID；更新 `src/data/dictationWords.json`，给新词分配未占用 ID
2. 确认听写和自动生成的日常学习题同步，归档词仍在题库中
3. 在临时目录生成新词及例句的普通/慢速音频，验证后复制到正式目录，保留归档词音频
4. 校验词表、题目、例句、音频文件集合与已有错题 ID，再跑 lint、test、build

不要只换词表，不换音频。  
不要只换听写，不换日常学习。

### B. 用户让你“生成相应发音并替换”

默认理解为要同时处理：

- `public/audio/words/us/*.wav`
- `public/audio/words/us-slow/*.wav`

有例句时还要同步生成 `public/audio/examples/us/*.wav` 和 `public/audio/examples/us-slow/*.wav`。每日词和归档词均优先使用本地资源。

### 例句学习与背诵

- 例句放在听写的新词学习卡中，支持中英对照、正常/慢速听读，以及遮住英文看中文背诵。
- 辨义或拼写作答前不渲染例句，避免从句子或翻译中看到答案；提交后才展示。
- 日常学习中，带例句的题提交后停留复盘，再点下一题；保存判题和发星不能重复执行。
- 切词时恢复英文显示并停止上一词音频，不另加背诵强制过关或未经验证的自动评分。

### C. 用户说“读音不够正宗 / 不够清楚 / 有回音”

优先检查：

1. 有没有做前端慢放或时间拉伸
2. 慢速音频是不是模型原生生成，而不是二次处理
3. 正常播放是不是误切到了不统一的本地源
4. 当前参考音频是否干净

不要第一时间再加新后处理。  
先排除“前端拉慢”和“脏参考音频”。

## 修改前优先检查的文件

如果需求和词、发音、练习、听写有关，优先看：

- `src/data/dictationWords.ts`
- `src/data/dailyLearningQuestions.ts`
- `src/lib/phonetic.ts`
- `src/pages/DictationPage.tsx`
- `src/pages/PracticePage.tsx`
- `src/lib/studyFeedback.ts`

## 输出给用户时要说明的重点

完成后，优先告诉用户：

1. 改了哪些文件
2. 现在的播放逻辑是什么
3. 校验是否通过
4. 还有什么剩余风险

不要只说“已经好了”，要把关键决定说清楚。
