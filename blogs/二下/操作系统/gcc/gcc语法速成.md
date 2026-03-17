---
excerpt: GCC 的语法详解
type: 轻松笔记
---
# GCC 编译原理

## 概览

```bash
gcc hello.c -o hello
./hello
```

就这？对，就这！但 GCC 背后干的事可不少...

#### 其实 GCC 偷偷做了四步：

```bash
# 1. 预处理（处理 #include、#define 等）
gcc -E hello.c -o hello.i

# 2. 编译（变成汇编语言）
gcc -S hello.i -o hello.s

# 3. 汇编（变成机器码）
gcc -c hello.s -o hello.o

# 4. 链接（合并成可执行文件）
gcc hello.o -o hello
```

一步到位就是 `gcc hello.c -o hello`，相当于挂了个专家号，一次搞定所有检查。

---

## 预处理

```c
#include <stdio.h>     // 大夫，我要用标准输入输出
#define PI 3.14        // 我习惯把圆周率叫 PI
#define MAX(a,b) ((a)>(b)?(a):(b))  // 我定义个取最大值的方法

int main() {
    printf("PI = %f\n", PI);
    int max = MAX(10, 20);
    return 0;
}
```

预处理后变成：
```c
// 这里插入了几百行 stdio.h 的代码...
int main() {
    printf("PI = %f\n", 3.14);     // PI 被直接替换成 3.14
    int max = ((10)>(20)?(10):(20));  // MAX 被展开
    return 0;
}
```

**相当于：** 你说"我头疼"，护士先帮你填表，把"头疼"转化成标准病历术语。

---

## 编译

这一步把 C 代码变成汇编代码，就像医生看完病开处方。

**C 代码：**
```c
int add(int a, int b) {
    return a + b;
}
```

**变成汇编（大概长这样）：**
```assembly
add:
    # MIPS参数传递规范：前4个参数在 $a0-$a3
    # 返回值在 $v0
    add     $v0, $a0, $a1     # $v0 = a + b
    jr      $ra               # 返回
    nop                        # 延迟槽
```

**相当于：** 医生把"每天吃两次药"写成专业处方 "Bid"，药剂师才看得懂。

---

## 汇编

这一步把汇编代码变成机器码（二进制），也就是 `.o` 文件。

```bash
gcc -c add.s -o add.o
# 生成的是二进制文件，用 hexdump 看看：
hexdump -C add.o
00000000  7f 45 4c 46 02 01 01 00  00 00 00 00 00 00 00 00  |.ELF............|
...
```

**相当于：** 药剂师根据处方把各种药片装进药袋，写上用法用量。

---

## 链接

```bash
# 有多个 .o 文件
gcc main.o add.o -o program

# 或者一步到位
gcc main.c add.c -o program
```

链接器把你的代码和库代码合并，解决各种"谁在哪"的问题：

- `printf` 函数在哪？（在 libc 库里）
- `main` 函数从哪里开始？
- `add` 函数的地址是多少？

**相当于：** 把所有药袋装进一个药盒，附上说明书（入口点 main）。

---

# 常用编译选项

## `-o` - 指定输出文件名

```bash
gcc hello.c -o hello.exe          # 输出叫 hello.exe
gcc hello.c                        # 默认输出 a.out（太难听了）
```

## `-c` - 只编译，不链接

```bash
gcc -c add.c                       # 生成 add.o
gcc -c main.c                       # 生成 main.o
gcc main.o add.o -o program         # 手动链接
```

适合大项目，改一个文件不用重新编译所有。

## `-I` - 指定头文件路径

```bash
# 目录结构
# .
# ├── include
# │   └── mylib.h
# └── src
#     └── main.c

gcc -I../include src/main.c -o program
```

`-I` 告诉 GCC："头文件也可能在这儿，去找找！"

相当于告诉大夫："我之前在别的医院看过，病历在那边。"

## `-Wall` - 打开所有警告

```bash
gcc -Wall program.c -o program
```

```c
int main() {
    int i;                         // 警告：i 没初始化
    if (i = 0) {                    // 警告：你确定是想赋值不是比较？
        printf("never\n");
    }
    return 0;
}
```

**相当于：** 大夫会指出你所有的不良生活习惯，即使不是病。

[task]
[question]
运行 `gcc -Wall test.c` 编译以下代码，最可能会产生什么警告？
```c
#include <stdio.h>
int main() {
    int x;
    printf("%d\n", x);
    return 0;
}
```
[\question]
[options]A 没有警告，一切正常[\options]
[options]B warning: unused variable 'x'[\options]
[options]C warning: 'x' is used uninitialized[\options]
[options]D warning: printf format mismatch[\options]
[answer]C[\answer]
[analysis]
定义变量 x 但没有初始化就直接使用，这是未定义行为。`-Wall` 会检测到这种情况并警告：'x' is used uninitialized。  
B 选项不对，因为 x 被使用了（printf 用了它）。  
D 选项不对，因为 %d 和 int 类型匹配。
[\analysis]
[\task]

---

# 编译错误解读

## 语法错误

```bash
test.c: In function ‘main’:
test.c:5:9: error: expected ‘;’ before ‘return’
    5 |         return 0;
      |         ^~~~~~
```
忘了加分号，就像句子没写句号。

## 未定义引用

```bash
/usr/bin/ld: /tmp/cc12345.o: undefined reference to `add'
collect2: error: ld returned 1 exit status
```
用了 add 函数但没实现，就像开了药但药房没这种药。

## 头文件找不到

```bash
test.c:1:10: fatal error: mylib.h: No such file or directory
    1 | #include "mylib.h"
      |          ^~~~~~~~~
compilation terminated.
```
头文件路径不对，就像病历找不到了。

[task]
[question]
编译时遇到 "undefined reference to `sqrt`" 错误，最可能的原因是什么？
[\question]
[options]A 忘记 `#include <math.h>`[\options]
[options]B 忘记链接数学库（忘了加 -lm）[\options]
[options]C sqrt 函数拼写错误[\options]
[options]D 编译器版本太低[\options]
[answer]B[\answer]
[analysis]
这是一个链接错误（ld 报的），不是编译错误。`sqrt` 函数在数学库 libm. So 里，需要加 `-lm` 链接。  
A 选项：缺少头文件会导致编译警告或错误，但不是这个链接错误。  
C 选项：如果拼写错误，编译器会报 implicit declaration 之类的错误，也不会是 undefined reference。  
D 选项：跟版本无关。
[\analysis]
[\task]

---

# 多文件编译

## 方式一：分开编译

```bash
# 分别编译每个 .c 文件
gcc -c file1.c -o file1.o
gcc -c file2.c -o file2.o
gcc -c main.c -o main.o

# 链接所有 .o 文件
gcc file1.o file2.o main.o -o program
```

## 方式二：一步到位

```bash
gcc file1.c file2.c main.c -o program
```

## 方式三：用 Makefile

```makefile
program: main.o file1.o file2.o
	gcc main.o file1.o file2.o -o program

main.o: main.c file1.h file2.h
	gcc -c main.c

file1.o: file1.c file1.h
	gcc -c file1.c

file2.o: file2.c file2.h
	gcc -c file2.c

clean:
	rm -f *.o program
```

相当于成立专家小组，谁擅长治什么就治什么。

---
# 写在最后

本文部分内容由 AI 生成。咕咕嘎嘎！