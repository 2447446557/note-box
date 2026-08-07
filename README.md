# Note-box

跨端笔记工具（**Expo / React Native**）：

- **电脑端**：`npm run web` 浏览器使用
- **手机端**：Expo Go 调试，或用 **EAS 云打包 APK**（**不需要 Android Studio**）
- 笔记存进你的 GitHub 仓库；打开自动拉取，停止输入后自动推送
- **不需要安装 Git**（走 GitHub API + PAT）

## 为什么不用 Android Studio？

App 用 React Native（Expo）编写。打正式 APK 时走 **Expo EAS Build 云构建**：在 Expo 服务器上编译，本机只需 Node.js，不必安装 Android Studio / SDK。

本地开发可用：

1. 浏览器 Web
2. 手机安装 [Expo Go](https://expo.dev/go)，扫码预览（无需打包）

## 准备 GitHub

1. 新建仓库（建议私有），例如 `my-notes`
2. 创建 Personal Access Token  
   - Fine-grained：该仓库 **Contents: Read and write**  
   - 或 Classic：勾选 `repo`
3. App 里打开 **设置**，填写 Token、`owner`、`repo`、分支（默认 `main`）、笔记目录（默认 `notes`）

Token 只存在本机 AsyncStorage，不会提交进代码仓库。

## 开发运行

需要 Node.js 18+。

```bash
npm install

# 电脑浏览器
npm run web

# 或启动 Expo 开发服务（可扫码用 Expo Go）
npm start
```

## 打包 Android App（无需 Android Studio）

1. 注册 [Expo](https://expo.dev) 账号  
2. 登录并初始化项目：

```bash
npx eas-cli login
npx eas-cli init
```

`eas init` 会写入真实的 `extra.eas.projectId` 到 `app.json`。

3. 云打包 APK：

```bash
npm run build:apk
```

构建在云端完成。结束后终端会给出 **APK 下载链接**，传到手机安装即可。

打上架用的 AAB：

```bash
npm run build:aab
```

## 同步说明

| 能力 | 说明 |
|---|---|
| 本地优先 | 打开先读本地缓存；拉取成功后再写入本地 |
| 编辑保存 | 修改立刻写入本地，再异步推送到 GitHub |
| 离线可用 | 推送失败或无网络时本地内容不丢，约 20 秒自动重试；恢复联网也会重试 |
| 立即同步 | 顶栏按钮手动拉取/推送待同步项 |
| 冲突 | 可选「用远程覆盖」或「强制用本地覆盖」 |

电脑、手机都不需要安装 Git。

## 技术栈

- Expo SDK 57 + React Native
- `@octokit/rest`（GitHub Contents API）
- `@react-native-async-storage/async-storage`
- EAS Build（云端出 APK）

## 安全提醒

- 不要把 Token 提交到 Git
- 建议私有仓库 + 最小权限 token
- Token 泄露后立刻在 GitHub 撤销
