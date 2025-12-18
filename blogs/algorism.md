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

注意，dp[i][j]指的是以第i、第j个字符结尾的最长子串长度，和公共子序列的含义不相同，因此需要专门用max来记录最长子串长度。
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
