---
title: Codeforces Round 1127（Div. 2）题解草稿
pubDatetime: 2026-10-12T00:00:00+08:00
description: 赛时4题，简要分析了ABCD四题的思路，补充E题赛后讨论的做法。
draft: true
excludeFromRss: true
tags:
  - OI日记
  - CodeFoces
---

赛时 4 题。

## A 题

> [!note] 题目：[The Projections of Paco](https://codeforces.com/contest/2274/problem/A)
> 数轴上有一个初始位于 $0$ 的棋子，给定 $n$ 个整数 $a_1,a_2,\ldots,a_n$。
> 选择一个整数 $p$，让棋子依次关于 $p,a_1,a_2,\ldots,a_n$ 各反射一次。关于某点反射，就是移动到该点另一侧且保持到该点的距离不变。
> 求使棋子最终回到 $0$ 的 $p$。题目保证这样的整数恰好有一个。

解析：

显然反射可逆，那么已知知最终位置，自然可以逆向操作，倒着关于 $a_n,a_{n-1},\ldots,a_1$ 反射，就能得到第一次关于 $p$ 反射后的镜像点 `cur`。

不过这里注意一下，我们求的是对称中心 $p$，它是原位置 $0$ 和镜像点 `cur` 的中点，因此答案为 $cur/2$。

```cpp
int cur = 0;
for (int i = n - 1; i >= 0; i--) {
    cur = 2 * a[i] - cur;
}
cout << cur / 2 << "\n";
```

**反思**：初次提交忘了最后的 `/ 2`，直接输出了镜像点的位置。补上之后才是题目要求的对称中心。

时间复杂度 $O(n)$，空间复杂度 $O(n)$。

**送的**

## B 题

> [!note] 题目：[Prefix](https://codeforces.com/contest/2274/problem/B)
> 给定数组 $a$，按顺序处理 $i=2,3,\ldots,n$。
> 设已经修改过的前缀和为 $s=a_1+\cdots+a_{i-1}$，把当前的 $a_i$ 替换成 $a_i-s$、$a_i$ 或 $a_i+s$ 中的一个。
> 求所有选择中，最终数组最大元素的最大可能值。

解析：

直观上，贪心让前缀和最大，进而可以让元素 ai 经过操作后最大。

故我们考虑如下dp，定义：

- `dp[i][0]`：处理完前 $i+1$ 个元素后，最小的可达前缀和；
- `dp[i][1]`：处理完前 $i+1$ 个元素后，最大的可达前缀和。

设此前的前缀和为 $s$，当前元素为 $x$。从 $x-s,x,x+s$ 中选择，当前元素的最小、最大值分别为 $x-|s|$、$x+|s|$。再加上原来的前缀和，得到：

$$f(s)=s+x-|s|,\qquad g(s)=s+x+|s|$$


```cpp
using ll = long long;

vector<vector<ll>> dp(n, vector<ll>(2, 0));
dp[0][0] = dp[0][1] = a[0];
ll res = a[0];

for (int i = 1; i < n; i++) {
    dp[i][0] = min(
        dp[i - 1][0] + a[i] - abs(dp[i - 1][0]),
        dp[i - 1][1] + a[i] - abs(dp[i - 1][1]));

    dp[i][1] = max(
        dp[i - 1][0] + a[i] + abs(dp[i - 1][0]),
        dp[i - 1][1] + a[i] + abs(dp[i - 1][1]));

    res = max(res, a[i] + abs(dp[i - 1][0]));
    res = max(res, a[i] + abs(dp[i - 1][1]));
}

cout << res << "\n";
```

其中，当前元素最大能变成 $x+|s|$，而 $|s|$ 的最大值也在两个端点中取得，所以用上一层状态更新 `res`。题目只要求某一个元素尽量大，各位置不需要同时实现各自的最大值。

由上面的分段式，还可以把转移简化。令上一层的两个极值为 $L,R$，则：

$$f(L)=x+\min(0,2L),\qquad g(R)=x+\max(0,2R)$$

对应代码为：

```cpp
dp[i][0] = a[i] + min(0LL, 2 * dp[i - 1][0]);
dp[i][1] = a[i] + max(0LL, 2 * dp[i - 1][1]);
```

**反思**：更新最大前缀和时，把 `max` 写成了 `min`，导致 `[1,1,1,1]` 本来可以得到 $8$，却只算出 $4$。

时间复杂度 $O(n)$，我的写法空间复杂度 $O(n)$；若边读入边处理、滚动保存两个状态，额外空间可以降到 $O(1)$。


## C 题

> [!note] 题目：[Lavencia Oranges](https://codeforces.com/contest/2274/problem/C)
> 有 $n$ 个橙子和 $n$ 个袋子，构造长度为 $n$ 的数组 $a$，其中 $a_i$ 表示第 $i$ 个橙子放入的袋子编号，要求 $1\le a_i\le n$。
> 对方会选择一种橙子数量 $s$，拿走所有恰好装有 $s$ 个橙子的袋子，使拿走的橙子总数最大。
> 记 $c_i$ 为恰好装有 $i$ 个橙子的袋子数，代价为 $\max_{0\le i\le n}i c_i$。求最小代价，并输出一种达到它的数组。

解析：

仔细读题子，发现真正的约束只有一个，即各类袋子需要满足 $\sum i c_i=n$。我们稍微构造一下发现不同代价上界 $k$ 对应的构造可能完全不同，不容易从一个方案递推最优解，所以先求最小可行的 $k$，再构造一次数组。

固定 $k$ 后，每类都要满足 $i c_i\le k$，即大小为 $i$ 的袋子最多有 $\lfloor k/i\rfloor$ 个，总容量为：

$$C(k)=\sum_{i=1}^{n}i\left\lfloor\frac{k}{i}\right\rfloor$$

容量小于 $n$ 一定不可行；容量不少于 $n$ 时，可以用下面的倒序构造恰好放满，因此判定条件就是 $C(k)\ge n$。

$k$ 越大，各类额度不会减少，可行性单调。答案至少为 $1$，把所有橙子放进一个袋子的代价为 $n$，所以在 $[1,n]$ 内二分最小可行值。

判定代码如下：

```cpp
using ll = long long;

int n;

bool check(ll k) {
    ll need = n;
    for (int i = 1; i <= n; i++) {
        ll cnt = k / i;
        need -= cnt * i;
    }
    return need <= 0;
}
```

确定答案后，从大到小枚举袋子大小。`answer` 是最优代价，`need` 是剩余橙子数，每类放 `min(answer / i, need / i)` 个完整袋子。代码中的 `k` 只是袋子编号。

直观上感觉倒叙放更容易放满：

- 若某类大小 $i\ge2$ 没用满额度，剩余量就小于 $i\le answer$，最后用单元素袋子即可补齐。
- 若大小 $2\sim answer$ 的袋子都用满了，由总容量不少于 $n$ 可知，剩余量也不会超过单元素袋子的额度 `answer`。

二分与构造部分如下：

```cpp
int l = 1, r = n;
while (l < r) {
    int mid = (l + r) / 2;
    if (check(mid)) {
        r = mid;
    } else {
        l = mid + 1;
    }
}
cout << l << "\n";

int answer = l;
int need = n;
int k = 1;

for (int i = answer; i >= 1; i--) {
    int cnt = min(answer / i, need / i);

    for (int j = 0; j < cnt; j++) {
        for (int p = 0; p < i; p++) {
            cout << k << " ";
        }
        need -= i;
        k++;
    }
}
cout << "\n";
```

**反思**：最初从小往大放，再截断最后一个袋子补满，忽略了袋子大小变化后要重新统计代价。例如 $n=6$，三个单元素袋子、一个双元素袋子之后还剩一个橙子，单独放入会使单元素这一类的代价变成 $4$；倒序构造 `[1,1,1,2,2,3]` 的代价为 $3$。另外，放满时 `need == 0` 就应停止，不能等到小于 $0$。

时间复杂度 $O(n\log n)$，额外空间复杂度 $O(1)$。


## D 题

> [!note] 题目：[Robot Championship](https://codeforces.com/contest/2274/problem/D)
> 有一个 $n\times n$ 的棋盘，行从下往上编号、列从左往右编号，机器人藏在未知格子里。
> 每秒先选择一个 $2\le v\le2n$，发射覆盖所有 $r+c=v$ 格子的激光；命中就获胜。
> 若没有命中，机器人必须选择一种不越界的移动：向上 $(r+1,c)$、向右 $(r,c+1)$，或向左下 $(r-1,c-1)$。
> 提前输出一个至多 $3n$ 次射击的固定序列，保证机器人无论从哪里出发、如何合法移动，都至少被命中一次。

解析：

**反思**：D 题最初考虑压边界，但具体位置不好处理。

先只看所在对角线，令 $s=r+c$，三种移动对 $s$ 的影响分别为 $+1,+1,-2$。

最重要的特征是：模 $3$ 意义下，每次移动都相当于 $+1$。因此，$s-\text{已移动次数}$ 的余数不变。

> **推论 1：** 初始位置和模 $3$ 相同的机器人，在同一时刻仍然具有相同余数，可以分成三个族处理。

题目允许至多 $3n$ 次射击，因此尝试每轮用至多 $n$ 次处理一个族。

假设当前这一族的位置和不超过 $v$，且都与 $v$ 模 $3$ 相同。射击 $v$ 后，剩余位置和至多为 $v-3$；再移动一步，最多增加 $1$，所以上界变成 $v-2$。

> **推论 2：** 射击 $v$ 并移动一步后，可以用 $v-2$ 作为该族的新上界，且它与该族当前的余数相同。实际候选可能更早清空。

因此，一轮的射击序列为：

$$M,M-2,M-4,\ldots$$

例如，考虑初始位置和为 $3,6,9,\ldots,3k$ 的一族，先看 $k\ge4$ 时的前两步。射击 $3k$ 后，剩余位置和至多为 $3k-3$；移动后，这一族变为 $4,7,10,\ldots,3k-2$。再射击 $3k-2$，移动后变为 $2,5,8,\ldots,3k-4$。

取 $n=6,k=4$，把过程展开：

$$
\begin{aligned}
\{3,6,9,12\}
&\xrightarrow{\text{射击 }12\text{ 后移动}}\{4,7,10\}\\
&\xrightarrow{\text{射击 }10\text{ 后移动}}\{2,5,8\}\\
&\xrightarrow{\text{射击 }8\text{ 后移动}}\{3,6\}\\
&\xrightarrow{\text{射击 }6\text{ 后移动}}\{4\}\\
&\xrightarrow{\text{射击 }4}\varnothing.
\end{aligned}
$$

射击 $6$ 后，$3$ 移动到 $1$ 或 $4$，但 $1$ 越界，所以只剩 $4$。这一族在射击 $4$ 时已经清空，统一构造继续射击 $2$ 也不影响正确性。不过为了统一一点，可以继续射击2。

每轮至多 $\lfloor M/2\rfloor\le n$ 次射击，三轮总共不超过 $3n$。

实现时，`k` 表示此前已经射击的次数，也是未被命中的机器人已经移动的次数。初始余数为 `c` 的族，当前余数是 `(c + k) % 3`；再取不超过 $2n$ 的最大同余值作为本轮起点。

代码如下：

```cpp
void solve() {
    int n;
    cin >> n;

    int k = 0;
    vector<int> ans;

    for (int c = 0; c < 3; c++) {
        int r = (c + k) % 3;
        int v = 2 * n - (2 * n - r) % 3;

        for (; v >= 2; v -= 2) {
            ans.push_back(v);
            k++;
        }
    }

    cout << k << "\n";
    for (int v : ans) {
        cout << v << " ";
    }
    cout << "\n";
}
```

这里只维护覆盖所有可能位置的上界，不要求每个候选值都实际可达。

时间复杂度和空间复杂度均为 $O(n)$。

## E 题

> [!note] 题目：[Matrix Puzzle](https://codeforces.com/contest/2274/problem/E)
> 给定两个 $n\times n$ 的矩阵 $a,b$，处理两类操作。
> `U r1 c1 r2 c2 x`：给 $a$ 中指定子矩阵的所有元素加上 $x$。
> `Q r1 c1 r2 c2`：判断能否对该子矩阵中的各行、各列分别加任意常数，使它与 $b$ 的同位置子矩阵完全相同。
> 查询中的调整是假设性的，各次查询独立，不会真正修改矩阵。只有 `U` 修改 $a$，$b$ 始终不变。

解析：

赛后讨论的思路，完整实现待补。

一次矩形加法只改变四个二维差分点，因此先考虑差分。将两个矩阵相减，令：

$$c_{i,j}=a_{i,j}-b_{i,j}$$

约定第 $0$ 行和第 $0$ 列为 $0$，其二维差分为：

$$d_{i,j}=c_{i,j}-c_{i-1,j}-c_{i,j-1}+c_{i-1,j-1}$$

给局部子矩阵的一行或一列加常数，只影响局部差分的第一行、第一列，内部差分不变。因此：

> **推论 1：** 子矩阵能够匹配的必要条件，是其内部差分全部为 $0$，即：
>
> $$d_{i,j}=0,\qquad r_1+1\le i\le r_2,\quad c_1+1\le j\le c_2$$

它也是充分条件。内部差分全为 $0$，则：

$$c_{i,j}=c_{i,c_1}+c_{r_1,j}-c_{r_1,c_1}$$

右边可以拆成行贡献与列贡献。选择 $h_i=-c_{i,c_1}$、$w_j=c_{r_1,c_1}-c_{r_1,j}$，就能使 $a_{i,j}+h_i+w_j=b_{i,j}$。

局部差分的内部点与全局差分的对应点相同，所以直接查询全局差分矩阵即可。

**反思**：若每次逐个检查，仍需要扫描整个子矩阵。我的思路卡在这里，后面补上的是维护非零点的数量。

令：

$$f_{i,j}=[d_{i,j}\ne0]$$

查询内部矩形的 $f$ 之和，为 $0$ 即可匹配。这里统计的是**非零点的数量**：差分中的 $1$ 和 $-1$ 都标记为 $1$，不会抵消。

使用二维树状数组（Fenwick Tree）[^fenwick] 维护 $f$，即可支持单点修改与矩形求和：

```cpp
using ll = long long;

const int N = 1000 + 5;
int n, bit[N][N];
ll d[N][N];

void add(int x, int y, int v) {
    for (int i = x; i <= n; i += i & -i)
        for (int j = y; j <= n; j += j & -j)
            bit[i][j] += v;
}

int sum(int x, int y) {
    int res = 0;
    for (int i = x; i > 0; i -= i & -i)
        for (int j = y; j > 0; j -= j & -j)
            res += bit[i][j];
    return res;
}

int query(int x1, int y1, int x2, int y2) {
    if (x1 > x2 || y1 > y2) return 0;
    return sum(x2, y2)
         - sum(x1 - 1, y2)
         - sum(x2, y1 - 1)
         + sum(x1 - 1, y1 - 1);
}

void change(int x, int y, ll v) {
    if (x > n || y > n) return;

    int pre = (d[x][y] != 0);
    d[x][y] += v;
    int now = (d[x][y] != 0);

    add(x, y, now - pre);
}
```

更新时，只将差分点修改前后的标记变化量加入树状数组：

```cpp
// U r1 c1 r2 c2 x
change(r1, c1, x);
change(r1, c2 + 1, -x);
change(r2 + 1, c1, -x);
change(r2 + 1, c2 + 1, x);

// Q r1 c1 r2 c2
cout << (query(r1 + 1, c1 + 1, r2, c2) == 0 ? "YES\n" : "NO\n");
```

单行或单列查询没有内部差分点，因此一定可以匹配。上面的 `query` 对空矩形返回 $0$。

初始化时，先计算 $c,d,f$。若逐点调用 `add`，初始化需要 $O(n^2\log^2 n)$；也可以利用标记矩阵的二维前缀和，在 $O(n^2)$ 内构建树状数组[^bitbuild]。

每次更新和查询为 $O(\log^2 n)$，空间复杂度 $O(n^2)$；按前缀和直接构建时，总时间复杂度为 $O(n^2+q\log^2 n)$。

TODO：补完整实现。

## F 题

> [!note] 题目：[Aura Battle](https://codeforces.com/contest/2274/problem/F)
> 本题为交互题（Interactive Problem）[^interactive]。每场有一个固定的隐藏整数 $x$，满足 $1\le x\le10^4$，必须完整进行 $10$ 轮。
> 第 $i$ 轮选择两个整数 $a_i,b_i$，满足 $-10^9\le a_i,b_i\le10^9$，随后得知本轮的损失：
>
> $$p_i=\min\bigl(|x-a_i|,|x-b_i|\bigr)$$
>
> 下一轮的选择可以依据此前的反馈。每场的总损失为这 $10$ 轮损失之和。
> 设 $m$ 是能够通过某种策略，保证任意隐藏值 $x$ 下总损失不超过 $m$ 的最小整数。要求设计策略，使每场总损失不超过 $m+67$；样例测试的上限则为 $10^5$。
> 每轮输出两个数并读取损失，完成 $10$ 轮后直接进入下一场，不需要额外输出答案。

解析：

TODO

[^fenwick]: 树状数组（Fenwick Tree，也称 Binary Indexed Tree，BIT）维护前缀统计。令 $\operatorname{lowbit}(i)=i\mathbin{\&}(-i)$，一维的 `bit[i]` 保存区间 $[i-\operatorname{lowbit}(i)+1,i]$ 的和；二维的 `bit[i][j]` 保存行、列这两个区间组成的矩形之和。修改时沿 `i += lowbit(i)` 更新，查询前缀时沿 `i -= lowbit(i)` 累加。二维版本在行、列方向各跳 $O(\log n)$ 次，因此复杂度为 $O(\log^2 n)$。

[^bitbuild]: 先计算标记矩阵 $f$ 的二维前缀和 $s$。令 $l_i=i-\operatorname{lowbit}(i)$、$l_j=j-\operatorname{lowbit}(j)$，则 `bit[i][j]` 管理的矩形为 $[l_i+1,i]\times[l_j+1,j]$，直接赋值 $bit_{i,j}=s_{i,j}-s_{l_i,j}-s_{i,l_j}+s_{l_i,l_j}$ 即可。共有 $n^2$ 个节点，每个节点用 $O(1)$ 时间求出，所以构建为 $O(n^2)$。每组测试都要重新初始化本组使用的区域。

[^interactive]: 交互题中，程序先输出本轮选择，再读取系统根据该选择返回的反馈。每次输出后需要换行并刷新缓冲区，例如使用 `cout.flush()`，否则系统可能无法及时收到输出。
