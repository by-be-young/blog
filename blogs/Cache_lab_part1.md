---
id: 667318263
title: Cache实验轻松学——part1
date: 2025-12-18
tags:
    - 学习
    - 计组
    - Cache实验
excerpt: C语言模拟Cache存储操作
---

# 一、题目要求

## 1. 读入

#### 读入格式：[space]\<operation> \<address>,\<size>

就是说你要完成四种指令操作，对于每种操作，给定主存地址和存取内存的大小。

重要的大概就是主存地址了。根据理论部分，我们能够轻易地知道address可以被划分成Tag和Index两个部分。

所以我们后续大概需要主要在address上动些手脚。

## 2.输入

这个是在控制台输入的东西，因此我们之后就要将这个字符串获取并解析成我们需要的参数。

#### 输入格式： [-v] -s \<s> -E \<E> -b \<b> -t \<tracefile>

既然它说了-h选做，那我们就不管他了（其实也根本没有什么东西，具体内容也不固定）

-v 是可选指令，如果我们输入了这个，我们就得输出详细输出

-s , -E , -b 后面都是接一个数字，由于我们的Cache是组相联映射的，因此认真学习过理论的孩子能够很容易理解，s就是组地址位数，E是每组的块数，b是数据位数。

-t 不用管了，它就是指应该读入哪个文件。

## 3. 输出

### ① 基本输出

#### 输出格式：hits:\<hits> misses:\<misses> evictions:\<evictions>

意思是你需要统计总共命中了几次，总共缺失了几次，以及替换了几次。

### ② 详细输出

#### 输出格式：\<operation> \<address>,\<size> [hit] [miss] [eviction]

就是让你每次命中/缺失/替换时都输出到底是哪个地址上的被进行了什么操作。

了解了输入输出应该是怎么样，我们就可以着手开始准备动手了！

# 二、Cache结构设计

第一步我们先不着急输入，我们先看看怎么用c语言华丽模拟出一个Cache来。

由于我们不考虑具体数据，因此每个Cache块（Cache Line)就只剩下地址映射表了。

## 1. Cache块

虽然又称Cache行，英文也叫Cache Line，但其实它是一整块，里面有多个存储单元。但理论学得好就知道，其实一个块只有一个地址映射表。因此我们可以建立这样的Cache块的结构体：

```cpp
typedef struct
{
    int valid;         // 有效位
    long long tag;     // Tag位
    int lru_counter;   // LRU替换算法位
} CacheLine;
```

## 2. Cache组与Cache

由于一组是由若干个Cache块组成的，那我们就将Cache组设计为CacheLine的数组不就好了嘛。

同理，整个Cache就是Cache组的数组（~~套娃起来了~~）

```cpp
typedef CacheLine *CacheSet;
typedef CacheSet *Cache;
```

什么？你问为什么用指针？喂！每组几个、几个一组都是会变的哎！

## 3. 相关参数

要知道到底几块为一组、共有几组等问题，我们必须设置几个参数来记录。

根据输入，我们当然得要设置：

#### s：组地址位数<br>E：每组块数<br>b：数据位数

然后根据题目提示，再稍微计算一下得到：

#### S：组数<br>B：数据字节数

# 三、代码框架构建

首先我们得要解决输入怎么内化于码。输入形式即为Cache参数，于是我们在解决完输入后就可以开始构建Cache了。

## 1. 初始化Cache

根据以上分析，我们需要两个部分来初始化Cache：

```cpp
parse_args(argc, argv);
init_cache();
```

具体如何实现，你可以先自己思考并完成，再比对后面的详细代码哦~~

## 2. 读入指令并模拟Cache操作

初始化了一个空的Cache之后，我们就可以根据文件中的一条条指令来模拟了。

就是先解析指令，再模拟操作~~

由于我们需要用malloc开辟空间，最后别忘了free掉！

```cpp
process_trace();
free_cache();
```

## 3. 打印结果

题目已经贴心帮我们准备好了打印结果的函数了，我们只需按照指示完成即可。

```cpp
printSummary(hits, misses, evictions);
```

# 四、具体代码实现

## 1. 解析输入

库函数里已经有了getopt（）函数了，这下解析输入就变得肥肠煎蛋了。话不多说，直接上代码：

```cpp
void parse_args(int argc, char *argv[])
{
    int opt;
    while ((opt = getopt(argc, argv, "hvs:E:b:t:")) != -1)
    {
        switch (opt)
        {
        case 'v':
            verbose = 1;
            break;
        case 's':
            s = atoi(optarg);
            break;
        case 'E':
            E = atoi(optarg);
            break;
        case 'b':
            b = atoi(optarg);
            break;
        case 't':
            tracefile = optarg;
            break;
        }
    }
}
```

emm，这个库函数的用法说实话并不好理解~~，直接AI生成就行（）~~。

## 2. 初始化Cache

很简单，就是分配内存，计算必要参数，并清空数据就行了。

```cpp
void init_cache()
{
    S = 1 << s;
    B = 1 << b;

    cache = (CacheSet *)malloc(sizeof(CacheSet) * S);
    for (int i = 0; i < S; i++)
    {
        cache[i] = (CacheLine *)malloc(sizeof(CacheLine) * E);
        for (int j = 0; j < E; j++)
        {
            cache[i][j].valid = 0;
            cache[i][j].tag = -1;
            cache[i][j].lru_counter = 0;
        }
    }
}
```

## 3. 模拟Cache操作

这是核心代码。

首先我们需要解析读入的字符串。 

### 解析读入文件

空格我们不用管它。剩下就是根据操作符决定要做什么事。这段代码大家已经屡见不鲜了，这里就不再赘述，相信你能做到的！

### 存取操作

我们已经解析出来了主存地址，根据理论学习，我们知道主存地址会被分裂为Tag和Index。

c语言中可以直接用移位或位运算来快速分裂！

```cpp
long long tag = addr >> (s + b);
int set_index = (addr >> b) & ((1 << s) - 1);
```

是的，要记住数据位在一个Cache块的最右端哦。

接下来需要找到Index对应的组，组内逐个比较Tag和有效位，判断是否命中！如果命中，我们记录一下是命中该组的哪一块。

```cpp
CacheSet set = cache[set_index];

int hit_index = -1;
for (int i = 0; i < E; i++)
{
    if (set[i].valid && set[i].tag == tag)
    {
        hit_index = i;
        break;
    }
}
```

为什么要记录命中了哪一块呢？你还记得LRU的算法吗？

#### 命中时，被访问块计数器清零，数字比它更小的组内其他计数器加1

很好，聪明的你一定已经恍然大悟了！

```cpp
for (int i = 0; i < E; i++)
{
    if (set[i].valid && i != hit_index)
    {
        set[i].lru_counter++;
    }
}
```

嘿嘿，其实我这段代码并没有完全按照LRU的算法来。如果你真的掌握了理论部分，你会知道为什么不用管数字是不是比命中块小。但我在这里还是再解释一遍吧：

我们理论学习的替换算法位为了节省空间，最大不会超过E - 1。但我们在C语言中其实不用太在乎空间，只需要正常计数，也不会有任何问题。

另外，我上面代码还没有对命中的清零，不要急，我放在下面了：

```cpp
if (hit_index != -1)
{
    set[hit_index].lru_counter = 0;
    hits++;
    if (verbose)
    {
        printf(" hit");
    }
}
```

接下来实现另外两条规则：

#### 未命中且有空闲块时，新装入行的计数器设为0，其余计数器加1<br>未命中且无空余块时，计数值达到最大值的块被替换，且计数器设为0，其余计数器加1

因此在未命中时，我们还需要判断该组是否有空闲块，也就是比较有效位是否有为0的块就行了。

```cpp
else
{
    misses++;
    if (verbose)
    {
        printf(" miss");
    }

    int empty_index = -1;
    for (int i = 0; i < E; i++)
    {
        if (!set[i].valid)
        {
            empty_index = i;
            break;
        }
    }

    if (empty_index != -1)
    {
        set[empty_index].valid = 1;
        set[empty_index].tag = tag;
        set[empty_index].lru_counter = 0;
    }
    else
    {
        evictions++;
        if (verbose)
        {
            printf(" eviction");
        }

        int lru_index = 0;
        int max_counter = set[0].lru_counter;
        for (int i = 1; i < E; i++)
        {
            if (set[i].lru_counter > max_counter)
            {
                max_counter = set[i].lru_counter;
                lru_index = i;
            }
        }

        set[lru_index].tag = tag;
        set[lru_index].lru_counter = 0;
    }
}
```

不知不觉我们就已经把所有代码完成了！这么看来其实也不难嘛，远不如大一的程设吧。只要理论学的够扎实，就相当于直接把人话翻译成C语言罢了。

#### Mission Accomplished！
