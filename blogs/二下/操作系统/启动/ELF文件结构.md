---
type: 系统笔记
excerpt: ELF文件结构概述、Linker Script的作用及内容、Lab1实验相关
recommended: true
---
# 概述

## ELF 是什么

ELF (Executable and Linkable Format)，顾名思义是一种文件格式，且既可以运行，也可以链接。

ELF 是 Linux 系统常用的**目标文件、可执行文件、共享库**的标准格式。

# ELF 文件基本结构

## ELF 头 

(ELF Header)

#### 描述文件类型、架构、入口点、程序头表/节头表的位置和大小。

ELF 头的内容其实可以看作一个结构体，对应的字段位置存放的编码就是该字段的值。

以下是 ELF 头中各个字段及其含义：

| 字段            | 含义                                                                              |
| ------------- | ------------------------------------------------------------------------------- |
| `e_ident`     | 魔数（0x7F, 'E', 'L', 'F'）及平台信息（大小端、版本等）。<br><br>这个魔数是固定的这四个字节，用于标识这是一个有效的 ELF 文件。 |
| `e_type`      | 文件类型：可重定位文件、可执行文件、共享库等。                                                         |
| `e_machine`   | 目标指令集架构（如 MIPS、x86、ARM）。                                                        |
| `e_version`   | ELF 版本号。我们一般不用关注这个。                                                             |
| `e_entry`     | 程序入口点的虚拟地址。<br><br>PC 寄存器会初始存放这个地址，程序执行时会根据这个地址取指。                              |
| `e_phoff`     | Program Header Table 在文件中的偏移（字节）。<br><br>后续会说明段头表的具体内容。                         |
| `e_shoff`     | Section Header Table 在文件中的偏移。<br><br>后续会说明节头表的具体内容。                             |
| `e_flags`     | 处理器相关标志。我们一般不用关注这个。                                                             |
| `e_ehsize`    | ELF Header 自身的大小。                                                               |
| `e_phentsize` | 每个 Program Header 表项的大小。                                                        |
| `e_phnum`     | Program Header 表项的数量。                                                           |
| `e_shentsize` | 每个 Section Header 表项的大小。                                                        |
| `e_shnum`     | Section Header 表项的数量。                                                           |
| `e_shstrndx`  | 节名字符串表所在节的索引。<br><br>后续在节头表中会说明作用。                                              |
## 段头表（也称程序头表）

描述如何将文件内容映射到内存（**用于加载、执行**）。

以下是每个**表项**的结构体。注意，不是整个表的结构体。整个表相当于表项结构体的数组。

| 字段         | 含义                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------- |
| `p_type`   | 段类型（如 PT_LOAD 表示可加载段）。我们一般不用关注这个。                                                                   |
| `p_offset` | 段在文件中的偏移。                                                                                           |
| `p_vaddr`  | 段在内存中的虚拟地址。                                                                                         |
| `p_paddr`  | 物理地址（Linux 中通常忽略，等于 p_vaddr）。<br><br>这是因为具有 MMU 的系统，物理地址会通过虚拟地址查找到。<br><br>物理地址只在嵌入式等没有 MMU 的系统中有用。 |
| `p_filesz` | 段在文件中的大小。                                                                                           |
| `p_memsz`  | 段在内存中的大小（可能大于 p_filesz，如 .bss）。<br><br>特别强调，.bss 段是未初始化的全局变量等，文件中不用存放其值，但在内存中需要留出空间。                |
| `p_flags`  | 段属性（可读、可写、可执行）。                                                                                     |
| `p_align`  | 段的对齐方式（必须是 2 的幂）。我们一般不用关注这个。                                                                        |

[task]
[question]
使用 readelf 工具解析可执行文件时，段信息中会展示 MemSiz 和 FileSiz。关于这两者的关系，下列说法正确的是（）?
[\question]
[options]A MemSiz 永远小于 FileSiz，因为文件加载到内存会被压缩[\options]
[options]B MemSiz 永远大于等于 FileSiz，当文件中未初始化的全局变量需要在内存中分配并填 0 时，MemSiz 会大于 FileSiz[\options]
[options]C MemSiz 与 FileSiz 始终完全相等，这保证了代码的完整性[\options]
[options]D FileSiz 代表虚拟地址大小，MemSiz 代表物理地址大小[\options]
[answer]B[\answer]
[analysis]
MemSiz 表示段在内存中的实际大小，FileSiz 表示段在 ELF 文件中占用的空间大小。对于 .bss 段（未初始化的全局变量和静态变量），文件中不占用实际空间（FileSiz 为 0），但加载到内存时需要分配空间并填 0，因此 MemSiz 大于 FileSiz。对于其他段（如 .text、.data），两者通常相等。所以 MemSiz 永远大于等于 FileSiz。[\analysis]
[\task]

## 节头表

描述文件中各个节（如 .text, .data, .bss）的位置、大小、属性（**用于链接**）。

以下是每个表项的结构体。

| 字段                    | 含义                                                                        |
| --------------------- | ------------------------------------------------------------------------- |
| `sh_name`             | 节名字在 `.shstrtab` 中的偏移。<br><br>`.shstrtab` 的位置可在 ELF 头的 `e_shstrndx` 字段找到。 |
| `sh_type`             | 节类型（如 SHT_PROGBITS, SHT_NOBITS 等）。我们一般不用关注这个。                             |
| `sh_flags`            | 节属性（可写、可执行、包含数据等）。                                                        |
| `sh_addr`             | 节在内存中的虚拟地址（链接时确定）。                                                        |
| `sh_offset`           | 节在 ELF 文件中的偏移。                                                            |
| `sh_size`             | 节的大小（字节）。                                                                 |
| `sh_link` / `sh_info` | 用于链接的辅助信息（如符号表、重定位表）。                                                     |
| `sh_addralign`        | 节的对齐要求。我们一般不用关注这个。                                                        |
| `sh_entsize`          | 表中每一项的大小（如符号表项固定大小）。                                                      |

[task]
[question]
ELF 文件包含了程序相关的所有必要信息。其中，主要包含程序中各个节（section）的信息，且在程序编译和链接时必须使用的是以下哪一部分（）?
[\question]
[options]A ELF 头[\options]
[options]B 段头表（program header table）[\options]
[options]C 节头表（section header table）[\options]
[options]D 魔数（Magic number）[\options]
[answer]C[\answer]
[analysis]
节头表（section header table）记录了 ELF 文件中各个节的名称、类型、大小、偏移量等关键信息，在编译和链接过程中用于组织和管理代码、数据、符号表等不同节的内容。

链接器需要依赖节头表来合并多个目标文件的节，解析符号引用并生成最终的可执行文件。

而 ELF 头（A）描述文件整体结构，段头表（B）用于运行时加载，魔数（D）仅用于标识文件格式，都不是编译链接时用于获取节信息的主要部分。[\analysis]
[\task]

## 段与节

根据 ELF 头找到段头表与节头表，然后找到各个段和节。

### 段

段通常覆盖多个节，用于指定这些节装载到内存的特定位置以便运行。

> 段在文件中是一片连续的字节区域，而节不是。节与节之间有空的填充字节以对齐。因此，段不是由节构成的，而是包括了一个或多个完整的节。

### 节

节中包含可运行的指令的机器码、数据、符号与连接等等。

**不是所有的节都位于段中**。比如，`.shstrtab` 记录的是所有的节的名字，不参与运行，因此不位于段中。

# Linker Script

## 链接的本质

链接就是要把多个文件中的相同的节合并同类项为一个节。

## 作用

由于各个平台的具体实现方法不同，链接器必须采用一种通用的方法，才可以为各个平台进行正确的链接。

Linker Script 中记录了各个节应该如何映射到段，以及各个段应该被加载到的位置等等。

最后，根据文件中记录的格式，链接器就能将多个 ELF 文件链接起来并生成最终的一个 ELF 文件。

## 使用方法

### 默认行为

当你直接运行 `gcc main.c -o a.out` 时，GCC 会调用 `ld`，并使用其内置的**默认链接脚本**。这个脚本已经为常规的可执行程序或库定义好了合理的布局。

### 自定义链接脚本

当你需要**精确控制**程序的内存布局（比如嵌入式开发、操作系统内核、Bootloader、自定义内存映射等），就需要编写或修改链接脚本，通过 `-T` 参数指定：

```bash
gcc -T my_link_script.ld main.c -o my_program
```

## SECTIONS 命令

用于定义各个节在输出文件中的布局。示例：

```ld
SECTIONS
{
    . = 0x400000;         	/* 设置当前的虚拟地址起点，例如 x86_64 的默认加载地址 */

    .text : { *(.text) }        /* 把所有输入文件中的 .text 节放到此处 */

    .rodata : { *(.rodata) }    /* 只读数据段 */

    .data : { *(.data) }        /* 已初始化的全局/静态变量 */

    .bss : { *(.bss) }          /* 未初始化的全局/静态变量，不占文件空间 */
}
```

其中，`.` 表示当前的地址。设置地址之后，下一个节就会从这里开始。注意，这个值会自动变化，比如，在 `.text : { *(.text) }` 的下一行获取 `.` 的值时，值会变成 `0x400000 + .text节的大小`。

[task]
[question]
在指导链接器将多个目标文件链接成可执行文件的 Linker Script 中，符号 `.` 代表什么（）?
[\question]
[options]A 这是一个通配符，匹配所有的相应的节[\options]
[options]B 这是一个特殊符号，用来做定位计数器，通过设置它可以设置接下来的节的起始地址[\options]
[options]C 代表当前文件所在的宿主根目录[\options]
[options]D 表示链接脚本文件在此处解析结束[\options]
[answer]B[\answer]
[analysis]
在链接脚本（Linker Script）中，符号 `.` 被称为位置计数器（location counter）或定位计数器。它表示当前正在输出的节（section）在虚拟地址空间中的当前位置。通过对 `.` 进行赋值（例如 `. = 0x80020000;`），可以设置后续节或输出段的起始地址。链接器在处理每个输出节时，会根据输入节的大小自动更新 `.` 的值，确保各个节在内存中连续排列。[\analysis]
[\task]

### 对于操作系统内核

我们的内核代码和数据必须存放在 kseg0 中。（具体原因可以看这个博客的【MIPS 基本地址空间】一节：[计算机的启动过程](http://be-young.top/blog-detail.html?id=3791533123 )）

```C
/*
  o      KSTACKTOP-----> +----------------------------+----|
  o                      |       Kernel Stack         |
  o	                 +----------------------------+
  o                      |       Kernel Text          |
  o      KERNBASE -----> +----------------------------+----|
*/
```

我们不仅需要在 `kernel text` 区域存放内核代码及数据，还要留出一部分空间作为内核栈，以存放运行过程中产生的临时变量。

因此大致代码应该为：

```ld
SECTIONS
{
    . = KERNBASE;			// 这个地址需要根据实际情况修改

    .text : { *(.text*) }
    .data : { *(.data*) }

    bss_start = .;
    .bss : { *(.bss*) *(COMMON) }
    bss_end = .;

    /* 内核栈：从高地址向下 */
    . = KSTACKTOP - KSTKSIZE;		// 这个两个地址同样需要修改或定义

    .kernel_stack : {
        . += KSTKSIZE;
    }

    end = .;
}
```

这里有很多与一开始的示例代码不同，这里依次解释：

- `*(.text*) ` 与 `*(.text)` 有什么区别？

答：有些节的名字可能是类似 `.text.startup` 等情况，这也属于 `.text` 节，所以后面也加上通配符，更符合真实系统的情况。

- 为什么要有 `*(COMMON)`？

答：有些编译器在特定情况下会将未初始化的全局变量标记为 `COMMON symbol`，因此将这部分也要放入 `.bss` 节中，更符合真实系统的情况。

- 内核栈是怎么被设置的？

答：给内核栈留了 `KSTKSIZE` 这么大的空间，要从栈顶向下安排空间。最后用 `end` 标记结束，结束的位置就应该是 `KSTACKTOP`。

- 为什么要加 `bss_start = .;` 和 `bss_end = .;`？

答：由于 `.bss` 节必须得要初始化（清零），标记这个能够让被链接的 C 语言程序知道需要清零的位置到底在哪。这个变量名是自定义的，只要保证 C 程序中的变量名一致即可。

# Lab 1 - Exercise 1.1

## 题目要求

我们需要补全一个 ELF 解析函数。通过这个函数，我们可以输出每个节头的地址。

大致思路是：先得到节头表，然后遍历节头表的每一项获取节头地址。

## 已有代码

```C
int readelf(const void *binary, size_t size) {
    // 1. 获取ELF文件头指针
    Elf32_Ehdr *ehdr = (Elf32_Ehdr *)binary;
    
    // 2. 验证ELF文件格式
    if (!is_elf_format(binary, size)) {
        fputs("not an elf file\n", stderr);
        return -1;
    }
    
    // 3. 获取节头表信息
    const void *sh_table;           // 节头表起始地址
    Elf32_Half sh_entry_count;      // 节头表项数量
    Elf32_Half sh_entry_size;       // 单个节头表项大小
    // 待补充（1/2）
    
    // 4. 遍历所有节头
    for (int i = 0; i < sh_entry_count; i++) {
        const Elf32_Shdr *shdr;     // 当前节头指针
        unsigned int addr;           // 节虚拟地址
        
        // 待补充（2/2）
        printf("%d:0x%x\n", i, addr); // 输出：索引:地址
    }
    
    return 0;
}
```

## 获取节头表信息

在获取节头表信息时，我们只定义了三个变量，而未对其进行赋值。因此第一个待补充区域应该要对上述三个变量进行赋值。

### 节头表起始地址

节头表起始地址可以通过偏移计算而得。根据 ELF 头的数据结构，我们知道 `e_shoff` 就是节头表相对 ELF 文件的偏移。而 ELF 文件的地址其实就是指针 `binary`，或者我们定义的等价指针 `ehdr`。

### 节头表项数量、大小

这个就更简单了，ELF 头的结构体中直接就有这两个数据，直接获取即可。

故最终的代码为：

```C
sh_table = (const char *)ehdr + ehdr->e_shoff;
sh_entry_count = ehdr->e_shnum;
sh_entry_size = ehdr->e_shentsize;
```

## 遍历所有节头

这里同样是只定义了变量而没赋值。

### 当前节头指针

由于节头表的每一项是等大小的，所以我们从 ELF 头中获取表项的大小，就能够推算出每个表项的地址，然后把节头指针定位到那里就行了。

### 节虚拟地址

我们最后要输出的就是这个地址。这个地址非常好得到，因为节头表的结构体就有这个字段。

最终的代码为：

```C
shdr = (const Elf32_Shdr *)((const char *)sh_table + i * sh_entry_size);
addr = shdr->sh_addr;
```

> 这里一定要注意指针类型的转换。尤其是 `sh_table` 是 `const void *` 类型的，很容易搞错。
> 
> 这里我还想吐槽一下北航【生气】，搞一个内核指导书关键注释还用英文，中文解释也超级难懂。上课也不怎么讲 ELF 文件，直接上来就要我写，真是花了我大功夫才学会啊【大哭】。

# Lab 1 - Exercise 1.2

## 题目要求

需要我们完善 Linker Script 代码，以告诉链接器如何链接多个 ELF 文件。

## 已有代码

```ld
SECTIONS {
    /* Step 1: 设置代码段加载地址 */
    /* 待补充（1/4） */

    /* Step 2: 定义 text 段 */
    /* 待补充（2/4） */

    /* Step 3: 定义 data 段 */
    /* 待补充（3/4） */

    bss_start = .;

    /* Step 4: 定义 bss 段 */
    /* 待补充（4/4） */

    bss_end = .;

    /* 内核栈顶 */
    . = 0x80400000;
    end = . ;
}
```

注意，其实这里并没有真正设置内核栈。设置的方法详见我在【SECTIONS 命令】一节中讲的代码。但是题目没有要求这一点，实测下来不设置依然可过。

## 参考答案

由于这个比较简单，和模板代码区别甚微，故直接给代码：

```ld
SECTIONS {
    /* Step 1: 设置代码段加载地址 */
    . = 0x80020000;

    /* Step 2: 定义 text 段 */
    .text : { *(.text) }

    /* Step 3: 定义 data 段 */
    .data : { *(.data) }

    bss_start = .;

    /* Step 4: 定义 bss 段 */
    .bss : { *(.bss) }

    bss_end = .;

    /* 内核栈顶 */
    . = 0x80400000;
    end = . ;
}
```

特别强调，`0x80020000` 和 `0x80400000` 这两个地址都是根据 `mmu.h` 这个文件中的内存分布图得到的。（~~但其实好像只要在 kseg0 区都能过测试点，毕竟看到有人 `KERNBASE` 写 `0x80010000` 也能过~~）

当然，如果想严谨一点，写成以下的代码也可以，但是我们的实验并不要求这么严谨。

```ld
KSTKSIZE = 0x2000;		// 内存分布图似乎没有写具体多大

SECTIONS {
    . = 0x80020000;

    .text : { *(.text*) }
    .data : { *(.data*) }

    bss_start = .;
    .bss : { *(.bss*) *(COMMON) }
    bss_end = .;

    . = 0x80400000 - KSTKSIZE;

    .kernel_stack : {
        . += KSTKSIZE;
    }

    end = .;
}
```