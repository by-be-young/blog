---
type: 系统笔记
excerpt: 操作系统Lab1课下实验实验报告
---
# 思考题

## Thinking 1.1

> 在阅读附录中的编译链接详解以及本章内容后，尝试分别使用：
> 
> 1. 实验环境中的原生 x86 工具链（gcc、ld、readelf、objdump 等）；
> 
> 2. MIPS 交叉编译工具链（带有 mips-linux-gnu- 前缀，如 mips-linux-gnu-gcc、mips-linux-gnu-ld）
> 
> 3. 重复其中的编译和解析过程，观察相应的结果，并解释其中向 objdump 传入的参数的含义。

创建一个非常简单的 C 语言文件 `hello.c`，内容如下：

```C
#include <stdio.h>

int main() {
    printf("hello world!\n");
    return 0;
}
```

### 使用 x86 工具链

- 预处理

```bash
gcc -E hello.c -o hello.i
```

执行后，查看 `hello.i` 文件：

![[hello.i.png]]

可以发现，其实就是把头文件给展开了而已，其他并没有变化。

- 编译

```bash
gcc -S hello.i -o hello.s
```

执行后，查看 `hello.s` 文件：

![[hello.s.png]]

这条指令将代码变成了 `x86` 汇编指令。

- 汇编

```bash
gcc -c hello.s -o hello.o
```

执行后，查看 `hello.o` 文件：

![[hello.o.png]]

这条指令将汇编指令变为了 ELF 文件，从前四个字节是魔数可以看出来。

- 链接

```bash
gcc hello.o -o hello_x86
./hello_x86
```

执行后，屏幕中输出了：

![[图片/hello_x86.png]]

说明这一步才最终生成了可执行文件。这个可执行文件仍然是 ELF 文件。

### 使用 MIPS 交叉编译工具链

- 编译

```bash
mips-linux-gnu-gcc -c hello.c -o hello_mips.o
```

执行后打开 `hello_mips.o` 文件：

![[hello_mips.o.png]]

这一步直接生成了 MIPS 架构下的目标文件。

- 链接

```bash
mips-linux-gnu-gcc hello_mips.o -o hello_mips
# 或者指定链接器：
# mips-linux-gnu-ld hello_mips.o -o hello_mips
```

执行后查看 `hello_mips` 文件：

![[图片/hello_mips.png]]

但是这个文件不能直接在我们实验环境中运行，因为不是 MIPS 架构的。

### 使用 `readelf` 分析 ELF 头

- 查看 `hello_x86`

```bash
readelf -h hello_x86
```

屏幕输出如下：

![[hello_x86 1.png]]

- 查看 `hello_mips`

```bash
mips-linux-gnu-readelf -h hello_mips
```

屏幕输出如下：

![[hello_mips.png]]

其中，除了在【系统架构】字段与 `x86` 有区别之外，其他字段也或多或少有出入。主要原因大概是 ABI（应用二进制接口）不同，当然也有其他的原因。

当然，还可以用 `readelf` 的 `-l`、`-S ` 查看段头和节头，这里就不再赘述。

### 使用 `objdump` 反汇编

- `x86` 反汇编

```bash
objdump -d hello_x86 > dump_x86.txt
```

查看 `dump_x86.txt` 文件：

![[dump_x86.png]]

- `MIPS` 反汇编

```bash
mips-linux-gnu-objdump -d hello_mips > dump_mips.txt
```

查看 `dump_mips.txt` 文件：

![[dump_mips.png]]

这里会发现，反汇编代码和汇编代码不完全一致。其实，反汇编后，一些定义的符号会由实际的地址取代。

## Thinking 1.2

> 思考下述问题： 
> 
> 1. 尝试使用我们编写的 `readelf` 程序，解析之前在 `target` 目录下生成的内核ELF文件。 
> 
> 2. 也许你会发现我们编写的 `readelf` 程序是不能解析 `readelf` 文件本身的，而我们刚才介绍的系统工具 `readelf` 则可以解析，这是为什么呢？（提示：尝试使用 `readelf-h`，并阅读 `tools/readelf` 目录下的 `Makefile`，观察 `readelf` 与 `hello` 的不同

### 问题 1

```bash
./tools/readelf/readelf ./target/mos
```

先保证编译 `readelf.c`，然后执行以上指令，得到：

```text
0:0x0
1:0x80010000
2:0x80011cc0
3:0x80011cd8
4:0x80011cf0
5:0x0
6:0x0
7:0x0
8:0x0
9:0x0
10:0x0
11:0x0
12:0x0
13:0x0
14:0x0
15:0x0
16:0x0
```

这就是 MOS 内核的 ELF 文件的各个节头的地址。

### 问题 2

我们用 `readelf -h` 命令分别对 `hello` 和 `readelf` 文件进行头部信息解析：`hello` 文件结果显示为 `ELF32`，而 `readelf` 文件则显示为 `ELF64`

这是因为我们编写的 `readelf` 程序默认解析且仅支持解析的都是 32 位 ELF 文件，而程序自身是一个64位的 ELF 文件，当然无法正常解析。

## Thinking 1.3

> 在理论课上我们了解到，MIPS体系结构上电时，启动入口地址为 `0xBFC00000` （其实启动入口地址是根据具体型号而定的，由硬件逻辑确定，也有可能不是这个地址，但一定是一个确定的地址），但实验操作系统的内核入口并没有放在上电启动地址，而是按照内存布局图放置。
> 
> - 思考为什么这样放置内核还能保证内核入口被正确跳转到？ 
> 
> （提示：思考实验中启动过程的两阶段分别由谁执行。）

这一题其实是在混淆概念。两个入口根本就不是同一个。

1. 启动入口：这是 bootloader 第一行指令所在的地址。
2. 内核入口：bootloader 第二步的最后一条指令就是跳转到内核入口的地址。然后就可以执行内核。

这两个入口一个在 kseg1，一个在 kseg0，必然不一样。

# 难点分析

## ELF 文件结构

花了很久时间才搞懂 ELF 文件的结构到底是什么样、ELF 头、段头表、节头表分别是什么东西、节和段又有什么关系等等。

于是花了大功夫写了这篇博客：[ELF文件结构](http://be-young.top/blog-detail.html?id=2659015209)。

最核心需要知道的就是：ELF 头、段头、节头其实相当于三个结构体。而段头表、节头表就是结构体的数组。ELF 头可以找到段头表和节头表的位置以及其他信息。

## 编译的过程

编译并不是一步到位的，其实经历了预处理、编译、汇编、链接四个主要步骤。

## MIPS 内存结构

了解了这个结构才能真正明白启动入口地址、内核入口地址设置的缘由，而不是单纯的约定。

如果这个部分没有学会，实验题中很多具体数值及其安排都将是一知半解。

详见这篇博客：[计算机的启动过程](http://be-young.top/blog-detail.html?id=3791533123)。

# 实验体会

## `printk` 和 `scank`！

今年的 extra 题依旧是模仿 `printk` 函数写另一个函数。我感觉这既和之前学的 C 语言程设没有大关系，又和 OS 没太大关系~

总而言之，这种函数不仅需要学一些之前没有见过的函数，而且还要和其他文件中的函数定义什么的相结合，需要看的代码量较多，逻辑也和平常的不是完全一致，确实得要好好看看。

## 学习流程

我感觉光听老师讲和光靠指导书都绝对不够。

我推荐从 Exercise 入手，让 AI 工具帮助分析完成任务所需的具体知识储备，从而明确学习目标。接着，针对性地学习这些核心知识点。

学完后，再重新审视题目——此时除非你天赋异禀，否则肯定依然会感到生涩，这正暴露了理解的盲区。所以要仔细记录思考过程中的每一个断点、疑点和错误，通过逐一求证来解决它们，最终完成题目并提交。

但亲身体验，这还不够。在完成所有 Exercise 后，我还会回过头来重新梳理，才能真正搞懂各个题目间的深层联系，以及底层知识点是如何环环相扣的。

以这次实验为例，要分辨编译过程中哪些是 ELF 文件，必须先掌握 ELF 文件结构；而要理解 ELF 结构，又得先弄清 MIPS 地址空间的布局。

如果按照指导书的传统顺序（先从 MIPS 地址空间讲起）——就容易迷失方向，不明白为何要学这个、关键在哪，常常导致学到后面一头雾水，又得翻回来重看。

唯有从具体问题入手，逐一击破，才能真正抓住重点、理清逻辑。

# 原创说明

本篇博客有一小部分借鉴了 [Old-Joy 学长的博客](https://www.oldjoy.top/2025/03/28/OS-Lab1/OS-Lab1%E5%AE%9E%E9%AA%8C%E6%8A%A5%E5%91%8A/)，其他部分大多是自己学完后整理总结的原创~