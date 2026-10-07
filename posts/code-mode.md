---
title: Code Mode：让 LLM 写程序来调工具
pubDatetime: 2026-10-08T02:57:00+08:00
description: 从 pi 的 Code Mode 出发，聊聊让模型写程序调工具究竟解决了什么问题。
draft: false
excludeFromRss: false
tags: ["AI", "agent", "pi", "MCP"]
status: 草稿
---

pi 的核心开发成员 Armin Ronacher 刚发了一篇 blog：[《What is Codemode》](https://lucumr.pocoo.org/2026/10/6/codemode/)，聊的是 pi 新增的 Code Mode。我瞅了一眼，觉得它和 DeepSeek Harness 的 [PTC 模式](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/ptc-runtime) 很像。

我没找到一套统一的 Code Mode 接口规范。下文把 pi 和 PTC 放在一起讨论，说的是它们共有的做法：**模型写程序，再由程序调用工具**。pi 叫它 Code Mode，DeepSeek Harness 叫 PTC。[^term]

我一开始也以为，这不过是给模型多加了个代码执行器。了解后才发现，Code Mode 的重点是**工具结果交给谁处理**。

## 直接调用：中间结果要经过模型

假设让 agent 做一次运维巡检：检查 100 个服务的状态，找出异常的，再取每个异常服务最近的 3 条错误日志。手头只有 `getServiceStatus` 和 `getRecentErrors` 两个查询工具。[^calling]

如果按最直接的方式，把工具结果原样返回给模型，这件事大概要走三步：

1. 模型在一轮里发出多个 `getServiceStatus` 调用，客户端可以并发执行。
2. 状态结果回到上下文，模型从中找出异常服务。
3. 模型再对这些服务调用 `getRecentErrors`，取回日志。

**麻烦就在第二步：** 该查哪些服务的日志，得等状态结果回来才知道。按这种原样返回的方式，假如只有 2 个服务异常，另外 98 个正常服务的状态也会进入上下文。模型得读完这些结果，才能发出下一批调用。这既占上下文，也多了一次模型推理。

那直接封装一个“巡检工具”，在工具内部查状态、筛异常、取日志，不就行了？当然可以。如果这套巡检是固定流程，专门做个工具很合适。可就算基础查询能力都有，需求一变，比如“异常时查最近一次发布”或“按负责人汇总”，仍得继续给这个工具加参数和分支。**临时组合太多，没法每出现一种需求就造一个工具。**

## Code Mode：让程序处理中间结果

Code Mode 的做法，是让模型写一段能运行的代码，把这些临时的查询和判断串起来。以 pi 为例，代码跑在 agent 框架（harness）[^harness]的沙箱里，通过 `tools.xxx()` 调用已有工具。工具结果先回到代码中，由代码决定下一步查什么、最后返回什么。[^runtime]

拿刚才的巡检来说，模型可以写出这样一段代码：[^example]

```js
const abnormal = [];

for (const name of serviceNames) {
  const result = await tools.getServiceStatus({ name });
  if (result.status === "running") continue;

  const logs = await tools.getRecentErrors({ name, limit: 3 });
  abnormal.push({
    name,
    status: result.status,
    reason: result.error ?? null,
    errors: logs.map(({ time, message }) => ({ time, message })),
  });
}

return { checked: serviceNames.length, abnormal };
```

底层仍是那两个查询工具。程序读到正常状态就跳过，碰到异常才接着查日志，**最后只把检查数量和异常详情交给模型。** 下次巡检条件变了，模型可以按新条件写另一段代码，不必每次都给后端加一个专用工具。

## Bash 也能做，差别在哪儿？

看到上面的 JavaScript，我第一反应其实也是：换成 Bash，配个 `jq`[^jq] 不就行了？确实可以。假设两个查询工具来自 `ops` 这个 MCP 服务，在任务环境里装好 [MCPorter](https://github.com/openclaw/mcporter)，配好连接，同样能写：[^bash-example]

```bash
for name in "${service_names[@]}"; do
  status=$(mcporter call ops.getServiceStatus name="$name" --output json) || exit 1
  [[ $(jq -r '.status' <<<"$status") == running ]] && continue

  logs=$(mcporter call ops.getRecentErrors name="$name" limit=3 --output json) || exit 1
  jq -nc --arg name "$name" --argjson status "$status" --argjson logs "$logs" \
    '{name: $name, status: $status.status, errors: $logs}'
done
```

状态查询的结果先存进 Shell 变量，正常的直接跳过，最后只打印异常服务。**用程序处理工具返回的数据，Bash 一样能做。**

上面这段 Bash 已经通过 MCPorter 调到了 `ops` 的两个工具，但它并不会因此获得 pi 框架里的模型接口。pi 的 Code Mode 跑在框架侧，可以调用图片模型，再用 `image(block)` 把生成的图片作为视觉内容返回给主模型。[^image] Bash 跑在任务环境，读文件、执行命令更方便；但 `cat image.png` 打印的是文件字节，主模型不会因此看到图片。要实现同样的效果，框架得给 Shell 提供调用模型、返回图片的接口。Shell 如果在远端容器里，还要处理接口的部署和权限。

**运行位置就是这里的 trade-off：程序放在框架侧，调用模型等框架能力更方便；放在任务环境，读文件、跑命令更方便。** 要用另一边的能力，就得补上相应的接口。DeepSeek Harness 的 PTC 选择让 `run_code` 在与会话 Shell 共用文件系统的 Node 进程里运行，同时通过绑定调用工具。[^ptc] pi 的沙箱要访问文件和命令，也得通过框架提供的工具。两者选的位置不同，却都让程序先处理工具结果，再返回给主模型。

## 还能怎么用？

巡检只用到了两个查询工具。如果框架还提供模型接口，程序也可以调用另一个模型分析数据，再处理它的回答。

Armin 的原文里就有个例子：先用 `gh issue list` 拉回最多 100 条 GitHub Issues，再调用分类模型，判断每条 Issue 的类型、作者对 pi 的态度和不满程度。程序略过分类失败的条目，按不满程度排序，最后只 `return` 前 12 条的编号、分数、类型和标题；完整结果存起来，需要时再查。[^issues]

分类模型负责读 Issue，代码负责排序和筛选。**这一批 Issue 的正文和分类结果不必逐条进入主模型的上下文**；主模型先看前 12 条，需要了解某一条时，再去查保存的完整结果。

子 agent 也能按这个方式组织。假如框架提供调度接口，程序可以让几个子 agent 分头检查不同模块；等它们返回结构化的发现项，再去重、合并，把清单交给主模型。[^agent] **分类模型和子 agent 还是照常工作，省下的是主模型逐项阅读中间结果、再安排下一步的工夫。**

---

[^term]: Cloudflare 在 2025 年的[文章](https://blog.cloudflare.com/code-mode/)使用了 Code Mode 这个名字；Armin 的[文章](https://lucumr.pocoo.org/2026/10/6/codemode/)也把命名归于 Cloudflare。本文把几种实现放在一起讨论，是我对其共同做法的归纳。

[^calling]: 这里对比的是两个查询工具直接交给模型调用的路径。MCP 的[架构说明](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture)并不规定应用如何管理模型上下文，如果单个工具在后端内部完成了批处理和条件判断，也能绕过这个问题。

[^harness]: harness：负责组织模型对话、工具调用和会话的框架。

[^runtime]: pi 的 [Code Mode 文档](https://pi.dev/docs/latest/codemode/)说明，代码在 QuickJS 沙箱中运行，没有文件系统、网络或子进程接口；访问外部能力要通过 `tools` 和 `models`。

[^example]: 接口和字段为示意，`running` 表示正常；工具已绑定到 `tools`，脚本按异步函数体执行。示例顺序查询用于演示条件分支，不代表实际耗时；省略了失败处理，调用抛异常时会中断。

[^jq]: `jq` 是在命令行中读取和筛选 JSON 数据的工具。

[^bash-example]: [MCPorter 的调用语法](https://github.com/openclaw/mcporter/blob/main/docs/call-syntax.md)支持 `mcporter call <server.tool> ... --output json`，成功时输出 JSON。这里的 `ops` 服务、工具名和返回字段与前面的 JavaScript 例子一样，都是为说明流程而设；`service_names` 是待巡检的服务名数组。Bash 示例省略了 `checked`、`reason` 和日志字段裁剪，输出与 JavaScript 示例不完全相同；两段代码都按顺序查询，并省略了完整的错误处理。

[^image]: [Armin 原文](https://lucumr.pocoo.org/2026/10/6/codemode/)展示了在 Code Mode 中调用图片生成模型、再用 `image(block)` 将图片返回给主模型；[pi 文档](https://pi.dev/docs/latest/codemode/)说明了图片内容的返回方式。Bash 若接上相应的接口，也能完成这一操作。

[^ptc]: DeepSeek Harness 的 [PTC 工具说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/tools/README.md)给出了 `run_code` 中调用 `tools.bash()` 的例子；[Node 运行时设计](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/architecture/2026-09-11-sandboxed-node-ptc-runtime.md)说明 PTC 与 Bash 受同一会话沙箱约束。

[^issues]: [Armin 原文](https://lucumr.pocoo.org/2026/10/6/codemode/)的示例还展示了 `Promise.all` 并发分类与 `store()` 保存完整结果。pi 会限制同时执行的工具数量，脚本写了并发不代表所有调用会同时发出。

[^agent]: 子 agent 的例子是假设，不是 Armin 原文展示的 pi 代码。他在文章中提到，子 agent 调度需要由 agent 框架提供接口；具体接口和权限取决于实现。

## 参考文献

1. Armin Ronacher. [What is Codemode](https://lucumr.pocoo.org/2026/10/6/codemode/). 2026-10-06.
2. Adam Jones, Conor Kelly. [Code execution with MCP: Building more efficient agents](https://www.anthropic.com/engineering/code-execution-with-mcp). Anthropic, 2025-11-04.
3. DeepSeek Harness. [PTC runtime](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/ptc-runtime). 查阅于 2026-10-07.
4. Model Context Protocol. [Architecture overview](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture). 查阅于 2026-10-07.
5. Anthropic. [Parallel tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use). 查阅于 2026-10-07.
6. MCPorter. [MCPorter README](https://github.com/openclaw/mcporter). 查阅于 2026-10-07.
7. DeepSeek Harness. [Sandboxed Node execution for PTC](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/architecture/2026-09-11-sandboxed-node-ptc-runtime.md). 查阅于 2026-10-07.
8. Cloudflare. [Code Mode: give agents an entire API in 1,000 tokens](https://blog.cloudflare.com/code-mode-mcp/). 2026-02-20.
9. Pi. [Codemode](https://pi.dev/docs/latest/codemode/). 查阅于 2026-10-08.
10. Kenton Varda, Sunil Pai. [Code Mode: the better way to use MCP](https://blog.cloudflare.com/code-mode/). Cloudflare, 2025-09-26.
