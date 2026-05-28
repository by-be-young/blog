---
type: 概要笔记
series: 操作系统
excerpt: 2421操作系统Lab5课下实验实验报告
order: "6"
chapter: 4-实验报告
---
# 思考题

## Thinking 5.1

> 如果通过 `kseg0` 读写设备，那么对于设备的写入会缓存到 Cache 中。这是一种错误的行为，在实际编写代码的时候这么做会引发不可预知的问题。
> 
> 请思考：这么做这会引发什么问题？对于不同种类的设备（如我们提到的串口设备和 IDE 磁盘）的操作会有差异吗？可以从缓存的性质和缓存更新的策略来考虑。

Cache 的写回策略可能会导致对设备的写入不会立即发生，甚至可能将多次写入合并为一次。很多设备需要按特定顺序、特定时序操作硬件，是绝对不能通过 Cache 缓存的。

对于串口，读写十分频繁，数据被 Cache 缓存很有可能造成死锁等情况，错误概率极高。而对于 IDE 磁盘，更多是数据块的传输，命令的时序不容易造成错误，错误概率稍低。

## Thinking 5.2

> 查找代码中的相关定义，试回答一个磁盘块中最多能存储多少个文件控制块？一个目录下最多能有多少个文件？我们的文件系统支持的单个文件最大为多大？

一个磁盘块的大小为 4 KB，一个 FCB 的大小为 256 B，因此一个磁盘块最多能存储 16 个 FCB。

一个目录占一个磁盘块（4 KB），每个目录项存储的是磁盘块号（4 B 的整型），因此一个目录下最多能有 1024 个目录项。一个目录项有 16 个 FCB，所以一个目录下最多能有 16 K 个文件。

直接块有 10 个，间接块有 1024 个，但间接块的前 10 个留空，所以一个 FCB 可以指向 1024 个磁盘块。一个磁盘块大小为 4 KB，所以单个文件最大为 1024 MB。

## Thinking 5.3

> 请思考，在满足磁盘块缓存的设计的前提下，我们实验使用的内核支持的最大磁盘大小是多少？

由于将 `DISKMAP ~ DISKMAP+DISKMAX` 这一段虚存地址空间作为缓冲区， ` DISKMAX = 0x40000000 ` ，因此最多处理 1 GB 的大小。

## Thinking 5.4

> 在本实验中， `fs/serv.h`、 `user/include/fs.h` 等文件中出现了许多宏定义，试列举你认为较为重要的宏定义，同时进行解释，并描述其主要应用之处。

```C
#define PTE_DIRTY 0x0004
```

最重要的应该是脏位这个软件控制位，在文件管理服务进程中，很多地方都需要注意虚拟地址对应的物理页是否脏，以方便写回磁盘。

 `fs.h` 中很多宏定义的是磁盘块和 FCB 相关的大小。如磁盘块大小就是一个页的大小、FCB 为 256 B 等等，都很关键。

## Thinking 5.5

> 在 Lab4“系统调用与 fork”的实验中我们实现了极为重要的 fork 函数。那么 fork 前后的父子进程是否会共享文件描述符和定位指针呢？请在完成上述练习的基础上编写一个程序进行验证。

Fork 前后的父子进程共享文件描述符和定位指针。

```C
#include "lib.h"

static char *msg = "This is the NEW message of the day!\n\n";
static char *diff_msg = "This is a different massage of the day!\n\n";

void umain()
{
        int r;
        int fdnum;
        char buf[512];
        int n;

        if ((r = open("/newmotd", O_RDWR)) < 0) {
            user_panic("open /newmotd: %d", r);
        }
        fdnum = r;
        writef("open is good\n");

        if ((n = read(fdnum, buf, 511)) < 0) {
            user_panic("read /newmotd: %d", r);
        }
        if (strcmp(buf, diff_msg) != 0) {
            user_panic("read returned wrong data");
        }
        writef("read is good\n");

        int id;

        if ((id = fork()) == 0) {
            if ((n = read(fdnum, buf, 511)) < 0) {
                user_panic("child read /newmotd: %d", r);
            }
            if (strcmp(buf, diff_msg) != 0) {
                user_panic("child read returned wrong data");
            }
            writef("child read is good && child_fd == %d\n",r);
            struct Fd *fdd;
            fd_lookup(r,&fdd);
            writef("child_fd's offset == %d\n",fdd->fd_offset);
        }
        else {
            if((n = read(fdnum, buf, 511)) < 0) {
                user_panic("father read /newmotd: %d", r);
            }
            if (strcmp(buf, diff_msg) != 0) {
                user_panic("father read returned wrong data");
            }
            writef("father read is good && father_fd == %d\n",r);
            struct Fd *fdd;
            fd_lookup(r,&fdd);
            writef("father_fd's offset == %d\n",fdd->fd_offset);
        }
}
```

关键运行结果：

```text
father read is good && father_fd == 0
father_fd's offset == 41

child read is good && child_fd == 0
child_fd's offset == 41
```

## Thinking 5.6

> 请解释 File, Fd, Filefd 结构体及其各个域的作用。比如各个结构体会在哪些过程中被使用，是否对应磁盘上的物理实体还是单纯的内存数据等。说明形式自定，要求简洁明了，可大致勾勒出文件系统数据结构与物理实体的对应关系与设计框架。

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

实际上 `Filefd` 这个结构体总共有 5 个字段。

1. `f_fd.fd_dev_id`：这个字段固定为字符 `f`。这里先不管。
2. `f_fd.fd_offset`：由于每个文件都需要通过指针来读取里面的内容，这个字段用于存储**指针**在文件中的**位置**。
3. `f_fd.fd_omode`：**打开模式**，这里应该要和 `Open` 中的 `o_mode` 字段保持一致。
4. `f_fileid`：**文件 ID**，也应该和 `Open` 中的 `o_fileid` 保持一致。
5. `f_file`：**文件的 FCB**。注意！这里不是 FCB 的指针，而是 FCB 的**副本**！因此不是和 `Open` 的 `o_file` 字段一致，而是和 `o_file` 指向的 FCB 的**内容一致**，但不是同一个东西。

## Thinking 5.7

> 下图（文件系统服务时序图）中有多种不同形式的箭头，请解释这些不同箭头的差别，并思考我们的操作系统是如何实现对应类型的进程间通信的。

![[文件系统服务时序图.png]]

`ENV_CREATE(user_env)` 和 `ENV_CREATE(fs_serv)` 都是异步消息，由 `init()` 发出创建消息后， `init()` 函数即可返回执行后续步骤，由 `fs` 和 `user` 线程执行自己的初始化工作。

`fs` 线程初始化 `serv_init()` 和 `fs_init()` 完成后，进入 `serv()` 函数，被  `ipc_receive()` 阻塞为 `ENV_NOT_RUNNABLE` ，直到收到 `user` 线程的 `ipc_send(fsreq)` 被唤醒。

`user` 线程向  `fs` 线程 `ipc_send(fsreq)` 发送请求为同步消息，发送后自身进入阻塞，等待被唤醒的 `fs` 线程服务结束时 `ipc_send(dst_va)` ,用户线程接收到数据后继续运行，此后  `fs` 线程进入阻塞，等待下次被用户唤醒。

# 难点分析

## 新增大量文件

本次实验相比前几次实验增加了大量的代码文件，需要留出大量的时间阅读。

同时，由于新增了很多数据结构和宏定义，很容易在阅读代码的时候遇到障碍。

好在跳板机与 VScode 的连接恢复了正常，可以更加方便地跳转查看宏定义，并对比阅读多个文件。

## 函数调用链

本次实验的函数调用链极长，甚至很多顶层函数会调用十几层函数，非常难以从顶层函数开始阅读，但从底层函数阅读的话又容易不知道函数的意义在哪。

因此本次实验对于代码的阅读功底和整理能力提出了更高的要求。强烈建议看 Kamonto 助教的讲解视频！

# 实验体会

## 实验跳板机的合理使用

本次实验以 extra 的满分完美收官了线下上机的历程。我认为除了助教的贴心 hint 之外，我也终于是真正会使用跳板机了！（哎，为什么最后一次上机才搞会）

注意跳板机多开窗口，每个窗口打开一个文件，写完之后只用 `w` 保存却不用 `q` 退出，这样切换文件真的很方便！（我怎么现在才发现！）

至于为什么这个实验这么重要，是因为这次实验涉及了太多文件了！一整个调用链经过了极多的文件，如果要找 bug，用 vim 打开文件实在是过于浪费时间了。

# 原创说明

本实验报告部分参考了[杨导的博客](https://yanna-zy.github.io/2023/05/19/BUAA-OS-5/)