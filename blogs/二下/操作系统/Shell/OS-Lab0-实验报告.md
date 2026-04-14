---
type: 系统笔记
excerpt: 操作系统Lab0课下实验实验报告
series: 操作系统实验报告
order: "1"
---
# 思考题

## Thinking 0.1

> 思考下列有关Git的问题： 
> 
> - 在已初始化的 `~/learnGit` 目录下，创建一个名为 `README.txt` 的文件。执行命令 `git status > Untracked.txt`
> 
>  - 在 `README.txt` 文件中添加任意文件内容，然后使用 `add` 命令，再执行命令 ` git status > Stage.txt `。
> 
>  - 提交 `README.txt`，并在提交说明里写入自己的学号。 
> 
> - 执行命令 `cat Untracked.txt` 和 `cat Stage.txt `，对比两次运行的结果，体会 `README.txt` 两次所处位置的不同。 
> 
> - 修改 `README.txt` 文件，再执行命令 `git status > Modified.txt`。 
> 
> - 执行命令 `cat Modified.txt`，观察其结果和第一次执行 `add` 命令之前的 status 是否一样，并思考原因。

1. 第一步中，创建完 `READE.txt` 文件后，我们并未执行 `add` 命令，就直接执行了 `git status` 命令。此时，这个文件未被加入暂存区，属于 **“未跟踪的文件”**。【Untracked】

2. 而第二步执行了 `add` 命令，此时这个文件被加入了暂存区，但未提交，会提示 **“要提交的变更”** 。【Staged】

3. 第三步提交了文件之后，工作目录变得很干净整洁，`README.txt` 文件已被 git 管理。【Unmodified】

4. 第五步重新修改了 `README.txt`，但是并没有 `add`。此时，git 发现了其管理的文件有修改，会提示 **“尚未暂存以备提交的变更”**。【Modified】
## Thinking 0.2

> 思考一下add the file、stage the file和 commit 分别对应的是Git里的哪些命令呢？

| 描述             | 命令           |
| -------------- | ------------ |
| Add the file   | `git add`    |
| Stage the file | `git add`    |
| Commit         | `git commit` |

这里体现了 `add` 命令既可以将新建的文件加入暂存区，也可以将有变更的文件更新到暂存区。

## Thinking 0.3

> 思考下列问题： 
> 
> 1. 代码文件 `print.c` 被错误删除时，应当使用什么命令将其恢复？ 
> 
> 2. 代码文件 `print.c` 被错误删除后，执行了 `git rm print.c` 命令，此时应当使用什么命令将其恢复？ 
> 
> 3. 无关文件 `hello.txt` 已经被添加到暂存区时，如何在不删除此文件的前提下将其移出暂存区？

### 第一问

我们只是不小心将其删除了，没有 `add` 或 `commit`，因此只需要将这个文件**恢复为暂存区的版本或者最后一次提交的状态**。

#### 执行 `git restore print.c` 即可。

或者执行 `git checkout -- print.c`，也是等价的效果。

### 第二问

我们直接通过 `rm` 命令将这个文件从暂存区删除了，所以首先需要**撤销对暂存区的修改**，然后再恢复其文件内容。

```bash
git reset HEAD print.c
git restore print.c
# 当然，第二行同样也可以改为： git checkout -- print.c
```

### 第三问

我们现在需要**撤回暂存区的文件**到工作区，但不改变文件内容。

#### 可以执行 `git rm --cached hello.txt`

或者执行 `git restore --staged hello.txt`

但二者其实并不等价。执行第一种命令时，会直接让 git 放弃对 `hello.txt` 的跟踪。一般来说，在这个文件后来确实需要完全删掉的时候可以这么用；而第二种命令则只是放弃这次 `add` 而已，git 仍然会追踪。

## Thinking 0.4

> 思考下列有关Git的问题： 
> 
> - 找到在 `/home/2xxxxxxx/learnGit` 下刚刚创建的 `README.txt` 文件，若不存在则新建该文件。 
> 
> - 在文件里加入 `Testing 1`，`git add`，`git commit`，提交说明记为1。 
> 
> - 模仿上述做法，把1分别改为2和3，再提交两次。 
> 
> - 使用 `git log` 命令查看提交日志，看是否已经有三次提交，记下提交说明为3的哈希值。 
> 
> - 进行版本回退。执行命令 `git reset --hard HEAD^` 后，再执行 `git log`，观察其变化。 
> 
> - 找到提交说明为1的哈希值，执行命令 `git reset --hard <hash>` 后，再执行 `git log`，观察其变化。 
> 
> - 现在已经回到了旧版本，为了再次回到新版本，执行 `git reset --hard <hash>` ，再执行 `git log`，观察其变化。

1. 第一次执行 `git log` 后，已有 3 次提交，我在执行的时候，提交说明为 3 的哈希值为 `e2db7b571b15c23135b87a1414a629724f9bb594`

2. 第二次执行 `git log` 后，第 3 次提交消失。

3. 第三次执行 `git log` 后，第 2 次提交也消失了。说明通过哈希值可以回退到对应的版本。

4. 最后一次执行 `git log` 后，又回到了 3 次提交的状态。

## Thinking 0.5

> 执行如下命令, 并查看结果 
> 
> - `echo first` 
> 
> - `echo second > output.txt` 
> 
> - `echo third > output.txt` 
> 
> - `echo forth >> output.txt`

运行结果如下：

```shell
git@24371379:~/learnGit (master)$ echo first
first
git@24371379:~/learnGit (master)$ echo second > output.txt
git@24371379:~/learnGit (master)$ cat output.txt
second
git@24371379:~/learnGit (master)$ echo third > output.txt
git@24371379:~/learnGit (master)$ cat output.txt
third
git@24371379:~/learnGit (master)$ echo forth >> output.txt
git@24371379:~/learnGit (master)$ cat output.txt
third
forth
```

## Thinking 0.6

> - 使用你知道的方法（包括重定向）创建下图内容的文件（文件命名为 `test`），将创建该文件的命令序列保存在 `command` 文件中，并将 `test` 文件作为批处理文件运行，将运行结果输出至 `result` 文件中。
> 
> -  给出 `command` 文件和 `result` 文件的内容，并对最后的结果进行解释说明（可以从test文件的内容入手）。
> 
> - 具体实现的过程中思考下列问题: `echo echo Shell Start` 与 `echo 【反引号】echo Shell Start【反引号】 `  效果是否有区别; `echo echo $c>file1` 与 ` echo 【反引号】echo $c>file1【反引号】` 效果是否有区别。

由于需要创建一个很长的文件，直接在命令行内写的话不好看，而且如果写错了也不是很好修改，不如写一个 shell 脚本。

以下是 `command.sh` 文件的内容：

```bash
#!/bin/bash  
   
touch test
echo 'echo Shell Start...' > test
echo 'echo set a = 1' >> test
echo 'a=1' >> test
echo 'echo set b = 2' >> test
echo 'b=2' >> test
echo 'echo set c = a+b' >> test
echo 'c=$[$a+$b]' >> test
echo 'echo c = $c' >> test
echo 'echo save c to ./file1' >> test
echo 'echo $c>file1' >> test
echo 'echo save b to ./file2' >> test
echo 'echo $b>file2' >> test
echo 'echo save a to ./file3' >> test
echo 'echo $a>file3' >> test
echo 'echo save file1 file2 file3 to file4' >> test
echo 'cat file1>file4' >> test
echo 'cat file2>>file4' >> test
echo 'cat file3>>file4' >> test
echo 'echo save file4 to ./result' >> test
echo 'cat file4>>result' >> test
```

运行 `bash command.sh` 之后，再运行 `bash test`。最后查看 `result` 文件的内容为：

```text
3
2
1
```

`echo echo Shell Start` 指令是直接输出 `echo Shell Start` 这个字符串；

 `echo 【反引号】echo Shell Start【反引号】` 则是将 `echo Shell Start` 这个指令的输出作为 `echo` 指令的参数，因此输出 `Shell Start`。

同理， `echo echo $c>file1` 与 ` echo 【反引号】echo $c>file1【反引号】` 也是一样的。

# 难点分析

![](../assets/OS-Lab0-实验报告/difficulty.png)

这里借用了 Hyggge 学长的博客附图~

同时，我也是才知道原来还有 `echo 【反引号】echo Shell Start【反引号】` 这样的写法。

这种写法乍一看很像管道，都是把两个命令连接起来。但实际上不是。这种写法是将反引号内的命令的输出作为主命令的**参数**，而管道是把前一个命令的输出作为后一个命令的**输入**。二者有本质的区别。

其实类比一下，反引号里的东西就是个参数从句！这样说应该很明了了吧哈哈哈。

# 实验体会

## Git 大学习

前几个学期完成大作业或是自己心血来潮制作网页的时候，其实已经用过很多 git 相关的东西了。但是当时只是通过 VScode 或是 IDEA 这种 git 可视化工具辅助的，通过阅读它们的提示也基本能够完成。

前段时间将我的博客部署到服务器上的时候，也学了一点用 Linux 命令行来使用 git 同步远程和本地仓库。

直到这个学期，我才知道原来现在才开始系统学 git，我也发现很多我曾经一知半解或者根本没有涉猎的地方。

## 知行合一

其实我早就感觉到了我这个缺点：感觉学会了但其实到用的时候根本就想不起来。

在整理笔记的时候，把 git、Linux、Makefile 等等的新语法或命令格式完完整整地梳理了一遍，其实花了不少时间，但一到做题其实时不时还是得回过头来看指导书或者笔记。

还是得要多做一点题目。哎。不说要怎么刷题，至少每个命令自己得要不借助外力写一遍。尤其是现在 AI 已经那么发达了，不要总是想着依赖 AI。希望自己能够改掉这个坏习惯。

## 说到 AI

如今回过头来看学长的博客，确实挺有感触。Hyggge 学长在 2022 年的博客中的感想中写道：

> 因为指导书所提供的学习内容比较局限，在一些常用的命令介绍上也仅仅是抛砖引玉（例如awk，sed等），所以许多重要的用法还需要在google上查找资料自学。

现在看到“百度”“Google”这种搜索引擎，已经感觉像是过去式了。我的笔记很多都是用 AI 帮忙整理的，愈发感到搜索引擎的无力。

很敬佩学长们学习这些未知领域时候的拼劲与闯劲，在海量的资料里面不断提炼适合自己的，且尽力看懂，是一件很宝贵的精神。

在此也勉励自己不要因为有 AI 而放弃了资料检索的能力，后续写论文、做研究肯定是需要有这种能力的。加油！

# 原创说明

本文借鉴了 [Hyggge学长的博客](http://hyggge.github.io/2022/03/21/os/os-lab0-shi-yan-bao-gao/)（虽然我其实并不认识这位佬）以及好强好强的[杨导的博客](https://yanna-zy.github.io/2023/03/19/BUAA-OS-0/)

同时也非常感谢与我一起讨论的同学们。

（特别鸣谢 Deepseek、Copilot 的大力协助。D 老师 C 老师没有你们我可怎么办啊!!）