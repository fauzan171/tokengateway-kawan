# Kawanku

[English](README.md) | 中文

Kawanku 是面向编程、分析、详细规划和代码评审的 AI 工作空间，保留现有插件化 Web 与桌面端布局，并使用 Kawanku 产品标识。

## 本地运行

需要 Node.js 24.9 或更高版本，以及 `package.json` 中指定的 pnpm 版本。

```sh
pnpm install --frozen-lockfile
pnpm run build:artifacts
pnpm run build:check
pnpm dsh web --no-open --host 127.0.0.1 --port 3081
```

打开启动器输出的认证地址。端口 3081 避免与现有 VPS 的 3080 隧道冲突。详见 [Kawanku 配置](KAWANKU.md)和[开发指南](docs/development.zh.md)。

## 许可证与来源

本项目基于开源 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，保留原始版权、[MIT 许可证](LICENSE)和[第三方声明](THIRD_PARTY_NOTICES.md)。内部包名与模型提供商标识保持兼容。
