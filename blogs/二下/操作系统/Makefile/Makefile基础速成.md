# 什么是 Makefile？

Makefile 是构建自动化工具 make 的配置文件，核心思想是定义**依赖关系**和**构建规则**。当你面对大型项目不知所措时，从 Makefile 开始读往往是最佳选择。

**相当于：** 项目的"施工说明书"——告诉 make：要盖楼（目标），需要先有砖和水泥（依赖），然后怎么砌（命令）。

---

# 基本格式

```makefile
目标: 依赖1 依赖2 ...
	命令1
	命令2
	...
```

**⚠️ 致命陷阱：** 命令前面必须用**Tab**缩进，不能用空格！

#### 最简单的例子

```makefile
helloworld: helloworld.c
	gcc -o helloworld helloworld.c
```

执行：
```bash
make helloworld   # 编译
make              # 默认构建第一个目标
```

**相当于：** 你说"给我个 hello 程序"，make 检查 helloworld. C 有没有更新，然后自动编译。

---

# 工作原理

Make 根据**时间戳**判断是否需要重新编译：

| 目标类型 | 判断逻辑 |
|---------|---------|
| 文件目标不存在 | 需要编译 |
| 文件目标存在 | 检查依赖时间戳，有更新的依赖则编译 |
| 依赖包含伪目标 | 总是需要编译 |
| 伪目标 | 总是需要编译 |

---

# 基本语法

## 伪目标

有时目标不是文件，比如 `clean`，要用 `.PHONY` 声明：

```makefile
.PHONY: clean all

all: helloworld          # all是惯例，表示完整构建

helloworld: helloworld.c
	gcc -o helloworld helloworld.c

clean:
	rm -f helloworld
```

**为什么需要伪目标？**  
如果没有 `.PHONY: clean`，且当前目录恰好有个叫 `clean` 的文件，make 会认为"clean 已经存在，不用执行"——你的清理命令就废了。

---

## 变量

变量让 Makefile 更简洁：

```makefile
# 赋值（所有值都是字符串）
CC := gcc                 # := 是简单展开变量
FILES := main.c utils.c
TARGET := program

$(TARGET): $(FILES)
	$(CC) -o $(TARGET) $(FILES)

# 引号直接作为值的一部分
a := one two              # 值就是"one two"
b := 'one two'            # 值就是"'one two'"
```

**相当于：** 把常用工具名存成快捷方式。

---

## 完整示例

```makefile
# 变量定义
CC := gcc
TARGET := helloworld

# 伪目标声明
.PHONY: all clean

# 第一个目标（默认构建）
all: $(TARGET)

# 编译规则
$(TARGET): $(TARGET).c
	$(CC) -o $(TARGET) $(TARGET).c

# 清理
clean:
	rm -f $(TARGET)
```

执行效果：
```bash
$ make clean    # 删除可执行文件
$ make all      # 编译（或不指定目标直接make）
gcc -o helloworld helloworld.c
```

---

## 常见错误

| 错误信息 | 原因 | 解决 |
|---------|------|------|
| `missing separator. Stop.` | 命令前用了空格，不是 Tab | 改成 Tab 缩进 |
| `No rule to make target 'xxx.c'` | 依赖文件不存在 | 检查文件路径 |
| `Nothing to be done for 'target'` | 目标已最新 | 正常现象 |

---

## 为什么大型项目都用 Makefile？

- **自动化**：一次编写，重复使用
- **智能编译**：只重新编译有变动的文件
- **跨语言**：支持任何能用命令行编译的语言
- **标准化**：从 Linux 内核到日常项目都在用

**相当于：** 项目的"总指挥"，知道谁依赖谁，谁该什么时候干活。

---

# 写在最后

本文内容参考自操作系统教学材料，结合实战经验整理。部分内容采用了 AI 技术生成~