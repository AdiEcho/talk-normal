# talk-normal

[English](README.md) | 中文

让 pi 说人话。直接给答案, 不废话, 不客套。

## 安装

```bash
pi install git:github.com/hexiecs/talk-normal
```

本地 clone 后安装:

```bash
pi install ./talk-normal
```

已在运行的 pi 需要重启一次, 或执行 `/reload`。下一轮对话开始生效。

## 它改什么

- 先给答案, 有需要再补上下文
- 禁掉否定式对比 ("不是X，而是Y" / "not X, but Y")
- 去掉客套开场、总结盖章、条件式追问菜单
- 内容真有步骤或并列项时, 该用结构就用结构

## 怎么做的

`extensions/talk-normal/index.ts` 每轮把 `extensions/talk-normal/prompt.md` 注入为 `talk_normal` system prompt 区块。pi 会对比区块差异, 所以只在第一次多一次 prompt 缓存未命中, 之后没有额外开销。不改 `AGENTS.md`, 不开新会话, 不重写整段提示词。

## 命令

```text
/talk-normal            显示版本、开关状态、prompt 路径
/talk-normal off        停止注入 (跨会话保留)
/talk-normal on         恢复
/talk-normal check      检查上一条回复里的禁用模式
```

`--no-talk-normal=1` 只对当前会话关闭。带 prompt 启动时保留 `=1`, 否则裸 flag 会把后面的 prompt 当成它的值吞掉。

状态存在 `~/.pi/agent/talk-normal.json`, 文件缺失或读不出都按开启处理。

## 修改规则

编辑 `extensions/talk-normal/prompt.md`, 执行 `/reload`, 下一轮就用新规则。

## 卸载

```bash
pi remove git:github.com/hexiecs/talk-normal
```

## 贡献

欢迎提交规则建议, 见 [CONTRIBUTING.md](CONTRIBUTING.md)。改完扩展后跑一次 `node scripts/test-extension.mjs`。

## 许可证

MIT
