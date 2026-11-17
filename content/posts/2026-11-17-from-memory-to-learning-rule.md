---
title: "持续学习：新经验应该写到哪里？"
date: 2026-11-17T21:45:00+08:00
draft: false
description: "从外部记忆、在线状态到持久参数，讨论持续学习中的经验写入、干扰与更新策略"
tags:
  - memory-continual-learning
  - 持续学习
  - 神经记忆
  - 模型架构
  - 研究札记
---

持续学习通常被概括成一个问题：模型学习新任务时，怎样不忘掉旧任务？但对一个长期运行的系统来说，还可以把问题往前推一步：新经验进入系统时，究竟应该写到哪里？

如果只把经验放进外部存储，模型下次可以检索它，却不一定因此改变内部的处理方式；如果直接更新参数，模型或许学到了新东西，也可能同时破坏原有能力。在线状态又处在两者之间：它确实发生了变化，但这种变化能保留多久？

这些问题把持续学习中的几条研究路线联系起来。与其按论文发表时间罗列，不如先看经验被写入了什么位置。

## 经验被写入什么位置？

为了比较这些方法，可以先区分三个层次。它们是一个便于讨论的阅读框架，并不是互斥的技术分类。

第一层是**外部记忆**。模型参数基本不动，系统把经验写入外部存储，需要时再取回来。MemGPT 和 ACE 属于我这次分享中讨论的这一类。

第二层是**在线状态**。信息不只是被保存下来，模型内部的一部分状态也会随着输入更新。Fast Weights、TTT 和 Titans 让我重点关注这一层。

第三层是**相对持久的参数更新**。经验经过筛选后，不再只服务于眼前的上下文，而是进入可以长期保留、按需激活或继续训练的参数结构。MoRAM、SEAL，以及 Nested Learning 所讨论的多时间尺度更新，都和这个问题有关。

区分它们时，主要看三件事：写入位置、保留时间，以及读写和更新的成本。

## EWC：参数为什么会相互干扰？

先看参数更新本身。

假设模型已经学完旧任务，参数停在 \(\theta^*\)。现在要学习新任务，参数需要发生变化。把这次变化记作 \(\Delta\theta\)，那么新参数就是 \(\theta^*+\Delta\theta\)。

我们关心的是：这一步更新会让旧任务的损失增加多少？

如果 \(\theta^*\) 是旧任务损失的局部极小点，那么它附近的梯度为零或接近零：

$$
\nabla \mathcal L_{\mathrm{old}}(\theta^*)\approx 0.
$$

先看这次参数更新让旧任务损失增加了多少：

$$
\begin{aligned}
\Delta\mathcal L_{\mathrm{old}}
&=
\mathcal L_{\mathrm{old}}(\theta^*+\Delta\theta)
-\mathcal L_{\mathrm{old}}(\theta^*).
\end{aligned}
$$

以旧任务解 \(\theta^*\) 为展开点，二阶泰勒展开为：

$$
\begin{aligned}
\mathcal L_{\mathrm{old}}(\theta^*+\Delta\theta)
=&\ \mathcal L_{\mathrm{old}}(\theta^*)
+\nabla\mathcal L_{\mathrm{old}}(\theta^*)^\top\Delta\theta\\
&+\frac12\Delta\theta^\top H_{\mathrm{old}}\Delta\theta
+O(\|\Delta\theta\|_2^3).
\end{aligned}
$$

两边减去 \(\mathcal L_{\mathrm{old}}(\theta^*)\)，再利用局部极小点处梯度近似为零，得到：

$$
\Delta\mathcal L_{\mathrm{old}}
\approx
\frac12\Delta\theta^\top H_{\mathrm{old}}\Delta\theta.
$$

这里的二次型不是简单的“参数移动距离”。把它按坐标展开：

$$
\begin{aligned}
\Delta\theta^\top H_{\mathrm{old}}\Delta\theta
&=
\sum_i\sum_j H_{ij}\Delta\theta_i\Delta\theta_j,
\qquad
H_{ij}=
\frac{\partial^2\mathcal L_{\mathrm{old}}}
{\partial\theta_i\partial\theta_j}.
\end{aligned}
$$

它同时考虑了每个参数方向的曲率，以及不同参数变化之间的耦合。

这里的 \(H_{\mathrm{old}}\) 是旧任务损失的 Hessian。这个式子说明，参数变化是否危险，不只取决于移动了多远，还取决于移动的方向。沿着曲率大的方向移动一点，旧任务损失就可能增加很多；沿着曲率小的方向，模型则相对不敏感。

如果进一步只保留 Hessian 的对角项，相当于忽略不同参数之间的交叉项：

$$
\Delta\mathcal L_{\mathrm{old}}
\approx
\frac12\sum_i H_{ii}(\Delta\theta_i)^2.
$$

EWC 再用 Fisher 信息的对角项 \(F_i\) 估计参数重要性，把这个局部约束放进新任务的训练目标。这里的 Fisher 是曲率的近似刻画，不应与 Hessian 在一般情况下直接画等号。

EWC 的做法，是用 Fisher 信息的对角近似来衡量参数对旧任务的重要程度。以负对数似然为损失时，在适当的正则条件下，期望 Fisher 信息可以作为损失曲率的估计；实际使用时通常还会采用对角近似或经验估计。因此，EWC 把旧任务的约束写成：

$$
\begin{aligned}
\mathcal L(\theta)
&=
\mathcal L_{\mathrm{new}}(\theta)
+\frac{\lambda}{2}
\sum_i F_i(\theta_i-\theta_i^*)^2.
\end{aligned}
$$

\(F_i\) 大，意味着这个参数对旧任务更重要，新任务训练时就应该少动它；\(F_i\) 小，参数的调整空间相对大一些。

EWC 的关键不在于禁止参数变化，而在于给不同参数设置不同的更新代价：对旧任务更重要的参数，应该受到更强的约束。

当然，EWC 的对角近似也有代价。参数之间的耦合关系被忽略了，Fisher 的估计也不可能完整描述所有旧知识。因此它缓解的是遗忘问题，并没有让遗忘消失。

## MemGPT 和 ACE：先不改参数，把经验留下来

如果更新参数会破坏旧能力，一个直接的办法就是暂时不动参数，把经验放到模型外面。

MemGPT 将上下文管理组织成类似操作系统内存管理的过程：上下文窗口像 RAM，外部存储像磁盘。Agent 自己决定什么时候换入、换出、读写和淘汰信息，而不是每次都把所有历史塞进提示词。

ACE 走的是另一种组织方式。它把任务执行过程中得到的经验整理成结构化的 Playbook，再通过执行、反思和整理等模块持续修订这份策略手册。基座模型的权重可以不变，系统仍然能够从过去的任务轨迹中提炼可复用的经验。

这类方法解决的是一个很实际的问题：上下文有限，但历史不必全部丢掉。需要的信息可以保存起来，下一次再取用。

这里需要区分「能找回」和「已经学会」。一个系统如果每次都要重新检索一条经验才能完成任务，它确实比完全没有历史的系统更有用；但这不等于这条经验已经改变了模型内部处理问题的方式。

外部记忆的优点是容易检查、修改和删除，出错时也容易定位。但它主要改变的是系统可访问的信息，不一定改变模型内部的表示和计算方式。要讨论后者，就需要看在线更新。

## Fast Weights 和 TTT：让一部分权重在推理时变化

Fast Weights 的出发点是：权重不一定全是慢变量。模型可以有一部分相对稳定的慢权重，也可以有一部分在推理过程中快速变化的权重，用来记录最近输入带来的信息。

TTT 把这个想法推进到了序列模型中。输入 \(x_t\) 会被映射成不同的视角，其中 \(k_t\) 提供输入，\(v_t\) 提供自监督学习目标，\(q_t\) 用来读取更新后的记忆。学习发生在序列层内部的一组快权重 \(W_t\) 上，而不是每读入一个 token 就重新微调整个基座模型。

先把 TTT 层的更新过程单独写出来：

$$
W_t=W_{t-1}-\eta_t\nabla_W\mathcal L_t,
\qquad
o_t=f(W_t,q_t).
$$

这里更新的是序列层内部的记忆参数 \(W_t\)：当前输入构造学习目标，梯度改变这组参数，再由查询 \(q_t\) 读取更新后的状态。为了看清楚梯度从哪里来，先把内部记忆网络简化成线性映射。

假设记忆矩阵 \(W\) 接收一个键向量 \(k\)，输出一个值向量：

$$
\hat v=Wk.
$$

现在希望它记住的目标是 \(v\)，那么最简单的损失就是平方误差：

$$
\mathcal L(W)=\frac12\|Wk-v\|_2^2.
$$

令 \(e=Wk-v\)。对损失求微分。先用 \(d(\frac12 e^\top e)=e^\top de\)，再注意 \(k\) 在这一步更新中是固定输入，因此 \(de=d(Wk)=(dW)k\)：

$$
\begin{aligned}
d\mathcal L
&=\frac12d(e^\top e)\\
&=e^\top de\\
&=e^\top(dW)k.
\end{aligned}
$$

接下来把标量写成迹，再对照 Frobenius 内积的定义
\(\langle A,B\rangle_F=\operatorname{tr}(A^\top B)\)：

$$
\begin{aligned}
d\mathcal L
&=\operatorname{tr}\!\left(e^\top(dW)k\right)\\
&=\operatorname{tr}\!\left(ke^\top dW\right)\\
&=\operatorname{tr}\!\left((ek^\top)^\top dW\right)\\
&=\langle ek^\top,dW\rangle_F.
\end{aligned}
$$

所以矩阵梯度就是：

$$
\nabla_W\mathcal L=(Wk-v)k^\top.
$$

把它代回梯度下降，并把时间下标补回来：

$$
\begin{aligned}
W_t
&=W_{t-1}-\eta_t(W_{t-1}k_t-v_t)k_t^\top\\
&=W_{t-1}+\eta_t(v_t-W_{t-1}k_t)k_t^\top.
\end{aligned}
$$

这就是一个最简单的在线写入规则。每次更新增加的是两个向量的外积，因此这次写入的矩阵增量至多是 Rank-1。

这个线性模型不是 TTT 的完整实现，它只用于单独观察一次写入如何改变后续读出。与把历史压进一个向量的常见 RNN 状态不同，TTT 可以把一组可更新的小模型权重作为状态；被保存下来的不只是某个向量，也包括输入到输出的映射关系。

## 一次写入会影响哪些旧记忆？

上面的更新看起来很简单，但它没有保证旧记忆不受影响。

假设刚刚写入了 \((k_t,v_t)\)，记这次写入造成的参数变化为：

$$
\begin{aligned}
\Delta W_t
&=W_t-W_{t-1}\\
&=\eta_t(v_t-W_{t-1}k_t)k_t^\top.
\end{aligned}
$$

现在用另一个旧键 \(q\) 查询。因为读出是矩阵乘法，输出变化可以直接写成：

$$
\begin{aligned}
\Delta o_t(q)
&=W_tq-W_{t-1}q\\
&=(W_t-W_{t-1})q\\
&=\Delta W_tq\\
&=\eta_t(v_t-W_{t-1}k_t)(k_t^\top q).
\end{aligned}
$$

关键就在最后的 \(k^\top q\)。

如果 \(k\) 和 \(q\) 正交，那么这次写入不会直接改变 \(q\) 的输出；如果两个键方向接近，内积就会变大，旧查询受到的影响也会变大。

把两个键都设成单位向量，令它们的夹角为 \(\phi\)，就有：

$$
k^\top q=\cos\phi.
$$

于是：

$$
\Delta o(q)=\eta(v-W_{\mathrm{old}}k)\cos\phi.
$$

当夹角接近 \(90^\circ\) 时，干扰很小；当两个方向逐渐接近时，干扰随之增大。

因此，写入造成的干扰与新旧键之间的相似度直接相关。问题不只是记忆容量够不够，还包括不同经验在表示空间里是否容易相互干扰。

## Titans：除了写入，还要控制写入和遗忘

Titans 将问题往前推了一步：除了更新记忆，还要控制更新强度和遗忘速度。

先把当前记忆对键 \(k_t\) 的读出与目标 \(v_t\) 之间的误差写成一个损失：

$$
\ell_t(M)=\|M(k_t)-v_t\|_2^2.
$$

在当前记忆 \(M_{t-1}\) 处计算梯度，得到 surprise 对应的更新方向：

$$
\begin{aligned}
g_t
&=\left.\nabla_M\ell_t(M)\right|_{M=M_{t-1}}\\
&=\nabla_M\|M_{t-1}(k_t)-v_t\|_2^2.
\end{aligned}
$$

梯度给出局部损失上升最快的方向，因此后面的更新会沿负梯度方向写入。

然后引入 momentum，把近期的更新趋势保留下来：

$$
S_t=\eta_t S_{t-1}-\theta_t g_t.
$$

最后，对已有记忆做衰减，再加上当前更新：

$$
M_t=(1-\alpha_t)M_{t-1}+S_t.
$$

把动量项代回去，可以看到三种作用是怎样叠在一起的：

$$
\begin{aligned}
M_t
&=(1-\alpha_t)M_{t-1}\\
&\quad+\eta_tS_{t-1}-\theta_tg_t.
\end{aligned}
$$

第一项保留一部分旧记忆，第二项延续之前的更新趋势，第三项根据当前误差修正记忆。这里沿用的是组会中的概括性记号，用来拆解机制，不是 Titans 论文全部门控与更新细节的逐项复写。

这样看，TTT 主要回答在线更新如何发生；Titans 则进一步考虑写入强度、更新趋势和遗忘。

但动态记忆仍然不等于终身学习。一次推理结束后，状态是否保留？换一个任务还能不能用？持续写入会不会覆盖旧经验？这些问题并不会因为模型有了在线更新能力就自动解决。

## 从临时状态到更持久的参数

再往后，问题变成：在线状态中的经验，怎样进入更持久的参数结构？MoRAM、SEAL 和 SDFT 分别从记忆单元组织、自我编辑和策略自蒸馏等角度切入。

MoRAM 的一个关键思路，是把低秩更新拆成可以检索和组合的 Rank-1 记忆单元。这个分解本身可以直接从 LoRA 的形式得到。

设 LoRA 更新为：

$$
\Delta W=BA,
$$

把低秩矩阵的两个因子按列和按行拆开。为与组会中的记号一致，记 \(B\) 的列向量为 \(v_i\)，记 \(A\) 的行向量为 \(k_i^\top\)：

$$
B=[v_1,\ldots,v_r],
\qquad
A=
\begin{bmatrix}
k_1^\top\\
\vdots\\
k_r^\top
\end{bmatrix}.
$$

那么矩阵乘法不是一个抽象的 \(BA\)，而是：

$$
\begin{aligned}
\Delta W=BA
&=
[v_1,\ldots,v_r]
\begin{bmatrix}
k_1^\top\\
\vdots\\
k_r^\top
\end{bmatrix}\\
&=v_1k_1^\top+\cdots+v_rk_r^\top\\
&=\sum_{i=1}^{r}v_i k_i^\top.
\end{aligned}
$$

每一项都是一个外积，秩至多为 1。也就是说，LoRA 的 Rank-\(r\) 更新可以拆成 \(r\) 个小的 Rank-1 更新单元；MoRAM 进一步研究如何把这些单元组织成可检索、可增量使用的记忆。

SEAL 则把注意力放在模型如何参与自己的更新过程：模型生成用于自我编辑的微调数据，再通过强化学习等机制选择修改方式，并借助 LoRA 进行相对持久的参数更新。[SDFT](https://proceedings.mlr.press/v306/shenfeld26a.html) 走的是另一条路：它把示范放进上下文，让模型先生成自己的轨迹，再用自蒸馏信号学习这些轨迹，目标是在获得新技能时尽量保留已有能力。它和前面两类记忆组织方式并不完全相同。

这几项工作并不是同一种记忆机制。它们的共同点是把讨论从「当前状态怎么更新」推向「经验怎样进入更长期的模型状态」。

## Nested Learning：不同的记忆，是否应该有不同的更新速度？

Nested Learning / Hope 讨论的另一个问题是：模型内部的不同部分，是否应该采用不同的更新频率？

眼前输入带来的信息需要快速响应；在多个片段中反复出现的模式，可以用中等速度整合；相对稳定的知识，则应该更慢地变化。这样看，模型内部其实存在不同时间尺度的状态。

先看一个熟悉的例子：优化器中的动量项

$$
m_t=\beta m_{t-1}+(1-\beta)g_t.
$$

先把前一时刻的动量代回当前式：

$$
\begin{aligned}
m_t
&=\beta m_{t-1}+(1-\beta)g_t\\
&=\beta\left[\beta m_{t-2}+(1-\beta)g_{t-1}\right]
 +(1-\beta)g_t\\
&=\beta^2m_{t-2}
 +(1-\beta)\beta g_{t-1}
 +(1-\beta)g_t.
\end{aligned}
$$

继续向前展开，每往前一步，旧梯度就多乘一个 \(\beta\)。因此：

$$
\begin{aligned}
m_t
&=\beta^t m_0\\
&\quad+(1-\beta)\sum_{j=1}^{t}\beta^{t-j}g_j.
\end{aligned}
$$

这说明 \(m_t\) 并不是只保存上一步梯度，而是把过去的梯度按指数衰减的方式压缩在一个状态里。越近的梯度权重越大，越久远的梯度影响越小。

这个展开只是说明动量状态如何汇总历史梯度，并不等同于 Hope 的完整更新规则。它提示了一个值得注意的事实：优化器状态本身也在保存历史，不同更新规则对应不同的历史保留方式。Nested Learning 将这一视角推广到不同时间尺度的学习过程。

## 从记忆结构到更新策略

到这里，问题已经不只是选择哪一种记忆结构，而是系统如何决定一次新经验应该怎样处理。

**第一，什么值得写？**

不能把每个 token、每次交互和每条中间推理都变成永久记忆。偶然的噪声、一次性的任务细节、反复出现且可复用的模式，显然不应该用同一种方式处理。系统需要判断一条经验是否值得保留，以及它的价值能持续多久。

**第二，应该写到哪一层？**

有些信息只需要留在当前上下文或 KV Cache；有些信息适合写入在线状态或快权重；有些经验可以放在外部记忆中，方便检查和检索；只有经过筛选、确实值得长期保留的内容，才考虑进入更持久的参数更新。

**第三，什么时候应该遗忘？**

遗忘不总是坏事。资源有限时，系统不可能无限保留所有历史。但如果过早删除了有用经验，或者新信息覆盖了仍然重要的旧知识，系统就会付出代价。因此，遗忘也应该是记忆策略的一部分，而不是容量用完之后才触发的补救措施。

如果把这些问题写成一个抽象的决策过程，可以记作：

$$
a_t=\pi(e_t,s_t,B_t),
$$

其中 \(e_t\) 是新经验，\(s_t\) 是当前记忆状态，\(B_t\) 是资源预算，\(a_t\) 则决定这条经验应该被丢弃、暂存在当前状态、写入外部记忆，还是触发更持久的参数更新。

这还不是一个具体算法。经验价值如何估计、动作空间如何定义、反馈信号从哪里来，都需要进一步明确。评价也不能只看准确率，还要同时记录记忆容量、读写带宽、更新时延、能耗和新旧经验之间的干扰风险。

如果一种记忆机制只能在资源近乎无限时维持效果，它还没有回答真实系统长期运行时会遇到的问题。

## 还缺少什么？

外部记忆解决了经验的保存和检索；TTT、Titans 让内部状态可以在线更新；MoRAM、SEAL 和 Nested Learning 则把问题推向参数组织、长期巩固和更新规则。

但这几层记忆之间还缺少一个明确的决策过程：新经验应该进入哪一层？什么时候需要从临时状态转成持久参数？已有经验又应该在什么条件下被覆盖或遗忘？这些问题目前还没有统一答案。

下一步我更想先从一个小模型开始，把一次写入对旧记忆造成的影响测清楚，再逐渐加入写入选择和遗忘策略。至少先弄明白：**一条新经验进入模型之后，究竟改变了什么，又让什么变得更难被记住？**

---

### 参考工作

- [EWC — Overcoming catastrophic forgetting in neural networks](https://pubmed.ncbi.nlm.nih.gov/28292907/)
- [MemGPT — Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560)
- [Fast Weights — Using Fast Weights to Attend to the Recent Past](https://arxiv.org/abs/1610.06258)
- [TTT — Learning to (Learn at Test Time)](https://proceedings.mlr.press/v267/sun25h.html)
- [Titans — Learning to Memorize at Test Time](https://research.google/pubs/titans-learning-to-memorize-at-test-time-2/)
- [MoRAM — ICML 2026](https://proceedings.mlr.press/v306/lu26au.html)
- [SEAL — Self-Adapting LLMs](https://papers.neurips.cc/paper_files/paper/2025/hash/6b41e04c41726e2a60e456d0a2b961ab-Abstract-Conference.html)
- [SDFT — Self-Distillation Enables Continual Learning](https://proceedings.mlr.press/v306/shenfeld26a.html)
- [Nested Learning — Google Research](https://research.google/blog/introducing-nested-learning-a-new-ml-paradigm-for-continual-learning/)
