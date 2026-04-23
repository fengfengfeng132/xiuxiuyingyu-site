# WOE L2 UI 生图到落地流程

本说明用于后续继续优化首页、听写、日常学习和其他学习模式时复用同一套流程，避免只在代码里临时调样式。

## 当前设计目标

- 目标设备比例：iPad Pro 竖屏，`1024 x 1366`。
- 视觉方向：儿童英语学习、奶油纸感、圆角卡片、柔和阴影、插画陪伴。
- 功能边界：基础学习功能不变，UI 只重排入口、层级、触控区域和视觉资产。
- 交互重点：小朋友能快速找到“今天学什么”“听写单词”“复习/错题/其他模式”。
- 奖励反馈：右上角星星必须是真实本地计数，点击后进入星星记录页。

## 参考方法

- `awesome-design-md`：借用 Apple 的清晰层级、Airbnb 的温暖卡片阴影、Clay 的奶油纸感和趣味色块，但不照搬品牌视觉。
- `huashu-design`：采用“先定义设计哲学，再生图，再批判和迭代”的方式。当前项目选定方向是“温暖儿童学习手账”，不是深色科技风，也不是成人仪表盘风。
- 用户参考图：保持 iPad Pro 大圆角画布、固定底部导航、大卡片任务流、儿童/小狗/兔子陪伴插画。

## 标准流程

1. 先生成整屏 UI 概念图，比例固定为 `1024 x 1366`，不要先写 CSS 盲调。
2. 从整屏图里拆出可复用单元素图片，统一放到 `public/images/ui-ipad/`。
3. 在 Figma 中保留概念图和页面捕获，方便逐屏对照。
4. 在项目中实现页面结构和样式，优先复用已有 React 业务逻辑，不重写题库、播放、错题等核心流程。
5. 用 Playwright 在 `1024 x 1366` 截图，再按 `visual-verdict` 记录视觉分数。
6. 捕获 Figma 时可以临时加入 capture 脚本，完成后必须从 `index.html` 移除。
7. 完成后运行 `npm run lint`、`npm run test`、`npm run build`，并更新 `docs/maintenance-lessons.md`。

## 当前设计资产

- 学习模式概念图：`docs/design/woe-l2-study-modes-ui-concept.png`
- 首页/听写概念图：`docs/design/woe-l2-ui-concept.png`
- 单元素生图资产：`public/images/ui-ipad/`
- Figma 文件：`https://www.figma.com/design/6vPBHMOfSH7TqMqZFXMsbk`
- Figma 首页节点：`node-id=4-2`
- Figma 听写节点：`node-id=5-2`
- Figma 学习中心节点：`node-id=8-2`
- Figma 每日练习节点：`node-id=7-2`

## 学习模式接入规则

学习中心页面为首页 `/`。旧入口 `/modes` 只做兼容跳转，避免历史链接失效。听写单词保持独立 `/dictation`，其他模式统一复用 `/practice`。

| 入口 | 路由 |
| --- | --- |
| 今日 10 分钟 | `/practice?mode=all&train=today10` |
| 每日 20 题 | `/practice?mode=all&train=daily20` |
| 等级闯关 | `/practice?mode=all&train=level10` |
| 听写单词 | `/dictation` |
| 听力选择 | `/practice?mode=all&train=audio` |
| 拼写练习 | `/practice?mode=vocab&train=spelling` |
| 中译英 | `/practice?mode=vocab&train=zh2en` |
| 对话填空 | `/practice?mode=dialogue&train=dialogueFill` |
| 错题优先 | `/practice?mode=all&train=wrongFirst` |
| 间隔复习 | `/practice?mode=all&train=spaced` |
| 收藏单词 | `/practice?mode=all&train=random` |

## 设计注意事项

- 不要把所有模式做成新的页面。除听写外，练习模式应接入现有 `PracticePage`，通过 `train` 分支控制题型。
- 不要改动播放策略。正常播放仍走美式词典接口，慢速播放仍按既有产品约定处理。
- 底部导航是固定层，页面底部必须预留触控空间，避免按钮被导航遮住。
- 右上角星星不是装饰。UI 改版时要保留 `/stars` 入口和真实星星计数。
- iPad 断点是本轮 UI 的主目标；手机端可以保持现有结构，但不能因大屏样式破坏移动端可用性。
- Figma 捕获是像素参考，不等同于长期设计系统组件库；如果后续要做组件库，再使用 `figma-use` 单独搭建组件。
