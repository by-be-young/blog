---
type: 待完善
excerpt: 操作系统文件管理MOS具体实现方法，暨2421 Lab5梳理总结
series: 操作系统实验详解
order: "5"
---
# 六大系统调用概览

我们要实现的无非是六个系统调用：创建、打开、关闭、读取、写入、删除。

在 MOS 的**微内核**设计中，我们不希望内核做过多的事情，让**用户进程进行磁盘操作**。因此，我们需要一个独立的进程（文件系统服务器），用于进行磁盘的操作并真正进行系统调用（`syscall`）。

如何联系起这两个进程？根据 Lab 4 的内容，可以通过 IPC 进行进程间的通信。因此，每个系统调用都要经历：

1. 通过 IPC 从用户进程到文件系统服务进程；
2. 通过 `syscall` 陷入内核态。

## 创建文件

实验中通过标记位 `O_CREAT`，和**打开文件**合在了一起。

## 打开文件

```text
open() → fd_alloc() → fsipc_open() → IPC → 服务器打开文件 → 内存映射文件内容 → 返回fd
```

## 关闭文件

```text
close() → file_close() → fsipc_close() → 解除内存映射 → 释放资源
```

## 读取文件

```text
read() → fd_lookup() → file_read() → memcpy() 从内存映射区域复制数据
```

## 写入文件

```text
write() → fd_lookup() → file_write() → memcpy() → fsipc_dirty() 标记脏页
```

## 删除文件

```text
remove() → fsipc_remove() → IPC → serve_remove() → file_remove()
```

# 文件在磁盘块中的数据结构

## 磁盘空间布局

我们可以通过代码操作的磁盘只有 1 块（共 4 MB）。

磁盘共有 1024 个磁盘块（一个磁盘块 4 KB）。

> **一个磁盘块的大小的设计是随意的吗？**
> 
> 一个磁盘块是 4 KB，刚好和一个页的大小相同。这并非偶然，而是精心设计的结果。
> 
> 既然是和一个页的大小相同，那我们在进行磁盘块和内存之间的换入换出操作时，就可以以页为单位进行操作了。

![[磁盘空间布局.png]]

### 引导扇区和分区表

在代码中不涉及。这个在最开始的 Boot 理论中有所讲到，这里不再赘述。

### 超级块（Super Block）

数据结构如下（`user/include/fs.h`）：

```C
struct Super {
    uint32_t s_magic;   // 魔数，具体值可以随便，但保证统一
    uint32_t s_nblocks; // 磁盘块总数，其实就是1024，本实验中写死（硬编码）也没问题
    struct File s_root; // 根目录的文件控制块（见下文说明）
};
```

### 位图块

#### 位图块用于记录该磁盘中哪些磁盘是空闲的。

位图记录的逻辑是一个 bit 记录一个磁盘块的状态，1 表示空闲。

所以只需要 1024 个 bit 就可以记录所有磁盘块的状态了，折合 128 个字节。

> 理论上，仅需 1 个磁盘块就够了，但我们的实验中留出了比较多的磁盘块。

### 总结

一共可以细分为 7 种不同的磁盘块：Boot 块、Super 块、位图块、普通文件数据块、目录文件数据块、间接块、空闲块。而不仅仅只是上图中的 4 种。

其中部分我还没讲到，那就请继续看：

## 文件的数据结构

### 文件控制块（FCB）

数据结构（`user/include/fs.h`）：

```C
struct File {
    char f_name[MAXNAMELEN];       // 文件名
    uint32_t f_size;              // 文件大小（字节）
    uint32_t f_type;              // 文件类型（实验中只有普通文件0和目录1两种）
    uint32_t f_direct[NDIRECT];   // 直接块指针数组（指向文件所在磁盘块号）
    uint32_t f_indirect;          // 间接块指针（指向间接块磁盘块号）
    
    struct File *f_dir;           // 父目录指针（仅内存中有效）
    
    char f_pad[FILE_STRUCT_SIZE - MAXNAMELEN - (3 + NDIRECT) * 4 - sizeof(void *)];
    // 这个仅是占位用的，补齐FCB为256个字节。
} __attribute__((aligned(4), packed));
```

注意，虽然 `NDIRECT` 被定义为 10，但实际上不一定全被用上了。具体被用上的需要通过 `f_size / BLOCK_SIZE` 得到。

超出 10 个的部分，全被放在了一个单独的磁盘块（**间接块**）中。这个磁盘块就是 1024 个磁盘块中的一个。由于一个磁盘块为 4 KB，一个号需要 4 B，所以这个间接块一共也是可以存储 1024 个磁盘块号。这里和栈帧类似，前 40 个字节（10 个字）留空，从第 11 个字开始存储数字。

> **父目录指针为什么仅在内存中有效？**
> 
> 磁盘中不存在地址的概念，因此也不存在指针的概念。
> 
> 实际上，在真实的操作系统中，不会这么设计，否则容易出现很多问题（如迁移磁盘到其他电脑上时地址不对了等等）。

和前面超级块联系起来：超级块记录有根目录的 FCB，因此可以直接**通过超级块找到根目录**。

### 目录文件

目录文件全部由 FCB 构成（最多 16 个，可以根据大小算出来）。**且文件不包括本身的 FCB**，目录文件也不例外。这些 FCB 可能是下一级目录的 FCB，也有可能就是普通文件的 FCB。

> 普通文件就是正常的数据而已。

> **小总结**
> 
> 假如你想找到 `/home/code.c`，则需要从超级块中拿到根目录的 FCB，根据其 `f_direct` 字段直接找到了根目录所在的磁盘块（如果根目录占用超过 10 个磁盘块则还需 `f_indirect` 字段）。
> 
> 然后在根目录中找到了 `/home` 目录的 FCB，同样地找到 `/home` 目录所在的磁盘块。
> 
> 接着一样地找到 `code.c`。

# 磁盘操作（文件管理服务进程）

这里主要涉及的文件为 `fs/fs.c`，功能是让文件管理服务进程与磁盘进行交互，使磁盘与内存之间进行换入和换出操作。

> 我们的实验中，由于内存地址空间较大（用户地址空间有 2 GB），但是只有 1 个磁盘共 4 MB，而且还有很多磁盘块不存储数据，按照正常的操作系统的方法，根本不会出现需要换入换出的场景。
> 
> 因此本实验直接固定了每个磁盘换入内存的位置，这是绰绰有余的。

## 特别说明

在真正进入代码之前，我们必须再强调一下磁盘操作的逻辑。

我们不是真正让虚拟地址映射到磁盘中，而是和之前一样，**虚拟地址映射到物理地址**。所以，我们需要让物理地址**复制**磁盘中的内容。

但是这样会导致：如果修改了部分内容，那么物理地址和磁盘将会不一致。我们需要通过特殊手段记录并保持同步。

> 其实这个在 Cache 中就有类似的设计，如果上学期的 CO 有一定掌握度，这里肯定没有阻碍。
> 
> 如果不记得了，后面【 [[#辅助函数——磁盘是否被写过]] 】一节会细讲。

## 辅助函数——空闲块相关

### `block_is_free`：检查磁盘块是否空闲

以下情况无法判断，返回 0，与非空闲的返回值一致：

1. 如果连超级块都还没读入，那将无法判断；
2. 如果 `blockno` 大于 1024，则为非法的磁盘块号。

- 如何找到对应的位呢？

首先，由于位图中第 `blockno` 位表示该编号对应的磁盘块是否空闲，所以得找到这一位；

其次，`bitmap` 本身是一个 `u_int` 类型的数组，一个 `u_int` 类型占 4 个字节，合 32 位。

所以第 `blockno` 位应该在第 `blockno / 32` 项中，余数则是偏移的数位。

```C
int block_is_free(u_int blockno) {
    if (super == 0 || blockno >= super->s_nblocks) {
        return 0;
    }
    
    if (bitmap[blockno / 32] & (1 << (blockno % 32))) {
        return 1;
    }
    
    return 0;
}
```

### `free_block`：释放并标记磁盘块为空闲

```C
// Exercise 5.4
void free_block(u_int blockno) {
    if (blockno == 0 || blockno >= super->s_nblocks) {
        return;
    }
    
    bitmap[blockno / 32] |= 1 << (blockno & 0x1f); // 其实和blockno % 32无区别
    write_block(blockno / BLOCK_SIZE_BIT + 2);	// 写回位图到磁盘

    if (block_is_mapped(blockno)) {
        unmap_block(blockno);	// 解除映射
    }
}
```

Boot 块绝对不能被释放掉！所以一开始必须检查 `blockno` 是否为 0。

写回磁盘的相关函数见后面小节【 [[#`write_block`：写回磁盘]] 】。

解除映射的相关辅助函数见后面小节【 [[#辅助函数——映射相关]] 】。

> 写回位图到磁盘中时，计算了 `blockno` 所在的磁盘块号。
> 
> 但其实，由于 `blockno` 最大才 1024，而 `BLOCK_SIZE_BIT` 为 `4096 * 8`，所以 `blockno / BLOCK_SIZE_BIT` 必定为 0。
> 
> 而前两个块（0 号块和 1 号块）是 Boot 块和 Super 块，所以需要加 2。

### `alloc_block`：分配空闲块

分配空闲块，并建立映射。

```C
int alloc_block(void) {
    int r, bno;
    
    if ((r = alloc_block_num()) < 0) {
        return r;
    }
    bno = r;

    if ((r = map_block(bno)) < 0) {
        free_block(bno);	// 正常情况不会分配失败，但如果失败了则放弃分配，释放回去
        return r;
    }

    return bno;
}
```

其中 `alloc_block_num` 这个更底层的函数的逻辑为：

向上遍历数据块（非 Boot 块、Super 块、位图块），如果找到了空闲块则标记为非空闲，并返回该块的编号。

```C
int alloc_block_num(void) {
    int blockno;
    // 整数向上取整常用方法计算位图块数
    u_int nbitmap = (super->s_nblocks + BLOCK_SIZE_BIT - 1) / BLOCK_SIZE_BIT;
    
    for (blockno = nbitmap + 2; blockno < super->s_nblocks; blockno++) {
        if (bitmap[blockno / 32] & (1 << (blockno % 32))) {
            bitmap[blockno / 32] &= ~(1 << (blockno % 32));
            write_block(blockno / BLOCK_SIZE_BIT + 2);	// 一旦修改了位图，立刻写回磁盘
            return blockno;
        }
    }
    
    return -E_NO_DISK;
}
```

## 辅助函数——映射相关

### `disk_addr`：磁盘块对应虚拟地址

由于本实验中磁盘块和虚拟地址是线性对应的，这个函数非常简单：

```C
// Exercise 5.6
void *disk_addr(u_int blockno) {
    return (void *)(DISKMAP + blockno * BLOCK_SIZE);
}
```

也就是说，从 `DISKMAP` 这个基地址开始，一个一个往上堆即可。

> 我们并没有实现逆向操作的函数，即没能通过虚拟地址得到磁盘块号。
> 
> 但从理论上来说并不困难，大可以另写一个函数实现。

### `va_is_mapped`： 检查虚拟地址是否有映射

```C
int va_is_mapped(void *va) {
    return (vpd[PDX(va)] & PTE_V) && (vpt[VPN(va)] & PTE_V);
}
```

如果之前的内存管理学的够好，这个很好理解：自映射页目录项有效且页表项有效即可。

### `block_is_mapped`：检查磁盘块是否被映射

如果磁盘块对应的虚拟地址有映射，则磁盘块被映射了。逻辑很好理解。

```C
void *block_is_mapped(u_int blockno) {
    void *va = disk_addr(blockno);
    if (va_is_mapped(va)) {
        return va;
    }
    return NULL;
}
```

但是这个**特别需要注意**的是：一个函数干了**两件事**，除了检查是否被映射外，如果确实被映射了，还能顺带**返回对应的虚拟地址**。

因此后面的代码可以直接使用这个的返回值，而不需要再次调用 `disk_addr` 函数。

### `map_block`：建立虚拟地址到磁盘块的映射

```C
// Exercise 5.7 (PART 1)
int map_block(u_int blockno) {
    if (block_is_mapped(blockno)) {
        return 0;
    }
    
    return syscall_mem_alloc(0, disk_addr(blockno), PTE_D);
}
```

实际上，我们并没有将磁盘块中的内容复制到物理内存中，只是建立了一个“空”映射。实际要使用的时候，还是需要先复制。

### `unmap_block`：解除映射

记得吗？我们在写入数据的时候，不可以直接写磁盘，而是写到对应的物理内存中。因此，在解除映射之前，必须将物理内存**复制到磁盘中**去。

```C
// Exercise 5.7 (PART 2)
void unmap_block(u_int blockno) {
    void *va = block_is_mapped(blockno);
    
    if (!block_is_free(blockno) && block_is_dirty(blockno)) {
        write_block(blockno);
    }

    panic_on(syscall_mem_unmap(0, va));
    user_assert(!block_is_mapped(blockno));
}
```

此处就用到了上述 `block_is_mapped` 的双重作用。

> 但其实，这么写逻辑非常混乱，而且也没有真正判断是否失败。如果磁盘块没有映射，`va` 将被赋值为空指针 `NULL`，然后并没有返回或报错。

## 辅助函数——磁盘是否被写过

注意我们使用的权限位是软件权限位 `PTE_DIRTY` 而不是硬件权限位 `PTE_D`。

实际上，`PTE_D` 这个权限位更多是表示“**可写**”而不是“脏”。

> 硬件权限位有 `PTE_D` 、`PTE_V` 等；
> 
> 软件权限位有 `PTE_COW`、`PTE_LIBRARY`、`PTE_DIRTY` 等。
> 
> 二者的区别包括但不限于：
> 
> 1. 硬件权限位会被缓存进 TLB 而软件权限位不会。
> 
> 2. 软件权限位检测时机较为灵活，可以按照策略主动检测。
> 
> 3. 硬件权限检测失败直接进异常处理，而软件权限位不会。

### `va_is_dirty`：检查虚拟地址是否脏

```C
int va_is_dirty(void *va) {
    return va_is_mapped(va) && (vpt[VPN(va)] & PTE_DIRTY);
}
```

### `block_is_dirty`：检查磁盘块是否脏

```C
int block_is_dirty(u_int blockno) {
    void *va = disk_addr(blockno);
    return va_is_dirty(va);
}
```

### `dirty_block`：标记磁盘块为脏

```C
int dirty_block(u_int blockno) {
    void *va = disk_addr(blockno);
  
    if (!va_is_mapped(va)) {
        return -E_NOT_FOUND;
    }
  
    if (va_is_dirty(va)) {
        return 0;
    }

    return syscall_mem_map(0, va, 0, va, PTE_D | PTE_DIRTY);
}
```

注意，最后 `syscall_mem_map` 的参数中，`src` 进程和虚拟地址、`dst` 进程和虚拟地址都是 `0` 和 `va`，表示的就是其实不改变映射，只是修改权限位。

## 写回（换出）、读入（换入）磁盘

### `write_block`：写回磁盘

先检查是否有映射，再写回磁盘。

```C
void write_block(u_int blockno) {
    if (!block_is_mapped(blockno)) {
        user_panic("write unmapped block %08x", blockno);
    }

    void *va = disk_addr(blockno);
    ide_write(0, blockno * SECT2BLK, va, SECT2BLK);
    syscall_mem_map(0, va, 0, va, PTE_D);
}
```

其中函数 `ide_write` 后续再说明用法。

### `read_block`： 读取磁盘

注意，如果想要换入已经建立映射的磁盘，这个操作是多余的。所以必须检查这个磁盘块是否被映射到了虚拟地址，如果已经有映射，则**不再换入**。

```C
int read_block(u_int blockno, void **blk, u_int *isnew) {
    if (super && blockno >= super->s_nblocks) {
        user_panic("reading non-existent block %08x\n", blockno);
    }

    if (bitmap && block_is_free(blockno)) {
        user_panic("reading free block %08x\n", blockno);
    }

    void *va = disk_addr(blockno);

    if (block_is_mapped(blockno)) {
        if (isnew) {
            *isnew = 0;
        }
    } else {
        if (isnew) {
            *isnew = 1;
        }
        try(syscall_mem_alloc(0, va, PTE_D));
        ide_read(0, blockno * SECT2BLK, va, SECT2BLK);
    }

    if (blk) {
        *blk = va;
    }
    return 0;
}
```

其中函数 `ide_read` 后续再说明用法。

实际上，`read_block` 和 `write_block` 一样，也只应该有一个参数 `blockno` 即可。但是这里多了两个参数，其实是起到返回值的作用。

如果原先该磁盘块没有被映射，`isnew` 就被返回为 1，否则为 0；而 `blk` 则是被返回为磁盘的虚拟地址 `va`。

> 对于指针返回值，照例是要检查是否空指针的。如果是空指针 `NULL`，表示不需要该返回值。
> 
> 为什么可以通过类似 `if (isnew)` 的方式判断？因为在 C 语言中，`NULL` 就是 `0`。

## 辅助函数——根据 FCB 查找磁盘块

### `file_block_walk`：根据 FCB 中逻辑块号获得磁盘块指针

**参数说明**：一个 FCB 的指针 `f` 和一个逻辑块号 `filebno` 。另外，还有个参数 `alloc`，如果为 1，表示当间接块不存在时，创建一个间接块。`ppdiskbno` 实际上是用来接收返回值的。

其中这个逻辑块号指的是在这个文件内部的第几个磁盘块。由于一个文件可以占多个磁盘块，而这些磁盘块并不一定在磁盘中连续，所以需要将**逻辑块号转为真实的磁盘块号**。

在前面【 [[#文件控制块（FCB）]] 】中讲过，可以通过**直接块和间接块**来由逻辑块号找到磁盘块号。所以需要让 `filebno` 与 `NDIRECT`（本实验中为 10）进行比较，选择不同的方法。

```C
int file_block_walk(struct File *f, u_int filebno, uint32_t **ppdiskbno, u_int alloc) {
    int r;
    uint32_t *ptr;
    uint32_t *blk;

    if (filebno < NDIRECT) {
        ptr = &f->f_direct[filebno];
    } else if (filebno < NINDIRECT) {
        if (f->f_indirect == 0) {
            if (alloc == 0) {
                return -E_NOT_FOUND;
            }

            if ((r = alloc_block()) < 0) {
                return r;
            }
            f->f_indirect = r;
            dirty_fcb(f);
        }

        if ((r = read_block(f->f_indirect, (void **)&blk, 0)) < 0) {
            return r;
        }
        ptr = blk + filebno;
    } else {
        return -E_INVAL;
    }

    *ppdiskbno = ptr;
    return 0;
}
```

其中 `dirty_fcb` 函数这里不再细讲，可以自行查看源码。

> **为什么 `read_block` 不会读到垃圾数据？**
> 
> 我当时在考虑，为什么在 `alloc_block` 之后，立刻就调用了 `read_block` 而不用先整理间接块内的数据。
> 
> 其实，回头查看这两个函数的具体实现【 [[#`alloc_block`：分配空闲块]] 】【 [[#`read_block`： 读取磁盘]] 】，就能发现，`alloc_block` 函数在分配空闲磁盘块后，会调用 `map_block` 函数为其对应的虚拟地址分配物理页面。
> 
> 而 `read_block` 函数则**不会**对**已经建立映射**的虚拟地址进行**读磁盘块**的操作的！
> 
> 所以这行只是针对以下情况才会真正读磁盘块：间接块存在，但没有读入内存。

### `file_map_block`：根据 FCB 中逻辑块号获得磁盘块号

实际上，上面 `file_block_walk` 只是这个函数实现的具体一步罢了。

```C
int file_map_block(struct File *f, u_int filebno, u_int *diskbno, u_int alloc) {
    int r;
    uint32_t *ptr;

    if ((r = file_block_walk(f, filebno, &ptr, alloc)) < 0) {
        return r;
    }

    if (*ptr == 0) {
        if (alloc == 0) {
            return -E_NOT_FOUND;
        }

        if ((r = alloc_block()) < 0) {
            return r;
        }
        *ptr = r;
    }

    *diskbno = *ptr;
    return 0;
}
```

### `file_get_block`：根据 FCB 中逻辑块号获得虚拟地址【!】

这个函数又是上面 `file_map_block` 的更高级的函数。

这个函数才是其他地方会经常调用的函数！因为：我们的一切用户读写操作都是基于用户空间的虚拟地址来的，获取磁盘块指针、磁盘块号什么的根本就不能直接拿来用！

```C
int file_get_block(struct File *f, u_int filebno, void **blk) {
    int r;
    u_int diskbno;
    u_int isnew;

    if ((r = file_map_block(f, filebno, &diskbno, 1)) < 0) {
        return r;
    }

    if ((r = read_block(diskbno, blk, &isnew)) < 0) {
        return r;
    }
    return 0;
}
```

## 释放磁盘块

### `file_clear_block`：释放文件中的某个块

这个函数的作用是将文件中的某个逻辑块实际意义上释放。

因此，我们需要的前置知识有：【 [[#辅助函数——空闲块相关]] 】、【 [[#辅助函数——根据 FCB 查找磁盘块]] 】。

```C
int file_clear_block(struct File *f, u_int filebno) {
    int r;
    uint32_t *ptr;

    if ((r = file_block_walk(f, filebno, &ptr, 0)) < 0) {
        return r;
    }

    if (*ptr) {
        free_block(*ptr);
        *ptr = 0;
    }

    return 0;
}
```

# 文件系统服务（文件管理服务进程）

这里仍然是 `fs/fs.c` 中的函数。之所以单独再划分出一章来整理，是因为我认为这些函数更加高级，更多地关注 FCB 的结构以及文件的路径，而更少地关注磁盘块。

> 当然，这只是我自己的划分方式，实际上差别并不大。

## 辅助函数——查找文件

### `dir_lookup`：在目录中查找文件

根据目录的 FCB 和文件名查找文件，返回文件的 FCB。

因此我们需要：由 FCB 得到磁盘块；遍历磁盘块寻找文件。

需要的前置知识有：【 [[#辅助函数——根据 FCB 查找磁盘块]] 】、【 [[#目录文件]] 】

```C
// Exercise 5.8
int dir_lookup(struct File *dir, char *name, struct File **file) {
    u_int nblock = dir->f_size / BLOCK_SIZE;

    for (int i = 0; i < nblock; i++) {
        void *blk;
        try(file_get_block(dir, i, &blk));

        struct File *files = (struct File *)blk;

        for (struct File *f = files; f < files + FILE2BLK; ++f) { // FILE2BLK即为一个磁盘块中文件的数量，即4096/256 = 16
            if (strcmp(name, f->f_name) == 0) {
                *file = f;
                // 一开始，f->f_dir为空，所以在查找时就顺便写进去
                f->f_dir = dir;
                return 0;
            }
        }
    }

    return -E_NOT_FOUND;
}
```

### `walk_path`：通过路径查找文件【!】

为了简化逻辑，我们实验中的 `path` 只有绝对路径，一定从根目录开始。

可获得的“返回值”有三个：

1.  `pdir`：目录的 FCB；
2. `pfile`：文件的 FCB；
3. `lastelem`：如果目录能找到，但是文件找不到时，文件的名字。

```C
int walk_path(char *path, struct File **pdir, struct File **pfile, char *lastelem) {
    char *p;
    char name[MAXNAMELEN];
    struct File *dir, *file;
    int r;

	// 一定从根目录开始。
    path = skip_slash(path); // 跳过斜杠
    file = &super->s_root;
    dir = 0;
    name[0] = 0;

    if (pdir) {
        *pdir = 0;
    }

    *pfile = 0;

    while (*path != '\0') {
        dir = file;
        p = path;

        while ( *path != '/' && *path != '\0') {
            path++;
        }

        if (path - p >= MAXNAMELEN) {
            return -E_BAD_PATH;
        }

        memcpy(name, p, path - p);
        name[path - p] = '\0';
        path = skip_slash(path);
        
        if (dir->f_type != FTYPE_DIR) {
            return -E_NOT_FOUND;
        }

        if ((r = dir_lookup(dir, name, &file)) < 0) {
            if (r == -E_NOT_FOUND && *path == '\0') {
                if (pdir) {
                    *pdir = dir;
                }

                if (lastelem) {
                    strcpy(lastelem, name);
                }

                *pfile = 0;
            }

            return r;
        }
    }

    if (pdir) {
        *pdir = dir;
    }

    *pfile = file;
    return 0;
}
```

## 辅助函数——分配新文件

### `dir_alloc_file`：分配新文件控制块

给定目录的 FCB，返回一个新的 FCB。

```C
int dir_alloc_file(struct File *dir, struct File **file) {
    int r;
    u_int nblock, i, j;
    void *blk;
    struct File *f;

    nblock = dir->f_size / BLOCK_SIZE;
	// 下面的写法其实和dir_lookup函数中的for循环写法是等价的
    for (i = 0; i < nblock; i++) {
        if ((r = file_get_block(dir, i, &blk)) < 0) {
            return r;
        }

        f = blk;
		
        for (j = 0; j < FILE2BLK; j++) {
            if (f[j].f_name[0] == '\0') { // 找一个空的FCB
                *file = &f[j];
                return 0;
            }
        }
    }

    dir->f_size += BLOCK_SIZE; // 需要加上一整个磁盘块
    dirty_fcb(dir);
    if ((r = file_get_block(dir, i, &blk)) < 0) {
        return r;
    }
    f = blk;
    *file = &f[0];

    return 0;
}
```

## 打开文件

需要的前置知识：【 [[#辅助函数——查找文件]] 】

### `file_open`：根据路径获取文件 FCB

实际上是微缩版的 `walk_path`。不需要获取其目录的 FCB 什么的。

```C
int file_open(char *path, struct File **file) {
    return walk_path(path, 0, file, 0);
}
```

## 创建文件

需要的前置知识：【 [[#辅助函数——分配新文件]] 】、【 [[#辅助函数——查找文件]] 】

### `file_create`：创建对应路径下的新文件

给的参数为路径即可。这个路径是带有文件名的，而这个文件名应该不存在才对。

```C
int file_create(char *path, struct File **file) {
    char name[MAXNAMELEN];
    int r;
    struct File *dir, *f;

    if ((r = walk_path(path, &dir, &f, name)) == 0) {
        return -E_FILE_EXISTS;
    }

    if (r != -E_NOT_FOUND || dir == 0) {
        return r;
    }

    if (dir_alloc_file(dir, &f) < 0) {
        return r;
    }

    strcpy(f->f_name, name);
    f->f_size = 0;
    f->f_type = FTYPE_REG;
    for (int i = 0; i < NDIRECT; i++) {
        f->f_direct[i] = 0;
    }
    f->f_indirect = 0;
    f->f_dir = dir;

    dirty_fcb(f);
    if (f->f_dir) {
        file_flush(f->f_dir);
    }
    *file = f;
    return 0;
}
```

其中 `file_flush` 函数这里不再细讲，作用是将文件中的脏块全部写回磁盘。

## 调整文件大小

由于缩小文件大小时会有多余的磁盘块需要释放，因此需要前置知识：【 [[#释放磁盘块]] 】

### `file_truncate`：根据 FCB 缩小文件大小

参数有：文件的 FCB、需要调整到的新大小。

```C
void file_truncate(struct File *f, u_int newsize) {
    u_int bno, old_nblocks, new_nblocks;

    old_nblocks = ROUND(f->f_size, BLOCK_SIZE) / BLOCK_SIZE;
    new_nblocks = ROUND(newsize, BLOCK_SIZE) / BLOCK_SIZE;

    if (newsize == 0) {
        new_nblocks = 0;
    }

    if (new_nblocks <= NDIRECT) {
        for (bno = new_nblocks; bno < old_nblocks; bno++) {
            panic_on(file_clear_block(f, bno));
        }
        if (f->f_indirect) {
            free_block(f->f_indirect);
            f->f_indirect = 0;
        }
    } else {
        for (bno = new_nblocks; bno < old_nblocks; bno++) {
            panic_on(file_clear_block(f, bno));
        }
    }
    f->f_size = newsize;
    dirty_fcb(f);
}
```

### `file_set_size`：根据 FCB 调整文件大小

由于文件的扩大非常简单，只需调整 `f->f_size` 这一个字段就够了，所以无需单独写一个扩大的函数。将扩大和缩小合在一起就形成了这个函数。

```C
int file_set_size(struct File *f, u_int newsize) {
    if (f->f_size > newsize) {
        file_truncate(f, newsize);
    } else {
        f->f_size = newsize;
        dirty_fcb(f);
    }

    return 0;
}
```

## 关闭文件

### `file_close`：根据 FCB 关闭文件

先将脏块全部写回磁盘，然后取消虚拟地址到磁盘块的映射。

因此前置知识包括：【 [[#`file_get_block`：根据 FCB 中逻辑块号获得虚拟地址【!】]] 】、【 [[#`unmap_block`：解除映射]] 】。

```C
void file_close(struct File *f) {
    file_flush(f);
    
    if (f->f_type == FTYPE_REG) {	// 其实目录文件也应该写回，但是我们实验代码有bug
        u_int nblock = (f->f_size + BLOCK_SIZE - 1) / BLOCK_SIZE;
        
        for (int i = 0; i < nblock; i++) {
            u_int diskbno;
            
            if (file_map_block(f, i, &diskbno, 0) < 0) {
                debugf("file_close: file_map_block failed\n");
                break;
            }
            
            unmap_block(diskbno);
        }
    }
}
```

## 删除文件

### `file_remove`：根据路径删除文件

这个函数的参数是文件的路径。因此需要前置知识【 [[#`walk_path`：通过路径查找文件【!】]] 】；

删除文件的部分底层逻辑是让文件的大小改为 0，因此需要前置知识【 [[#`file_truncate`：根据 FCB 缩小文件大小]] 】。

```C
int file_remove(char *path) {
    int r;
    struct File *f;

    if ((r = walk_path(path, 0, &f, 0)) < 0) {
        return r;
    }

    file_truncate(f, 0);
    f->f_name[0] = '\0';

    dirty_fcb(f);
    if (f->f_dir) {
        file_flush(f->f_dir);
    }

    return 0;
}
```

# 进程通信

## 相关数据结构

### 打开的文件信息

定义在 `fs/serv.c` 中：

```C
struct Open {
    struct File *o_file;      // 指向需要打开的文件的FCB
    u_int o_fileid;           // 文件ID（在opentab中的索引）
    int o_mode;               // 打开模式（O_RDONLY, O_WRONLY等）
    struct Filefd *o_ff;      // 指向Filefd结构的指针
};

struct Open opentab[MAXOPEN];	// 共1024个Open结构体可被分配
```

实际上，每个 `Open` 结构体和其对应的 `Filefd` 结构体（即 `o_ff` 字段）是线性对应的，在后续小节【 [[#`serve_init`：初始化文件服务]] 】会分析源码。

`opentab` 叫做**打开文件表**。

### 文件状态信息

定义在 `user/include/fd.h` 中：

```C
struct Fd {
	u_int fd_dev_id;
	u_int fd_offset;
	u_int fd_omode;
};

struct Filefd {
	struct Fd f_fd;
	u_int f_fileid;
	struct File f_file;
};
```

也就是说实际上 `Filefd` 这个结构体总共有 5 个字段。

1. `f_fd.fd_dev_id`：这个字段固定为字符 `f`。这里先不管。
2. `f_fd.fd_offset`：由于每个文件都需要通过指针来读取里面的内容，这个字段用于存储**指针**在文件中的**位置**。
3. `f_fd.fd_omode`：**打开模式**，这里应该要和 `Open` 中的 `o_mode` 字段保持一致。
4. `f_fileid`：**文件 ID**，也应该和 `Open` 中的 `o_fileid` 保持一致。
5. `f_file`：**文件的 FCB**。注意！这里不是 FCB 的指针，而是 FCB 的**副本**！因此不是和 `Open` 的 `o_file` 字段一致，而是和 `o_file` 指向的 FCB 的**内容一致**，但不是同一个东西。

所以可以看到这个结构体有很多副本，一定要小心副本和本体的一致性。

> `Filefd` 是 `Fd` 的一种扩展关系，或说是“继承”关系。
> 
> 在 Lab 6 中，会有管道、Console 这两种设备，也会有对应的结构体继承 `Fd`。此时 `fd_dev_id` 的作用就体现出来了：其实就是标识设备类型。
> 
> 这会在什么时候用到呢？假如你要把一个 `struct Fd *` 类型的指针强制类型转换为 `struct Filefd *` 类型，就需要检查 `fd_dev_id` 字段是否是 `f`，如果不是则不允许转换，以免造成错误。

## 接收请求（文件管理服务进程）

在 `fs/serv.c` 的末尾有一个 `main` 函数，其实就是通过 `main` 函数建立起服务的。

```C
int main() {
    user_assert(sizeof(struct File) == FILE_STRUCT_SIZE);
  
    debugf("FS is running\n");
  
    serve_init();
    fs_init();
  
    serve();
    return 0;
}
```

我们按顺序看：

### `serve_init`：初始化文件服务

根据 `Open` 与 `Fileid` 的线性对应关系，从基地址 `FILEVA` 开始为**打开文件表**分配虚拟地址。

```C
void serve_init(void) {
    int i;
    u_int va = FILEVA;

    for (i = 0; i < MAXOPEN; i++) {
        opentab[i].o_fileid = i;
        opentab[i].o_ff = (struct Filefd *)va;
        va += BLOCK_SIZE;
    }
}
```

### `fs_init`：初始化文件系统

将超级块、位图块读入内存。具体实现不再赘述，可以自行在 `fs/fs.c` 中查看。

```C
void fs_init(void) {
    read_super();
    check_write_block();
    read_bitmap();
}
```

### `serve`：接收请求并分配服务

首先我们需要知道可以请求的**服务类型**有哪些。这个和系统调用的分发表是极度类似的，而且同样可以扩展，因此题目往往从这里入手，新添服务。

```C
void *serve_table[MAX_FSREQNO] = {
    [FSREQ_OPEN] = serve_open,
    [FSREQ_MAP] = serve_map,
    [FSREQ_SET_SIZE] = serve_set_size,
    [FSREQ_CLOSE] = serve_close,
    [FSREQ_DIRTY] = serve_dirty,
    [FSREQ_REMOVE] = serve_remove,
    [FSREQ_SYNC] = serve_sync,
};
```

系统将通过用户进程发送的 IPC 获取请求的服务类型，然后再根据这个服务类型跳转到对应的函数进行执行。具体代码如下：

```C
void serve(void) {
    u_int req, whom, perm;
    void (*func)(u_int, u_int);

    for (;;) {	// 死循环以不断尝试接收IPC
        perm = 0;
        req = ipc_recv(&whom, (void *)REQVA, &perm); // req获得请求类型

        if (!(perm & PTE_V)) { // 无效则跳过
            debugf("Invalid request from %08x: no argument page\n", whom);
            continue;
        }

        if (req < 0 || req >= MAX_FSREQNO) { // 请求类型无效则跳过
            debugf("Invalid request code %d from %08x\n", req, whom);
            panic_on(syscall_mem_unmap(0, (void *)REQVA));
            continue;
        }

        func = serve_table[req];
        func(whom, REQVA);

        panic_on(syscall_mem_unmap(0, (void *)REQVA));
    }
}
```

## 发送请求（用户进程）

### 概览

在 `user/lib/fsipc.c` 中，有一系列发送请求的函数，命名统一为 `fsipc_xxx`。

共性部分用伪代码表示：

```C
int fsipc_xxx(auto au, ......) {
	struct Fsreq_xxx *req;
	req = (struct Fsreq_xxx *)fsipcbuf;
	req->xx = xx;	// 写入某些字段……
	req->yy = yy;	// 写入某些字段……
	return fsipc(FSREQ_XXX, req, x, y);
}
```

其中，`Fsreq_xxx` 是一种数据结构，不同的请求数据结构自然不同。也就是说，将请求时需要发送的参数通过结构体包裹起来，以方便发给**文件管理服务进程**。

既然不同的请求数据结构不同，所以要将共同的模板 `fsipcbuf` 转换为对应的结构体指针类型。

> 这个模板其实相当于就是一张白纸，先给你分配了一张纸，你才能随意填写你想写的信息。
> 
> 实际上，这张纸的大小为一个页（`PAGE_SIZE`）。

### `fsipc`：发送请求

先来看一下参数：

1. `type`：**请求类型**。
2. `fsreq`：**发送的数据**。即上面讲到的对应的结构体。
3. `dstva`：如果文件管理服务进程将返回一个页面，告诉它要与**哪个虚拟地址**建立映射。（如果不会返回一个页面，这个参数直接传 0 即可）。

`perm` 实际上是返回值。

```C
static int fsipc(u_int type, void *fsreq, void *dstva, u_int *perm) {
    u_int whom;
    ipc_send(envs[1].env_id, type, fsreq, PTE_D);	// 发送请求
    return ipc_recv(&whom, dstva, perm);	// 接收返回的消息
}
```

【待完善：具体的请求函数】

## 服务并返回消息（文件管理服务进程）

### 概览

又回到 `fs/serv.c`（因为又回到文件管理服务进程了），里面很多 `serv_xxx` 命名的函数。

这些函数将调用【 [[#磁盘操作（文件管理服务进程）]] 】、【 [[#文件系统服务（文件管理服务进程）]] 】中讲的函数进行真正的服务操作，然后通过 `ipc_send` 返回用户进程所需要的数据。

【待完善：具体的服务函数】

# 用户程序接口

接口装在了两个文件中：`user/lib/fd.c`、`user/lib/file.c`。

分成不同文件的意义在于：我们总共有三个资源（设备）：文件、控制台、管道。这三者都可以调用的接口放在 `fd.c` 中，而只能由文件调用的接口放在 `file.c` 中。

因此，实质上两个文件的接口没有层级区别，都是平等的，且是最高级的接口。即使这些接口之间也有互相调用的地方，但都是可以在正常编写程序的时候**直接使用的、封装完整的**函数。

## 概览

这些函数最后都会 `return fsipc_xxx()`。