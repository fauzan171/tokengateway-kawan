# Kawanku

English | [中文](README.zh.md)

Kawanku is an AI workspace for coding, analysis, detailed planning, and code review. It keeps the existing plugin-based Web and Desktop interface with Kawanku branding.

## Run locally

Use Node.js 24.9 or newer and the pnpm version declared in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm run build:artifacts
pnpm run build:check
pnpm dsh web --no-open --host 127.0.0.1 --port 3081
```

Open the authenticated URL printed by the launcher. Port 3081 avoids the existing VPS tunnel on port 3080. See [Kawanku setup](KAWANKU.md) and the [development guide](docs/development.md).

## License and origin

Kawanku is based on the open-source [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) project. Original copyright, the [MIT license](LICENSE), and [third-party notices](THIRD_PARTY_NOTICES.md) are preserved. Internal package and provider identifiers remain compatible with the upstream runtime.
