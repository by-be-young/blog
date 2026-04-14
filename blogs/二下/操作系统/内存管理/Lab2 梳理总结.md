---
type: 待完善
excerpt: 2421操作系统Lab2课下实验Exercise习题总结及个人答案
---
# 2.1

```C
npage = memsize / PAGE_SIZE;
```

其中 `PAGE_SIZE` 在 `mmu.h` 中有定义。

# 2.2

```C
#define LIST_INSERT_AFTER(listelm, elm, field)                                     \
    do {                                                                		  \ 
        (elm)->field.le_next = (listelm)->field.le_next;                           \
        if ((listelm)->field.le_next != NULL) {                                    \
            (listelm)->field.le_next->field.le_prev = &(elm)->field.le_next;       \
        }                                                                           \
        (listelm)->field.le_next = (elm);                                            \
        (elm)->field.le_prev = &LIST_NEXT((listelm), field);                         \
    } while (0)
```

或第四步改为：

```C
(elm)->field.le_prev = &(listelm)->field.le_next;
```

特别需要注意 `le_next` 和 `le_prev` 的变量类型不同。如果你还没有发现它俩不同，可以先去看看 thinking 2.3 怎么写。

十分建议这道题边画图边写！

# 2.3

```C
void page_init(void) {
    LIST_INIT(&page_free_list);
    
    freemem = ROUND(freemem, PAGE_SIZE);
    
    for (int i = 0; i < npage; i++) {
        if (PAGE_SIZE * i < PADDR(freemem)) {
            pages[i].pp_ref = 1;
        } else {
            pages[i].pp_ref = 0;
            LIST_INSERT_HEAD(&page_free_list, &pages[i], pp_link);
        }
    }
}
```

其中 `ROUND` 宏的用法在指导书 2.3.2 节有提到。

- 为什么要 `PADDR(freemem)`？

我们要管理的内存是物理地址，而 `freemem` 是虚拟地址，必须得要用这个函数才能将虚拟地址转化为物理地址。这个函数的出现也是在指导书的 2.3.2 节。

- 我们如何知道 `LIST_INSERT_HEAD` 函数中的 `field` 参数就是 `pp_link`？

还记得我们之前经常写类似：`field.le_next` 吗？所以，包含变量 `le_next` 和 `le_prev` 的结构体就是 `field` （实际上，这个结构体的类型为 `LIST_ENTRY(type)`，可以在 `queue.h` 中找到它的定义。）

# 2.4

```C
int page_alloc(struct Page **new) {
    struct Page *pp;
    
    if (LIST_FIRST(&page_free_list) == NULL) {
        return -E_NO_MEM; // 前面有注释来提示
    }
    pp = LIST_FIRST(&page_free_list);
    
    LIST_REMOVE(pp, pp_link);
    
    memset((void *)page2kva(pp), 0, PAGE_SIZE);
    
    *new = pp;
    return 0;
}
```

- 为什么要 `page2kva(pp)`？

`pp` 是链表中对应 `Page` 结构体的地址，并不是内存中该页面的地址。

我们可以查阅 `pmap.h` 中，与这些地址转化相关的大量函数，发现 `page2kva()` 这个函数能够直接将 `Page` 结构体的地址转化为内核虚拟地址，这样 `memset()` 函数就能够操作了。标准 C 库函数的参数都必须是虚拟地址。

# 2.5

```C
void page_free(struct Page *pp) {
    assert(pp->pp_ref == 0);
    LIST_INSERT_HEAD(&page_free_list, pp, pp_link);
}
```

- `assert()` 函数是干什么的？

这个函数在当括号内条件为真时，什么都不做；为假时，立即终止程序并打印错误信息。总而言之，就是防止误调用，检查一下而已。

# 2.6

- 这个函数是干啥的？

将虚拟地址 `va` 对应的二级页表的地址赋给指针 `*ppte`。注意，`ppte` 是 `Pte *` 类型的指针（即 `Pte **` 类型），解引用之后得到的是二级页表的指针（`Pte *`  类型）。

- 如何获得一级页表项地址？

`PDX(va)` 函数能够获得 `va` 的 31-22 位，即一级页表偏移量。用基地址加上偏移量即可。

二级页表项的获取方法如出一辙。

- 如何获得二级页表基地址？

可以从一级页表项获取。这里可以直接使用函数 `PTE_ADDR()`。但要注意，这是物理地址，必须用 `KADDR()` 函数转化成虚拟地址，才可继续使用。

- 如何判断二级页表不存在？

在获得二级页表项后，如果其有效位为 0，则无效。`PTE_V` 是一个标志位掩码，它只有有效位的那一位为 1。通过和页表项进行与运算（&），可以判断有效位是否为 1。

- 什么叫维护 `pp_ref` 字段？

`pp_ref` 字段记录的是有多少个地方（指针）引用了这个物理页。当引用计数为 0 时，表示页面可以被回收。所以，本函数就是要引用 `pp` 这个页，所以 `pp_ref` 自增即可。

- 参数 `create` 是干什么的？

当 `create == 0` 时，只查找，不创建；当 `create == 1` 时，若不存在则创建。

```C
static int pgdir_walk(Pde *pgdir, u_long va, int create, Pte **ppte) {
    Pde *pgdir_entryp;
    struct Page *pp;

    pgdir_entryp = pgdir + PDX(va);
    
    if ((*pgdir_entryp & PTE_V) == 0) {
        if (create) {
            if (page_alloc(&pp) < 0) {
                *ppte = NULL;
                return -E_NO_MEM;
            }
            pp->pp_ref++;
            *pgdir_entryp = PTE_C_CACHEABLE | PTE_V | page2pa(pp);
        } else {
            *ppte = NULL;
            return -E_NO_MEM;
        }
    }
    
    *ppte = (Pte *)KADDR(PTE_ADDR(*pgdir_entryp)) + PTX(va);
    return 0;
}
```

# 2.7

- 这个函数是干什么的？

将页 `pp` 映射到二级页表之中。具体的实现思路是：对于两级页表结构中 `va` 对应的地址，里面需要存放页 `pp` 的地址。

- 如何判断 `va` 这个地址是否映射了一个有效的物理页？

通过上一题的函数 `pgdir_walk()` ，可以获得二级页表项，如果没有映射，则指针的值为 `NULL`。因此，我们可以通过判断指针是否是 `NULL`，且该二级页表项的有效位是否为 1 来判断。

- 如何将 `pp` 对应的物理地址写入 `va` 对应的二级页表项中？

还是通过函数 `pgdir_walk()` 函数，其中 `clean` 参数设为 1，以便当 `va` 没有映射物理页的时候，创建一个新的页。

然后将该函数获得的指针 `ppte` 两次解引用后的值赋为 `pp` 的物理地址 `page2pa(pp)`，并按题目要求设置权限即可。

- 函数参数中的 `asid` 是什么？

这个在指导书后面 2.6.1 节才讲到（也可先看 Thinking 2.4）。在这里没有那么重要，`tlb_invalidate()` 函数直接照抄上面已给代码就行。

```C
int page_insert(Pde *pgdir, u_int asid, struct Page *pp, u_long va, u_int perm) {
    Pte *pte;

    pgdir_walk(pgdir, va, 0, &pte);

    if (pte && (*pte & PTE_V)) {
        if (pa2page(*pte) != pp) {
            page_remove(pgdir, asid, va);
        } else {
            tlb_invalidate(asid, va);
            *pte = page2pa(pp) | perm | PTE_C_CACHEABLE | PTE_V;
            return 0;
        }
    }

    tlb_invalidate(asid, va);

    if (pgdir_walk(pgdir, va, 1, &pte) < 0) {
        return -E_NO_MEM;
    }

    *pte = page2pa(pp) | perm | PTE_C_CACHEABLE | PTE_V;
    pp->pp_ref++;

    return 0;
}
```

# 2.8

- 该函数是干什么的？

根据传入的参数（Key）找到 TLB表项，然后清空该表项。该函数是之前我们用到的 `tlb_invalidate()` 函数的具体实现方法。

- `LEAF()` 是什么意思？

表示该函数是一个叶子函数，不会调用其他的函数。

- `.set reorder` 和 `.set noreorder` 是什么意思？

前者表示汇编器可以按需自动重新排序，以处理延迟槽；

后者表示汇编器必须严格按照指令顺序执行。通常需要自行处理延迟槽。

```asm
LEAF(tlb_out)
.set noreorder
mfc0    t0, CP0_ENTRYHI
mtc0    a0, CP0_ENTRYHI
nop
tlbp
nop
mfc0    t1, CP0_INDEX
.set reorder
bltz    t1, NO_SUCH_ENTRY
.set noreorder
mtc0    zero, CP0_ENTRYHI
mtc0    zero, CP0_ENTRYLO0
mtc0    zero, CP0_ENTRYLO1
nop
tlbwi
.set reorder

NO_SUCH_ENTRY:
mtc0    t0, CP0_ENTRYHI
j       ra
END(tlb_out)
```

> 这道题何意味？
> 
> 这个北航人自创了 2000 条 MIPS 指令……
> 
> 我真的自己创了条 `tlbp    CP0_INDEX, CP0_ENTRYHI`，结果最后发现答案就只要写个名字就好了！气笑了……

# 2.9

```C
void _do_tlb_refill(u_long *pentrylo, u_int va, u_int asid) {
    tlb_invalidate(asid, va);
    Pte *ppte;
    
    while (page_lookup(cur_pgdir, va, &ppte) == NULL) {
        passive_alloc(va, cur_pgdir, asid);
    }
    
    ppte = (Pte *)((u_long)ppte & ~0x7);
    pentrylo[0] = ppte[0] >> 6;
    pentrylo[1] = ppte[1] >> 6;
}
```

提示写的非常清楚，这里不再解释。