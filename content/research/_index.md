---
title: '研究方向'
description: '资源约束下的模型架构、记忆与持续学习。'
showToc: true
---

> **以真实物理与计算约束为出发点，研究智能系统的信息表示、记忆与学习机制，探索高效且可持续适应的新一代模型架构。**

## 当前定位

我目前关注 **Resource-Constrained Intelligent Model Architectures**：资源约束下的智能模型架构与学习机制。

更完整地说，是 **Hardware-Aware Model Architecture, Memory and Continual Learning**。研究重点不是把某一个模型或某一块 GPU 调得更快，而是从内存容量、带宽、时延、能耗、并行性和通信成本等稳定约束出发，反过来思考模型应该如何表示信息、组织记忆、更新状态和持续学习。

我的研究方式是：

- **算法为主，系统为辅**：模型架构、记忆机制和学习机制是核心研究对象。
- **算法—系统协同设计**：推理引擎、Kernel 和硬件执行是验证想法真实代价的手段。
- **从可验证问题逐步走向基础问题**：先研究信息压缩、选择性计算和状态更新，再逐渐逼近持续适应与自主智能。

## 四个核心问题

### 1. 信息应该如何表示？

不同模态、不同时间尺度和不同重要程度的信息，是否应该使用完全相同的 Token、Embedding 和计算路径？

我关注表示学习、Attention、压缩表示和跨模态状态之间的关系，希望理解什么信息必须精确保留，什么信息可以转化为更紧凑的状态。

### 2. 记忆应该如何组织？

记忆不只是增大 KV Cache，也包括信息的选择、压缩、检索、遗忘和巩固。

我关心：

- 哪些信息应该保留，哪些信息可以遗忘？
- 哪些记忆需要精确检索，哪些可以压缩为状态？
- 短期工作记忆如何影响长期记忆？
- 信息应该存储在 KV Cache、隐状态、外部记忆还是模型参数中？

### 3. 内部状态应该如何更新？

系统能否在持续运行时，根据新信息增量更新内部表示，而不必重新处理全部历史？

这里涉及 State Representation、State Update Mechanisms、Fast Weights、Test-Time Learning 和 Memory Consolidation。目标是在计算效率、历史知识保留和新环境适应之间建立可解释的机制联系。

### 4. 智能如何持续学习？

我关注 Continual Learning、Online Learning、Test-Time Training、Adaptive Plasticity、Self-Distillation 和强化学习等方向，但会区分“记忆检索”“状态更新”和“能力形成”。

真正的问题是：模型怎样在与环境交互的过程中获得新能力，同时避免灾难性遗忘、无效更新和不可控漂移？

## 主要研究方向

### 高效模型架构与推理

- Efficient AI / Efficient Deep Learning
- Hardware-Aware Architecture
- Algorithm-System Co-design
- LLM Inference Optimization
- Attention Mechanisms
- KV Cache Compression
- Sparse Attention
- Quantization
- Efficient Inference

### 神经记忆与状态机制

- Neural Memory
- Memory Architecture
- Memory Consolidation
- State Representation
- State Update Mechanisms
- Fast Weights
- Episodic-to-Parametric Memory

### 持续学习与测试时适应

- Continual Learning
- Test-Time Learning / Test-Time Training
- Online Learning
- Adaptive Plasticity
- Selective Update
- Learned Update Policy

### 机制可解释性

我更关注 **Mechanistic Interpretability**，而不只是解释模型输出的 XAI。

核心问题包括：

- Transformer 内部如何表示和处理信息？
- Attention Head、MLP 和层间结构如何形成计算回路？
- 知识与记忆究竟存储在哪里？
- 能否从内部机制出发，反过来设计更高效的新模型架构？

机制可解释性对我来说既是分析工具，也是理解记忆、表示和模型能力形成方式的理论入口。

### 端侧与具身智能

我关注端侧推理、嵌入式设备和具身场景中的模型设计。长期来看，感知、行动、能源、身体结构和环境反馈不应只是模型外部的接口，而可能直接参与智能的形成。

## 当前项目如何连接这条主线

| 项目 | 当前积累 | 对应问题 |
| --- | --- | --- |
| ReservoirKV | KV Cache 压缩、残差表示、多轮记忆恢复 | 有限记忆容量下如何保留对未来有用的信息 |
| TriAttention / TurboQuant | Attention 分解、残差编码、低比特压缩 | 表示结构与压缩精度如何协同 |
| NSA / TileLang | 稀疏注意力、数据访问和计算调度 | 如何减少无效计算与数据搬运 |
| Fused MoE GEMM | 数据流、访存、并行和硬件执行 | 模型结构如何受到真实计算成本约束 |
| vLLM 推理系统 | KV 管理、Prefill、Decode 和调度 | 新的模型与记忆机制如何高效运行 |
| 持续学习阅读与实验 | 可塑性、快速状态、记忆巩固 | 模型如何在运行期间形成和修正能力 |

ReservoirKV 目前因阶段性实验结果而暂停，但并未被放弃。它对我的长期价值，不只是压缩了多少 KV，而是让我具体面对了一个更普适的问题：

> **怎样用有限的内部状态，保存对未来行为真正有用的信息？**

## 长期科学理想：Metavis

我长期想研究的是 **具身驱动的智能涌现**（Embodiment-Driven Emergence of Intelligence）。

我的工作假设是：智能可能不是一组预先拼接好的功能模块，而是在具有身体边界、内部状态、物理约束和环境交互的动态系统中，通过持续适应与自组织逐渐形成。

这不是已经被证明的结论，而是我希望沿着信息表示、记忆、状态更新、持续学习和真实交互逐步检验的科学问题。

最终，我希望构建 Metavis：一个能够通过自主行动、真实环境反馈、记忆积累和持续学习而不断成长的智能系统。

## 研究关键词

**Model Architecture · Efficient AI · Neural Memory · State Representation · Continual Learning · Test-Time Learning · Mechanistic Interpretability · Representation Learning · Attention Mechanisms · LLM Inference Optimization · Hardware-Aware AI · Embodied Intelligence**
