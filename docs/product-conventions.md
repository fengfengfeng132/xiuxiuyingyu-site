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

遇到这类需求时，默认必须同时更新：

- `src/data/dictationWords.ts`
- `src/data/dailyLearningQuestions.ts`

不要只改一个文件，否则容易出现：

- 听写页还是旧词
- 日常学习还是旧词
- 题目、释义、音频文件名不一致

## 当前播放策略

截至 `2026-04-21`，当前产品约定如下：

- 正常播放：走统一的美式词典接口
- 慢速播放：走本地 `IndexTTS2` 生成的自然慢速音频
- 不允许前端自己把音频拉慢来伪造慢速

相关代码主要看：

- `src/lib/phonetic.ts`
- `src/pages/PracticePage.tsx`
- `src/pages/DictationPage.tsx`

## 关于男女声不一致

- 词典接口的音频本身不是同一个说话人录制。
- 所以正常播放出现男声/女声混用，通常是上游音频源特性，不一定是本地 bug。
- 如果用户明确要求“正常播放也统一成一个女声”，就不能继续只走词典接口，必须切回本地统一音频。
- 如果用户没有再次改要求，就保持当前策略：正常播放词典接口，慢速播放本地。

## 跟读识别约定

- 已接入基于浏览器 Web Speech API 的跟读判定。
- iPad 端优先提示使用 Safari。
- iPad 端需要开启 Siri，否则语音识别能力可能不可用。

相关文件：

- `src/lib/speechAssessment.ts`
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

1. 更新 `src/data/dictationWords.ts`
2. 更新 `src/data/dailyLearningQuestions.ts`
3. 生成并替换对应音频
4. 跑校验

不要只换词表，不换音频。  
不要只换听写，不换日常学习。

### B. 用户让你“生成相应发音并替换”

默认理解为要同时处理：

- `public/audio/words/us/*.wav`
- `public/audio/words/us-slow/*.wav`

即使当前正常播放主要走词典接口，本地 `us/*.wav` 仍然建议同步更新，作为统一声音的备用资源。

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
