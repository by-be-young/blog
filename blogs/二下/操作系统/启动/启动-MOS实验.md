# 实验环境的简化

我们实验中，编写代码的环境是 Linux，硬件仿真平台是 QEMU 模拟器。

QEMU 模拟器能够模拟实验中所要用到的各种硬件资源，可以直接加载 ELF 文件格式的内核。也就是说，我们要把内核视为一个文件，然后进行编译、链接等，然后运行出的程序就是内核。

# 内核的入口

## 内核入口的设置

既然知道了内核本质上就是一个文件，那么就需要通过链接脚本（Linker Script）来找到内核的入口了。

在根目录下，找到文件 `kernel.lds`，我们一步步拆解：

```lds
OUTPUT_ARCH(mips)

ENTRY(_start)
```

首先明确了文件采用的指令集是 MIPS，然后指明程序的入口函数名为 `_start`。也就是说，整个内核是从这个函数开始的。

```lds
// Exercise 1.2
SECTIONS {
    . = 0x80010000;

    .text : { *(.text) }
    .data : { *(.data) }
    bss_start = .;
    .bss : { *(.bss) }
    bss_end = .;

    . = 0x80400000;
    end = . ;
}
```

这一部分则是规定了程序的各个段应该存储在地址空间的哪一块。如何知道正确的地址在哪呢？

## 内存的空间布局

实际上，地址的布局是人为规定好的。可以打开文件 `include/mmu.h`，里面画了一张图，这就是用来告诉你内存应该怎么布局。

```C
/*
 o     4G ----------->  +----------------------------+------------0x100000000
 o                      |       ...                  |  kseg2
 o      KSEG2    -----> +----------------------------+------------0xc000 0000
 o                      |          Devices           |  kseg1
 o      KSEG1    -----> +----------------------------+------------0xa000 0000
 o                      |      Invalid Memory        |   /|\
 o                      +----------------------------+----|-------Physical Memory Max
 o                      |       ...                  |  kseg0
 o      KSTACKTOP-----> +----------------------------+----|-------0x8040 0000-------end
 o                      |       Kernel Stack         |    | KSTKSIZE            /|\
 o                      +----------------------------+----|------                |
 o                      |       Kernel Text          |    |                    PDMAP
 o      KERNBASE -----> +----------------------------+----|-------0x8001 0000    |
 o                      |      Exception Entry       |   \|/                    \|/
 o      ULIM     -----> +----------------------------+------------0x8000 0000-------
 o                      |         User VPT           |     PDMAP                /|\
 o      UVPT     -----> +----------------------------+------------0x7fc0 0000    |
 o                      |           pages            |     PDMAP                 |
 o      UPAGES   -----> +----------------------------+------------0x7f80 0000    |
 o                      |           envs             |     PDMAP                 |
 o  UTOP,UENVS   -----> +----------------------------+------------0x7f40 0000    |
 o  UXSTACKTOP -/       |     user exception stack   |     BY2PG                 |
 o                      +----------------------------+------------0x7f3f f000    |
 o                      |                            |     BY2PG                 |
 o      USTACKTOP ----> +----------------------------+------------0x7f3f e000    |
 o                      |     normal user stack      |     BY2PG                 |
 o                      +----------------------------+------------0x7f3f d000    |
 a                      |                            |                           |
 a                      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~                           |
 a                      .                            .                           |
 a                      .                            .                         kuseg
 a                      .                            .                           |
 a                      |~~~~~~~~~~~~~~~~~~~~~~~~~~~~|                           |
 a                      |                            |                           |
 o       UTEXT   -----> +----------------------------+------------0x0040 0000    |
 o                      |      reserved for COW      |     BY2PG                 |
 o       UCOW    -----> +----------------------------+------------0x003f f000    |
 o                      |   reversed for temporary   |     BY2PG                 |
 o       UTEMP   -----> +----------------------------+------------0x003f e000    |
 o                      |       invalid memory       |                          \|/
 a     0 ------------>  +----------------------------+ ----------------------------
 o
*/
```

其他的暂时不用看，我们先关心 `.text`、`.data`、`.bss` 应该放在哪个位置即可。根据理论知识，我们知道，这三个程序段必须放在 `kseg0` 中。

具体来看，从 `0x80000000` 到 `0x80001000` 的部分（`Exception Entry`）需要留给异常处理，所以不能放；而上面的 `Kernel Stack` 区域需要临时存放进程所需要的数据，故也不能放。

其实，最合适的地方已经标出来了，就是 `Kernel Text` 区域。因此，程序中的 `. = 0x80010000;` 就是规定数据放在这里。

> 实际上，我当时将这一行代码写成了 `. = 0x80020000;`，没有对后续实验产生任何影响，还是在学期结束的时候整理这篇博客才发现。
> 
> 原因是，这些数据并没有很多，即使 `0x80001000` 到 `0x80002000` 之间的空间被浪费了，空间依旧够用。
> 
> 另外，`KSTACKTOP`（栈顶）以上的区域，是预留出的安全缓冲区。因为栈是从栈顶向下压的，如果 `Kernel Stack` 中的数据过多，可能会侵占到 `Kernel Text` 区域（代码中的 `KSTKSIZE` 也没被定义成常量来限制大小）。为了防止这种问题，更多的数据可能会被存放到栈顶以上。（我没有看代码中到底有没有实现这个功能）

链接脚本的最后还有一行 `. = 0x80400000;`，这其实就是将程序的位置定位到栈顶，这样就能开始真正运行程序了。

# 初始化内核

## 准备工作

我们通过链接脚本得知了入口函数的名字 `_start`，但是函数实际上在哪呢？打开文件 `init/start.S`：

```asm
.text // 表示以下内容是可执行的汇编指令
EXPORT(_start)	// 设置为全局符号以让链接器可见
.set at	// 表示允许汇编器使用at寄存器
.set reorder	// 表示允许汇编器进行指令重排优化
	la      v0, bss_start
	la      v1, bss_end
clear_bss_loop:
	beq     v0, v1, clear_bss_done
	sb      zero, 0(v0)
	addiu   v0, v0, 1
	j       clear_bss_loop
```

带注释的东西看看就行，并不重要。

大致流程可以归纳为：通过链接脚本告诉的 `bss_start` 和 `bss_end` 的值，为整个 `.bss` 段进行清零处理（清零处理的原因在理论部分已经讲过了）。清理完成后，跳转到 `clear_bss_done`。

> 前几年的老版代码中，链接脚本没有为 `bss_start` 和 `bss_end` 赋值，在 `_start` 函数中也没有清零 `.bss`。这与理论知识明显不符。因此，现在的代码非常合理地加上了这些。

现在再看初始完之后应该去哪：

```asm
clear_bss_done:
	mtc0    zero, CP0_STATUS	// 禁止中断
	la	sp, 0x80400000
	j	mips_init
```

我们在计组中学过 `sp` 寄存器存的是栈帧的指针。所以在一开始时，需要初始化为栈顶的地址。所以这里给 `sp` 赋值为了栈顶的地址，写 `la sp, KSTKTOP` 也是等价的，因为 `include/mmu.h` 中 define 了这个常量。

> 注意这里不能使用 `lui`、`li` 之类的指令赋值，因为 `0x80000000` 的数字太大了，超出了立即数能表示的范围。

准备工作初始化完毕之后，就正式跳转到 `mips_init` 函数了！我们可以真正开始运行内核了！

> 这里直接用 `j` 指令而不用 `jal` 指令，因为 `mips_init` 函数根本不会返回。

## 开始运行

这个函数是一个 C 语言函数，在 `init/init.c` 中：

```C
void mips_init(u_int argc, char **argv, char **penv, u_int ram_low_size) {
	printk("init.c:\tmips_init() is called\n");
	halt();	// 停止CPU继续执行指令，原理是退出模拟器或备用方案死循环
}
```

`printk` 函数就是我们内核的第一个函数了，这并不是哪个库函数，而是自己真正编写的函数（下一小节会讲）。也就是说，我们到这里已经可以自己写任何内核代码了！恭喜 ！

同时，这也告诉我们，后面各个 Lab 的最高层函数都应该是在这里被调用，每个 Lab 都可以从这里自顶向下来纵观鸟瞰了。

# 第一个函数 printk

在 `kern/printk.c` 中有该函数的定义，来看看：

```C
void printk(const char *fmt, ...) {
	va_list ap;
	va_start(ap, fmt);
	vprintfmt(outputk, NULL, fmt, ap);
	va_end(ap);
}
```

显而易见，这个函数必须是个有**变长参数**的函数。`va_list ap;` 就是变长参数列表。`va_start` 和 `va_end` 是用来初始化和结束变长参数列表的宏。这些对我们来说不重要。

核心函数是 `vprintfmt`。看看这个的声明（`lib/print.c`）：

```C
void vprintfmt(fmt_callback_t out, void *data, const char *fmt, va_list ap);
```

第一个参数是一个回调函数，也就是把函数作为参数。也就是说这个函数还会用到 `outputk` 这个函数。这个函数的定义同样在 `kern/printk.c` 中，这里就不看了，就是输出字符串。

现在仔细看定义：

```C
// Exercise 1.4
void vprintfmt(fmt_callback_t out, void *data, const char *fmt, va_list ap) {
    char c;
    const char *s;
    long num;
    int width;		// 标记输出的宽度
    int long_flag;	// 标记输出是否为long型而非int
    int neg_flag;	// 标记输出是否为负数
    int ladjust;	// 标记输出是否要左对齐
    char padc;		// 填充空白位置的字符

    for (;;) {
    	// 输出模板外的字符
        while (*fmt != '%' && *fmt != '\0') {
            out(data, fmt, 1);
            fmt++;
        }

        if (*fmt == '\0') {
            break;
        }

        fmt++;

        ladjust = 0;
        padc = ' ';
        if (*fmt == '-') {
            ladjust = 1;
            fmt++;
        }
        if (*fmt == '0') {
            padc = '0';
            fmt++;
        }

        width = 0;
        while (*fmt >= '0' && *fmt <= '9') {
            width = width * 10 + (*fmt - '0');
            fmt++;
        }

        long_flag = 0;
        if (*fmt == 'l') {
            long_flag = 1;
            fmt++;
        }

        neg_flag = 0;
        switch (*fmt) {
        case 'b':
            if (long_flag) {
                num = va_arg(ap, long int);	// 这也是处理可变参数的宏，表示获取下一个参数
            } else {
                num = va_arg(ap, int);
            }
            print_num(out, data, num, 2, 0, width, ladjust, padc, 0);
            break;

        case 'd':
        case 'D':
            if (long_flag) {
                num = va_arg(ap, long int);
            } else {
                num = va_arg(ap, int);
            }
            if (num < 0) {
                neg_flag = 1;
                num = -num;
            } else {
                neg_flag = 0;
            }
            print_num(out, data, num, 10, neg_flag, width, ladjust, padc, 0);
            break;

        case 'o':
        case 'O':
            if (long_flag) {
                num = va_arg(ap, long int);
            } else {
                num = va_arg(ap, int);
            }
            print_num(out, data, num, 8, 0, width, ladjust, padc, 0);
            break;

        case 'u':
        case 'U':
            if (long_flag) {
                num = va_arg(ap, long int);
            } else {
                num = va_arg(ap, int);
            }
            print_num(out, data, num, 10, 0, width, ladjust, padc, 0);
            break;

        case 'x':
            if (long_flag) {
                num = va_arg(ap, long int);
            } else {
                num = va_arg(ap, int);
            }
            print_num(out, data, num, 16, 0, width, ladjust, padc, 0);
            break;

        case 'X':
            if (long_flag) {
                num = va_arg(ap, long int);
            } else {
                num = va_arg(ap, int);
            }
            print_num(out, data, num, 16, 0, width, ladjust, padc, 1);
            break;

        case 'c':
            c = (char)va_arg(ap, int);
            print_char(out, data, c, width, ladjust);
            break;

        case 's':
            s = (char *)va_arg(ap, char *);
            print_str(out, data, s, width, ladjust);
            break;

        case '\0':
            fmt--;
            break;

        default:
            out(data, fmt, 1);
        }
        fmt++;
    }
}
```

其中指导书上详细定义了 `fmt` 字符串所有的格式要求，这里简单归纳就是：

```text
%[flags][width][length]<specifier>
```

`flags` 共三种情况：`-`、`0` 或没有。`-` 表示左对齐，`0` 表示用 0 填充空白；

`width` 只可能出现数字；

`length` 只有两种情况： `l` 或没有。

具体实现这里就不细讲了，应该很好看懂。