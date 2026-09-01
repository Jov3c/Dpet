# Roach on Desk

Windows 11 离线写实蟑螂桌宠。没有 Agent、模型接口、账号、遥测或网络请求。

## 开发运行

```powershell
npm install
npm start
```

- 左键拖拽：抓住并拖动；松开后会落地逃跑。
- 快速连点：触发挣扎。
- **文件回收站**：从文件管理器拖拽文件或文件夹到蟑螂上，确认后它会"吃掉"（移动到应用自己的回收站，非永久删除）；在设置的「回收站」里可恢复或清空。
- 系统托盘的蟑螂图标右键：打开设置或退出。
- 角色视觉尺寸固定为 95 × 161 px，不提供运行时缩放。
- 设置可开关各功能：自动游走、可拖拽、鼠标靠近逃跑、连点挣扎、边缘收边、跟随系统事件；并可切换「始终置顶」或「只在桌面显示」（可被其他窗口挡住）。
- `Ctrl + Shift + H`：隐藏；`Ctrl + Shift + R`：重新显示。

## 验证与打包

```powershell
npm test
npm run lint
npm run make
```

便携版输出到 `dist/Roach-on-Desk/Roach on Desk.exe`，可直接双击运行。设置文件只存于 Electron 的本机用户数据目录。

网络可访问 GitHub 时，也可生成 NSIS 安装器：

```powershell
npm run makeInstaller
```
