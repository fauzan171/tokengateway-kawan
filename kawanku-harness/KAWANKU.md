# Kawanku

English | [中文](KAWANKU.zh.md)

Kawanku uses the existing Web and Desktop layouts with its own product name and K monogram. Browser titles, installed Web App names, loading screens, sidebar branding, desktop menus, installer text, and application icons use Kawanku.

Build and run from this checkout with Node.js 24.9 or newer:

```sh
pnpm install --frozen-lockfile
pnpm run build:artifacts
pnpm run build:check
pnpm dsh web --no-open --host 127.0.0.1 --port 3081
```

Port 3081 keeps the local Kawanku build separate from the existing VPS tunnel on 3080. The command prints an authenticated browser URL.

Internal workspace names, CLI commands, environment variable names, API endpoints, model names, and upstream repository URLs retain their original technical identifiers. DeepSeek remains a selectable model provider; renaming that provider would misidentify the service. Original copyright, MIT license, and third-party notices are retained.

Desktop packaging uses the `ai.kawanku.desktop` application identity. The `dsh://` URL scheme is retained for upstream authentication compatibility; installing multiple desktop distributions may make the operating system ask which application should open these links.
