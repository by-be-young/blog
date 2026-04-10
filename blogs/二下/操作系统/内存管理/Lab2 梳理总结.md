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