---
title: 从一问一答到 AI 编程 agent：一个通俗版演进史
pubDatetime: 2026-09-02T00:00:00.000Z
description: 用大白话捋一遍：AI 如何从一问一答的聊天框，一路补洞补成今天能读文件、改代码、跑命令的编程 agent。
draft: true
status: 草稿
tags: ["AI", "agent"]
---

最近 codex 这类"AI 程序员"很火：能读你的文件、自己改代码、自己跑命令，看起来像黑魔法。但把底层拆开看并不玄乎——它是从"一问一答的聊天框"一路补洞补出来的。这篇用大白话把这条线捋一遍，看它每一步是怎么长出来的。

## 起点：AI 只会一问一答，还没有记忆

现在的对话式 AI，本质是一个"文字进、文字出"的模型，外面套一层交互壳。最初的形态很简单：你问一句，它答一句。问完就忘——**没有记忆**。

## 记忆：把历史拼回去

没有记忆怎么办？有人想到一个办法：假装它有。把"历史对话"原样拼在新问题前面，再一起交给 AI 输出答案。AI 看到前面有"你刚才说过的内容"，自然就"记得"了。

代价是历史越攒越长，总有一个放不下的上限，所以真实产品还要做压缩、裁剪（这是后话）。

## 思考：看不见的草稿

现在的 AI 有时会先"想"一段再给答案。思考和我们看到的回答，本质都是模型吐出来的文字，唯一的区别是：**思考是模型给自己打的草稿，不会当成正式对话存进历史**——它只影响这一轮，不污染记忆。DeepSeek 的"思考模式"[1-2]、各种带 reasoning 的模型，底层基本就是这一条。

（细节上各家有点差异：DeepSeek 会把思考明文输出，你能亲眼看到它"想"的过程，且不进历史；另一些厂商把思考摘要加密后送回上下文，用来续接超长对话。但对用户来说，思考永远只是中间产物。）

## 从"吐代码"到"跑起来再改"

纯文本时代，想让 AI 写代码，最原始的做法是让它把代码当作文本吐出来，人手动复制粘贴去用。但模型经常写错，粘过去跑不起来。

怎么保证代码能用？最朴素也最有效的办法：**跑起来看**。程序把 AI 的代码拿去执行（或者执行它给的命令），一报错，就把报错文本原样回填给模型——"你写的代码报错了，错误在 xxx"。模型看着报错自己改，改完再跑，循环到通过为止。今天各家编程 agent 的命令行工具循环，底层还是这个思路。

## 工具调用：给 AI 一双手

但只会"吐文本"终究别扭——搜索、执行、改文件这些动作，总不能全靠在回答里打字描述。有人想：**能不能把工具直接交给 AI，让它自己判断什么时候用？**

于是有了工具调用（function calling，OpenAI 在 2023 年推出[3]）。机制是这样的：每次请求时，程序把一份"可用函数清单"随请求一起发给模型——注意，**不是写进提示词，而是请求里的一个独立参数**，每项包含函数名和参数格式。模型需要时不会吐一段含糊文字让你猜，而是直接返回一条结构化的调用请求：调哪个函数、参数填什么。程序解析出来就去执行，把结果再送回去[4]。

这里的关键是：模型不是碰运气输出一段"能被匹配上的文本"，而是**被专门训练成在固定格式下生成**。早期为了让模型稳定输出合法格式，各家还专门做了"JSON 模式"之类的保障[5]——所以"AI 能稳定输出结构化请求"这件事，本身就是当时要攻克的技术点（今天你在各大 API 中转站看到的能力标签"结构化输出 / structured output"，说的就是它）。

顺带澄清一个常见误解：工具调用不是某个"专用模型"才有的能力。OpenAI 最初确实随一个专门的模型版本推出它，但它的本质是**训练数据教出来的行为模式**——只要训练里放足"给一份工具清单、请输出标准调用格式"的样本，任何模型都能学会，不需要为它单独造模型。所以 DeepSeek 这类后来的模型，同样把工具调用做成了原生能力（它早期 API 不支持时，开发者只能靠提示词让它输出 JSON 硬凑，体验就是不稳定）。

### 第一个出圈的工具：联网搜索

ChatGPT 的"联网搜索"本质上就是一个工具调用：AI 判断需要查资料，就发出一个"去搜这几个词"的请求；程序执行搜索，把结果（网页文字等）回填给 AI，AI 再继续回答。机制示意大致是这样（各家内部格式从未公开，这里只是帮理解）：

```json
{ "function": "search", "arguments": { "query": "xxx 是什么" } }
```

尝到甜头后，工具越来越多：有人把开放 API 封装成函数——同花顺的股价接口、邮箱的发件接口……于是有了"工具集"（tools）。每个工具在清单里写清楚"输入什么、输出什么"，AI 就能自己挑选使用。

## MCP：工具的统一插座

工具多了就出现新麻烦：每个 AI 应用都得自己对接一遍各个工具，太重复。于是 Anthropic 在 2024 年底推出并开源了 **MCP**（Model Context Protocol）[6-7]——一个"工具接口"的统一规格，官方自己的类比是 USB-C：工具方按规格写一个 server，任何支持 MCP 的 AI 应用插上就能用。

顺带澄清一个常见混淆：MCP 和上面说的 function calling 是两回事，互补不冲突——**function calling 管的是"模型怎么发出调用请求"**（上面那套结构化输出），**MCP 管的是"工具怎么接入 AI 应用"**（统一插座）。后来 OpenAI、Google 也陆续采纳了 MCP。

## agent：四件套 + 一个循环

再往前一步，想法很自然：既然 AI 能通过工具调用各种 API 了，**为什么不给它一个"执行命令行"的工具**？命令的输出回填给 AI，让它看到结果、决定下一步——循环起来。

再补上三个文件工具，就凑齐了编程 agent 的经典四件套：

| 工具 | 输入 | 作用 |
|---|---|---|
| bash | 命令 | 执行命令行，返回输出 |
| read | 文件路径 | 返回文件内容 |
| write | 路径 + 内容 | 从零创建 / 整体覆盖文件 |
| edit | 路径 + 旧文本 + 新文本 | 精确替换文件中的一段内容 |

这是各家编程 agent 的最小工具集（Claude Code、Codex 这类都以此为底）[8]，实际产品通常还会补上检索（grep/glob 找文件）、差异补丁之类的工具——但核心闭环就是这四个：阅读、修改、执行。因为开发/编程的本质，就是阅读、复制粘贴/编辑、执行指令（绝大多数图形界面的按钮，底层都是命令行操作）。

于是 agent 诞生：AI 不再是只给建议的聊天框，而是能自己动手干活的"员工"。

## harness：大脑和身体

2025 年，Claude Code、Codex 这批编程 agent 成了主流[9-10]，圈内冒出个词叫 **agent harness**。它其实不是什么新概念，指的就是把裸模型变成 agent 的那套**运行时骨架**[11]：

- **事件循环**：模型说一步，程序做一步——生成回复、调工具、拿结果、再生成，周而复始；
- **上下文与记忆管理**：历史怎么组织、太长怎么压缩；
- **工具接入**：上面说的函数清单、MCP 连接；
- **权限控制与出错恢复**：哪些事允许做、半路挂了怎么接着来。

打个比方：模型是大脑，harness 是身体。大脑负责想，身体负责跑起来——骨架、神经、肌肉都在 harness 里。后来各家陆续加的多 agent 功能（一个主 agent 开几个子 agent 并行干活）也只是骨架之上的一层花活，代价是 token 烧得成倍快。真正难做、各家真正卷的，永远是骨架的底层：上下文不丢、解析稳定、权限不越界、出错能恢复。

## 提示词工程 2.0：skill

早几年"提示词工程"火过一阵——AI 不够聪明时，想要好输出就得把人设和引导写足（"你是这个领域的专家"之类）。它没消失，只是升级换名了。

以前 AI 不能读写文件，为了让 AI 把活干好，人们恨不得把几千几万字的方法论全塞进提示词。但实际开发里，**大部分内容用不上**，理想状态是"用到的时候再去查"。

AI 能读文件之后，解法自然出现：提示词可以放本地文件。先是 Claude Code 的 CLAUDE.md（项目根目录放一个，AI 每次先读），随后社区把它通用化成 AGENTS.md 开放格式（2025 年，定位就是"给 agent 看的 README"，各家 coding agent 都认）[12]。

但注意：这类文件官方反复强调**本身要短小**——几万字方法论塞不下。要装更多，就得拆：一个总览文件写根本原则（"遇到 XX 问题，先查 xxx 再回答""做设计时别一口气给全部方案，给几个选项让人类挑"），具体方法论分门别类放各文件，AI 按需去读。

这条路线的标准化产物，是 Anthropic 在 2025 年 10 月随 Claude Code 推出的 **Agent Skills**[13]：一个技能一个目录，里面一个 SKILL.md 文件、开头写名字和一句话简介；AI 平时不加载全文，先扫简介、觉得用得上才打开（官方叫"渐进式披露"[14]）——和"用到再查"是同一个思路。

Skill 的本质，就是**个人经验、个人方法论的文字化**——把"这个项目怎么干活"沉淀成 AI 能按需调用的本地记忆。

## 收尾

回头看整条线，每一步都是在补前一步的洞：

1. **记忆**：把历史拼回新问题前面；
2. **思考**：模型自己的草稿，不落进历史；
3. **工具调用**：结构化请求让 AI 触发外部动作（搜索、API、命令）；
4. **agent**：工具 + 循环，让 AI 自己读、改、执行；
5. **harness**：把模型变成 agent 的运行时骨架；
6. **skill**：把"怎么干活"的经验写成按需读取的文件。

所以 codex 这类东西看着唬人，拆开就是一个能输出文字的模型，加一套"把历史、工具、结果来回搬运"的循环。原理本身不难；真正难的是把每一环做扎实——不丢上下文、解析稳定、出错能恢复。这些才是各家 harness 真正卷的地方。

## 参考文献

[1] DeepSeek. Reasoning Model（推理模型）指南[EB/OL]. [2026-09-02]. https://api-docs.deepseek.com/guides/reasoning_model.
[2] DEEPSEEK-AI. DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning[EB/OL]. (2025-01)[2026-09-02]. https://arxiv.org/abs/2501.12948.
[3] OpenAI. Function calling and other API updates[EB/OL]. (2023-06-13)[2026-09-02]. https://openai.com/index/function-calling-and-other-api-updates/.
[4] OpenAI. Function calling（开发者指南）[EB/OL]. [2026-09-02]. https://platform.openai.com/docs/guides/function-calling.
[5] OpenAI. Introducing Structured Outputs in the API[EB/OL]. (2024-08-06)[2026-09-02]. https://openai.com/index/introducing-structured-outputs-in-the-api/.
[6] Anthropic. Introducing the Model Context Protocol[EB/OL]. (2024-11-25)[2026-09-02]. https://www.anthropic.com/news/model-context-protocol.
[7] Model Context Protocol. Specification（版本 2024-11-05）[EB/OL]. [2026-09-02]. https://modelcontextprotocol.io/specification/2024-11-05/.
[8] Anthropic. Claude Agent SDK[EB/OL]. [2026-09-02]. https://github.com/anthropics/claude-agent-sdk-typescript.
[9] Anthropic. Claude 3.7 Sonnet and Claude Code[EB/OL]. (2025-02-24)[2026-09-02]. https://www.anthropic.com/news/claude-3-7-sonnet.
[10] OpenAI. Introducing Codex[EB/OL]. (2025-05-16)[2026-09-02]. https://openai.com/index/introducing-codex/.
[11] Mario Zechner. What I learned building an opinionated and minimal coding agent[EB/OL]. (2025-11-30)[2026-09-02]. https://mariozechner.at/posts/2025-11-30-pi-coding-agent/.
[12] AGENTS.md. AGENTS.md — a simple, open format for guiding coding agents[EB/OL]. [2026-09-02]. https://github.com/agentsmd/agents.md.
[13] Anthropic. Introducing Agent Skills[EB/OL]. (2025-10-16)[2026-09-02]. https://www.anthropic.com/news/skills.
[14] Anthropic. Extend Claude with skills — Claude Code Docs[EB/OL]. [2026-09-02]. https://code.claude.com/docs/en/skills.
