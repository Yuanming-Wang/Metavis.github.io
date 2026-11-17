---
title: "模型怎样从经验中学习？——从 EWC、TTT 到记忆更新的一些思考"
date: 2026-11-17T21:45:00+08:00
draft: false
description: "从灾难性遗忘出发，手推线性记忆的写入与干扰，讨论记忆应该存在哪一层、以什么规则更新"
tags:
  - memory-continual-learning
  - 持续学习
  - 神经记忆
  - 模型架构
  - 研究札记
---

最近准备持续学习的组会分享，读了 EWC、MemGPT、TTT、Titans、Nested Learning 等一些工作。起初只是想把这条研究线索理顺，后来发现，比起某篇论文做到了什么，我更在意一个没有那么容易回答的问题：

**模型经历了新事情之后，究竟应该发生什么变化？**

把一次对话存到数据库里，下次还能检索出来，我们说它有了记忆；保留一段 KV Cache，我们也说它记住了上下文；如果模型的某个权重矩阵在推理中发生了变化，好像就更接近「学习」了。但仔细想想，这三件事并不等价。

我想按自己读论文时产生的疑问，把它们串起来。推导会从最简单的模型开始，能算清楚的尽量算清楚，算不清楚的就留下问题。下面涉及的线性记忆是为了分析机制而作的简化，不是对 TTT 或 Titans 完整算法的复现；文章后半部分的想法也只是研究设想，并非已经得到实验验证的结论。

## 从遗忘问题开始

持续学习中有一个很经典的矛盾：模型如果不改变，就难以吸收新经验；但改变得太随意，原来的能力又可能被破坏。

这里的「破坏」究竟怎么理解？不妨把问题说得具体一点。

假设旧任务已经训练完成，得到参数 $\theta^*$。现在想学新任务，需要把参数从 $\theta^*$ 移动到 $\theta^*+\Delta\theta$。如果 $\theta^*$ 是旧任务损失的一个局部极小点，梯度在它附近可以近似看作零：

$$
\nabla\mathcal L_{\mathrm{old}}(\theta^*)\approx 0.
$$

于是，在这个点附近对旧任务损失做二阶泰勒展开，有

$$
\begin{aligned}
\mathcal L_{\mathrm{old}}(\theta^*+\Delta\theta)
&\approx \mathcal L_{\mathrm{old}}(\theta^*)
+\nabla\mathcal L_{\mathrm{old}}(\theta^*)^\top\Delta\theta\\
&\qquad+\frac12\Delta\theta^\top H_{\mathrm{old}}\Delta\theta\\
&\approx \mathcal L_{\mathrm{old}}(\theta^*)
+\frac12\Delta\theta^\top H_{\mathrm{old}}\Delta\theta,
\end{aligned}
$$

其中 $H_{\mathrm{old}}$ 是旧任务损失在 $\theta^*$ 处的 Hessian。

这个式子给出了一个直观解释：**不是所有参数变化都同样危险。** 沿着损失曲率大的方向移动，即便位移不大，也可能让旧任务的损失明显上升；曲率小的方向则相对宽容。

如果暂时忽略参数之间的耦合，只保留 Hessian 的对角项，便得到

$$
\Delta\mathcal L_{\mathrm{old}}
\approx \frac12\sum_i H_{ii}(\theta_i-\theta_i^*)^2.
$$

学习新任务时，既希望新损失下降，又不想旧损失上升太多。把两者放到一个目标函数中：

$$
\mathcal L(\theta)
=\mathcal L_{\mathrm{new}}(\theta)
+\frac{\lambda}{2}\sum_i F_i(\theta_i-\theta_i^*)^2.
$$

这就是 [EWC](https://pubmed.ncbi.nlm.nih.gov/28292907/) 的典型形式。这里的 $F_i$ 是用 Fisher 信息等方法得到的参数重要性估计；**不能把 Fisher 与 Hessian 在一般情况下直接画等号**，上面的泰勒展开只是帮助理解二次约束为什么合理。

我以前看到 EWC 时，主要记住的是「保护重要参数」。现在觉得它更有意思的地方是：学习不只是求一个新任务的最优解，还要考虑这一步更新会给过去带来什么代价。

然而，这又带出一个问题：既然直接修改原有参数可能造成干扰，我们能不能先不改它？

## 先把经验放在外面，行不行？

这就是我理解 [MemGPT](https://arxiv.org/abs/2310.08560)、ACE 等外部记忆方案的一个出发点。

假设一个 Agent 做任务时犯了错，下一次将错误原因和改正方法写入一份可检索的记录。此后再遇到相似问题，它读取这份记录，表现确实可能更好。即使基座权重完全没有更新，整个系统也已经从经验中获益。

MemGPT 把上下文和外部存储组织成类似分层内存的结构；ACE 则尝试把执行轨迹整理为可反复修订的策略手册。它们具体做法不同，但都说明：不必每次都更新神经网络权重，也可以让系统在使用中积累经验。

不过，「能找回」与「已经内化」仍然不同。

一个做过同类题目的学生，下次翻笔记找到答案，与不翻笔记也能够独立推导，显然是两种能力。这个类比不严格，却能说明我想区分的事情：**外部记忆改变的是系统能利用哪些信息，而权重或内部状态的更新还可能改变系统处理信息的方式。**

我并不觉得前者低级。外部记忆可追溯、易删除，还可以单独审查错误；这些优点恰恰是直接更新权重不容易拥有的。只是，如果研究目标是模型自身如何适应连续到来的信息，外部检索并没有终结问题。

于是我把注意力转向了另一件事：有没有一种记忆，它不需要修改整个基础模型，却又真的能在推理中改变内部计算？

## 如果记忆本身就是一个矩阵

[Fast Weights](https://arxiv.org/abs/1610.06258) 和 [TTT](https://proceedings.mlr.press/v267/sun25h.html) 给了我一个很有启发的视角：**记忆未必是一串需要保留下来的历史向量，也可以是一组不断变化的参数。**

先不考虑复杂网络，我们自己写一个最简单的记忆模型。

设输入键为 $k\in\mathbb R^d$，希望记住的值为 $v\in\mathbb R^m$，记忆就是一个矩阵 $W\in\mathbb R^{m\times d}$。读出规则为

$$
\hat v=Wk.
$$

读出来不对，就需要更新 $W$。最自然的做法是让平方误差小一些：

$$
\mathcal L(W)=\frac12\|Wk-v\|_2^2.
$$

这是个非常容易手算的目标。记 $e=Wk-v$，对矩阵 $W$ 求微分：

$$
\begin{aligned}
d\mathcal L
&=e^\top\,d(Wk)\\
&=e^\top(dW)k\\
&=\langle ek^\top,dW\rangle_F.
\end{aligned}
$$

最后一步用了 Frobenius 内积的定义。因此

$$
\nabla_W\mathcal L=(Wk-v)k^\top.
$$

做一次梯度下降，得到

$$
\boxed{
W_{\mathrm{new}}
=W_{\mathrm{old}}
+\eta\bigl(v-W_{\mathrm{old}}k\bigr)k^\top
}
$$

这便是一个最简的在线记忆写入规则。注意右边新增的部分是两个向量的外积，所以**一次写入对应一个至多 Rank-1 的矩阵增量**。

如果 $W$ 很大，而这次写入可以用两个向量描述，就不难理解为什么低秩更新会频繁出现在记忆研究中。当然，真实系统能否省下存储，还要看它怎样合并旧增量，以及需要保存多少个这样的向量对。

TTT 进一步把「用当前数据构造自监督目标、更新一个小型记忆网络、再读取」放进序列模型内部。它的具体机制比这个线性例子丰富得多，但这个小推导足以让我理解一个关键变化：**模型的隐状态可以不只是一个向量，而是一组经过在线学习更新的权重。**

说到这里，似乎有些令人兴奋：每来一个新输入，就做一次小更新，不就能一直学下去了吗？

还不能这么快下结论。

## 新记忆是怎么干扰旧记忆的？

上面的更新公式其实已经告诉了我们答案。我们不需要先搭建一个很大的实验，就可以用纸笔看出干扰从何而来。

假设模型刚刚对 $(k,v)$ 做了一次写入：

$$
\Delta W=\eta(v-W_{\mathrm{old}}k)k^\top.
$$

现在拿另一条过去的记忆键 $q$ 去查询。写入前后的读出差为

$$
\begin{aligned}
\Delta o(q)
&=W_{\mathrm{new}}q-W_{\mathrm{old}}q\\
&=\Delta Wq\\
&=\eta(v-W_{\mathrm{old}}k)(k^\top q).
\end{aligned}
$$

这个结果很有意思。**新写入对旧查询的影响，直接受到 $k^\top q$ 控制。**

假设两个键都是单位向量。如果 $k$ 与 $q$ 正交，那么 $k^\top q=0$，这次更新对 $q$ 的读出没有直接影响；如果两个键非常接近，内积就很大，新写入也更容易改变旧查询的结果。

例如在二维空间里，取

$$
k=\begin{pmatrix}1\\0\end{pmatrix},\qquad
q=\begin{pmatrix}\cos\phi\\\sin\phi\end{pmatrix}.
$$

于是

$$
\Delta o(q)=\eta(v-W_{\mathrm{old}}k)\cos\phi.
$$

从 $\phi=90^\circ$ 到 $\phi=0^\circ$，两个键从正交变成重合，更新影响也从零变成最大量级。

这只是一个单步、线性、固定键的例子，不能直接拿来证明真实大模型的遗忘规律。但它至少说明：**就算只更新一个很小的记忆模块，干扰问题也没有凭空消失。**

更进一步说，记忆的困难并不只在于「容量不够」。如果两个经验被编码到彼此容易干扰的方向上，即使矩阵还有空余的存储规模，新的写入也未必是安全的。

这一步是我读 [Titans](https://research.google/pubs/titans-learning-to-memorize-at-test-time-2/) 时真正开始关心写入规则的原因。Titans 不只是让神经记忆能够更新，还在更新过程中设计了与 surprise、momentum、forgetting 相关的机制。它提醒我：存什么当然重要，**以多大幅度写入、是否保留旧状态，同样是模型机制的一部分**。

## 能不能让一次写入更谨慎？

沿着刚才的例子，我们可以再做一个非常简单的推导。

只拟合当前 $(k,v)$，会倾向于让新误差尽可能小。但如果希望新矩阵不要偏离原来的 $W_{\mathrm{old}}$ 太远，可以加上一个二次惩罚：

$$
\min_W\quad
\frac12\|Wk-v\|_2^2
+\frac{\lambda}{2}\|W-W_{\mathrm{old}}\|_F^2,
\qquad \lambda>0.
$$

这个目标并不是 Titans 的原始更新公式，只是我为了弄清「稳健写入」而列的一个最小模型。它和前面的 EWC 也有相似之处：都不希望新任务的收益以任意大的旧状态变化为代价。

对 $W$ 求导并令梯度为零：

$$
(Wk-v)k^\top+\lambda(W-W_{\mathrm{old}})=0.
$$

令 $\Delta W=W-W_{\mathrm{old}}$、$r=v-W_{\mathrm{old}}k$，整理得

$$
\Delta W(kk^\top+\lambda I)=rk^\top.
$$

右乘逆矩阵，并利用

$$
k^\top(kk^\top+\lambda I)^{-1}
=\frac{k^\top}{\|k\|_2^2+\lambda},
$$

最终得到精确解

$$
\boxed{
W_{\mathrm{new}}
=W_{\mathrm{old}}
+\frac{(v-W_{\mathrm{old}}k)k^\top}
{\lambda+\|k\|_2^2}
}
$$

我们又得到了一个 Rank-1 更新，但与任意选取学习率的梯度下降相比，这里的写入幅度由旧状态约束 $\lambda$ 和键向量的范数共同决定。

$\lambda$ 越大，新状态越难偏离旧状态；$\lambda$ 越小，就越愿意适应眼前这一条样本。这是一个非常朴素的稳定性与可塑性权衡。

但是它还不能回答更难的问题：如果当前输入本来就是噪声，为什么还要更新？如果旧状态里有过时信息，为什么还要尽量保留？如果多个历史记忆在同一个方向上冲突，应该优先保护谁？

换句话说，**调节更新幅度只是第一步；决定一次经验到底值不值得写进去，是另外一个问题。**

## 从写入公式转向更新策略

读到这里，我对一些工作的关注点慢慢发生了变化。

[MoRAM](https://proceedings.mlr.press/v306/lu26au.html) 让我注意到，可检索的低秩记忆单元是一种组织参数增量的思路；[SEAL](https://papers.neurips.cc/paper_files/paper/2025/hash/6b41e04c41726e2a60e456d0a2b961ab-Abstract-Conference.html) 则尝试让模型参与生成自己的更新数据和训练过程。它们讨论的并非完全相同的记忆形式，也不能简单排成同一条技术进化路线，但都让我开始考虑「更新是如何被决定的」。

至于 [Nested Learning / Hope](https://research.google/blog/introducing-nested-learning-a-new-ml-paradigm-for-continual-learning/)，我最感兴趣的不是又多出一个模块，而是它强调了不同时间尺度的学习：有些状态可以高频变化，有些知识需要经过多次交互才值得被巩固。连优化器保存的历史量，也可以从记忆与更新的角度重新审视。

这么看，外部记忆、KV Cache、快权重、长期参数并不一定是互相替代的方案。它们可能只是同一个系统里，**读写代价、保存期限与可塑性各不相同的几类状态**。

这又让我想到推理系统里很现实的一件事：每一种记忆都要付出代价。

把信息留在 KV Cache 里，需要显存容量和读写带宽；放到外部存储里，需要检索和数据搬运；更新快权重，可能引入额外的梯度计算和同步；更新更持久的参数，还要考虑训练稳定性与旧能力退化。单看哪种方法在某个长上下文或持续学习基准上分数更高，并不足以决定它应该部署在哪里。

我现在更希望把问题表述成：给定一条经验 $e_t$ 和当前系统状态 $s_t$，能不能由一个策略决定

$$
a_t=\pi(e_t,s_t,B_t),
$$

其中 $B_t$ 表示当下的资源预算，$a_t$ 不只是「记住或丢弃」，还包括写入哪一层、更新幅度多大、保留多久。

这里的 $\pi$ 只是我的问题抽象，还没有定义一个已经可训练、可验证的具体算法。如果将来真的做实验，我想首先让决策空间尽量小，例如只比较四种操作：丢弃、保留在临时状态、写入外部记忆、触发更持久的更新。

评价时则不能只看眼前任务的准确率，还得记录旧任务性能、额外的内存占用、读写流量、更新时延，以及跨任务或跨会话后状态究竟还在不在。否则，很容易把「把评测样本记熟了」误当成真正的持续学习。

## 最后还有一个问题

回头看这些论文，最开始的问题是「新经验应该放在哪里」，后来变成「怎样把新经验写进去」，到现在我觉得更值得追问的是：

**系统凭什么知道这一条经验应该被写入？写进哪里？又在什么时候把它忘掉？**

这也许才是我想继续研究记忆机制的原因。记忆本身并不是目的。一个真正长期运行的智能系统，既不能把所有经过的事情原封不动留下，也不能在每一次更新时都不顾过去。它必须在有限资源下不断作出取舍。

现在我还没有足够的实验去支持某个新的结构设计，所以把它当作一个待检验的问题更合适。接下来如果要继续推进，我宁愿先拿一个可手算、可复现的小记忆模型，测清楚一次更新到底改变了哪些旧查询，再逐步增加写入决策，而不是一开始就堆出很复杂的多级记忆系统。

毕竟，连最小模型里为什么会相互干扰都没弄明白，直接讨论「终身记忆」恐怕还太早了。

---

**本文是 2026 年 11 月持续学习组会准备过程中的研究笔记。** 上文 EWC 的二阶近似、线性记忆的 Rank-1 写入与干扰、带二次惩罚的更新解，均为便于理解机制而整理的数学推导；它们并不构成对真实大模型持续学习性能的保证。有关可学习更新策略的部分，是尚未验证的研究设想。

### 阅读线索

- [EWC：Overcoming catastrophic forgetting in neural networks](https://pubmed.ncbi.nlm.nih.gov/28292907/)
- [MemGPT：Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560)
- [Fast Weights：Using Fast Weights to Attend to the Recent Past](https://arxiv.org/abs/1610.06258)
- [TTT：Learning to (Learn at Test Time)](https://proceedings.mlr.press/v267/sun25h.html)
- [Titans：Learning to Memorize at Test Time](https://research.google/pubs/titans-learning-to-memorize-at-test-time-2/)
- [MoRAM：ICML 2026](https://proceedings.mlr.press/v306/lu26au.html)
- [SEAL：NeurIPS 2025](https://papers.neurips.cc/paper_files/paper/2025/hash/6b41e04c41726e2a60e456d0a2b961ab-Abstract-Conference.html)
- [Nested Learning：Google Research](https://research.google/blog/introducing-nested-learning-a-new-ml-paradigm-for-continual-learning/)
