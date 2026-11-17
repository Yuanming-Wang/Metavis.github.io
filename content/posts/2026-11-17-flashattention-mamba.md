---
title: "从 FlashAttention 到 Mamba：重新理解高效架构"
date: 2026-11-17T22:50:00+08:00
draft: false
description: "从 IO-aware Attention 到 inference-first SSM，沿着计算、数据搬运与状态表示这条线，重新理解高效架构的设计问题。"
categories:
  - 高效模型架构与推理优化
tags:
  - FlashAttention
  - Mamba
  - Attention
  - SSM
  - 推理优化
---

最近把 FlashAttention 和 Mamba 几代工作重新串起来看了一遍。最初读这些工作时，我很容易把它们分别归纳成几个熟悉的关键词：FlashAttention 是 IO-aware，Mamba 是线性复杂度，Mamba-2 是 SSD，Mamba-3 则是 inference-first。

这些概括当然没错，但如果只停留在这里，很容易把论文读成一份技术名词清单。真正让我觉得有意思的，是它们其实一直在追问相似的问题：

**在给定的硬件和资源约束下，模型究竟应该保存什么、计算什么，又应该怎样组织这些计算？**

这个问题比单纯比较 FLOPs 或渐近复杂度更接近高效架构设计本身。

## 1. FlashAttention：Attention 的结果不一定需要完整的注意力矩阵

先从标准 Attention 写起。忽略 batch 和 head 维度，有

$$
S = QK^\top, \qquad P = \operatorname{softmax}(S), \qquad O = PV.
$$

其中 $Q,K,V\in\mathbb{R}^{N\times d}$，而 $S,P\in\mathbb{R}^{N\times N}$。

问题其实出在中间这两个矩阵上。以 $N=4096$、BF16 为例，一个 $N\times N$ 矩阵需要

$$
4096^2\times 2\text{ bytes}=32\text{ MiB}.
$$

这还只是一个 head 的一个矩阵。标准实现先算出 $S$，再做 Softmax 得到 $P$，最后与 $V$ 相乘。中间结果需要写回显存，再被后续算子读出来。序列长度增长时，计算量本来就是二次的，但中间矩阵的存储和读写也会带来很大的压力。

我觉得这里最值得注意的并不是“Attention 很耗显存”，而是另一个更具体的问题：

**我们最终只需要 $O$，为什么一定要把完整的 $S$ 和 $P$ 保存下来？**

FlashAttention 的关键就在于，它没有改变 Attention 的数学定义，而是改变了计算过程中的数据组织方式。把 $Q,K,V$ 分块，每次只计算一个局部 Score Tile，完成局部归一化和加权累积后，就不再保留这个 Tile 的完整概率矩阵。

这里有一个细节：Softmax 的归一化依赖整行 Score。既然 Key 被分成多个块，当前块算出的结果还没有看到后面的 Score，怎么能提前累积？

### 1.1 Online Softmax 到底在维护什么？

对一个 Query，先把 Attention 输出写成

$$
o=\frac{\sum_j e^{s_j}v_j}{\sum_j e^{s_j}}.
$$

为了避免指数溢出，通常减去最大值。令

$$
m=\max_j s_j,
$$

于是

$$
o=\frac{\sum_j e^{s_j-m}v_j}{\sum_j e^{s_j-m}}.
$$

现在假设我们已经处理了一部分 Score，只维护三个量：

$$
m=\max_{j\in\mathcal{C}}s_j,
$$

$$
\ell=\sum_{j\in\mathcal{C}}e^{s_j-m},
\qquad
u=\sum_{j\in\mathcal{C}}e^{s_j-m}v_j.
$$

最终输出就是 $o=u/\ell$。这里的 $m$ 是当前已经处理部分的最大值，$\ell$ 是归一化分母，$u$ 是未归一化的加权 Value 和。

接下来加入一个新块。记新块的最大 Score 为 $m_b$，那么更新后的最大值是

$$
m'=\max(m,m_b).
$$

旧块的指数参考尺度也随之改变。定义

$$
\alpha=e^{m-m'}.
$$

因为对任意旧 Score，都有

$$
e^{s_j-m'}=e^{s_j-m}e^{m-m'}
=\alpha e^{s_j-m},
$$

所以旧的累积量不需要重新读取旧 Score，只需要统一乘上 $\alpha$。若新块内的 Score 为 $s_j$，则

$$
\ell'=\alpha\ell+\sum_{j\in b}e^{s_j-m'},
$$

$$
u'=\alpha u+\sum_{j\in b}e^{s_j-m'}v_j.
$$

处理完所有块之后，

$$
o=\frac{u'}{\ell'}.
$$

这就是 Online Softmax 最核心的地方：**全局归一化可以被压缩成少量可递推的统计量。** 它没有近似掉 Softmax，也没有改变 Attention 的结果，只是避免了把完整的中间矩阵物化到 HBM。

这也解释了 FlashAttention 为什么不是通过减少 Attention 的算术复杂度来加速。它仍然要做 $O(N^2d)$ 量级的计算，优化的是数据在不同存储层级之间的移动。

### 1.2 从算法到 GPU：Tile 的生命周期

如果只看公式，似乎做到分块就结束了。但真正运行在 GPU 上，还要考虑 Tile 如何分配给 CTA 和 Warp，数据何时从 HBM 搬到片上，矩阵乘法、Softmax 和 Value 累积之间如何衔接。

我倾向于把 FlashAttention 的实现理解成对中间数据生命周期的重新安排：

1. 从 HBM 取入当前所需的 $Q/K/V$ Tile；
2. 在片上计算局部 $QK^\top$；
3. 更新行最大值和指数归一化统计量；
4. 将局部概率与 $V$ 相乘，累积到输出；
5. 丢弃当前 Score Tile，继续处理下一块。

因此，Tiling 不只是把大矩阵切小。它决定了哪些数据能够留在片上、哪些数据必须写回显存，以及一个中间结果应该存在多久。

反向传播也沿着类似的思路展开：前向不保存完整的 $P$，反向时根据 $Q,K$ 和归一化统计量重新计算局部 Score 与概率块，以重计算换取更少的显存读写。

后来再看 FlashAttention-2、3、4，能看到优化问题继续向下移动。FA2 重新安排 Query 与 Warp/CTA 的工作划分，减少不必要的跨 Warp 归约；FA3 利用 Hopper 的异步数据搬运和矩阵计算能力，让不同执行阶段尽可能重叠；到了 FA4，Blackwell 上 Tensor Core 的吞吐增长又把瓶颈推向指数运算、共享内存通信和流水线组织。

这条演进路线给我的一个直观感受是：**一个瓶颈被解决之后，原来被掩盖的瓶颈就会显现出来。** 所以高效 Kernel 很难靠一套固定技巧一直优化下去，必须重新测量当前硬件上真正限制吞吐的部分。

## 2. Mamba：如果不保存全部历史，状态应该怎样更新？

FlashAttention 仍然保留了标准 Attention 的计算形式，只是让中间矩阵不再落到 HBM。Mamba 则把问题推进了一步：能不能不显式保存所有历史 Token 的 Key/Value，而是用一个固定大小的状态承载历史信息？

从连续时间的线性状态空间模型开始：

$$
\frac{dh(t)}{dt}=Ah(t)+Bx(t).
$$

这里 $h(t)$ 是状态，$A$ 描述状态自身如何演化，$B$ 描述输入如何进入状态。为了先看清楚更新机制，可以考虑最简单的一维情形：

$$
\frac{dh(t)}{dt}=-h(t)+x(t).
$$

假设一个离散区间内 $x(t)$ 保持不变，区间长度为 $\Delta$。解这个微分方程：

$$
h_t=e^{-\Delta}h_{t-1}
+\int_0^\Delta e^{-(\Delta-\tau)}x_t\,d\tau.
$$

积分项可以直接算出：

$$
\int_0^\Delta e^{-(\Delta-\tau)}d\tau
=1-e^{-\Delta}.
$$

所以

$$
h_t=e^{-\Delta}h_{t-1}
+(1-e^{-\Delta})x_t.
$$

这个式子很简单，但已经能看出状态更新的两个部分：旧状态乘上衰减系数，新输入乘上写入系数。$\Delta$ 越大，旧状态保留得越少，新输入的影响越大。

Mamba-1 的 Selectivity 则让离散参数能够依赖当前输入。也就是说，模型不再对每个 Token 都使用完全相同的状态更新规则，而是可以根据当前 Token 调整状态保留、写入和读出的方式。

这一步解决的是固定线性时不变系统缺乏内容自适应的问题。不过，选择性更新并不意味着固定状态能够无损保存任意长度的历史。状态容量仍然有限，模型必须在有限表示中保留对后续预测有用的信息。

### 2.1 有递推依赖，训练为什么还能并行？

状态更新看起来是串行的：

$$
h_t=a_th_{t-1}+b_t.
$$

但可以把每一步看成一个仿射函数：

$$
f_t(h)=a_th+b_t.
$$

两个仿射函数复合仍然是仿射函数。若把 $(a_1,b_1)$ 和 $(a_2,b_2)$ 作为两个更新，定义组合运算

$$
(a_1,b_1)\otimes(a_2,b_2)
=(a_2a_1,\ a_2b_1+b_2).
$$

这个运算满足结合律。于是，多个状态更新可以组织成 Prefix Scan，而不必严格按照 Token 顺序逐步执行每一次计算。

这里并没有消除时间上的因果关系，只是利用结合律改变了计算括号。训练时可以通过并行 Scan 计算前缀状态，Decode 时则仍然可以逐 Token 更新状态。

我认为这是 Mamba 里一个很典型的例子：算法是否能并行，不只取决于公式表面上有没有递归，还取决于递归操作能否找到适合并行组合的代数结构。

## 3. Mamba-2：为什么有时要主动限制模型的表达形式？

Mamba-1 的状态转移具有较丰富的结构，但这种结构并不一定最适合 GPU 的矩阵计算单元。

Mamba-2 做了一个很有代表性的取舍：将状态转移进一步约束为标量乘单位阵的形式。直观地说，同一个 Head 内的状态维度共享一个标量衰减，而不是每个维度都使用独立的转移系数。

这样做牺牲了一部分状态转移的自由度，却换来了更规整的矩阵结构。论文通过 State Space Duality（SSD）把状态递推与结构化矩阵乘法联系起来，使得块内计算可以更充分地利用 GEMM 和 Tensor Core。

简单展开一下递推就能看到这种联系。考虑

$$
h_t=a_th_{t-1}+B_tx_t,
\qquad y_t=C_t^\top h_t.
$$

连续展开：

$$
h_1=B_1x_1,
$$

$$
h_2=a_2B_1x_1+B_2x_2,
$$

$$
h_3=a_3a_2B_1x_1+a_3B_2x_2+B_3x_3.
$$

因此，

$$
y_3
=a_3a_2(C_3^\top B_1)x_1
+a_3(C_3^\top B_2)x_2
+(C_3^\top B_3)x_3.
$$

可以看到，历史 Token 对当前输出的贡献由两类因素相乘得到：一类是沿时间累积的衰减系数，另一类是输入与输出方向之间的内容交互。把这些系数排成矩阵，就得到一种带有因果结构的矩阵表示。

这里需要特别区分：SSD 的矩阵形式并不等于标准 Softmax Attention。它来自状态递推的展开，矩阵具有特定的衰减和结构约束。

进一步地，Chunkwise SSD 把序列分块：块内通过局部矩阵乘法计算，块间通过边界状态传递历史影响，再用 Prefix Scan 传播 Chunk 状态。这样既能使用 GEMM 的高吞吐，也不必显式构造完整的长序列矩阵。

这让我想到，架构设计中的“表达能力”与“硬件效率”并不总是同一个方向。某些约束看起来是在削弱模型，实际上可能是在把计算变成硬件更擅长执行的形式。关键不是无条件地追求更一般的数学表达，而是看被约束掉的自由度是否真的值得它带来的计算成本。

## 4. Mamba-3：Decode 阶段的计算可能太少了

Mamba-2 的设计明显重视训练效率。但模型进入 Decode 阶段之后，计算形态发生了变化：每生成一个 Token，都需要读取并更新状态。此时，如果每次状态更新只做很少的计算，整体执行就可能受限于状态读写，而不是算术吞吐。

这引出了一个值得思考的问题：**当 Decode 已经是 memory-bound 时，继续减少 FLOPs 是否一定能让模型更快？**

从 Roofline 的角度看，性能不仅取决于算术量，还取决于算术强度：

$$
AI=\frac{\text{FLOPs}}{\text{Bytes moved}}.
$$

如果计算单元还有空闲，而状态读写已经占据主要时间，那么适当增加有用计算，并不一定会同比增加延迟。当然，这不是说额外计算免费；它必须落在当前硬件尚有余量的范围内，还要考虑参数读取、同步、调度和 Batch 形状等因素。

Mamba-3 的三个改动可以放在这个背景下理解。

### 4.1 从单端点输入到双端点输入

传统离散更新可以理解为用一个端点近似区间内的输入作用。Mamba-3 使用 Exponentially Adjusted Trapezoidal 形式，让前后两个端点共同参与输入积分的近似。

先把区间内的状态转移部分固定，关注输入项：

$$
h_t\approx e^{\Delta_t A_t}h_{t-1}
+\int_{t-1}^{t}e^{(t-\tau)A_t}B_tf_t(\tau)\,d\tau.
$$

如果只使用右端点估计，输入项可以写成类似

$$
\Delta_t f_t(t).
$$

而梯形形式会同时考虑区间两端：

$$
\Delta_t\left[(1-\lambda_t)f_t(t-1)
+\lambda_t f_t(t)\right].
$$

将端点对应的输入代回去，递推式就不再只包含当前输入，而是多出一个前一时刻的输入项：

$$
h_t=\alpha_t h_{t-1}
+\beta_t B_{t-1}x_{t-1}
+\gamma_t B_tx_t.
$$

这里重要的不是把它简单理解成“更高阶的积分”，而是它让局部时间混合有了更丰富的形式。也需要注意，并不是任意可学习的 $\lambda_t$ 都自动保证经典梯形公式的二阶精度。

### 4.2 复数状态：从单纯衰减到旋转与衰减

如果状态转移只有正实数衰减，那么状态分量可以逐渐减弱，却不能直接表达旋转或振荡。

把两个实数状态合成一个复数状态，令转移系数包含幅值和相位：

$$
z_t=e^{(a+i\omega)\Delta_t}z_{t-1}.
$$

利用欧拉公式，

$$
e^{i\theta}=\cos\theta+i\sin\theta,
$$

可以将复数乘法写成二维实数旋转：

$$
R(\theta)=
\begin{pmatrix}
\cos\theta&-\sin\theta\\
\sin\theta&\cos\theta
\end{pmatrix}.
$$

因此状态更新可以理解为

$$
\begin{pmatrix}u_t\\v_t\end{pmatrix}
=e^{a\Delta_t}R(\omega\Delta_t)
\begin{pmatrix}u_{t-1}\\v_{t-1}\end{pmatrix}.
$$

它同时包含衰减和相位变化。同样大小的状态空间，现在能够表达更丰富的动态关系。通过类似 RoPE 的重参数化，可以在实数计算中实现这种旋转结构。

### 4.3 MIMO：让一次状态更新承载更多计算

再看 Mamba-2 中的 SISO 状态更新。其核心写入项可以表示成一个外积：

$$
H_t=a_tH_{t-1}+b_tx_t^\top,
$$

其中 $b_t\in\mathbb{R}^{N\times 1}$，$x_t\in\mathbb{R}^{P\times 1}$，所以每次写入的矩阵秩至多为 1。

Mamba-3 的 MIMO 形式把单个外积扩展为多个输入方向的组合：

$$
H_t=a_tH_{t-1}+B_tX_t^\top,
$$

其中

$$
B_t\in\mathbb{R}^{N\times R},\qquad
X_t\in\mathbb{R}^{P\times R}.
$$

等价地看，更新项是 $R$ 个外积之和，单步更新的秩最多可以达到 $R$。但主要状态仍然是 $N\times P$，并不是把状态直接扩大成 $N\times P\times R$。

这点很重要：MIMO 增加的是每一步状态更新的计算自由度，而不是让状态存储量也按 $R$ 倍增长。若 Decode 的主要瓶颈确实是状态读写，而计算单元还有空余，那么这类设计就有机会用更多计算换取更好的模型表达能力。

但它是否真的划算，仍然要看实际 Kernel 和服务负载。额外的矩阵运算、输入读取、参数开销，以及不同 Batch 下的调度效率，都不能只从公式中判断。

## 5. 我现在更关心的，是如何从成本反推架构

把这几代工作放在一起，我逐渐觉得“高效架构”不应该只按照复杂度来分类。

FlashAttention 没有减少 Attention 的二次计算，却改变了中间结果的存储方式和数据搬运路径；Mamba 用固定状态替代不断增长的历史存储，但也因此引入了状态容量和信息保留的问题；Mamba-2 主动约束状态转移结构，让计算更适合 GPU；Mamba-3 则重新审视 Decode 阶段的资源利用率，尝试让固定状态承载更多有用计算。

它们处理的不是同一个层次的问题，却有一个共同点：先看清楚真实执行过程中最贵的部分，再决定算法和表示应该长什么样。

我想把这个思路进一步抽象成三个问题：

**第一，数据应该以什么形式存在？**

是保存完整的历史 KV，是保存压缩后的状态，还是只保留某种可以递推的统计量？不同表示决定了内存容量、带宽和信息保留之间的取舍。

**第二，计算应该以什么形式组织？**

同一个数学运算，分块方式、并行粒度、数据复用和同步方式不同，实际性能可能差别很大。理论上的并行性也不等于硬件上能够高效执行。

**第三，模型应该把有限资源花在哪里？**

如果某个阶段受限于带宽，继续压缩 FLOPs 未必有效；如果状态容量限制了记忆能力，单纯加快状态更新也不够。真正值得研究的，可能是如何在固定的内存、带宽、时延和能耗预算下，让每一次状态更新携带更多有效信息。

这也让我对“线性复杂度”有了更谨慎的看法。线性只是对某种计算或存储规模的描述，并不能直接推出端到端推理一定更快。反过来，增加一些计算也不必然意味着更慢。最终还是要回到具体的硬件执行路径和实际负载。

我目前还没有一个确定的答案，但至少有一个方向越来越清楚：与其先假设某种架构天然高效，再围绕它做局部优化，不如从内存容量、带宽、计算吞吐、通信和时延这些约束出发，重新考虑模型的状态表示与更新机制。

这可能才是我希望持续研究的高效架构问题。

## 参考资料

1. Dao et al., [FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135), NeurIPS 2022.
2. Dao, [FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691), ICLR 2024.
3. Shah et al., [FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision](https://arxiv.org/abs/2407.08608), NeurIPS 2024.
4. Zadouri et al., [FlashAttention-4: Algorithm and Kernel Pipelining Co-Design for Asymmetric Hardware Scaling](https://arxiv.org/abs/2603.05451), MLSys 2026.
5. Gu & Dao, [Mamba: Linear-Time Sequence Modeling with Selective State Spaces](https://arxiv.org/abs/2312.00752), 2023.
6. Dao & Gu, [Transformers are SSMs: Generalized Models and Efficient Algorithms Through Structured State Space Duality](https://arxiv.org/abs/2405.21060), ICML 2024.
7. Lahoti et al., [Mamba-3: Improved Sequence Modeling using State Space Principles](https://arxiv.org/abs/2603.15569), ICLR 2026.
8. Tri Dao, [Mamba-3 Part 1](https://tridao.me/blog/2026/mamba3-part1/) and [Mamba-3 Part 2](https://tridao.me/blog/2026/mamba3-part2/).
9. [Triton Fused Attention Tutorial](https://triton-lang.org/main/getting-started/tutorials/06-fused-attention.html).
