---
title: Codefoces Round 1122 div3 复盘
pubDatetime: 2026-09-22T21:00:00
description: 赛时5题，简要分析了ABCDEF六题得思路
draft: false
ExcludeFromRss: true
tags:
  - OI日记
  - CodeFoces
---
个人情况：赛时 5 题，中途 E 题没思路，直接硬着头皮上 F，感觉太复杂再灰溜溜把 E 题过了
算是平均的水平。
![](assest/Pasted%20image%2020260922101535.png)

## A 题

> [!note] 题目：Good Contest
> 下一场比赛有三道题和 n 名参赛者。若一名参赛者没有解出全部三道题，则称其为 weak。
> 记 `a`、`b`、`c` 分别为三道题的通过人数。已知这些人数，求所有可能的计分板中 weak 参赛者人数的最小值。

解析：
最多有 `min(a, b, c)` 名参赛者同时解出三道题，而且这个上界可以达到。因此答案为：

$$n - \min\{a, b, c\}$$

秒了，送分题。

## B 题

> [!note] 题目：Three Piles
> Alice 和 Bob 玩一个三堆石子的游戏：初始时 Alice 有 `a` 个石子，Bob 有 `b` 个石子，第三堆有 `c` 个石子。
> Alice 先手。每回合，当前玩家可以从第三堆取任意数量（可以取 0 个）并放入自己的石子堆。
> 如果连续两个回合中，当前玩家都取了 0 个石子，游戏结束。设游戏结束时 Alice 和 Bob 分别有 `A`、`B` 个石子，分数为 `|A - B|`。
> Alice 希望最大化分数，Bob 希望最小化分数。求双方最优时的最终分数。

解析：
可以证明，Alice 的最优策略是第一次要么一个石子都不拿，要么把第三堆全部拿走。

- 如果 Alice 一个石子都不拿，Bob 也会取 0 个，游戏结束，分数为 `|a - b|`。
- 如果 Alice 只拿走一部分：若拿完后 Alice 仍不超过 Bob，那么 Bob 取 0 个即可；此时 Alice 还不如一开始一个都不拿。若拿完后 Alice 已经不落后，则继续把剩余石子全部拿走不会让最终分数变小，而且还能避免 Bob 利用剩余石子缩小差距。因此，部分拿取不会优于“不拿”或“全拿”。
- 如果 Alice 把第三堆全部拿走，分数为 `|a + c - b|`，且 Bob 已经没有石子可取。

所以答案是：

$$\max\bigl(|a-b|,\ |a+c-b|\bigr)$$

对应代码如下：
```cpp
long long curScore = abs(a - b);       // Alice 不拿
long long newScore = abs(a + c - b);   // Alice 全拿
cout << max(curScore, newScore) << '\n';
```

评价：也是送分题，不过需要稍微盘一盘博弈逻辑。

## C 题

> [!note] 题目：AND, OR, Sort!
> 给定一个长度为 `n` 的 01 字符串 `s`。
> 可以进行任意次操作（也可以不操作）：选择一个下标 `i`，将 `s_i` 替换为 `s_1, s_2, \ldots, s_i` 的按位 AND 或按位 OR。
> 求使 `s` 按非递减顺序排列所需的最少操作次数。

对于一个同时包含 0 和 1 的前缀，其按位 AND 为 0，按位 OR 为 1。因此，对位置 `i` 操作时，前缀中出现 0/1 就分别可以把 `s_i` 变成 0/1；如果前缀全相同，则操作不会改变 `s_i`。

### `s[0] == '1'`

第一个字符无法改变，而非递减的二进制串如果以 1 开头，就只能是全 1。因此每个 0 都必须通过一次 OR 操作变成 1，答案就是 0 的个数。

```cpp
if (s[0] == '1') {
    int answer = count(s.begin(), s.end(), '0');
    cout << answer << '\n';
    return;
}
```

### `s[0] == '0'`

最终结果一定形如 `000...111`。设最终结果中第一个 1 的位置为 `k`；如果最终全为 0，则令 `k = n + 1`。

设原串第一个 1 的位置为 `p`，那么必须有 `k >= p`：在第一个原始 1 之前，所有前缀都只有 0，无法通过 OR 操作生成 1。

固定一个合法的 `k` 后：

- `[1, k - 1]` 中原本为 1 的位置，需要进行 AND 操作变成 0；
- `[k, n]` 中原本为 0 的位置，需要进行 OR 操作变成 1。

先处理右侧的 OR，再处理左侧的 AND，这些操作都能达到预期。因此，枚举所有合法的分割点，计算“左侧的 1 的个数 + 右侧的 0 的个数”，取最小值即可。全 0 的结果对应 `k = n + 1`。

官解的线性扫描代码如下：

```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int t;
    cin >> t;
    while (t--) {
        int n;
        string s;
        cin >> n >> s;

        if (s[0] == '1') {
            cout << count(s.begin(), s.end(), '0') << '\n';
            continue;
        }

        int firstOne = n;
        for (int i = 0; i < n; ++i) {
            if (s[i] == '1') {
                firstOne = i;
                break;
            }
        }
        int answer = count(s.begin(), s.end(), '1'); // 全 0
        if (firstOne == n) {
            cout << answer << '\n';
            continue;
        }

        int onesOnLeft = 0;
        int zerosOnRight = count(s.begin(), s.end(), '0');
        for (int k = 0; k < n; ++k) {
            if (k >= firstOne) {
                answer = min(answer, onesOnLeft + zerosOnRight);
            }
            if (s[k] == '1') {
                ++onesOnLeft;
            } else {
                --zerosOnRight;
            }
        }
        cout << answer << '\n';
    }
}
```

**个人解（动态规划）**

在已经处理的前缀中，定义：

- `dp[i][0]`：前 `i + 1` 个字符组成非递减串且以 0 结尾时的最小操作数；
- `dp[i][1]`：前 `i + 1` 个字符组成非递减串且以 1 结尾时的最小操作数。

不可达状态记为 `-1`。由于这里已经特判了 `s[0] == '1'`，初始化为：

```cpp
dp[0][0] = 0;
dp[0][1] = -1;
```

状态转移为：

```cpp
dp[i][0] = dp[i - 1][0] + (s[i] == '1');

if (s[i] == '1') {
    dp[i][1] = dp[i - 1][0];
    if (dp[i - 1][1] != -1) {
        dp[i][1] = min(dp[i][1], dp[i - 1][1]);
    }
} else if (dp[i - 1][1] != -1) {
    dp[i][1] = dp[i - 1][1] + 1;
}
```

最终答案为：

```cpp
int answer = dp[n - 1][0];
if (dp[n - 1][1] != -1) {
    answer = min(answer, dp[n - 1][1]);
}
cout << answer << '\n';


```

## D 题

> [!note] 题目：坠落中的混凝土
> Vihaan 正在修一条由 n 个路段组成的道路，第 i 个路段的高度为 ai。
> 可以进行若干次操作（可 0 次）：选择两个下标 i < j，将第 j 个路段搬到第 i 个路段前。
> 搬运过程中，被搬运的路段每经过一个路段，就会有 1 单位混凝土落到这个路段上。
> 也就是将 $[a_i, a_{i + 1}, ..., a_{j - 1}, a_j]$ 替换为 $[a_j - (j - i), a_i + 1, a_{i + 1} + 1, ..., a_{j - 1} + 1]$。
> 定义 score 为数组中连续相等的最大长度，求 score 的最大值。

D题初看没思路，细看发现很多小特征，但关联不大。
不过最重要的还是要发现：每次操作，对于某个具体的路段，左移 1 位则高度减 1，右移 1 位则高度加 1。

假设某个路段当前在位置 p，高度为 h，那么可以定义：

$$key = h - p$$

对于被搬运的路段，位置减少多少，高度就减少多少；对于被经过的路段，位置增加 1，高度也增加 1。
所以对于每个具体的路段，`key` 始终不变。

如果这个路段初始在位置 i，高度为 ai，那么它的 key 就是：

$$key_i = a_i - i$$

接下来，问题就变成：如何利用这些 key，拼出最长的平坦区域？

假设有一段长度为 k 的平坦区域，位置为 p 到 $p + k - 1$，高度都是 h。
那么这 k 个路段对应的 key 为：

$$h-p,\ h-(p+1),\ ...,\ h-(p+k-1)$$

可以发现，它们是 k 个连续的数。

反过来，如果有 k 个 key 连续的路段，并且按照 key 从大到小的顺序排列，那么它们就可以组成一段平坦区域。
路段的顺序是可以调整的：从左到右确定位置，每次把想要的路段搬到当前位置即可。

所以，最终问题就是：求所有 $a_i - i$ 中，最长的连续数字长度。
排序之后遍历一遍即可。相同的 key 只保留一个，因为相同的 key 不可能同时出现在同一段平坦区域中。

代码如下：
```c++
#include <bits/stdc++.h>
using namespace std;

void solve() {
    int n;
    cin >> n;

    vector<int> a(n);
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }

    vector<int> tmp(n);
    for (int i = 0; i < n; i++) {
        // 代码使用 0 下标，所以这里写 a[i] - i
        tmp[i] = a[i] - i;
    }

    sort(tmp.begin(), tmp.end());

    int cur = 1;
    int res = 1;

    for (int i = 1; i < n; i++) {
        if (tmp[i] == tmp[i - 1]) continue;

        if (tmp[i] == tmp[i - 1] + 1) {
            cur++;
            res = max(res, cur);
        } else {
            cur = 1;
        }
    }

    cout << res << "\n";
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int T = 1;
    cin >> T;

    while (T--) {
        solve();
    }

    return 0;
}
```


## E 题

> [!note] 题目：Prime Destruction
> 给定一个包含 n 个正整数的 multiset `a`。
> 每次操作可以选择一个大于 1 的数 `x`，以及 `x` 的一个质因数 `p`，删除一个 `x`，然后加入 `p` 个 `x / p`。
> 给定一个整数 `k`，求使 multiset 中的每个数都不大于 `k` 所需的最少操作次数。

E题一开始没思路，
后来注意到给定 k 的情况下，对于数 m，其操作数和拆解后的 `m / p` 相关，即：

如果选择质因数 p，那么一次操作会把一个 m 拆成 p 个 `m / p`，所以有：

$$g(m) = 1 + p \times g(m / p)$$

这里的 1 是当前这次拆解操作，后面的 p 是因为拆解后会出现 p 个 `m / p`。

对于 m 的所有质因数都尝试一下，就可以得到：

$$dp[m] = \min_{p \mid m,\ p\text{ 为质数}}\{1 + p \times dp[m / p]\}$$

当 `m <= k` 时，不需要进行任何操作，所以 `dp[m] = 0`。

这个形式特别像动态规划。
由于 `m / p < m`，所以从小到大计算 `dp` 即可。

然后写了点基本的线性筛，快速求质数。

```c++
const int MAXN = 200005;
vector<int> all_p;
vector<int> spf(MAXN + 1);

void init_primes() {
    for (int i = 2; i <= MAXN; ++i) {
        if (spf[i] == 0) {
            spf[i] = i;
            all_p.push_back(i);
        }
        for (int p : all_p) {
            if (p > spf[i] || 1LL * i * p > MAXN) break;
            spf[i * p] = p;
        }
    }
}
```

然后获取一个数的所有不同质因数：

```c++
vector<int> get_p(int k) {
    vector<int> res;
    while (k > 1) {
        int p = spf[k];
        res.push_back(p);
        while (k % p == 0)
            k /= p;
    }
    return res;
}
```

接下来就是 DP 部分。

```c++
vector<long long> dp(n + 5, LLONG_MAX);
for (int i = 0; i <= k; i++)
    dp[i] = 0;

for (int i = k + 1; i <= n; i++) {
    vector<int> ps = get_p(i);

    // 尝试遍历所有方法，获取最小的dp[i]
    for (int p : ps) {
        long long cur = 1 + p * dp[i / p];
        dp[i] = min(dp[i], cur);
    }
}
```

最后统计每个数的答案：

```c++
long long res = 0;
for (int i = 0; i < n; i++) {
    res += dp[a[i]];
}
cout << res << "\n";
```

## F 题

> [!note] 题目：MEX Replacement
> 给定一个压缩表示的多重集，`x_i` 出现 `y_i` 次。
> 每次操作可以选择多重集中的任意非空集合，删除这些数，然后加入一个它们的 MEX。
> 求经过若干次操作后，多重集中可能出现的最大整数。

PS：这题卡了我一小时，最后因为没时间回到 E 题草草了事。
事后复盘发现，我就差一个逆向思维了。

分析：正向考虑很困难，我们逆向考虑。

假设我们想要生成一个数 M，那么在生成 M 的那次操作之前，需要准备一份 `0, 1, ..., M - 1`。
选出这份数之后，它们的 MEX 才是 M。

现在倒着考虑 `M - 1, M - 2, ..., 0`。
处理到 `cur` 时，令 `need` 表示：当前还需要 `need` 份 `cur`，并且 `0, 1, ..., cur - 1` 也都各需要 `need` 份。
一开始只需要一份 `M - 1`，所以 `need = 1`。

假设原多重集中有 c 个 `cur`：

- 如果 `c >= need`，直接拿出 `need` 个 `cur`，剩下的 `c - need` 个就是多余的正数；
- 如果 `c < need`，还缺少 `need - c` 个 `cur`。每缺少一个 `cur`，就必须进行一次 MEX 为 `cur` 的操作，而这次操作会消耗一份 `0, 1, ..., cur - 1`。

所以，下一层中每个更小数字的需求会变成：

$$need + (need - c) = 2need - c$$

这里增加的 `need - c`，本质上就是还需要额外生成多少次 `cur`。
因为所有更小数字的需求增加量都一样，所以只维护一个 `need` 就够了。

如果从当前存在的数字直接跳到更小的 `x`，中间的 `cur - 1, ..., x + 1` 都没有初始出现过。
这些位置的 `c` 都是 0，因此 `need` 会连续翻倍；缺少 k 个数就直接乘上 $2^k$。

处理到 0 时，不能再靠更小的数字生成 0 了。
此时能提供 0 的只有初始的 0，以及前面没有被使用的多余正数：每个多余正数都可以单独操作，变成一个 0。
所以最后判断 `初始 0 的数量 + 多余正数的数量` 是否至少为 `need` 即可。

根据这个性质，我们可以很容易有 **二分答案** 的想法。
如果 M 可以被构造出来，那么更小的数也一定可以被构造出来。
初始多重集中的最大值一定可以直接出现，所以从初始最大值开始二分即可。

检查一个答案 M：

初始多重集中的最大值已经可以直接出现，所以二分时从这个最大值开始。
因此 `check` 只需要检查比初始最大值更大的 `target`，递推从 `target - 1` 开始往 `0` 处理。

先处理一下需求翻倍时的越界问题：

```c++
const long long INF = 4e18;

long long grow(long long x, int len) {
    if (len <= 0) return x;
    if (len >= 63) return INF;

    __int128 res = (__int128)x * (1LL << len);
    if (res > INF) return INF;
    return (long long)res;
}
```

然后从大到小处理：

```c++
bool check(int target, const vector<pair<int, int>>& cnts) {
    long long need = 1;
    long long extra = 0;
    long long zero = 0;

    int upper = target - 1; // 还没有处理的最大值

    for (int i = (int)cnts.size() - 1; i >= 0; i--) {
        int x = cnts[i].first;
        long long cnt = cnts[i].second;

        if (x == 0) {
            zero = cnt;
            break;
        }

        // 中间缺失的数，每缺一个，need 就翻倍
        need = grow(need, upper - x);
        upper = x - 1;

        if (cnt >= need) {
            extra += cnt - need;
        } else {
            // need - cnt 就是还需要额外生成 x 的次数
            __int128 new_need = (__int128)need * 2 - cnt;
            need = new_need > INF ? INF : (long long)new_need;
        }
    }

    // 处理剩下缺失的 1, 2, ..., upper
    need = grow(need, upper);
    return zero + extra >= need;
}
```


再加上传统二分，这题就 ok 了：

```c++
sort(cnts.begin(), cnts.end());

int mx = cnts.back().first;
int left = mx;
int right = mx + 50;

while (left < right) {
    int mid = (left + right + 1) / 2;
    if (check(mid, cnts)) {
        left = mid;
    } else {
        right = mid - 1;
    }
}

cout << left << "\n";
```

## G 题 / H 题

> [!Todo]
> 不想看，感觉目前看完全就是越级
> 以后有时间再看吧


