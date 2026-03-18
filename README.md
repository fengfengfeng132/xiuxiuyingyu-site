# xiuxiuyingyu (WOE L2 iPad互动英语)

Day1 落地版本（React + TypeScript + PWA 基础）

## 本地运行

```bash
npm install
npm run dev
```

默认地址：`http://localhost:5173`

## 构建

```bash
npm run build
npm run preview
```

## Day1 已完成

- React + TS 工程初始化
- PWA 基础（manifest + service worker 注册）
- 路由骨架：首页 / 做题 / 结果 / 错题 / 复习 / 家长 / 设置
- 基础组件：按钮、卡片、进度条
- 数据 schema 与 TS 类型
- `question_bank.json` 50 题骨架
- localStorage 封装
- “开始学习 → 第一题 → 提交 → 结果页”闭环

## 固定参数（已落地）

- 题量：50
- 风格：简洁低卡通
- 数据：纯本地
- 正确率：做对/50
- 录音：预留本地保存结构（Day2 接入）
- 目标域名：`xiuxiuyingyu.pages.dev`
