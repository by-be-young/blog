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
    uint32_t s_nblocks; // 磁盘块总数，其实就是1024，写死（硬编码）也没问题
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

# 磁盘操作

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
> 如果不记得了，后面【 [[#辅助函数——页面是否被写过]] 】一节会细讲。

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

解除映射的相关辅助函数见下节【 [[#辅助函数——映射相关]] 】。

> 写回位图到磁盘中时，计算了 `blockno` 所在的磁盘块号。
> 
> 但其实，由于 `blockno` 最大才 1024，而 `BLOCK_SIZE_BIT` 为 `4096 * 8`，所以 `blockno / BLOCK_SIZE_BIT` 必定为 0。
> 
> 而前两个块（0 号块和 1 号块）是 Boot 块和 Super 块，所以需要加 2。

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

## 辅助函数——页面是否被写过

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

## 写回（换出）磁盘

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