---
type: 待完善
series: 操作系统实验报告
excerpt: 2421操作系统Lab2课下实验实验报告
order: "3"
---
# 思考题

## Thinking 2.1

> 1. 在编写的 C 程序中，指针变量中存储的地址被视为虚拟地址，还是物理地址？
> 
> 2. MIPS 汇编程序中 `lw` 和 `sw` 指令使用的地址被视为虚拟地址，还是物理地址？

都被视为虚拟地址，最终由内存管理单元（MMU）转化为物理地址。

## Thinking 2.2

> 请思考下述两个问题： 
> 
> 1. 从可重用性的角度，阐述用宏来实现链表的好处。 
> 
> 2. 查看实验环境中的 `/usr/include/sys/queue.h`，了解其中单向链表与循环链表的实现，比较它们与本实验中使用的双向链表，分析三者在插入与删除操作上的性能差异。

### 宏的好处

1. 可支持泛型：C 语言没有泛型的语法。这样的宏定义，通过 field 这一参数，使同一套链表操作能够兼容任意结构体类型。
2. 减少开销：宏定义在预处理阶段就会展开，没有函数调用的开销。
3. 代码复用性：一套宏可以用在所有需要链表的结构体上，且便于维护和扩展新功能。

### 三种链表的性能差异

由于单向链表没有记录前驱节点，在单向链表中的某个给定节点前插入或删除上一个节点时，需要从头开始遍历，时间复杂度为 `O(n)`，同时，由于没有尾指针，在尾部插入或删除尾节点时，也要遍历一遍，时间复杂度为 `O(n)`。

我们实验环境中的循环链表为循环双向链表，和双向链表差别不大，任意插入和删除操作的时间复杂度都为 `O(1)`。

总结：

| 操作                                | 单向链表  | 双向链表  | 循环双向链表 |
| --------------------------------- | ----- | ----- | ------ |
| **头部插入/删除**​                      | O (1) | O (1) | O (1)  |
| **尾部插入/删除**<br><br>**插入/删除前驱节点**​ | O (n) | O (1) | O (1)  |

## Thinking 2.3

> 请阅读 `include/queue.h` 以及 `include/pmap.h`, 将 `Page_list` 的结构梳理清楚，选择正确的展开结构。
> 
> ```C
> A:
> struct Page_list{
> struct {
> 	struct {
> 		struct Page *le_next;
> 		struct Page *le_prev;
> 	} pp_link;
> 	u_short pp_ref;
> }* lh_first;
> }
> ```
> 
> ```C
> B:
> struct Page_list{
> 	struct {
> 		struct {
> 			struct Page *le_next;
> 			struct Page **le_prev;
> 		} pp_link;
> 		u_short pp_ref;
> 	} lh_first;
> }
> ```
> 
> ```C
> C:
> struct Page_list{
> 	struct {
> 		struct {
> 			struct Page *le_next;
> 			struct Page **le_prev;
> 		} pp_link;
> 		u_short pp_ref;
> 	}* lh_first;
> }
> ```

本题选 C。

首先，`Page_list` 是结构体 `Page` 的指针（是 `page_free_list` 的类型，而 `page_free_list` 是头指针），再通过定义把 `Page` 一层层展开即可得到。

特别需要注意的是，最内层的结构体包含的是前驱和后继的信息，但类型却不一样：`le_next` 是直接指向后继节点的指针，而 `le_prev` 却是指向前驱节点的 `le_next` 字段的指针。

但是这段代码并不是真正的正确代码，只是一个示意伪代码。原因是：内部的结构体不应该是匿名的，如第二层结构体应该是 `struct Page *` 类型的、最内层结构体应该是 `LIST_ENTRY(Page)` 类型的。但如果直接这么写，又会和外面对 `struct Page` 结构体的定义相冲突。

## Thinking 2.4

> 1. 请阅读上面有关 TLB 的描述，从虚拟内存和多进程操作系统的实现角度，阐述 ASID的必要性。
> 
> 2. 请阅读 MIPS 4Kc 文档《MIPS32® 4K™ Processor Core Family Software User’s Manual》的 Section 3.3.1 与 Section 3.4，结合 ASID 段的位数，说明 4Kc 中可容纳不同的地址空间的最大数量。

### 第一问

1. 地址空间隔离：使每个进程有独立的地址空间，同一个虚拟地址不会争抢同一个物理页。
2. TLB 性能优化：如果没有 ASID，每次切换进程时需要清空 TLB，这也会导致命中率大大降低。

### 第二问

ASID 的位数共 6 位，因此可以容纳 $2^6=64$ 个不同的地址空间。

## Thinking 2.5

> 1. `tlb_invalidate` 和 `tlb_out` 的调用关系？
>    
> 2. 请用一句话概括 `tlb_invalidate` 的作用。
>    
> 3. 逐行解释 `tlb_out` 中的汇编代码。

### 第一问

```C
void tlb_invalidate(u_int asid, u_long va) {
    tlb_out((va & ~GENMASK(PGSHIFT, 0)) | (asid & (NASID - 1)));
}
```

#### `tlb_out()` 函数被 `tlb_invalidate()` 函数调用。

这个函数可以在 `kern/tlbex.c` 中找到。

### 第二问

使指定虚拟地址在 TLB 中的缓存条目（映射物理页面的表项）失效。

### 第三问

```asm
LEAF(tlb_out)              # 声明叶子函数tlb_out
.set noreorder             # 禁止汇编器重排指令
mfc0    t0, CP0_ENTRYHI    # 保存当前EntryHi到t0
mtc0    a0, CP0_ENTRYHI    # 将要查找的地址写入EntryHi
nop                        # 延迟槽，确保写入完成
tlbp                       # 探测TLB查找匹配项，并将结果索引存到Index
nop                        # 延迟槽
mfc0    t1, CP0_INDEX      # 读取探测结果到t1
.set reorder               # 允许汇编器重排指令
bltz    t1, NO_SUCH_ENTRY  # 如果没找到(t1<0)，跳转到标签
.set noreorder             # 再次禁止指令重排
mtc0    zero, CP0_ENTRYHI  # 清空EntryHi寄存器
mtc0    zero, CP0_ENTRYLO0 # 清空EntryLo0寄存器
mtc0    zero, CP0_ENTRYLO1 # 清空EntryLo1寄存器
nop                        # 延迟槽
tlbwi                      # 将清零的EntryHi/Lo写入TLB
.set reorder               # 允许指令重排

NO_SUCH_ENTRY:             # 标签：未找到TLB条目的处理点
mtc0    t0, CP0_ENTRYHI    # 恢复原来的EntryHi值
j       ra                 # 跳转回调用者
END(tlb_out)               # 函数结束
```

## Thinking 2.6

> 请结合 Lab2 开始的 CPU 访存流程与下图中的 Lab2 用户函数部分，尝试将函数调用与CPU访存流程对应起来，思考函数调用与CPU访存流程的关系。

### 触发 TLB 缺失，但页表命中时所需的函数

- `page_lookup`：找到虚拟地址对应的二级页表项，并返回对应的页控制块的地址。
- `_do_tlb_refill`：将页表项写入 TLB

### 触发 TLB 缺失，且页表缺失时所需的额外函数

- `page_alloc`：分配一个页表中的空闲页
- `page_insert`：将该页插入页表中

## Thinking 2.7

> 1. 简单了解并叙述X86体系结构中的内存管理机制，比较X86和MIPS 在内存管理上的区别。
> 
> 2. 简单了解并叙述RISC-V 中的内存管理机制，比较RISC-V 与 MIPS 在内存管理上的区别。
> 
> 3. 简单了解并叙述LoongArch 中的内存管理机制，比较 LoongArch 与 MIPS 在内存管理上的区别。

| 特性           | MIPS        | X 86           | RISC-V      | LoongArch     |
| ------------ | ----------- | -------------- | ----------- | ------------- |
| **映射方式**​    | 固定分段+分页     | 分段+分页          | 纯分页         | 分页            |
| **TLB 管理**​  | 软件管理        | 硬件自动           | 软件管理        | 混合管理          |
| **ASID 宽度**​ | 8 位         | PCID (后加)      | 可选扩展        | 10 位          |
| **权限分级**​    | 2 级 (内核/用户) | 4 级 (Ring 0-3) | 3 级 (U/S/M) | 4 级 (PLV 0-3) |
| **页表级数**​    | 二级          | 四级/五级          | 多级可配置       | 四级            |

