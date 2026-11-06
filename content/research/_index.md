---
title: '研究方向'
description: '从高效推理与机制理解走向 AGI 理论，同时研究持续学习与记忆机制。'
showToc: true
---

> **我的终极理想是创造 AGI。当前从高效推理和模型机制出发，沿着可验证的技术问题逐步走向更深的数学理论与智能理论；与此同时，独立研究持续学习、记忆和状态更新。**

## 当前定位

我关注资源与物理约束下的模型架构、推理机制、记忆与学习。

其中，**高效推理和机制可解释性是一条连续路线**。我不把 KV Cache、Attention、Kernel 或推理系统当作最终职业终点，而是把它们作为理解模型内部计算机制、建立数学直觉并最终研究 AGI 的技术跳板。

**持续学习与记忆机制是另一条研究块**，重点是模型如何在运行过程中形成、保留、更新和巩固内部状态。

## 两条研究主线

### 主线一：从高效推理走向 AGI 理论

我的理想技术路线是：

> **KV Cache 压缩 → 注意力机制研究 → 机制可解释性 → Scaling Law 数学理论 → 计算意识理论 → AGI**

这条路线的每一段都对应一个逐渐深入的问题：

1. **KV Cache 压缩**  
   在有限显存、带宽和时延下，研究哪些信息必须保留、哪些信息可以压缩，建立对信息表示和记忆的第一手执行直觉。

2. **注意力机制研究**  
   从缓存和数据访问问题进入 Attention，研究模型如何选择信息、建立依赖并完成上下文计算。

3. **机制可解释性**  
   分析 Attention Head、MLP、层间连接和内部计算回路，理解知识、记忆和能力究竟如何在网络中实现。

4. **Scaling Law 数学理论**  
   从实验规律进一步研究模型规模、数据、计算量、损失和能力之间的数学关系，寻找现象背后的可解释结构。

5. **计算意识理论**  
   在理解表示、记忆、全局信息整合和内部状态之后，继续追问意识是否能够被形式化为某种计算过程或动力学结构。

6. **AGI**  
   最终目标是创造具有通用理解、持续学习、长期记忆、主动行动和真实环境适应能力的 AGI。

这是一条长期路线。前面的阶段可以用工程、实验和模型分析逐步验证，后面的 Scaling Law、计算意识与 AGI 仍属于开放的基础科学问题。

### 主线二：持续学习与记忆机制

这条主线独立研究模型如何在生命周期内不断获得和修正能力：

- Continual Learning
- Test-Time Learning / Test-Time Training
- Online Learning
- Neural Memory
- Memory Consolidation
- State Representation
- State Update Mechanisms
- Fast Weights
- Adaptive Plasticity
- Selective Update
- Episodic-to-Parametric Memory

核心问题包括：

- 短期工作记忆如何转化为长期记忆？
- 哪些信息应该保留、压缩、检索或遗忘？
- 模型如何在不重新处理全部历史的情况下更新内部状态？
- 如何同时适应新环境并避免灾难性遗忘？
- 记忆检索、状态更新和新能力形成之间究竟是什么关系？

这条路线与 AGI 目标有关，但研究对象是持续学习和内部状态机制本身，不等同于简单地把“外挂记忆”接到现有模型上。

## 主线一的当前研究方向

### 高效模型架构与推理

- Efficient AI / Efficient Deep Learning
- Hardware-Aware Architecture
- Algorithm-System Co-design
- LLM Inference Optimization
- KV Cache Compression
- Attention Mechanisms
- Sparse Attention
- Quantization
- Efficient Inference

### 机制可解释性

我更关注 **Mechanistic Interpretability**，而不只是解释模型输出的 XAI。

核心问题包括：

- Transformer 内部如何表示和处理信息？
- Attention Head、MLP 和层间结构如何形成计算回路？
- 知识与记忆究竟存储在哪里？
- 能否根据发现的内部机制，反过来设计更高效的新模型架构？

机制可解释性是连接高效推理、表示学习、Scaling Law 和 AGI 理论的重要中间环节。

### Scaling Law 与计算意识

这是我的长期理论方向，目前仍处于问题定义和基础积累阶段：

- 模型规模、数据、计算量与能力之间是否存在更深层的统一规律？
- Scaling Law 能否从经验拟合走向更有解释力的数学理论？
- 信息整合、内部状态、记忆和自我建模能否构成计算意识理论的形式基础？
- 这些理论能否反过来指导 AGI 架构设计？

## 端侧、具身与物理约束

我关注端侧推理、嵌入式设备和具身场景中的模型设计。内存容量、带宽、时延、能耗、并行性和通信成本，不只是部署时才考虑的工程指标，也可能反过来约束智能系统的结构。

长期来看，感知、行动、能源、身体结构和环境反馈不应只是模型外部的接口，而可能直接参与智能的形成。

## 当前项目如何连接两条主线

| 项目 | 当前积累 | 对应研究问题 |
| --- | --- | --- |
| ReservoirKV | KV Cache 压缩、残差表示、多轮记忆恢复 | 有限记忆容量下如何保留对未来有用的信息 |
| TriAttention / TurboQuant | Attention 分解、残差编码、低比特压缩 | 表示结构与压缩精度如何协同 |
| NSA / TileLang | 稀疏注意力、数据访问和计算调度 | 如何减少无效计算与数据搬运 |
| Fused MoE GEMM | 数据流、访存、并行和硬件执行 | 模型结构如何受到真实计算成本约束 |
| vLLM 推理系统 | KV 管理、Prefill、Decode 和调度 | 新的模型与记忆机制如何高效运行 |
| 持续学习阅读与实验 | 可塑性、快速状态、记忆巩固 | 模型如何在运行期间形成和修正能力 |

ReservoirKV 目前因阶段性实验结果而暂停，但并未被放弃。它对我的长期价值，不只是压缩了多少 KV，而是让我具体面对了一个更普适的问题：

> **怎样用有限的内部状态，保存对未来行为真正有用的信息？**

## 终极科学理想：创造 AGI

我的终极理想是创造 **AGI（Artificial General Intelligence，通用人工智能）**：一种能够理解不同任务、持续学习、形成长期记忆、主动行动并在真实环境中自主适应的通用智能系统。

我将这条长期探索命名为 **具身驱动的智能涌现**（Embodiment-Driven Emergence of Intelligence），并将未来的系统设想命名为 **Metavis**。

我的工作假设是：通用智能可能不是把推理、记忆、意识和行动等模块简单拼接起来，而是在具有身体边界、内部状态、物理约束和环境交互的动态系统中，通过持续适应与自组织逐渐形成。

这不是已经被证明的结论，而是我希望通过高效推理、机制可解释性、数学理论、计算意识和持续学习等研究路线逐步检验的科学问题。

## 研究关键词

**AGI · KV Cache Compression · Attention Mechanisms · Mechanistic Interpretability · Scaling Laws · Computational Consciousness · Continual Learning · Neural Memory · State Representation · Model Architecture · Hardware-Aware AI · Embodied Intelligence**
