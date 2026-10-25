# Kawanku

[English](KAWANKU.md) | 中文

Kawanku 保留现有 Web 和桌面端布局，使用自己的产品名称和 K 字母标志。浏览器标题、已安装 Web 应用名称、加载页面、侧栏品牌、桌面菜单、安装程序文本和应用图标均使用 Kawanku。

在此目录中使用 Node.js 24.9 或更新版本构建和运行：

```sh
pnpm install --frozen-lockfile
pnpm run build:artifacts
pnpm run build:check
pnpm dsh web --no-open --host 127.0.0.1 --port 3081
```

端口 3081 将本地 Kawanku 与 3080 端口上的现有 VPS 隧道分开。启动命令会输出带认证信息的浏览器地址。

内部工作区名称、CLI 命令、环境变量名称、API 地址、模型名称和上游仓库地址保留原有技术标识。DeepSeek 仍是可选的模型提供商；更改该提供商名称会错误标识服务。原始版权、MIT 许可证和第三方声明均保留。

桌面打包使用 `ai.kawanku.desktop` 应用标识。为兼容上游认证，保留 `dsh://` URL scheme；安装多个桌面发行版后，操作系统可能询问使用哪个应用打开此类链接。
