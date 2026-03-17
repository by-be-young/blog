---
type: 轻松笔记
excerpt: Linux基本命令的语法、格式及用法举例。
---
# 初识终端

当你打开终端，首先会看到这样的提示符：
```
git@24xxxxxx:~$ 
```
- `git` - 当前用户名
- `24xxxxxx` - 计算机名
- `~` - 当前目录（`~` 表示家目录 `/home/用户名`）
- `$` - 表示当前是普通用户（如果是 `#` 则表示 root 超级用户）

**实用快捷键：**
- `Ctrl+C` - 终止当前运行的程序（比如写了个死循环，用它来救命）
- `Ctrl+Z` - 挂起当前程序
- `Ctrl+D` - 退出当前 shell 或表示输入结束
- `Ctrl+L` - 清屏（比输入 `clear` 命令快多了）

---

# 基础命令

## 文件和目录操作

### `ls` - 查看目录内容

即 list 的缩写。

```bash
ls                    # 简单列出文件名
ls -l                 # 列出详细信息（权限、大小、修改时间等）
ls -a                 # 显示所有文件（包括隐藏文件，以.开头的）
ls -al                # 组合使用，显示所有文件的详细信息
```

就像打开衣柜，`ls` 只是看一眼有什么衣服，`ls -l` 是把每件衣服的标签都看一遍，`ls -a` 连藏在抽屉里的内衣也给你翻出来。

---

### `cd` - 切换目录

即 change directory 的缩写。

```bash
cd newdir             # 进入newdir目录
cd ..                 # 返回上一级目录（两个点就像回头看）
cd .                  # 进入当前目录（一个点就是原地不动）
cd ~                  # 回到家目录
cd /home              # 使用绝对路径，直接去/home目录
```

[task]  
[question]  
处于 /home/user/workspace 目录时，执行 cd ../.. 命令后，当前工作目录将变为什么？  
[\question]  
[options]A /home/user[\options]  
[options]B /home[\options]  
[options]C /[\options]  
[options]D 语法错误[\options]  
[answer]B[\answer]  
[analysis]  
`cd ../..` 表示向上级目录移动两次。`/home/user/workspace` 的上一级是 `/home/user`，再上一级是 `/home`。
[\analysis]  
[\task]

---

### `pwd` - 显示当前路径

即 print working directory 的缩写。

```bash
pwd                   # 比如输出：/home/git/newdir
```

当你迷路时，`pwd` 就是你的导航仪。

---

### `mkdir` - 创建目录

即 make directory 的缩写。

```bash
mkdir myfolder        # 创建名为myfolder的文件夹
mkdir -p a/b/c        # 递归创建多级目录（如果父目录不存在也一并创建）
```

[task]  
[question]  
尝试使用 rmdir 命令删除一个非空目录，会产生何种结果？  
[\question]  
[options]A 强制清空目录并将其删除[\options]  
[options]B 弹出交互式提示，要求逐一确认删除文件[\options]  
[options]C 命令执行失败并提示错误，因为该命令仅能处理空目录[\options]  
[options]D 目录本身被删除，其内部文件被移动到上级目录[\options]  
[answer]C[\answer]  
[analysis]  
`rmdir`（remove directory）的设计初衷就是删除空目录。如果目录非空，它会报错并拒绝执行，这是为了避免误删文件。要删除非空目录，应该使用 `rm -r` 命令。  
[\analysis]  
[\task]

---

### `touch` - 创建空文件或更新文件时间戳

```bash
touch hello.c         # 创建一个空的hello.c文件
touch existing.txt    # 如果文件已存在，只更新它的最后修改时间
```

---

### `cp` - 复制

即 copy 的缩写。

```bash
cp file1.txt file2.txt    # 复制file1.txt为file2.txt
cp file1.txt folder/      # 复制文件到folder目录
cp -r folder1 folder2     # 复制整个文件夹（-r递归复制）
cp -i file1.txt file2.txt # 复制前询问是否覆盖（-i即interactive）
```

---

### `mv` - 移动或重命名

即 move 的缩写。

```bash
mv oldname.txt newname.txt    # 重命名文件
mv file.txt folder/            # 移动文件到folder目录
mv -i file.txt folder/         # 移动前询问是否覆盖
```

`mv` 就像搬家，可以把文件从一个地方搬到另一个地方，如果目的地和当前在同一个目录，就相当于改了个名字。

---

### `rm` - 删除

即 remove 的缩写。

```bash
rm file.txt               # 删除文件
rm -r folder/             # 删除文件夹（-r递归删除）
rm -f file.txt            # 强制删除，不询问（-f是force）
rm -rf folder/            # 递归强制删除文件夹（非常危险！）
```

⚠️ **警告**：Linux 没有回收站，`rm` 删了就真没了！尤其是 `rm -rf /` 会删除整个系统。

---

### `cat` - 查看文件内容

即 concatenate 的缩写（连接文件的意思）。

```bash
cat file.txt              # 直接把文件内容打印到屏幕
cat file1.txt file2.txt   # 依次显示两个文件的内容
cat -n file.txt           # 显示行号
```

---

### `echo` - 打印输出

```bash
echo "Hello World"        # 输出：Hello World
echo $PATH                # 输出环境变量的值
echo -n "no newline"      # 输出后不换行
```

---

## 查找和搜索

### `find` - 找文件

```bash
find . -name "*.c"        # 在当前目录找所有.c文件
find /home -name "test.txt" # 在/home目录下找test.txt
find . -size +1M          # 找大于1MB的文件
find . -mtime -7          # 找7天内修改过的文件
```

---

### `grep` - 找内容

名字来源于 ed 编辑器命令 "g/re/p" (global/regular expression/print)。

```bash
grep "hello" file.txt      # 在file.txt中找包含hello的行
grep -r "main" .           # 递归在当前目录所有文件中找main
grep -n "error" log.txt    # 显示找到的行号
grep -i "hello" file.txt   # 忽略大小写
grep -v "debug" file.txt   # 显示不包含debug的行（-v反向选择）
```

当你忘了某个函数写在哪，`grep -r "函数名" .` 帮你找遍所有文件。

---

# 权限管理

## `chmod` - 修改文件权限

即 change mode 的缩写。

Linux 中每个文件都有三种权限：**r** 读 (4)、**w** 写 (2)、**x** 执行 (1)，分别对应三种用户：文件拥有者 (u)、群组 (g)、其他人 (o)。

### 符号方式

```bash
chmod u+x script.sh        # 给文件拥有者添加执行权限
chmod g-w file.txt         # 移除群组的写权限
chmod o=r file.txt         # 设置其他人的权限为只读
chmod a+x run.sh           # 给所有人（all）添加执行权限
chmod u=rwx,g=rx,o=r file  # 分别设置三种用户的权限
```

### 数字方式

```bash
chmod 755 script.sh        # 设置权限为 rwx r-x r-x
chmod 644 file.txt         # 设置权限为 rw- r-- r--
chmod 777 everything.sh     # 所有人可读可写可执行（危险！）
```

**数字权限速记**（把权限当作二进制数）：
- `7` = 4+2+1 = rwx（可读可写可执行）
- `6` = 4+2 = rw-（可读可写）
- `5` = 4+1 = r-x（可读可执行）
- `4` = r--（只读）
- `0` = ---（无权限）

**常见组合**：
- `755` - 自己可读写执行，其他人可读执行（常见于程序文件）
- `644` - 自己可读写，其他人只读（常见于普通文件）
- `700` - 仅自己可读写执行（私密文件）
- `600` - 仅自己可读写（私密数据）

[task]  
[question]  
运行指令 chmod -w script.sh 移除某文件的写入权限时，由于未指明特定的用户范畴，预设处理机制为？  
[\question]  
[options]A 仅对文件拥有者的写入权限进行剥夺[\options]  
[options]B 仅对该文件所属群组以外用户的写入权限进行剥夺[\options]  
[options]C 对涵盖拥有者、群组和其他所有用户的写入权限进行统一剥夺[\options]  
[options]D 判定作用域缺失从而中止操作并抛出错误[\options]  
[answer]C[\answer]  
[analysis]  
在 `chmod` 命令中，如果不指定用户类别（u/g/o），默认作用于所有用户（a）。所以 `chmod -w` 相当于 `chmod a-w`，会移除文件拥有者、群组和其他所有人的写权限。这是为了符合直觉：当你想让一个文件"不可写"时，通常是希望所有人都不能写。  
[\analysis]  
[\task]

---

# 文件比较和内容处理

## `diff` - 比较文件差异

即 difference 的缩写。

```bash
diff file1.txt file2.txt    # 显示两个文件的不同
diff -q file1.txt file2.txt # 只显示是否有差异，不显示详情
diff -u file1.txt file2.txt # 统一格式输出（更易读）
diff -r dir1 dir2           # 比较两个目录下的所有文件
```

---

## `sed` - 流编辑器

即 stream editor 的缩写，文本处理神器。

```bash
# 替换操作
sed 's/old/new/g' file.txt  # 把文件中的old替换成new（输出到屏幕）
sed -i 's/old/new/g' file.txt # 直接修改文件（-i是直接修改）

# 行操作
sed -n '3p' file.txt        # 只输出第3行（-n安静模式）
sed -n '3,$p' file.txt		#输出第3行及以后（$表示末尾）
sed '2d' file.txt            # 删除第2行（输出到屏幕）
sed '2,5d' file.txt          # 删除第2到5行

# 添加内容
sed '3a\new line' file.txt   # 在第3行后添加一行
sed '1i\header' file.txt     # 在第1行前插入一行

# 组合命令
sed -e 's/foo/bar/g' -e 's/baz/qux/g' file.txt # 执行多个替换
```

`sed` 就像 Word 里的"查找替换"，但功能强大得多，还能批量处理成千上万的文件。

> 这里不得不提醒一下单引号和双引号的区别。
> 
> 单引号：不解析其中的任何符号，所见即所得。
> 
> 双引号：解析其中的 `$` 、`\` 等。即会解析变量。如果你只是单纯的想要写 `$`，则需要在符号前面加上 `\` 转义。不会解析通配符。

---

## `awk` - 文本处理

名字来源于创始人 Aho, Weinberger, Kernighan 的姓氏首字母。

```bash
# 列操作
awk '{print $1}' file.txt    # 输出每行的第一个字段（默认空格分隔）
awk '{print $1, $3}' file.txt # 输出第1和第3列
awk -F',' '{print $2}' file.csv # 以逗号分隔，输出第二列

# 条件筛选
awk '$1>10 {print $3}' file.txt # 第一列大于10的行，输出第三列
awk '/error/ {print}' log.txt   # 输出包含error的行

# 内置变量
awk '{print NR, $0}' file.txt   # NR是行号，$0是整行
awk '{print NF, $1}' file.txt   # NF是当前行的字段数

# 统计功能
awk '{sum+=$1} END {print sum}' numbers.txt # 求第一列总和
awk '{count++} END {print count}' file.txt  # 统计行数
```

---

## `sort` - 排序

```bash
sort file.txt              # 按字母顺序排序
sort -n file.txt           # 按数字大小排序
sort -r file.txt           # 反向排序
sort -u file.txt           # 去重排序（相当于sort后再uniq）
sort -k2 file.txt          # 按第二列排序
sort -t',' -k3 file.csv    # 按逗号分隔，按第三列排序
```

---

## `uniq` - 去重

```bash
uniq file.txt              # 去除连续重复的行（注意：只去连续重复）
sort file.txt | uniq       # 先排序再去重（真正的全局去重）
sort file.txt | uniq -c    # 统计每行出现的次数
sort file.txt | uniq -d    # 只显示重复的行
```

---

# 重定向和管道

Linux 定义了三种数据流：
- 标准输入（stdin）- 0，默认来自键盘
- 标准输出（stdout）- 1，默认输出到屏幕
- 标准错误（stderr）- 2，默认也输出到屏幕

## 重定向符号

| 符号 | 含义 | 示例 |
|------|------|------|
| `>` | 输出重定向（覆盖） | `echo hello > file.txt` |
| `>>` | 输出重定向（追加） | `echo world >> file.txt` |
| `<` | 输入重定向 | `sort < file.txt` |
| `2>` | 错误输出重定向 | `gcc test.c 2> error.log` |
| `&>` | 同时重定向输出和错误 | `command &> all.log` |

```bash
# 把ls的结果保存到文件（覆盖）
ls > filelist.txt

# 追加内容
echo "new line" >> filelist.txt

# 从文件读取输入
sort < unsorted.txt

# 分别处理正确输出和错误输出
find / -name "*.c" 2> errors.log 1> results.log

# 把错误输出也合并到正确输出
command > output.log 2>&1

# 简洁写法（bash支持）
command &> output.log

# 丢弃不需要的输出（/dev/null是黑洞）
command 2> /dev/null
```

[task]  
[question]  
在执行带覆写重定向符的命令链如 echo "start" > log.txt 时，指令运行的流程次序表现为？  
[\question]  
[options]A 在执行命令本体前准备外部文件，若检测到已有数据则将其强制清空[\options]  
[options]B 保障输出内容安全附加至原有文件数据的尾端[\options]  
[options]C 命令本体完成内容准备后再进行重定向[\options]  
[options]D 对原有文件实施读取操作生成备份再启动输出[\options]  
[answer]A[\answer]  
[analysis]  
Shell 在处理重定向时，会先进行文件操作，再执行命令。对于 `>` 覆写重定向，shell 会先打开目标文件，如果文件存在则清空（截断为0），如果不存在则创建。然后才执行 `echo` 命令，把输出写入已经打开的空文件中。这就是为什么有时候即使命令失败，目标文件也会被清空的原因。  
[\analysis]  
[\task]

---

## 管道

管道符号 `|` 把前一个命令的 stdout 接到后一个命令的 stdin。

```bash
# 把ls的结果传给grep，只显示包含".c"的文件
ls | grep ".c"

# 查看进程，找到包含"bash"的
ps aux | grep bash

# 统计当前目录文件个数
ls -l | wc -l

# 组合使用：查看第8-12行
cat bigfile.txt | head -12 | tail -5

# 多层管道：找包含error的行，排序，去重，计数
grep "error" log.txt | sort | uniq -c | sort -nr

# 用less分页查看长输出
dmesg | less

# 只显示前10个结果
history | grep "git" | head -10
```

管道就像流水线，前一个命令的输出是后一个命令的输入。可以无限串联，打造自己的数据处理流水线。

---

## 常用组合示例

```bash
# 找最大的10个文件
find . -type f -exec du -h {} \; | sort -rh | head -10

# 统计代码行数（排除空行和注释）
grep -v "^$" *.c | grep -v "^//" | wc -l

# 实时查看日志并过滤
tail -f app.log | grep "ERROR"

# 找出访问量最大的IP
cat access.log | awk '{print $1}' | sort | uniq -c | sort -nr | head -20

# 备份当前目录所有.c文件
ls *.c | xargs -i cp {} {}.bak
```

---
# 实用工具

## `tree` - 树形显示目录

```bash
tree                    # 显示当前目录树
tree -d                 # 只显示目录
tree -a                 # 显示所有文件（包括隐藏）
tree -L 2               # 只显示2层深度
tree -I "*.c"           # 忽略所有.c文件
```

**输出示例**：
```
.
├── src
│   ├── main.c
│   ├── utils.c
│   └── include
│       └── utils.h
├── Makefile
└── README.md
```

`tree` 就像给文件夹拍了一张全景照片，一眼就能看清整个项目结构。

---

## `man` - 查看命令手册

即 manual 的缩写。

```bash
man ls                  # 查看ls命令的详细用法
man printf              # 查看printf函数的说明
man 3 printf            # 查看C库函数printf（3表示第3章，库函数）
man -k keyword          # 搜索包含keyword的手册页
```

**操作技巧**：
- 按 `空格` 翻下一页
- 按 `b` 翻上一页
- 按 `/` 搜索，按 `n` 跳到下一个匹配
- 按 `q` 退出

**手册章节**：
1. 用户命令
2. 系统调用
3. C 库函数
4. 设备文件
5. 文件格式
6. 游戏
7. 杂项
8. 系统管理命令

当你忘了某个命令怎么用，`man 命令` 就是你的救命稻草。

---

# 速查表

| 命令          | 一句话记法    |
| ----------- | -------- |
| `ls`        | 看文件夹里有什么 |
| `cd`        | 去哪个目录    |
| `pwd`       | 我在哪      |
| `mkdir`     | 新建文件夹    |
| `touch`     | 新建空文件    |
| `cp`        | 复制       |
| `mv`        | 移动或改名    |
| `rm`        | 删除       |
| `cat`       | 看文件内容    |
| `head/tail` | 看开头/结尾   |
| `grep`      | 找内容      |
| `find`      | 找文件      |
| `chmod`     | 改权限      |

---

# 最后的小贴士

1. **按 Tab 自动补全** - 输入命令或文件名时，按 Tab 键自动补全，按两次 Tab 显示所有可能
2. **按上箭头** - 查看刚才用过的命令
3. **`Ctrl+R`** - 搜索历史命令（输入关键字，按多次可循环查找）
4. **`!!`** - 执行上一条命令
5. **`!$`** - 上一条命令的最后一个参数
6. **`命令 &`** - 后台运行命令
7. **`;`** - 顺序执行多个命令（如 `cd ..; ls -l`）
8. **`&&`** - 前一个成功才执行后一个（如 `make && ./program`）
9. **`||`** - 前一个失败才执行后一个（如 `make || echo "编译失败"`）

---

掌握了这些，你已经能应付绝大多数 Linux 日常操作了！剩下的就是多练习，多用。