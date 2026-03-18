# GCC & Makefile Quiz

## 题目

|执行命令|实现功能|
|---|---|
|`make check`|利用 `gcc` 将**同目录**下的 `check.c` 编译成名为 `check.o` 的未链接的目标文件，并放在同目录下。|
|`make`|**先完成 `make check` 要求的功能**。然后利用 `gcc` 将 **`src` 目录**下的 `main.c`、`output.c` 编译成名为 `main` 的可执行文件，并放在 **`out` 目录**下。|
|`make run`|直接运行可执行文件 `out/main` 。|
|`make clean`|删除目标文件 `check.o` 、可执行文件 `out/main`。|

## 参考答案

```bash
all: check
	gcc ./src/main.c ./src/output.c -o ./out/main
	
check: check.c
	gcc -c check.c -o check.o
	
run:
	./out/main
	
clean:
	rm -f check.o ./out/main
```

# GCC & Bash Quiz

## 步骤 1：新建目录

### 题目

创建一个新的目录，名为 `result` 。再在 `result` 目录下创建两个新的目录，名为 `code` 和 `backup` 。

### 参考答案

```bash
#!/bin/bash

mkdir -p result
mkdir -p result/code result/backup
```

此处 `-p` 的作用是：如果已经存在这个目录，也不会报错

所以不加这个也行。

## 步骤 2：查找指定行

### 题目

将 `origin` 目录下的 `basic.c` 的文件中含有 `hello` （区分大小写）的行输出。

### 参考答案

```bash
#!/bin/bash

grep "hello" origin/basic.c
```

## 步骤 3：移动文件

### 题目

将 `origin` 目录下的 `basic.c` 文件移动到 `result` 目录下。

### 参考答案

```bash
#!/bin/bash

mv ./origin/basic.c ./result/
```

注意地址只需要写文件夹名即可。

## 步骤 4：拷贝文件

### 题目

将 `origin` 目录下的 `code` 目录及其内容拷贝到 `result/backup` 目录下。

### 参考答案

```bash
#!/bin/bash

cp -r ./origin/code ./result/backup
```

很有意思的是，两个路径最后加不加斜杠都是可以的，如：

```bash
cp -r ./origin/code ./result/backup/
```

与上面的等价。

## 步骤 5：查找替换

### 题目

将 `origin/code` 目录下的 `0.c` `1.c` `2.c` …… `20.c` （从0开始的**连续整数**命名的.c文件，共21个）文件中的**所有** `REPLACE` （区分大小写）替换为文件名（**不含扩展名**），替换的结果保存到 `result/code` 目录下的同名文件中。

### 参考答案

```bash
#!/bin/bash

for i in {0..20}; do
	sed "s/REPLACE/$i/g" origin/code/$i.c > result/code/$i.c
done
```

这里务必保证是双引号而不是单引号。因为双引号内的变量会解析，单引号内不会解析。如果此处用了单引号，所有的“REPLACE”全会变成“$i”，而不是真正的数字！

## 步骤 6：编译

### 题目

将 `result/code` 目录下的**全部** `.c` 文件一起编译为可执行文件 `result/verify` 。

### 参考答案

```bash
#!/bin/bash

gcc result/code/*.c -o result/verify
```

采用通配符即可。

## 步骤 7：重定向

### 题目

运行可执行文件 `result/verify` ，将其**标准错误输出**的内容**追加**到仓库根目录下的 `stderr.txt` 文件。

### 参考答案

```bash
#!/bin/bash

bash result/verify 2>> stderr.txt
```

2 表示标准错误输出；

`>>` 表示追加写入。

## 步骤 8：权限修改

### 题目

将 `stderr.txt` 文件的权限修改为 `r--r-----`。

### 参考答案

```bash
#!/bin/bash

chmod 440 stderr.txt
```

三个符号为一组，r=4, w=2, x=1。-表示没有权限，故表示 0。

其实还有一种写法，或许看起来更直观：

```bash
#!/bin/bash

chomd u=r,g=r stderr.txt
```

因为这三组符号分别对应 user, group, other。把前两个设置为 r 就行了。

## 步骤 9：选择性输出

### 题目

 `run_exam.sh` 以 `bash exam_9.sh [s] [t]` 的格式向 `exam_9.sh` 传入两个参数 `s` , `t` （正整数，且 `s < t` ）。
- 两个均缺省时，输出 `stderr.txt` 的所有内容    
- 仅缺省 `t` 时，输出 `stderr.txt` 自第 `s` 行开始（行号从 `1` 开始编号，输出**含**第 `s` 行）至结尾的内容
- 两个均指定时，输出 `stderr.txt` 自第 `s` 行至第 `t` 行的内容（输出**含**第 `s` 行，**不含**第 `t` 行）

### 参考答案

```bash
#!/bin/bash

if [ $# -eq 0 ]; then	# 注意空格
	cat stderr.txt
elif [ $# -eq 1 ]; then
	sed -n "$1,\$p" stderr.txt
else
	sed -n "$1,$(($2 - 1))p" stderr.txt
```

`$#` 的意思是“参数的个数”。

注意，`$` 表示文档的最后一行。但是如果放在双引号内，则会当成变量进行解析，因此前面要加转义符。

`$(())` 表示算数运算。注意有两层小括号。

还有一个需要提醒的是，如果你的 `sed` 后面不加 `-n`，你的终端上就会把每行显示两次。

以下这个版本也应该可以：

```bash
#!/bin/bash

if [ $# -eq 0 ]; then
	sed -n '1,$p' stderr.txt
elif [ $# -eq 1 ]; then
	sed -n "$1,\$p" stderr.txt
else
	sed -n "$1,$2p" stderr.txt | sed '$d'
```

其中第三种情况，先输出所有行，再删除最后一行。

# 说在最后

这些答案是我自己后面重做的，但是懒得再提交和对比之前的提交了，不保证 100%正确 www