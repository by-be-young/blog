---
id: 2807178879
title: 算法板子（未完待续）
date: 2025-12-17
tags:
    - 学习
    - 算法
    - 模板
excerpt: 常用算法C++模板代码集合，包含头文件、STL、常用模板等
---

# 头文件

## Hello world

```cpp
#include <iostream>
#include <cstdio>
#include <cctype>
#include <cmath>
#include <cstring>
#include <string>
#include <vector>
#include <algorithm>
#include <queue>
#include <stack>
#include <bits/stdc++.h>
#include <unordered_map>
#include <functional>

using namespace std;
typedef long long ll;

int main() {
    cout << "Hello world!" << endl;
    return 0;
} 
```

## algorithm

```cpp
__gcd(a, b)                     // 求两个数的最大公因数
__builtin_popcount(a)           // 求 int 的二进制里多少个 1

is_sorted(a, a + n)             // 是否升序
is_sorted_until(a, a + n)       // 到哪里是升序
sort(a, a + n)                  // 不稳定排序(默认升序)
sort(a, a + n, greater<int>())  // 降序排序
stable_sort(a, a + n)           // 稳定排序
nth_element(a, a + k, a + n)    // 将第 k 大元素放到 a[k]
unique(begin, end)              // 对有序数组去重，返回末尾地址

max(a, b)                       // 返回较大值
min(a, b)                       // 返回较小值
max_element(a, a + n)           // 返回最大值位置
min_element(a, a + n)           // 返回最小值位置

lower_bound(a, a + n, key)      // 返回第一个不小于 key 的元素的位置
upper_bound(a, a + n, key)      // 返回第一个大于 key 的元素的位置
binary_search(a, a + n, key)    // 二分查找是否存在

is_heap(a, a + n)               // 判断是否为大顶堆
is_heap_until(a, a + n)         // 到哪里是大顶堆
make_heap(a, a + n)             // 区间建堆
push_heap(a, a + n)             // 末尾元素入堆并调整，与 push_back() 配合
pop_heap(a, a + n)              // 堆顶移到末尾并调整，与 pop_back() 配合
sort_heap(a, a + n)             // 升序堆排序

is_permutation()                // 两个序列是否互为另一个的排序
next_permutation()              // 下一个排序
prev_permutation()              // 上一个排序

fill(a, a + n, val)             // 批量赋值
reverse(a, a + n)               // 数组翻转 
```

## vector

```cpp
v.at(k)             // 访问 v[k]
v.front()           // 首元素
v.back()            // 末元素
v.begin()           // 首地址(迭代器)
v.end()             // 末地址(迭代器)
v.empty()           // 是否空
v.size()            // 大小
v.max_size()        // 最大空间
v.clear()           // 清除
v.insert(pos, item) // 在 pos(迭代器) 位置插入 item
v.eraze(pos)        // 擦除 pos(迭代器) 位置的元素
v.push_back(item)   // 末尾插入
v.pop_back()        // 末尾删除
```

## queue

priority_queue是堆，默认最大堆

```cpp
// 最大堆的top()返回最大值，最小堆返回最小值
priority_queue<int, vector<int>> pq;
priority_queue<int, vector<int>, greater<int>> minHeap;
```

```cpp
/*----- queue -----*/
q.front()        // 访问队头
q.back()         // 访问队尾
q.empty()        // 是否空
q.size()         // 大小
q.push(item)     // item 入队
q.emplace(item)  // item 替换队尾
q.pop()          // 出队
/*----- priority_queue -----*/
priority_queue<int, vector<int>, greater<int>> pq
pq.top()         // 访问队首
pq.empty()       // 优先队列是否空
pq.size()        // 大小
pq.push(item)    // 插入 item
pq.pop()         // 出队
```

## set

有序集合，set不允许重复元素，multiset允许重复元素。插入时自动排序，默认升序/字典序。

```cpp
set<int> s;                // 升序
set<int, greater<int>> s;  // 降序
// multiset 同样适用
multiset<double> ms;
```

```cpp
/*----- set -----*/
s.size()          // 大小
s.empty()         // 是否空
s.clear()         // 清除
s.insert(key)     // 插入
s.erase(pos/key)  // 删除
s.count(key)      // 是否存在
s.find(key)       // 查找，成功返回位置，失败返回 s.end()
/*----- multiset -----*/
ms.size()         // 大小
ms.empty()        // 是否空
ms.clear()        // 清除
ms.insert(key)    // 插入
ms.erase(pos/key) // 删除
ms.count(key)     // 计数
ms.find(key)      // 查找，成功返回位置，失败返回 s.end()
```

## unordered_map

哈希表

```cpp
unordered_map<Key,           // 键类型
              T,             // 值类型
              Hash,          // 哈希函数（可选，默认 std::hash<Key>）
              KeyEqual,      // 键相等比较（可选，默认 std::equal_to<Key>）
              Allocator>     // 分配器（可选，默认 std::allocator<pair<const Key, T>>）

如：unordered_map<int, string> hashMap;
```

# 分治

## 归并排序

见P43

## 逆序对计数

见P45

## 最大子段和

见P48

```

## 多数问题

寻找数组中出现次数超过一半的元素

```cpp
const int N = 2000000; // 定义数组的最大长度
int a[N];

/**
 * 分治法求解多数问题
 * @param a[] 待查找的数组
 * @param start 查找区间的起始下标
 * @param end 查找区间的结束下标
 * @param result 用于返回找到的多数元素
 * @return 1表示找到多数元素，0表示未找到
 */
int majorityDC(int a[], int start, int end, int *result) {
    if (start == end) {
        *result = a[end];
        return 1;
    } else {
        int m1, m2;
        int mid = (start + end) / 2;
        
        // 递归查找前半区间的多数元素
        majorityDC(a, start, mid, &m1);
        
        // 递归查找后半区间的多数元素
        majorityDC(a, mid + 1, end, &m2);
        
        // 统计m1和m2在整个区间中出现的次数
        int count1 = 0, count2 = 0;
        for (int i = start; i <= end; i++) {
            if (a[i] == m1) {
                count1++;
            }
            if (a[i] == m2) {
                count2++;
            }
        }
        
        // 检查m1是否为多数元素
        if (count1 > ((end - start + 1) / 2)) {
            *result = m1;
            return 1;
        }
        // 检查m2是否为多数元素
        else if (count2 > ((end - start + 1) / 2)) {
            *result = m2;
            return 1;
        }
        // 两者都不是多数元素
        else {
            return 0;
        }
    }
}

int main() {
    int n, resultDC;
    
    // 读取数组长度
    scanf("%d", &n);
    
    // 读取数组元素
    for (int i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    
    // 查找多数元素
    if (majorityDC(a, 0, n - 1, &resultDC)) {
        printf("%d", resultDC);
    } else {
        printf("Can not find the majority!");
    }
    
    return 0;
} 
```

# 贪心

## 哈夫曼编码

完整的哈夫曼编码代码，输入字符串、查询次数和每次查询的字符，输出查询的字符的哈夫曼编码、整个字符串的哈夫曼编码、哈夫曼编码的长度等。

```cpp
#include <iostream>
#include <queue>
#include <unordered_map>
#include <vector>
#include <string>
using namespace std;

// 哈夫曼树节点
struct Node {
    char ch;
    int freq;
    Node *left, *right;

    Node(char c, int f) : ch(c), freq(f), left(nullptr), right(nullptr) {}
    Node(int f) : ch('\0'), freq(f), left(nullptr), right(nullptr) {}
};

// 比较函数，用于优先队列
struct Compare {
    bool operator()(Node* a, Node* b) {
        return a->freq > b->freq;
    }
};

// 构建哈夫曼树
Node* buildHuffmanTree(const string& s, unordered_map<char, int>& freqMap) {
    priority_queue<Node*, vector<Node*>, Compare> pq;

    // 统计字符频率
    for (char c : s) {
        freqMap[c]++;
    }

    // 创建叶子节点并加入优先队列
    for (auto& pair : freqMap) {
        pq.push(new Node(pair.first, pair.second));
    }

    // 构建哈夫曼树
    while (pq.size() > 1) {
        Node* left = pq.top(); pq.pop();
        Node* right = pq.top(); pq.pop();

        Node* parent = new Node(left->freq + right->freq);
        parent->left = left;
        parent->right = right;

        pq.push(parent);
    }

    return pq.top();
}

// 递归生成哈夫曼编码
void generateHuffmanCodes(Node* node, string code, unordered_map<char, string>& huffmanCodes) {
    if (!node) return;

    // 叶子节点，存储编码
    if (!node->left && !node->right) {
        huffmanCodes[node->ch] = code;
        return;
    }

    generateHuffmanCodes(node->left, code + "0", huffmanCodes);
    generateHuffmanCodes(node->right, code + "1", huffmanCodes);
}

// 编码整个字符串
string encodeString(const string& s, unordered_map<char, string>& huffmanCodes) {
    string encoded = "";
    for (char c : s) {
        encoded += huffmanCodes[c];
    }
    return encoded;
}

// 清理哈夫曼树内存
void clearTree(Node* node) {
    if (!node) return;
    clearTree(node->left);
    clearTree(node->right);
    delete node;
}

// 可选：打印所有哈夫曼编码
void printAllCodes(unordered_map<char, string>& huffmanCodes) {
    cout << "所有哈夫曼编码:" << endl;
    for (auto& pair : huffmanCodes) {
        if (pair.first == ' ') {
            cout << "空格: " << pair.second << endl;
        } else {
            cout << "'" << pair.first << "': " << pair.second << endl;
        }
    }
    cout << endl;
}

int main() {
    cin.tie(nullptr)->sync_with_stdio(false);

    string s;
    cout << "请输入字符串: ";
    getline(cin, s);

    if (s.empty()) {
        cout << "字符串不能为空!" << endl;
        return 0;
    }

    // 构建哈夫曼树和编码表
    unordered_map<char, int> freqMap;
    Node* root = buildHuffmanTree(s, freqMap);

    unordered_map<char, string> huffmanCodes;
    generateHuffmanCodes(root, "", huffmanCodes);

    int queryCount;
    cout << "请输入查询次数: ";
    cin >> queryCount;

    cout << "\n字符查询结果:" << endl;
    for (int i = 0; i < queryCount; i++) {
        char queryChar;
        cout << "请输入要查询的字符: ";
        cin >> queryChar;

        if (huffmanCodes.find(queryChar) != huffmanCodes.end()) {
            if (queryChar == ' ') {
                cout << "字符 '空格' 的哈夫曼编码: " << huffmanCodes[queryChar] << endl;
            } else {
                cout << "字符 '" << queryChar << "' 的哈夫曼编码: " << huffmanCodes[queryChar] << endl;
            }
        } else {
            cout << "字符 '" << queryChar << "' 不在字符串中" << endl;
        }
    }

    // 输出整个字符串的哈夫曼编码
    string encodedString = encodeString(s, huffmanCodes);
    cout << "\n整个字符串的哈夫曼编码:" << endl;
    cout << encodedString << endl;

    // 显示编码统计信息
    cout << "\n编码统计:" << endl;
    cout << "原始字符串: \"" << s << "\"" << endl;
    cout << "字符串长度: " << s.length() << " 字符" << endl;
    cout << "原始数据位: " << s.length() * 8 << " 位" << endl;
    cout << "哈夫曼编码: " << encodedString.length() << " 位" << endl;
    cout << "压缩率: " << (1.0 - (double)encodedString.length() / (s.length() * 8)) * 100 << "%" << endl;

    // 可选：显示所有编码
    cout << "\n";
    printAllCodes(huffmanCodes);

    // 清理内存
    clearTree(root);

    return 0;
}
```

只需要知道哈夫曼编码的长度（适用于合并果子等问题）

```cpp
#include <cstdio>
#include <bits/stdc++.h>
#include <algorithm>
#include <array>
#include <queue>
#include <cmath>
#include <stack>
#include <unordered_map>
using namespace std;
typedef long long ll;

int main()
{
    cin.tie(nullptr)->sync_with_stdio(false);
    string s;
    cin >> s;
    unordered_map<char, int> hashMap;
    for (char c : s)
    {
        hashMap[c]++;
    }
    if (hashMap.size() == 1)
    {
        cout << s.length();
        return 0;
    }

    priority_queue<ll, vector<ll>, greater<ll>> pile;
    for (auto &p : hashMap)
    {
        pile.push(p.second);
    }
    ll ans = 0;

    while (pile.size() > 1)
    {
        ll a = pile.top();
        pile.pop();
        ll b = pile.top();
        pile.pop();

        ll sum = a + b;
        ans += sum;
        pile.push(sum);
    }
    cout << ans;

    return 0;
}
```

# 动态规划

## 卡塔兰数

给定二叉树的节点数n，输出不同形态的二叉树总数

```cpp
int main()
{
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;

    vector<long long> C(n + 1, 0);
    C[0] = 1;
    for (int i = 1; i <= n; ++i)
    {
        long long sum = 0;
        for (int j = 0; j < i; ++j)
        {
            sum += C[j] * C[i - 1 - j];
        }
        C[i] = sum;
    }

    cout << C[n];
    return 0;
}


```

## 钢条切割问题

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
#include <climits>
using namespace std;

/**
 * 自底向上动态规划求解钢条切割问题
 * @param n 钢条长度
 * @param price 价格表，price[i]表示长度为i的钢条价格（i从1开始）
 * @param maxRevenue 存储最大收益的数组
 * @param cutPoint 存储切割点的数组
 */
void bottomUpCutRod(int n, const vector<int>& price, vector<int>& maxRevenue, vector<int>& cutPoint) {
    // 初始化
    maxRevenue.resize(n + 1, 0);
    cutPoint.resize(n + 1, 0);
    
    // 基础情况：长度为0的钢条收益为0
    maxRevenue[0] = 0;
    
    // 递推计算每个长度的最优解
    for (int j = 1; j <= n; j++) {
        int currentMax = INT_MIN;  // 当前长度的最大收益
        
        for (int i = 1; i <= j; i++) {
            // 如果当前切割方案更好
            if (currentMax < price[i] + maxRevenue[j - i]) {
                currentMax = price[i] + maxRevenue[j - i];
                cutPoint[j] = i;  // 记录第一段切割长度
            }
        }
        
        maxRevenue[j] = currentMax;
    }
}

/**
 * 根据切割点数组获取切割方案
 * @param n 钢条长度
 * @param cutPoint 切割点数组
 * @return 切割方案的长度序列
 */
vector<int> getCuttingSolution(int n, const vector<int>& cutPoint) {
    vector<int> solution;
    int remaining = n;
    
    // 从后向前追踪切割方案
    while (remaining > 0) {
        solution.push_back(cutPoint[remaining]);
        remaining -= cutPoint[remaining];
    }
    
    return solution;
}

int main() {
    int n;
    cin >> n;
    
    // 读取价格表，注意价格表下标从1开始
    vector<int> price(n + 1, 0);
    for (int i = 1; i <= n; i++) {
        cin >> price[i];
    }
    
    // 存储最大收益和切割点的数组
    vector<int> maxRevenue;
    vector<int> cutPoint;
    
    // 计算最优解
    bottomUpCutRod(n, price, maxRevenue, cutPoint);
    
    // 获取切割方案
    vector<int> solution = getCuttingSolution(n, cutPoint);
    
    // 输出结果
    // 第一行：最大总销售价格
    cout << maxRevenue[n] << endl;
    
    // 第二行：钢管被分割成的段数
    cout << solution.size() << endl;
    
    // 第三行：分割方式
    for (size_t i = 0; i < solution.size(); i++) {
        if (i > 0) cout << " ";
        cout << solution[i];
    }
    cout << endl;
    
    return 0;
}
```

## 矩阵链乘法问题

```cpp
#include <bits/stdc++.h>
using namespace std;

/*
 * 矩阵链乘法动态规划算法
 *
 * 输入：
 *   n: 矩阵链中矩阵的个数
 *   p: 数组，p[i] 表示矩阵 A_i 的列数，p[i-1] 表示矩阵 A_i 的行数
 *       矩阵 A_i 的维度为 p[i-1] × p[i]
 *
 * 输出：
 *   m[1][n]: 计算 A1...An 所需的最少标量乘法次数
 *   最优括号化方案
 */

#define MAX 100 // 最大矩阵数量

long long p[MAX];      // 矩阵维度数组
long long m[MAX][MAX]; // m[i][j]：计算 A_i...A_j 所需的最少乘法次数
long long s[MAX][MAX]; // s[i][j]：A_i...A_j 最优括号化的分割点位置

/**
 * 计算矩阵链乘法的最优括号化方案
 * @param n 矩阵链中矩阵的个数
 */
void MATRIX_CHAIN_ORDER(int n)
{
    // 初始化：单个矩阵不需要乘法
    for (int i = 1; i <= n; i++)
    {
        m[i][i] = 0;
    }

    // l 表示矩阵链的长度（包含的矩阵个数）
    for (int l = 2; l <= n; l++)
    {
        // i 表示矩阵链的起始位置
        for (int i = 1; i <= n - l + 1; i++)
        {
            int j = i + l - 1;   // 矩阵链的结束位置
            m[i][j] = LLONG_MAX; // 初始化为最大值

            // 尝试所有可能的分割点 k
            for (int k = i; k <= j - 1; k++)
            {
                // 计算将矩阵链在 k 处分隔的代价
                long long q = m[i][k] + m[k + 1][j] + p[i - 1] * p[k] * p[j];

                // 如果当前分割方式更优，则更新
                if (q < m[i][j])
                {
                    m[i][j] = q;
                    s[i][j] = k; // 记录最优分割点
                }
            }
        }
    }
}

/**
 * 递归打印最优括号化方案
 * @param i 矩阵链起始索引
 * @param j 矩阵链结束索引
 */
void PRINT_OPTIMAL_PARENS(long long i, long long j)
{
    if (i == j)
    {
        printf("A%d", i); // 单个矩阵
    }
    else
    {
        printf("(");
        // 递归打印左半部分
        PRINT_OPTIMAL_PARENS(i, s[i][j]);
        // 递归打印右半部分
        PRINT_OPTIMAL_PARENS(s[i][j] + 1, j);
        printf(")");
    }
}

int main()
{
    int n;

    // 输入矩阵数量
    scanf("%d", &n);

    // 输入矩阵维度
    for (int i = 0; i <= n; i++)
    {
        scanf("%lld", &p[i]);
    }

    // 计算最优括号化方案
    MATRIX_CHAIN_ORDER(n);

    // 输出最少乘法次数
    printf("%lld\n", m[1][n]);

    // 输出最优括号化方案
    PRINT_OPTIMAL_PARENS(1, n);
    printf("\n");

    return 0;
}
```

## 背包问题

有多个物品可选，但总价值有限。

0-1背包：每个物品只能选一次（见P244）

完全背包：每个物品能选任意次（P244，需要修改的部分见P243）

分组背包：物品被分为多组，每组最多选择一个物品（见下）

```cpp
#include <iostream>
#include <algorithm>

typedef long long ll;

const int MAX = 1005;

struct {
    int cnt;
    ll ID[MAX];
} group[MAX];   //用一个结构体来存储每一组的物品编号

ll dp[MAX];
ll val[MAX];
ll weight[MAX];

ll group_bag(int cap, int max_group);

using namespace std;

int main() {
    int n, m;
    cin >> m >> n;
    int a, b, k, max_group = 0;
    for (int i = 1; i <= n; i++) {
        cin >> a >> b >> k;
        weight[i] = a;
        val[i] = b;
        group[k].ID[group[k].cnt++] = i;
        max_group = max(max_group, k);
    }
    cout << group_bag(m, max_group);
    return 0;
}

ll group_bag(int cap, int max_group) {
    for (int i = 0; i <= max_group; i++)            // 第一层组循环
        for (ll j = cap; j >= 0; j--)               // 第二层容量倒着循环
            for (int k = 0; k < group[i].cnt; k++)  // 第三层组内循环
                if (j >= weight[group[i].ID[k]])
                    dp[j] = max(dp[j],
                                dp[j - weight[group[i].ID[k]]] + val[group[i].ID[k]]);
    return dp[cap];
}
```

## 最大子列和

连续子数组的元素和最大

```cpp
#include <iostream>
#include <algorithm>

#define MAX 1000005
#define ll long long
using namespace std;

int a[MAX];

ll maxSubArray(int *array, int n) {
    ll Max = -0x3f3f3f3f3f3f3f3f;
    ll sum = 0;
    for (int i = n - 1; i >= 0; i--) {
        if (sum <= 0)
            sum = array[i];
        else
            sum += array[i];
        Max = max(sum, Max);
    }
    return Max;
}

int main() {
    int n;
    cin >> n;
    for (int i = 0; i < n; i++)
        cin >> a[i];
    cout << maxSubArray(a, n);
    return 0;
}
```

## LCS（最长公共子序列）

见P260。多组数据记得清空数组！

## 最长公共子串

注意，dp\[i]\[j]指的是以第i、第j个字符结尾的最长子串长度，和公共子序列的含义不相同，因此需要专门用max来记录最长子串长度。
多组数据记得清空数组！

```cpp
int PRINT_LCS2(char *s1, char *s2)
{
    int max = 0, start = 0, len1 = strlen(s1), len2 = strlen(s2);
    for (int i = 1; i <= len1; i++)
    {
        for (int j = 1; j <= len2; j++)
        {
            if (s1[i - 1] == s2[j - 1])
                dp[i][j] = dp[i - 1][j - 1] + 1;
            if (dp[i][j] > max)
            {
                max = dp[i][j];
                start = i - max;
            }
        }
    }
    return max;
}
```

## 最小编辑距离

见P261

## LIS（最长单调子序列）

见P254

# 图算法

## Dijkstra算法

单源最短路径

```cpp
#include <iostream>
#include <algorithm>
#include <queue>
#include <vector>

#define V_MAX 100005           // 最大顶点数
#define INF 0x3f3f3f3f3f3f3f3f // 表示无穷大的值

using namespace std;
typedef long long ll;

// 边结构体
struct Edge
{
    int to; // 目标顶点
    ll w;   // 边权重
};

// 用于优先队列的节点结构体
struct Node
{
    ll dis; // 当前到起点的距离
    int u;  // 顶点编号
    // 重载大于运算符，用于最小堆
    bool operator>(const Node &b) const { return dis > b.dis; }
};

// 邻接表存储图
vector<Edge> e[V_MAX];

// 添加有向边
void addEdge(int u, int v, ll w)
{
    e[u].push_back({v, w});
}

// Dijkstra算法求单源最短路径
vector<ll> dijkstra(int s)
{
    // 最小堆（优先队列），每次取出距离起点最近的点
    priority_queue<Node, vector<Node>, greater<Node>> q;
    vector<ll> dis(V_MAX);             // 存储起点到各点的最短距离
    fill(dis.begin(), dis.end(), INF); // 初始化为无穷大
    vector<bool> vis(V_MAX);           // 标记顶点是否已确定最短路径

    // 初始化起点
    dis[s] = 0;
    q.push({0, s});

    while (!q.empty())
    {
        int u = q.top().u;
        q.pop();

        // 如果该点已经处理过，跳过（优先队列中可能有重复顶点）
        if (vis[u])
            continue;
        vis[u] = true;

        // 遍历u的所有邻接边
        for (auto ed : e[u])
        {
            int v = ed.to;
            ll w = ed.w;
            // 松弛操作：如果通过u到v比当前记录更短，则更新
            if (dis[v] > dis[u] + w)
            {
                dis[v] = dis[u] + w;
                q.push({dis[v], v}); // 将更新后的顶点加入队列
            }
        }
    }
    return dis; // 返回所有最短距离结果
}

int main()
{
    int n, m; // n:顶点数，m:边数
    int s;    // 起点编号
    cin >> n >> m >> s;

    int x, y, w;
    for (int i = 0; i < m; i++)
    {
        cin >> x >> y >> w;
        addEdge(x, y, w); // 添加有向边
    }

    // 执行Dijkstra算法
    vector<ll> dis = dijkstra(s);

    // 输出结果：起点到每个顶点的最短距离
    for (int i = 1; i <= n; i++)
    {
        cout << dis[i] << " ";
    }
    return 0;
}
```

## Floyd 算法

全源最短路径，可以计算任意点对间的最短路

```cpp
#include <algorithm>
#include <cstring>
#include <iostream>

#define V_MAX 510 // 结点数
#define INF 0x3f3f3f3f3f3f3f3f

using namespace std;
typedef long long ll;

ll f[V_MAX][V_MAX]; // 邻接矩阵存图

int main()
{
    int n, m, p;
    ll x, y, w;
    cin >> n >> m >> p;
    for (x = 1; x <= n; x++)
        for (y = 1; y <= n; y++)
            f[x][y] = INF;
    for (int i = 1; i <= n; i++)
        f[i][i] = 0;

    /*-----初始化部分-----*/

    for (int i = 0; i < m; i++)
    {
        cin >> x >> y >> w;
        if (w < f[x][y]) // 考虑重边的情况
            f[x][y] = w;
    }

    /*-----读入-----*/

    for (int k = 1; k <= n; k++)
        for (x = 1; x <= n; x++)
            for (y = 1; y <= n; y++)
                f[x][y] = min(f[x][y], f[x][k] + f[k][y]);

    /*----- Floyd -----*/

    for (int i = 0; i < p; i++)
    {
        cin >> x >> y;
        if (f[x][y] != INF)
            cout << f[x][y] << endl;
        else
            cout << "-1" << endl;
    }

    /*-----输出-----*/
    return 0;
}
```

## 经过固定点的最短路

将问题分为起点到固定点最短路+终点到固定点最短路即可。

即两次分别 Floyd。

## 拓扑排序

```cpp
#include <bits/stdc++.h>
using namespace std;

#define MAX_VERTICES 10010  // 最大顶点数

// 链式前向星结构
struct Edge {
    int from;   // 边的起点
    int to;     // 边的终点
    int next;   // 同起点的下一条边的索引
} e[MAX_VERTICES];

int cnt;                    // 边计数
int head[MAX_VERTICES];     // 每个顶点作为起点的第一条边的索引
int indegree[MAX_VERTICES]; // 每个顶点的入度
unordered_map<int, vector<int>> graph;  // 邻接表表示（备用）

// 拓扑排序函数（输出字典序最大的拓扑排序）
vector<int> topologicalSort(int n) {
    // 优先队列（最大堆）：先输出序号大的点，再输出序号小的点
    // 这样得到的是字典序最大的拓扑排序
    priority_queue<int> pq;
    
    // 将所有入度为0的顶点加入优先队列
    for (int i = 1; i <= n; i++) {
        if (indegree[i] == 0) {
            pq.push(i);
        }
    }
    
    vector<int> result;  // 存储拓扑排序结果
    
    while (!pq.empty()) {
        int u = pq.top();    // 取出当前编号最大的入度为0的顶点
        pq.pop();
        result.push_back(u);
        
        // 遍历从u出发的所有边（链式前向星遍历）
        int edge = head[u];
        while (edge != -1) {
            int v = e[edge].to;
            indegree[v]--;          // 删除边u->v
            
            // 如果删除后v的入度为0，加入队列
            if (indegree[v] == 0) {
                pq.push(v);
            }
            
            edge = e[edge].next;    // 移动到下一条边
        }
    }
    
    return result;
}

int main() {
    int t;  // 测试用例数量
    scanf("%d", &t);
    
    while (t--) {
        int n, m;  // n:顶点数, m:边数
        scanf("%d%d", &n, &m);
        
        // 初始化
        cnt = 1;  // 边索引从1开始
        memset(head, -1, sizeof(head));      // 所有表头初始化为-1
        memset(indegree, 0, sizeof(indegree)); // 入度清零
        graph.clear();
        
        // 读入所有边
        for (int i = 1; i <= m; i++) {
            int from, to;
            scanf("%d%d", &from, &to);
            
            // 使用链式前向星存储边
            e[cnt].from = from;
            e[cnt].to = to;
            e[cnt].next = head[from];  // 插入到表头
            head[from] = cnt;          // 更新表头
            indegree[to]++;            // 终点入度+1
            cnt++;                     // 边计数增加
            
            // 同时用邻接表存储（可能用于其他操作）
            graph[from].push_back(to);
        }
        
        // 执行拓扑排序
        vector<int> ans = topologicalSort(n);
        
        // 输出结果
        for (int vertex : ans) {
            printf("%d ", vertex);
        }
        printf("\n");
    }
    
    return 0;
}
```

## Dinic 算法求最大流

时间复杂度 $O (VE^2)$
- 第一行一个正整数 T（1≤T≤10），表示数据组数。
- 对于每组数据，第一行四个正整数 n,m,s,t（1≤n≤100，1≤m≤5× $10^3$，1≤s,t≤n），n个点，m条边，计算从s到t的最大流。
- 接下来 m 行，每行三个正整数 $u_i$, $v_i$, $w_i$（1≤ $u_i$, $v_i$ ≤n，0≤ $w_i$ < $2^{31}$），表示第 i 条有向边 $u_i$ → $v_i$ 的最大容量为 $w_i$。
- 图中有可能存在**重边和自环**。
```cpp
#include <algorithm>  
#include <cstring>  
#include <iostream>  
#include <queue>  
using namespace std;  
typedef long long ll;  
const int V_MAX = 205; // 最大顶点数  
const int E_MAX = 5005; // 最大边数  
const ll LL_INF = 0x3f3f3f3f3f3f3f3f;  
ll max_stream = 0; // 最大流  
int cnt_E = 0;  
int n, m, s, t;  
  
struct Edge {  
    int to; // 边的目标顶点  
    int nxt; // 下一条边的索引  
    ll val; // 边的容量  
} e[E_MAX * 2]; // 边数组，每条边对应一条正向边和一条反向边  
int head[V_MAX]; // 邻接表的头指针数组  
int depth[V_MAX]; // 每个顶点的层次  
void addEdge(int x, int y, int w);  
void read();  
bool bfs();  
ll Dinic();  
  
int main() {  
    int T;  
    cin >> T;  
    while(T--){  
        cin >> n >> m >> s >> t; // 顶点数 边数 源点 汇点  
        cnt_E = 0, max_stream = 0; // 初始化边计数器和最大流  
        fill(head + 1, head + 1 + n, -1);  
        read();  
        cout << Dinic() << '\n';  
    }  
    return 0;  
}  
void addEdge(int x, int y, int w) {  
    e[cnt_E].to = y;  
    e[cnt_E].val = w;  
    e[cnt_E].nxt = head[x];  
    head[x] = cnt_E++;  
}  
void read() {  
    int u, v, w;  
    for (int i = 0; i < m; i++) {  
        cin >> u >> v >> w;  
        addEdge(u, v, w); // 添加正向边  
        addEdge(v, u, 0); // 添加反向边，容量为0  
    }  
}  
bool bfs() {   // bfs用于获得层次（分层图）  
    memset(depth, 0, sizeof(depth));  
    depth[s] = 1; // 源点的层次为1  
    queue<int> q;  
    q.push(s); // 将源点加入队列  
    while (!q.empty()) {  
        int u = q.front();  
        q.pop();  
        for (int i = head[u]; i > -1; i = e[i].nxt) {  
            int v = e[i].to;  
            if (e[i].val && !depth[v]) { // 边有剩余容量且目标顶点未访问  
                depth[v] = depth[u] + 1; // 更新目标顶点的层次  
                q.push(v); // 将目标顶点加入队列  
            }  
        }  
    }  
    if (depth[t] != 0) // 如果汇点可达  
        return true; // 返回true表示存在增广路径  
    return false;  
}  
  
ll dfs(int pos, ll in) { // DFS用于寻找增广路径并计算流量  
    if (pos == t) // 如果当前顶点是汇点，则返回当前流量  
        return in;  
    ll out = 0; // 初始化当前顶点的流出量为0  
    for (int u = head[pos]; u > -1 && in; u = e[u].nxt) {  
        int v = e[u].to;  
        // 如果边有剩余容量且目标顶点的层次恰好是当前顶点层次加1  
        if (e[u].val && depth[v] == depth[pos] + 1) {  
            // 递归调用dfs寻找增广路径，并计算可以流过当前边的流量  
            ll res = dfs(v, min(e[u].val, in));  
            e[u].val -= res; // 更新正向边的容量  
            e[u ^ 1].val += res; // 更新反向边的容量  
            in -= res; // 减少当前流量  
            out += res; // 增加流出量  
        }  
    }  
    if (out == 0)  
        // 如果当前顶点没有流出量，则将其层次设为0，表示在后续的BFS中不会再访问  
        depth[pos] = 0;  
    return out;  
}  
ll Dinic() {  
    while (bfs())   // 存在增广路径  
        max_stream += dfs(s, LL_INF);  
    return max_stream;  
}
```

# 数学

## 多项式乘法（这里采用FFT的迭代实现）

```cpp
#include <iostream>
#include <bits/stdc++.h>
using namespace std;

const int maxn = 1000000 + 7;
#define PI acos(-1)

// 复数类，用于FFT计算
struct Complex {
    double x, y; // 实部和虚部 x + yi

    // 复数加法
    Complex operator+(const Complex &b) const {
        return {x + b.x, y + b.y};
    }

    // 复数减法
    Complex operator-(const Complex &b) const {
        return {x - b.x, y - b.y};
    }

    // 复数乘法：(a+bi)*(c+di) = (ac-bd) + (ad+bc)i
    Complex operator*(const Complex &b) const {
        return {x * b.x - y * b.y, x * b.y + y * b.x};
    }
};

int n, m; // 两个多项式的次数
Complex a[maxn * 3], b[maxn * 3]; // 存储多项式的系数（复数形式）
int pos[maxn * 3]; // 位逆序置换数组，用于FFT中的位置交换

// 函数声明
void FFT(Complex* A, int len, int type);

int main() {
    int maxLen = 1, l = 0; // maxLen为FFT的长度，l为log2(maxLen)

    // 输入两个多项式的次数
    scanf("%d%d", &n, &m);

    // 计算FFT需要的长度，必须是2的幂次，且至少能容纳n+m+1个系数
    while (maxLen < n + m + 1) {
        maxLen <<= 1;
        l++;
    }

    // 读取第一个多项式的系数（实部），虚部默认为0
    for (int i = 0; i <= n; i++) {
        scanf("%lf", &a[i].x);
        a[i].y = 0;
    }

    // 读取第二个多项式的系数（实部），虚部默认为0
    for (int i = 0; i <= m; i++) {
        scanf("%lf", &b[i].x);
        b[i].y = 0;
    }

    // 初始化位逆序置换数组
    pos[0] = 0;
    for (int i = 0; i < maxLen; i++) {
        // 计算每个索引i的位逆序位置
        // 例如：二进制011(3) -> 110(6)
        pos[i] = (pos[i >> 1] >> 1) | ((i & 1) << (l - 1));
    }

    // 步骤1：对两个多项式进行DFT（将系数表示法转换为点值表示法）
    FFT(a, maxLen, 1);  // type=1 表示正向FFT（DFT）
    FFT(b, maxLen, 1);

    // 步骤2：在点值表示法下进行乘法（对应点相乘）
    for (int i = 0; i < maxLen; i++) {
        a[i] = a[i] * b[i];
    }

    // 步骤3：对结果进行IDFT（将点值表示法转换回系数表示法）
    FFT(a, maxLen, -1);  // type=-1 表示逆向FFT（IDFT）

    // 输出结果多项式的系数
    for (int i = 0; i < n + m + 1; i++) {
        if (i != 0) printf(" ");
        // 四舍五入取整，+0.49是为了处理浮点数精度问题
        printf("%d", (int)(a[i].x + 0.49));
    }
    printf("\n");

    return 0;
}

/**
 * FFT快速傅里叶变换
 * @param A     复数数组（输入输出）
 * @param len   数组长度（必须是2的幂次）
 * @param type  变换类型：1表示DFT，-1表示IDFT
 */
void FFT(Complex* A, int len, int type) {
    // 步骤1：位逆序置换（蝶形重排）
    // 将数组A中的元素按照位逆序的位置进行交换
    for (int i = 0; i < len; i++) {
        if (i < pos[i]) {  // 只交换一次，避免重复交换
            swap(A[i], A[pos[i]]);
        }
    }

    // 步骤2：迭代进行FFT计算
    for (int L = 2; L <= len; L <<= 1) {  // L为合并的区间长度
        int HLen = L / 2;  // 区间的一半长度

        // 计算单位根：Wn = cos(2π/L) + i*sin(2π/L)
        // type=1时为正旋转，type=-1时为逆旋转
        Complex Wn = {cos(2.0 * PI / L), type * sin(2.0 * PI / L)};

        // 遍历每个长度为L的区间
        for (int R = 0; R < len; R += L) {
            Complex w = {1, 0};  // 初始化旋转因子

            // 对当前区间内的每个元素进行蝴蝶操作
            for (int k = 0; k < HLen; k++, w = w * Wn) {
                // 蝴蝶操作公式：
                // even[k] = A[k] + w * A[k+HLen]
                // odd[k] = A[k] - w * A[k+HLen]

                Complex Buf = A[R + k];  // 保存A[k]的值
                Complex t = w * A[R + k + HLen];  // w * A[k+HLen]

                // 更新A[k]和A[k+HLen]
                A[R + k] = Buf + t;         // even部分
                A[R + k + HLen] = Buf - t;  // odd部分
            }
        }
    }

    // 步骤3：如果是IDFT，需要除以长度len
    if (type == -1) {
        for (int i = 0; i < len; i++) {
            A[i].x /= len;
            A[i].y /= len;
        }
    }
}
```

## 高精度乘法（这里采用FFT的递归实现）

```cpp
#include <iostream>
#include <cmath>
#include <cstring>

using namespace std;

const double Pi = acos(-1);
const int MAX = 4000005;
typedef long long ll;

// 复数结构体
struct Complex {
    double x, y;

    Complex operator+(const Complex &b) const {
        return {x + b.x, y + b.y};
    }

    Complex operator-(const Complex &b) const {
        return {x - b.x, y - b.y};
    }

    Complex operator*(const Complex &b) const {
        return {x * b.x - y * b.y, x * b.y + y * b.x};
    }
} f[MAX], p[MAX], sav[MAX];  // f和p存储输入多项式，sav是临时数组

ll ans[MAX];  // 存储最终结果的数组

/**
 * FFT快速傅里叶变换（递归实现）
 * @param f    复数数组
 * @param len  数组长度（必须是2的幂）
 * @param type 变换类型：1表示DFT，-1表示IDFT
 */
void FFT(Complex *f, int len, int type) {
    // 递归基：长度为1时直接返回
    if (len == 1)
        return;

    // ==================== 第一步：奇偶分离 ====================
    // 将多项式分为两部分：
    // fl: 偶数次项（索引为0,2,4,...）
    // fr: 奇数次项（索引为1,3,5,...）
    Complex *fl = f, *fr = f + len / 2;

    // 备份原数组
    for (int k = 0; k < len; k++)
        sav[k] = f[k];

    // 重新排列：偶数索引放前面，奇数索引放后面
    for (int k = 0; k < len / 2; k++) {
        fl[k] = sav[k << 1];       // 偶数索引：k*2
        fr[k] = sav[k << 1 | 1];   // 奇数索引：k*2+1
    }

    // ==================== 第二步：递归处理 ====================
    FFT(fl, len / 2, type);
    FFT(fr, len / 2, type);

    // ==================== 第三步：合并结果 ====================
    // 根据type选择单位根：
    // DFT:  ω_n = cos(2π/n) + i*sin(2π/n)
    // IDFT: ω_n = cos(2π/n) - i*sin(2π/n)  （共轭）
    Complex tG = {cos(2 * Pi / len), type * sin(2 * Pi / len)};
    Complex buf = {1, 0};  // 当前旋转因子，初始为ω_n^0 = 1

    // 蝴蝶操作：合并偶数和奇数部分的结果
    for (int k = 0; k < len / 2; k++) {
        // FFT公式：
        // F(k) = fl(k) + ω_n^k * fr(k)
        // F(k + len/2) = fl(k) - ω_n^k * fr(k)
        sav[k] = fl[k] + buf * fr[k];            // 前一半结果
        sav[k + len / 2] = fl[k] - buf * fr[k];  // 后一半结果

        buf = buf * tG;  // 更新旋转因子：ω_n^(k+1) = ω_n^k * ω_n
    }

    // 将结果复制回原数组
    for (int k = 0; k < len; k++)
        f[k] = sav[k];
}

int main() {
    char a[MAX], b[MAX];

    // 读取两个大整数
    scanf("%s%s", a, b);

    // 获取字符串长度
    int n = strlen(a);
    int m = strlen(b);

    // ==================== 第一步：将大整数转换为多项式 ====================
    // 反转存储：个位在索引0位置
    for(int i = 0; i < n; i++)
        f[i].x = a[n - i - 1] - '0';  // 反转并转换为数字

    for(int i = 0; i < m; i++)
        p[i].x = b[m - i - 1] - '0';  // 反转并转换为数字

    // ==================== 第二步：计算FFT需要的长度 ====================
    // FFT需要长度为2的幂次，且能容纳n+m个系数
    for (m += n, n = 1; n <= m; n <<= 1);  // 找到大于等于m+1的最小的2的幂

    // ==================== 第三步：执行FFT ====================
    FFT(f, n, 1);  // 对第一个多项式进行DFT（type=1）
    FFT(p, n, 1);  // 对第二个多项式进行DFT（type=1）

    // ==================== 第四步：点值相乘 ====================
    for (int i = 0; i < n; i++)
        f[i] = f[i] * p[i];  // 逐点相乘

    // ==================== 第五步：执行逆FFT ====================
    FFT(f, n, -1);  // 对结果进行IDFT（type=-1）

    // ==================== 第六步：获取结果并处理进位 ====================
    // 注意：IDFT后需要除以n（逆变换的缩放因子）
    for (int i = 0; i <= m; i++)
        ans[i] = (ll) (f[i].x / n + 0.49);  // +0.49是为了四舍五入

    // 处理进位
    for(int i = 0; i < MAX; i++){
        ans[i + 1] += (ans[i] / 10);  // 将进位加到下一位
        ans[i] %= 10;                 // 当前位只保留个位数
    }

    // ==================== 第七步：输出结果 ====================
    // 去除前导零
    int t = MAX - 1;
    while (t > 0 && ans[t] == 0)
        t--;

    // 反向输出（从高位到低位）
    while (t >= 0)
        cout << ans[t--];
    cout << endl;

    return 0;
}
```

## 位逆序函数（FFT核心部分）

```cpp
// 函数：执行位逆序置换
vector<int> bitReversePermute(const vector<int>& arr) {
    int n = arr.size();
    vector<int> result = arr;

    // 计算二进制位数
    int l = 0;
    while ((1 << l) < n) l++;

    // 计算位逆序置换表
    vector<int> pos(n);
    pos[0] = 0;
    for (int i = 1; i < n; i++) {
        pos[i] = (pos[i >> 1] >> 1) | ((i & 1) << (l - 1));
    }

    // 执行置换
    for (int i = 0; i < n; i++) {
        if (i < pos[i]) {
            swap(result[i], result[pos[i]]);
        }
    }

    return result;
}
```

# 其他

## 字符串匹配（KMP 算法）

