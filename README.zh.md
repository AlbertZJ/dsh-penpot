# dsh-penpot

把 [Penpot](https://penpot.app) 以**原生插件**方式接入 DeepSeek Harness——**不走 MCP**。
插件直接调用 Penpot 后端的命令 API，注册一组 `penpot_*` 模型工具，并附带两个打包技能
（设计走查、设计交付）。

同时适用于 [penpot.app](https://penpot.app) 官方 SaaS 与任意自托管 Penpot。

[English](README.md) | 中文

## 功能

- **13 个 `penpot_*` 工具**，直连 Penpot REST/RPC 命令 API，**读 + 写**：
  连通性/身份检查、团队 → 项目 → 文件遍历、文件搜索、文件概览（页面 +
  设计令牌集合）、页面画板结构树、未解决评论、`.penpot` 二进制归档导出；
  以及**建项目**、**建文件**、**导入 `.penpot` 归档**、**上传模型生成的
  SVG/PNG/JPEG/WebP 资产**。认证使用个人访问令牌（`Authorization: Token`
  方案），与 Penpot 网页端使用的是同一套后端 API。
- **3 个打包技能**：`penpot-design-review`（基于实时数据的结构化设计走查）、
  `penpot-design-handoff`（面向开发的清单 + 令牌 + 评论 + 可移植归档）、
  `penpot-design-generate`（建项目/文件，把模型生成的 SVG 画板作为资产
  交付进 Penpot——写入路径，不走 MCP、不做画布自动化）。

## 要求

- DeepSeek Harness `>= 0.2.1-rc.2 < 0.3.0`
- Node.js `>= 22.19.0`
- 一个 Penpot 个人访问令牌：Penpot → Settings → Access tokens 生成。

## 安装

```sh
export PENPOT_TOKEN=<你的令牌>            # Windows PowerShell: $env:PENPOT_TOKEN="..."
dsh plugin --profile web add github:AlbertZJ/dsh-penpot
```

可选配置（给出的是默认值）——在插件页编辑该 bundle 行的配置，
链接安装可直接改 `cordis.patch.yml`：

```yaml
config:
  baseUrl: https://design.penpot.dev   # 或你的自托管地址
  tokenRef: PENPOT_TOKEN               # 存放令牌的环境变量名
  timeoutMs: 30000
```

安装**不需要构建权限**：`lib/` 已预构建并提交，包内没有 `prepare` 脚本。

## 验证

在会话里让模型执行 `penpot_whoami`，应返回你的 Penpot 个人资料；
再说"走查一下名为 X 的设计稿"，`penpot-design-review` 技能会接管。

## 开发

```sh
pnpm install
pnpm run build     # tsc + tsdown -> lib/
pnpm run verify    # 结构校验（零依赖）
```

`lib/` 必须随仓库提交：git 安装只取源码、不执行构建，因此改动 `src/` 后要重新构建并
一并提交 `lib/`。

## 与其他方案的关系

- 与 [qunanchang/dsh-penpot](https://github.com/qunanchang/dsh-penpot) 不同，
  本插件**不**把 Penpot 编辑器内嵌进侧边栏，也**不**使用 Penpot 的 MCP，
  而是数据/工具型集成：模型通过 dsh 原生工具读取和导出设计数据。
- 两者可以组合使用：agent 工作流用本插件，想要在 dsh 里看可视化编辑器
  再用对方的插件。

## 许可证

[MIT](LICENSE)
