---
type: 系统笔记
series: 操作系统实验详解
order: "4"
excerpt: 操作系统系统调用MOS具体实现方法，暨2421 Lab4梳理总结
---
# MOS 具体实现方法

## 系统调用的原理

### 内核态提供给用户态的接口

我们知道，系统调用会导致**用户态陷入内核态**。所以我们必须得要提供一个**入口**（接口），让用户态程序可以主动进行系统调用。

在 `user/lib/syscall_lib.c` 中，定义了所有系统调用的函数，如：

```C
int syscall_print_cons(const void *str, u_int num) {
	return msyscall(SYS_print_cons, str, num);
}

u_int syscall_getenvid(void) {
	return msyscall(SYS_getenvid);
}

int syscall_env_destroy(u_int envid) {
	return msyscall(SYS_env_destroy, envid);
}
```

不难发现，每一个系统调用函数其实都调用了另一个函数 `msyscall`。而且，这个函数的参数是可变长的。

再来看 `msyscall` 函数的定义（`user/lib/syscall_wrap.S`）：

```asm
// Exercise 4.1
LEAF(msyscall)
	syscall
	jr	ra
END(msyscall)
```

非常简单，只有两行代码，一行代码是 `syscall`，这个 MIPS 指令用于让程序产生一个**异常**，即**系统异常**，而处理异常则是内核态的事情了。

> 第二行代码是返回当前 `$v0` 寄存器的值。这个返回值会保存在当前进程的 `Trapframe` 的相应寄存器中。这一点在后面 Fork 的时候会用到，在这一小节（系统调用的原理）的末尾有一个例题，如果能够理解例题，那么后续的相关代码应该没有困难了。

#### 所以，内核态提供给用户程序的接口，只有异常。

### 处理和分发异常

一旦遇到异常，硬件会跳转到异常入口地址（包括 `syscall` 在内的通用异常入口 `exc_gen_entry` 为 ` 0x80000180 `，**这个地址处于内核态**），并将异常码设为 8（即系统调用的异常码）。这是硬件自己执行的，没有代码。

> **异常入口 `exc_gen_entry` 的位置**
> 
> 位于链接脚本 `kernel.lds` 中（其实 Lab 1 就看了这个代码，但是没有关注）：
> 
> ```C
> . = 0x80000180;
> .exc_gen_entry : {
> 	*(.text.exc_gen_entry)
> }
> ```

做完之后，我们还要用代码**保存现场**（`Trapframe`），再跳转到**异常处理函数**。

这是 Lab 3 的内容，我们回看一下相关代码（`kern/entry.S`）：

```asm
exc_gen_entry:
        SAVE_ALL
        mfc0    t0, CP0_STATUS
        and     t0, t0, ~(STATUS_UM | STATUS_EXL | STATUS_IE)
        mtc0    t0, CP0_STATUS
        mfc0    t0, CP0_CAUSE	// 这就是异常码（系统调用是8）！
        andi    t0, t0, 0x7c
        lw      t0, exception_handlers(t0)
        jr      t0
```

程序会开始执行这一段代码，其中 `jr t0` 这行代码就会直接跳转到 `exception_handlers` 数组。注意，这是一个函数指针数组，回顾一下代码（`kern/traps.c`）：

```C
void (*exception_handlers[32])(void) = {
    [0 ... 31] = handle_reserved,
    [0] = handle_int,
    [2 ... 3] = handle_tlb,
#if !defined(LAB) || LAB >= 4
    [1] = handle_mod,
    [8] = handle_sys,
#endif
};
```

所以，`jr t0` 实际上会直接跳转运行数组中偏移 `t0` 处的指针对应的函数。（这个 `t0` 不是数组的角标，而是数组地址到所需项地址的偏移值。）

**对于系统调用来说**，因为异常码是 8，所以就对应了 `handle_sys`。

---

**这些函数定义在哪呢？** 答案在 `kern/genex.S`：

先看一下这个文件中的宏定义，这个很重要。

```asm
.macro BUILD_HANDLER exception handler
NESTED(handle_\exception, TF_SIZE + 8, zero)
	move    a0, sp           # 将栈指针作为第一个参数传递给C函数
	addiu   sp, sp, -8       # 调整栈指针（压栈）
	jal     \handler         # 调用C处理函数
	addiu   sp, sp, 8        # 恢复栈指针（弹栈）
	j       ret_from_exception  # 跳转到公共返回路径
END(handle_\exception)
.endm
```

这个宏定义可以构造任何一个处理函数的入口，如这次 Lab 4 所需的：

```asm
BUILD_HANDLER mod do_tlb_mod
BUILD_HANDLER sys do_syscall
```

我们先关注正在讲的 `do_syscall`，也就是说，如果异常是系统调用，则异常处理函数的入口为 `handle_sys`，跳转到函数 `do_syscall`。

> TLB Mod 异常的处理将在 Fork 机制详解中再分析。

### 系统调用处理

函数 `do_syscall` 位于 `kern/syscall_all.c` 中。该函数用于实现系统调用的**分发和运行**。

---

在读懂这个函数之前，我们必须要先复习一下计组实验中学到的 MIPS 寄存器的编号。

| 汇编名       | 别名        | 用途   |
| --------- | --------- | ---- |
| `$0`      | `$zero`   | 常数   |
| `$1`      | `$at`     | 汇编临时 |
| `$2-$3`   | `$v0-$v1` | 返回值  |
| `$4-$7`   | `$a0-$a3` | 参数   |
| `$8-$15`  | `$t0-$t7` | 临时   |
| `$16-$23` | `$s0-$s7` | 保存   |
| `$24-$25` | `$t8-$t9` | 临时   |
| `$26-$27` | `$k0-$k1` | 内核   |
| `$28`     | `$gp`     | 全局指针 |
| `$29`     | `$sp`     | 栈指针  |
| `$30`     | `$fp`     | 帧指针  |
| `$31`     | `$ra`     | 返回地址 |

其中重点关注一下：

1.  `$a0-$a3` 参数寄存器：用于保存参数，后续调用函数的时候一般从这里取值。
2. `$v0-$v1` 返回值寄存器：用于保存调用函数后返回的值。
3. `$sp` 栈指针：MIPS 调用函数之前，必须要给函数分配一定大小的**栈帧**，用于存储参数、局部变量、返回地址等。由于 MIPS 一共只有 4 个参数寄存器，但函数的参数不一定只有 4个，所以多余的参数会存储在栈内。

> **栈帧的实现细节**
> 
> 寄存器 `$a0-$a3` 用于存放函数调用的前四个参数，其余的参数存放在栈中。
> 
> 但是，即使前四个参数不要求存储在栈中，还是**需要在栈中预留空间**。

[task]
[question]
在 MOS 中，参数最多的系统调用需要接收 6 个参数。用户态程序执行 `msyscall` 指令触发系统调用时，对于这 6 个参数传递的规范，下列说法正确的是?（）
[\question]
[options]A 所有参数均直接压入用户栈中传递，内核从用户栈读取。[\options]
[options]B 6 个参数全部存放在 `$a0-$a3` 寄存器中传递。[\options]
[options]C 前 4 个参数存放在 `$a0-$a3` 寄存器中，后 2 个参数存放在用户栈中，且调用方无需为前 4 个参数在栈上预留空间。[\options]
[options]D 前 4 个参数存放在 `$a0-$a3` 寄存器中，后 2 个参数存放在用户栈中，且调用方的栈帧必须至少预留 16 字节的空间。[\options]
[answer]D[\answer]
[analysis]
在 MIPS 架构的 MOS 系统中，系统调用参数传递遵循 MIPS O32 调用约定：前 4 个参数通过寄存器 `$a0-$a3` 传递，第 5 个及以后的参数通过用户栈传递。同时，调用约定要求调用方的栈帧必须为前 4 个寄存器参数预留 16 字节的空间（每个参数 4 字节），即使这些参数实际上已通过寄存器传递。选项 D 正确。[\analysis]
[\task]

---

由于 `do_syscall` 函数需要分发系统调用，我们还需要先知道**怎么分发系统调用**。

其实，和**分发异常**的方法如出一辙：在一个函数指针数组中找到对应的函数，然后执行这个函数。

这个数组也在 `kern/syscall_all.c` 中：

```C
void *syscall_table[MAX_SYSNO] = {
    [SYS_putchar] = sys_putchar,
    [SYS_print_cons] = sys_print_cons,
    [SYS_getenvid] = sys_getenvid,
    [SYS_yield] = sys_yield,
    [SYS_env_destroy] = sys_env_destroy,
    [SYS_set_tlb_mod_entry] = sys_set_tlb_mod_entry,
    [SYS_mem_alloc] = sys_mem_alloc,
    [SYS_mem_map] = sys_mem_map,
    [SYS_mem_unmap] = sys_mem_unmap,
    [SYS_exofork] = sys_exofork,
    [SYS_set_env_status] = sys_set_env_status,
    [SYS_set_trapframe] = sys_set_trapframe,
    [SYS_panic] = sys_panic,
    [SYS_ipc_try_send] = sys_ipc_try_send,
    [SYS_ipc_recv] = sys_ipc_recv,
    [SYS_cgetc] = sys_cgetc,
    [SYS_write_dev] = sys_write_dev,
    [SYS_read_dev] = sys_read_dev,
};
```

---

**怎么知道需要分配哪个系统调用？**

再回到一开始所说的，每个系统调用函数都调用了 `msyscall` 函数。其实，`msyscall` 函数的参数中，第一个就是**所需的系统调用**在 `syscall_table` 数组中的下标，剩下的就是对应系统调用的**其他参数**。【*记得调用函数的参数应该存放在哪些寄存器内吗？*】

---

解决以上所有问题后，终于可以完成 `do_syscall` 函数了！

```C
// Exercise 4.2
void do_syscall(struct Trapframe *tf) {
	int (*func)(u_int, u_int, u_int, u_int, u_int);
	int sysno = tf->regs[4];
	
	if (sysno < 0 || sysno >= MAX_SYSNO) {
		tf->regs[2] = -E_NO_SYS;
		return;
	}

	tf->cp0_epc += 4;
	func = syscall_table[sysno];

	u_int arg1 = tf->regs[5];
	u_int arg2 = tf->regs[6];
	u_int arg3 = tf->regs[7];
	u_int arg4 = *(u_int *)(tf->regs[29] + 4);
	u_int arg5 = *(u_int *)(tf->regs[29] + 5);

	tf->regs[2] = func(arg1, arg2, arg3, arg4, arg5);
}
```

> **`tf->cp0_epc += 4;` 这行代码的意义**
> 
> EPC （Exception Program Counter）存储的是发生异常的指令地址。如果不动这个地址，则异常返回后依然回到 EPC 存储的地址取指并执行。
> 
> 所以，如果不写这行代码，后面又会再次执行 `syscall` 指令，这显然不对。
> 
> 根据上学期计组的知识，我们不难知道，应该给 EPC 加 4，即一个字的长度（4 个字节，32 位），因为 MIPS 指令集的每条指令都是 4 个字节，是定长的。

[task]
[question]
在 MOS 中，系统调用号（如 `SYS_mem_alloc`）的作用和传递方式，下列描述错误的是（）
[\question]
[options]A 系统调用号是内核 `do_syscall` 中区分具体要执行哪个 `sys_*` 函数的依据。[\options]
[options]B 所有的系统调用执行时，在 MIPS 硬件层面均统一触发 8 号异常（Syscall 异常）。[\options]
[options]C 用户态包装函数调用 `msyscall` 时，系统调用号作为第一个参数，存放在 `$a0` 寄存器中传入内核。[\options]
[options]D 系统调用号在内核态处理完成后，会被内核清零以防止信息泄露。[\options]
[answer]D[\answer]
[analysis]
选项 A、B、C 均正确，选项 D 错误。

- 选项 A 正确：`do_syscall` 根据系统调用号（如 `SYS_mem_alloc`）通过 `switch` 语句或跳转表调用对应的内核处理函数（如 `sys_mem_alloc`）。
- 选项 B 正确：在 MIPS 架构中，`syscall` 指令会统一触发异常码为 8 的异常（`EXC_SYS`），无论调用哪个系统调用号。
- 选项 C 正确：按照 MIPS O 32 调用约定，第一个参数通过 `$a0` 传递。用户态包装函数通常将系统调用号放在 `$a0`，然后调用 `msyscall`（或内联汇编执行 `syscall` 指令）。
- 选项 D **错误**：内核不会主动清零系统调用号。系统调用返回后，`$v0` 被设为返回值，而 `$a0` 等寄存器通常保持不变（或视为已破坏，但不会特意清零）。信息泄露并非系统调用号需要关注的问题。[\analysis]
[\task]

### 从内核态返回用户态

#### 这个部分在后续 `fork` 中十分关键，但现在可以先不用关注太多。

上面 `kern/genex.S` 在调用完 `do_syscall` 之后，最后返回到了 `ret_from_exception`。让我们再来看看这个标签的代码（同样在这个文件里）：

```asm
FEXPORT(ret_from_exception)
	RESTORE_ALL
	eret	// 返回用户态
```

这里的 `RESTORE_ALL` 非常重要，表示恢复当前进程的 `Trapframe` 中的寄存器的值（**恢复现场**）。

这对应的就是在 `SAVE_ALL` 中保存的值。需要先保存再恢复的原因是：在陷入内核前后，难以保证寄存器不会被修改。为了保证系统调用前后进程的上下文不变，必须先保存后恢复。

具体实现方法就是把当前进程的 `Trapframe` 中保存的值再用 `lw` 指令赋给寄存器。

[task]
[question]
当系统陷入内核处理系统调用时，内核需要获取用户态传递的参数并将返回值交还给用户程序。关于这一过程，下列描述错误的是?（）
[\question]
[options]A 陷入内核后，SAVE_ALL 宏会将原用户进程的现场以 Trapframe 结构格式保存到内核栈的中。[\options]
[options]B 内核中的 do_syscall 函数通过传入的 Trapframe 指针读取保存的用户进程现场，从而获取系统调用号和相关参数。[\options]
[options]C 系统调用执行完毕后，内核直接将返回值写入用户进程的进程控制块（PCB）中，用户程序再从 PCB 中读取。[\options]
[options]D 内核会将系统调用的返回值覆写到 Trapframe 结构保存的 `$v0` 寄存器位置，随后恢复现场返回用户态。[\options]
[answer]C[\answer]
[analysis]
系统调用执行完毕后，内核并不会将返回值写入用户进程的 PCB 中。正确的做法是：内核将返回值写入 Trapframe 结构中保存的 `$v0` 寄存器位置，当用户程序恢复现场返回用户态时，`$v0` 寄存器中即为返回值。用户程序直接从 `$v0` 寄存器获取返回值，而非从 PCB 读取。因此选项 C 描述错误。[\analysis]
[\task]

---

#### 到这里，整个系统调用的机制已经完善了！只需要专项攻破各个具体的系统调用即可！

## 系统调用函数一览

| 系统调用号                      | 系统调用函数（内核函数）                                                                  | 函数功能                |
| -------------------------- | ----------------------------------------------------------------------------- | ------------------- |
| **SYS_putchar**​           | `sys_putchar(int c)`                                                          | 在屏幕上打印一个字符          |
| **SYS_print_cons**​        | `sys_print_cons(const void *s, u_int num)`                                    | 在屏幕上打印字符串           |
| **SYS_getenvid**​          | `sys_getenvid(void)`                                                          | 获取当前进程的环境ID         |
| **SYS_yield**​             | `sys_yield(void)`                                                             | 让出CPU时间片，调度其他进程     |
| **SYS_env_destroy**​       | `sys_env_destroy(u_int envid)`                                                | 销毁指定环境（进程）          |
| **SYS_set_tlb_mod_entry**​ | `sys_set_tlb_mod_entry(u_int envid, u_int func)`                              | 注册用户空间TLB修改异常处理入口   |
| **SYS_mem_alloc**​         | `sys_mem_alloc(u_int envid, u_int va, u_int perm)`                            | 分配物理页并映射到虚拟地址       |
| **SYS_mem_map**​           | `sys_mem_map(u_int srcid, u_int srcva, u_int dstid, u_int dstva, u_int perm)` | 映射源环境的物理页到目标环境      |
| **SYS_mem_unmap**​         | `sys_mem_unmap(u_int envid, u_int va)`                                        | 解除虚拟地址的页映射          |
| **SYS_exofork**​           | `sys_exofork(void)`                                                           | 创建子环境（fork 的实现）     |
| **SYS_set_env_status**​    | `sys_set_env_status(u_int envid, u_int status)`                               | 设置环境状态（可运行/不可运行）    |
| **SYS_set_trapframe**​     | `sys_set_trapframe(u_int envid, struct Trapframe *tf)`                        | 设置环境的Trapframe（异常帧） |
| **SYS_panic**​             | `sys_panic(char *msg)`                                                        | 内核恐慌，打印消息并停止系统      |
| **SYS_ipc_try_send**​      | `sys_ipc_try_send(u_int envid, u_int value, u_int srcva, u_int perm)`         | 尝试发送IPC消息给目标环境      |
| **SYS_ipc_recv**​          | `sys_ipc_recv(u_int dstva)`                                                   | 接收IPC消息，阻塞等待        |
| **SYS_cgetc**​             | `sys_cgetc(void)`                                                             | 从控制台读取一个字符          |
| **SYS_write_dev**​         | `sys_write_dev(u_int va, u_int pa, u_int len)`                                | 向设备物理地址写入数据         |
| **SYS_read_dev**​          | `sys_read_dev(u_int va, u_int pa, u_int len)`                                 | 从设备物理地址读取数据         |

## 基础系统调用函数

### `sys_mem_alloc`：申请内存

乍一看这个系统调用的功能：分配物理页并映射到虚拟地址，这不就是我们 Lab 2 写的 `page_alloc` 和 `page_insert` 函数的功能吗！

其实这就是系统调用和内核函数直接的联系。系统调用是用户态程序发起的请求，然后具体实现方法才是内核函数。也就是说，`sys_mem_alloc` 函数肯定是会用到 `page_alloc` 和 `page_insert` 的！

---

同时，由于这是程序发起的请求，我们必须要知道**这是哪个进程**，否则我们怎么知道要用哪个进程的 `pgdir` 和 `asid` 呢？

因此，我们需要先写一个函数，由 `envid` 获取进程控制块(`kern/env.c`)：

```C
// Exercise 4.3
int envid2env(u_int envid, struct Env **penv, int checkperm) {
	struct Env *e;

	if (envid == 0) {
		*penv = curenv;
		return 0;
	}

	e = &envs[ENVX(envid)];
	
	if (e->env_status == ENV_FREE || e->env_id != envid) {
		return -E_BAD_ENV;
	}
	// 需要检查的原因和逻辑后续再详细说明
	if (checkperm != 0) {
		if (e != curenv && e->env_parent_id != curenv->env_id) {
			return -E_BAD_ENV;
		}
	}

	*penv = e;
	return 0;
}
```

> 这个函数的参数 `checkerm` 只是一个控制是否检查权限的开关，可以人为控制。不过，大多数情况下，都需要检查权限，所以引用该函数时将 `checkperm` 直接定为 1 即可。（本实验中仅有一个例外）

---

现在我们的思路就很明了了：在判断虚拟地址合法后，先通过 `envid` 找到对应的进程控制块，然后分配一个物理页，再插入到页表中。

```C
// Exercise 4.4
int sys_mem_alloc(u_int envid, u_int va, u_int perm) {
	struct Env *env;
	struct Page *pp;
	
	if (is_illegal_va(va)) {
		return -E_INVAL;
	}
	
	try(envid2env(envid, &env, 1));
	try(page_alloc(&pp));
	
	return page_insert(env->env_pgdir, env->env_asid, pp, va, perm);
}
```

> **宏—— `try`**
> 
> 这个宏的定义如下（`include/error.h`）：
> 
> ```C
> #define try(expr) \
>     do { \
>         int _r = (expr); \
>         if (_r != 0) \
>             return _r; \
>     } while (0)
> ```
> 
> 其实和之前实验中，类似：
> 
> ```C
> r = env_setup_vm(e);
>     if (r != 0) {
>         return r;
>     }
> ```
> 
> 这样的结构是一致的，只是降低了代码的重复性而已。

### `sys_mem_map`：映射源环境的物理页到目标环境

这个系统调用的功能是让一个进程的虚拟地址也映射源进程映射到的物理页。不过现在看这个系统调用感觉莫名其妙，什么时候会用到这个呢？其实，在后续会讲到的 IPC、Fork 等处都会用到。

但由于这个涉及到两个不同的进程，所以必须得要**保证安全性**才能操作。如果两个进程间无关，那我们必须得要防止使用这个系统调用，以免泄露数据。所以我们规定：

#### 只有源进程和目标进程都是当前进程或其直接子进程才行。

而要检查这个，可以将 `envid2env` 函数中的参数 `checkperm` 设置为 1 就行了！现在再回头看 `envid2env` 函数中的这一部分就明白逻辑了。

---

- **现在再来思考如何实现这个系统调用。**

首先，传入的参数包括：源进程和目标进程的 `envid` 和 `va`，然后还有需要设置的权限 `perm`。

所以我们先要找到二者的程序控制块 `srcenv` 和 `dstenv`。然后，根据源进程的 `va` 找到其映射的物理页。最后，再将这个物理页与目标进程的 `va` 建立映射关系即可。

```C
// Exercise 4.5
int sys_mem_map(u_int srcid, u_int srcva, u_int dstid, u_int dstva, u_int perm) {
	struct Env *srcenv;
	struct Env *dstenv;
	struct Page *pp;
	
	if (is_illegal_va(srcva) || is_illegal_va(dstva)) {
		return -E_INVAL;
	}
	
	try(envid2env(srcid, &srcenv, 1));
	try(envid2env(dstid, &dstenv, 1));
	
	pp = page_lookup(srcenv->env_pgdir, srcva, NULL);
	if (pp == NULL) {
		return -E_INVAL;
	}
	
	return page_insert(dstenv->env_pgdir, dstenv->env_asid, pp, dstva, perm);
}
```

[task]
[question]
在实现 `sys_mem_alloc` 和 `sys_mem_map` 系统调用时，都需要对传入的虚拟地址（va）进行合法性检查。以下关于这些检查的描述，错误的是（）
[\question]
[options]A 传入的虚拟地址 va 必须小于 `UTOP`，以防止用户程序越权操作内核空间或意外访问不应访问的内存区域。[\options]
[options]B `va` 必须页对齐（即 `va % PAGE_SIZE == 0`）。[\options]
[options]C `sys_mem_alloc` 操作的目标进程、`sys_mem_map` 的源进程和目标进程均可以是当前进程或其他合法进程。[\options]
[options]D 只要 `va` 落在用户空间合法范围内，即使调用进程的对应虚拟地址没有映射物理页，`sys_mem_map` 也能直接成功执行共享映射。[\options]
[answer]D[\answer]
[analysis]
选项 A、B、C 均正确，选项 D 错误。

- 选项 A 正确：用户程序只能访问 `UTOP` 以下的用户空间地址，内核空间地址（`UTOP` 及以上）不允许用户态直接操作。
- 选项 B 正确：页表操作要求虚拟地址必须按页对齐（4 KB 对齐），否则会导致页表项错位。
- 选项 C 正确：`sys_mem_alloc` 可为当前进程或其他进程分配物理页；`sys_mem_map` 的源进程和目标进程均可以是当前进程或其他合法进程（需持有相应权限）。
- 选项 D **错误**：`sys_mem_map` 进行共享映射时，要求**源进程**的 `va` 处已经存在有效的物理页映射（即已通过 `sys_mem_alloc` 分配或已有映射），否则无法获取物理页框号用于目标进程的映射。单纯 `va` 落在合法范围内但无物理页映射，会导致映射失败。[\analysis]
[\task]

### `sys_mem_unmap`：解除虚拟地址的页映射

> 回想大一学习 C 语言的时候：书上总是会强调，在 `malloc` 申请内存之后一定要记得 `free` 掉。
> 
> 这里面的原因现在能够解答了吗？

其实，`malloc` 这个库函数在一些情况下就是使用了系统调用 `sys_mem_map`。然后，就建立起了物理页与虚拟地址之间的映射。如果不去取消这个映射，就会导致——虽然物理页已经不再需要被引用了，但是由于映射本身还存在，无法被回收到空闲页链表里，不能再被使用了。

如果这样过多，导致没有空闲页了，就会发生**内存泄漏**。

---

这个系统调用本身很简单，直接给出代码：

```C
// Exercise 4.6
int sys_mem_unmap(u_int envid, u_int va) {
	struct Env *e;
	
	if (is_illegal_va(va)) {
		return -E_INVAL;
	}
	
	try(envid2env(envid, &e, 1));
	
	page_remove(e->env_pgdir, e->env_asid, va);
	return 0;
}
```

### `sys_yield`：放弃当前进程对 CPU 的占有

这个系统调用并不是直接结束当前的进程，而是暂时将这个进程放在一边，让其他进程使用 CPU。

而这个，就是**并发**的原理。

这个函数本身超级简单，其实就是 Lab 3 写的 `schedule` 函数！只需要传入参数 1 以表示主动放弃即可！

```C
// Exercise 4.7
void __attribute__((noreturn)) sys_yield(void) {
	schedule(1);
}
```

现在可以再回头看看 `schedule` 函数的实现原理了。有很多不同的算法，我会在其他地方细讲，在这里不再赘述。

## IPC系统调用函数

### 对进程控制块的补充

```C
u_int env_ipc_value;   // 发送方发送的值
u_int env_ipc_from;    // 发送方的环境ID
u_int env_ipc_recving; // 此环境是否阻塞等待接收
u_int env_ipc_dstva;   // 接收页面应映射到的虚拟地址
u_int env_ipc_perm;    // 接收页面的权限
```

### `sys_ipc_recv`：等待接收消息

该函数的基本思路：

1. 将自己设置为准备接收消息的状态（`env_ipc_recving`）；
2. 获得需要接受的消息的虚拟地址（`env_ipc_dstca`）；
3. 将自己的进程阻塞（`env_status`），放弃 CPU。

代码如下：

```C
// Exercise 4.8
int sys_ipc_recv(u_int dstva) {
	if (dstva != 0 && is_illegal_va(dstva)) {
		return -E_INVAL;
	}

	curenv->env_ipc_recving = 1;
	curenv->env_ipc_dstva = dstva;
	curenv->env_status = ENV_NOT_RUNNABLE; 
	TAILQ_REMOVE(&env_sched_list, curenv, env_sched_link);
	// 保存返回值。即tf的$v0寄存器的值设为0，表示成功收到消息
	((struct Trapframe *)KSTACKTOP - 1)->regs[2] = 0;
	schedule(1);
}
```

> **为什么明明没有返回还将返回值固定为 0（成功收到消息）？**
> 
> 因为如果没有成功收到消息，说明给的参数 `dstva` 肯定是无效的。
> 
> 既然参数有效，那么一定能成功阻塞，在我们的实验中也就最终一定能成功收到消息，被唤醒。
> 
> 而现实中，有可能根本不存在消息的发送方，这个进程将一直被阻塞。我们不考虑这个情况。

> 注意保存的 `Trapframe` 在哪个地方。这个地方是 MIPS 硬件结构所固定的，记住这个位置就行。之后的有些代码也将从这里取。

[task]
[question]
在实现进程间通信（IPC）机制时，调用 `sys_ipc_recv` 函数的进程会经历一系列状态变化。下列不属于 ` sys_ipc_recv ` 函数执行逻辑的是?（）
[\question]
[options]A 将当前进程控制块的 `env_ipc_recving` 标志设置为 1。[\options]
[options]B 记录接收页面期望映射的目标虚拟地址到 `env_ipc_dstva`。[\options]
[options]C 将当前进程状态设为 `ENV_NOT_RUNNABLE` 并放弃 CPU，内核重新选取下一个进程调度。[\options]
[options]D 不断轮询检查发送方是否已经将数据写入自身的进程控制块中。[\options]
[answer]D[\answer]
[analysis]
`sys_ipc_recv` 函数的典型执行逻辑包括：设置 `env_ipc_recving = 1` 表示进程正在等待接收；将期望映射的目标地址保存到 `env_ipc_dstva`；然后将自身状态设为 `ENV_NOT_RUNNABLE` 并调用 `sched_yield` 让出 CPU，等待发送方唤醒。进程**不会**在 `sys_ipc_recv` 内部**不断轮询**检查发送方数据，而是通过阻塞等待、由发送方主动唤醒的机制实现。因此选项 D 不属于其执行逻辑。[\analysis]
[\task]

### `sys_ipc_send`：发送消息

IPC 是一种异步通信，需要先让被接收方阻塞，然后再让发送方唤醒，顺序不能搞错。

> 但在真实的操作系统中，难以保证先后顺序绝对不出错，往往会用其他方法处理。

另外，我们还规定：如果参数 `dstva` 为 0，表示我只需要获取值（`env_ipc_value`）而不需要获取物理页来映射。

---

这个函数的基本思路：

1. 如果 `dstva` 不为 0，检查是否合法；
2. 获取 `envid` 对应的进程控制块，并检查其是不是处于待接收状态（`env_ipc_recving`）；
3. 清除接收进程的接收状态，将相应数据填入进程控制块；
4. 如果 `dstva` 不为 0，传递物理页面的映射关系（和 `mem_sys_map` 类似）；
5. 修改进程控制块中的进程状态，使接受数据的进程可继续运行(`env_status`)。

代码如下：

```C
// Exercise 4.8
int sys_ipc_try_send(u_int envid, u_int value, u_int srcva, u_int perm) {
	struct Env *e;
	struct Page *p;

	if (srcva != 0 && is_illegal_va(srcva)) {
		return -E_INVAL;
	}
	
	try(envid2env(envid, &e, 0));
	
	if (e->env_ipc_recving != 1) {
		return -E_IPC_NOT_RECV;
	}
	
	e->env_ipc_value = value;
	e->env_ipc_from = curenv->env_id;
	e->env_ipc_perm = PTE_V | perm;
	e->env_ipc_recving = 0;
	
	e->env_status = ENV_RUNNABLE;
	TAILQ_INSERT_TAIL(&env_sched_list, e, env_sched_link);
	
	if (srcva != 0) {
		p = page_lookup(curenv->env_pgdir, srcva, NULL);
		if (p == NULL) {
			return -E_INVAL;
		}
		try(page_insert(e->env_pgdir, e->env_asid, p, e->env_ipc_dstva, perm));
	}
	return 0;
}
```

在这个进程运行完毕后，会根据实际使用的调度算法（即 `schedule` 函数以及与之相关的代码的实现方法，我们实验是 RR 算法）再次调用 `schedule` 函数，重新调用接收方的进程，达成通信。

[task]
[question]
进程 A 试图通过 `sys_ipc_try_send` 向进程 B 发送数据。如果此时进程 B 的 `env_ipc_recving` 标志为 0，系统会如何处理?（）
[\question]
[options]A 阻塞进程 A，直到进程 B 准备好接收为止。[\options]
[options]B 将数据暂时存放在内核的缓冲队列中，等待进程 B 随后读取。[\options]
[options]C 函数直接返回 `-E_IPC_NOT_RECV` 错误码，表明目标进程未处于接收状态。[\options]
[options]D 强制唤醒进程 B，并将数据写入进程 B 的地址空间。[\options]
[answer]C[\answer]
[analysis]
`sys_ipc_try_send` 是非阻塞的发送接口。如果目标进程 B 的 `env_ipc_recving` 标志为 0，表示 B 尚未调用 `sys_ipc_recv` 进入等待接收状态，则 `sys_ipc_try_send` 会**直接返回 `-E_IPC_NOT_RECV`**，不会阻塞 A、不会缓存数据、也不会强制唤醒 B。[\analysis]
[\task]

## Fork 相关系统调用函数

在正式进入代码之前，建议先做对思考题 4.4。

但是，为什么一个函数会产生两个不同的返回值呢？这合理吗？

让我们先查看 `fork` 函数中**与返回值有关**的部分（`user/lib/fork.c`）：

```C
int fork(void) {  
	u_int child;  
	child = syscall_exofork();  
	if (child == 0) {  
		return 0;  
	}  
	return child;  
}
```

### `sys_exofork`：实现 fork 的关键

我们要实现一个函数拥有两个不同的返回值，必须知道在 MIPS 中对于返回值的实现细节：

- **父进程是怎么获得返回值的？**

父进程是最好理解的，因为和我们正常 C 代码的流程没有差别：`child` 变量获取 `syscall_exofork` 的返回值。这个返回值来自于当前进程的是调用的 `msyscall` 的返回值、`msyscall` 的返回值来自当前的 `$v0` 寄存器、`$v0` 寄存器存储的是 `sys_exofork` 的返回值。

对，完全就是正常的流程，`sys_exofork` 返回值是多少，`syscall_exofork` 的返回值就是多少。

---

- **子进程是怎么获得返回值的？**

为了让子进程的返回值不一样，我们再看看从内核态返回用户态时**恢复现场**的逻辑：

#### 将当前进程 `Trapframe` 中保存的值用 `lw` 指令重新赋给寄存器。

那么岂不是只要在返回之前“偷偷”把 `Trapframe` 给修改了不就好了！

返回值对应的是 `$v0` 寄存器，所以将子进程的 `env_tf.reg[2]` 置 0，即可让子进程的返回值变为 0，而不是 `return` 的 `env_id`。

---

了解了以上问题之后，再写代码就游刃有余了：

```C
// Exercise 4.9
int sys_exofork(void) {
	struct Env *e;

	try(env_alloc(&e, curenv->env_id));

	e->env_tf = *((struct Trapframe *)KSTACKTOP - 1);

	e->env_tf.regs[2] = 0;

	e->env_status = ENV_NOT_RUNNABLE;
	e->env_pri = curenv->env_pri;	// 继承父进程优先级

	return e->env_id;
}
```

> **为什么 `return` 不会影响子进程的 `Trapframe`？**
> 
> `return` 的原理是：让调用者（这里是 `fork` 函数）进程的 `Trapframe` 的 `$v0` 寄存器的值改为返回值。
> 
> 而调用者的进程是父进程，子进程是在 `sys_exofork` 函数自身内部创建的，自然不会受影响。

> **为什么子进程要被设置为 `ENV_NOT_RUNNABLE`？**
> 
> 因为目前子进程还没有实现写时复制机制等。
> 
> 后续代码会完善这一机制，因此现在先不着急搞懂。

[task]
[question]
在 fork 的实现中，关于内核态系统调用 `sys_exofork` 的行为，下列说法错误的是?（）
[\question]
[options]A 会为子进程分配一个新的进程控制块（PCB）。[\options]
[options]B 会将父进程完整的用户地址空间（包括代码段和数据段）物理页复制一份给子进程。[\options]
[options]C 会将父进程的运行现场（`Trapframe`）复制到子进程的 PCB 中。[\options]
[options]D 会将子进程的现场中的 `$v0` 寄存器修改为 0，以确保子进程从 `fork` 返回时值为 0。[\options]
[answer]B[\answer]
[analysis]
`sys_exofork` 的核心逻辑如下：

- 调用 `env_alloc()` 为子进程分配一个新的进程控制块（PCB），对应选项 A。
- 将父进程的 `Trapframe` 复制到子进程的 PCB 中，对应选项 C。
- 将子进程 `Trapframe` 中的 `$v0` 寄存器设置为 0（`e->env_tf.regs[2] = 0`），确保子进程从 `fork` 返回时返回值为 0，对应选项 D。

`sys_exofork` **不会**复制父进程的用户地址空间物理页，它只是创建空的地址空间。真正的物理页复制（写时复制）是在 `sys_exofork` 返回后的用户态 `fork` 函数中，通过 `duppage` 等机制完成的(见下一小节“Fork 机制详解”)。因此选项 B 错误。[\analysis]
[\task]

## Fork 机制详解

### 写时复制

> Young 要抄袭 Charactex 的笔记！（~~骗你的，Charactex 从来不做笔记~~）
> 
> 由于 Charactex 的笔记已经非常完善，Young 根本就不需要做很多修改，于是 Young 就想偷懒，在完全和 Charactex 的笔记一样的地方写上“见 Charactex 的笔记第 x 页”。
> 
> 实在要修改一些内容的时候，才迫不得已抄下来这一节，并修改其中的部分内容。

这个情形和 Fork 的“**写时复制**”机制是同样的想法，具体实现如下：

1. 在 fork 时，只需将地址空间中的所有可写页标记为写时复制页面。一开始，父进程和子进程的对应虚拟地址都**映射同一个**物理页。
2. 根据标记，在父进程或子进程对写时复制页面进行写入时，能够产生一种**异常**。
3. 处理异常：为当前进程试图写入的虚拟地址分配新的物理页面——新的页面复制原页面的内容——返回用户程序。
4. 处理完成后即可对新分配的物理页面进行写入。

---

- **如何让父进程子进程初始映射同样的物理页？**

我们需要单独写一个函数，用于复制映射关系。思路如下：

1. 根据虚页号获取虚拟地址，并提取虚页号对应的页表项的权限位；
2. 如果该页不可写（`PTE_D`）、或该页是共享库(`PTE_LIBRARY`)、或该页已经是 COW 页了（`PTE_COW`）：直接复制映射关系，权限不变；
3. 否则，先让子进程复制映射关系，并让该页不可写、变为 COW 页。
4. 然后再修改父进程的映射关系，但其实只是修改了权限，也变成不可写、COW。

代码如下（`user/lib/fork.c`）:

```C
// Exercise 4.10
static void duppage(u_int envid, u_int vpn) {
	int r;
	u_int addr;
	u_int perm;

	addr = vpn << PGSHIFT;
	perm = vpt[vpn] & ((1 << PGSHIFT) - 1);

	if ((perm & PTE_D) == 0 || (perm & PTE_LIBRARY) || (perm & PTE_COW)) {
		if ((r = syscall_mem_map(0, (void *)addr, envid, (void *)addr, perm)) < 0) {
			user_panic("user panic mem map error: %d", r);
		}
	} else {
		if ((r = syscall_mem_map(0, (void *)addr, envid, (void *)addr, (perm & ~PTE_D) | PTE_COW)) < 0) {
			user_panic("user panic mem map error: %d", r);
		}
		if ((r = syscall_mem_map(0, (void *)addr, 0, (void *)addr, (perm & ~PTE_D) | PTE_COW)) < 0) {
			user_panic("user panic mem map error: %d", r);
		}
	}
}
```

[task]
[question]
在用户态 `fork` 实现的 `duppage` 函数中，需要根据父进程中不同页面的权限进行不同的映射处理。对于带有 ` PTE_LIBRARY `（共享）标志的页面，正确的处理方式是?（）
[\question]
[options]A 在父子进程中都加上 `PTE_COW` 标志，并取消 `PTE_D` 标志。[\options]
[options]B 仅按只读权限原样映射给子进程，不做其他修改。[\options]
[options]C 在父子进程中直接映射为相同物理页并保持可写状态，不添加 `PTE_COW`。[\options]
[options]D 为子进程分配新物理页，拷贝数据后保持可写状态。[\options]
[answer]C[\answer]
[analysis]
`PTE_LIBRARY` 标志表示该页面是共享库页面，多个进程需要**共享同一份物理页且可写**。在 `duppage` 中的处理逻辑为：父子进程直接映射同一物理页并保持可写，保持原权限而不添加 `PTE_COW`。

- 选项 A 是普通 `PTE_COW` 页面的处理方式；
- 选项 B 是只读页面的处理方式；
- 选项 C **正确**；
- 选项 D 是私有可写页面的处理方式（实际 fork 采用 COW 而非立即拷贝）。[\analysis]
[\task]

---

- **如何设计能让写入时产生异常？**

MIPS 使用 TLB 项的标记位 `PTE_D` 来判断是否允许写入。

但是 `PTE_D` 表示的是是否为“脏页”，即是否**被程序修改过**，和是否能写似乎毫不沾边。

其实，操作系统巧妙地把这两个标记合二为一了：

1. 一开始，所有页的 `PTE_D` 全部设为 0；
2. 当程序尝试写入页时，由硬件判断 `PTE_D` 是否为 0，如果是，自动触发 TLB Mod 异常；
3. 在处理异常的时候判断到底是否允许写入；
4. 如果允许写入，将 `PTE_D` 改为 1，这样既表示该页合法，又表示该页被修改过了。

> 注意，除了系统调用是用 `syscall` 主动触发异常之外，其他的异常都是由硬件自动产生的，操作系统需要被动地处理异常。

### 处理 TLB Mod 异常

- **异常触发后，是怎么到达异常处理函数的？**

和系统调用一样，硬件会自动跳转到 `0x80000180` 进入通用异常入口，但是异常码设为 1。这样，在最后异常处理函数的入口即为 `handle_mod`，跳转到函数 `do_tlb_mod` （位于 `kern/tlbex.c`）。

---

- **如何处理异常？**

在很多操作系统中，`do_tlb_mod` 函数会直接履行写时复制（COW）的职责，但**我们实验中不是这样**！实际上，我们此处采用的是**微内核**的设计思想，即 COW 的工作交给**用户态**来做，而内核代码 `do_tlb_mod` 只是用于跳转到**用户异常处理函数**中。

如果需要在用户态下完成页写入异常的处理，是不能直接使用正常情况下的用户栈的（因为发生页写入异常的也可能是正常栈的页面），所以用户进程就需要一个单独的栈来执行处理程序，我们把这个栈称作**异常处理栈**，它的栈顶对应的是内存布局中的 `UXSTACKTOP`。

[task]
[question]
在处理页写入异常时，为何操作系统需要提供一个单独的“用户异常处理栈”，而不是直接使用进程原有的正常用户栈?（）
[\question]
[options]A 正常用户栈的容量太小，不足以完整保存 Trapframe 结构。[\options]
[options]B 因为发生页写入异常的地址本身可能就位于正常用户栈上，直接向其压栈可能导致异常无限触发，造成死循环。[\options]
[options]C 单独的异常栈位于内核空间，能够保证异常处理数据的安全性。[\options]
[options]D 硬件 MIPS 协处理器 CP0 规定异常处理必须切换物理栈。[\options]
[answer]B[\answer]
[analysis]
当页写入异常发生时，触发异常的虚拟地址可能**恰好位于当前的用户栈上**（例如向栈上局部变量写入时，该栈页尚未获得 `PTE_D` 权限）。如果此时操作系统将 `Trapframe` 保存到原有的用户栈上，则保存过程本身又会触发对该栈页的写入操作，而该栈页仍然没有 `PTE_D` 权限，导致再次触发 TLB Mod 异常。如此反复，形成**无限循环**。

使用单独的异常栈 `UXSTACKTOP` 可以避免这一问题：异常处理机制将现场保存到一个已知的可写页面上，从而安全地运行用户态异常处理程序（如 `pgfault_handler`）。因此选项 B 正确。

- 选项 A 错误：正常用户栈通常有足够容量（例如 8 KB 或更大），`Trapframe` 大小固定（约 64 字节），不存在容量不足的问题。
    
- 选项 C 错误：用户异常栈仍然位于**用户态虚拟地址空间**（如 `UXSTACKTOP`），而非内核空间，内核空间地址用户态无法访问。
    
- 选项 D 错误：MIPS CP0 并未规定异常处理必须切换物理栈，切换栈是操作系统的设计决策，而非硬件强制要求。
[\analysis]
[\task]

---

所以 `do_tlb_mod` 函数的大致思路为：

1. 如果栈指针不在异常处理栈的范围内（这个范围详见 `include/mmu.h` 中绘制的图），将栈指针设为 `UXSTACKTOP`。
2. 保存现场（具体实现方法的解释详见思考题 4.7）.
3. 设置返回地址：由于 EPC 是异常返回时的程序计数器，所以这里应该存放从 `eret` 指令返回用户态时的地址。

> 注意：由于我们想转交给用户态来执行，所以 EPC 的设置和之前系统调用中的**不一样**。
> 
> 我们之前是 `tf->cp0_epc += 4`，表示执行下一条指令；而这里我们的工作还没做完，应该在返回时到达具体的处理函数。
> 
> 所以，在一开始，我们就必须为进程注册 `env_user_tlb_mod_entry`，以告诉操作系统跳转到哪个函数。

```C
// Exercise 4.11
void do_tlb_mod(struct Trapframe *tf) {
	struct Trapframe tmp_tf = *tf;

	if (tf->regs[29] < USTACKTOP || tf->regs[29] >= UXSTACKTOP) {
		tf->regs[29] = UXSTACKTOP;
	}
	tf->regs[29] -= sizeof(struct Trapframe);
	*(struct Trapframe *)tf->regs[29] = tmp_tf;
	
	// 这两行代码没有实际意义，怀疑是原本想要判断该页到底是不是COW页。
	Pte *pte;
	page_lookup(cur_pgdir, tf->cp0_badvaddr, &pte);
	
	if (curenv->env_user_tlb_mod_entry) {
		tf->regs[4] = tf->regs[29];
		tf->regs[29] -= sizeof(tf->regs[4]);
		tf->cp0_epc = curenv->env_user_tlb_mod_entry;
	} else {
		panic("TLB Mod but no user handler registered");
	}
}
```

[task]
[question]
当 CPU 捕获到 TLB Mod（页写入异常）时，内核的 `do_tlb_mod` 函数会进行异常转发。以下关于 `do_tlb_mod ` 行为的描述，正确的是?（）
[\question]
[options]A 直接在内核态为触发异常的虚拟地址分配新的物理页并完成数据拷贝。[\options]
[options]B 直接触发 `panic`，因为用户程序不应向没有 ` PTE_D ` 权限的页面写入数据。[\options]
[options]C 将当前用户进程的执行现场（`Trapframe`）复制到当前用户（正常）栈上。[\options]
[options]D 将 `Trapframe` 复制到专门的用户异常处理栈（` UXSTACKTOP `）上，并将 EPC 设置为用户预先注册的异常处理入口（假设已经设置异常处理入口）。[\options]
[answer]D[\answer]
[analysis]
TLB Mod 异常发生在用户程序向没有 `PTE_D`（可写）权限的页面写入数据时（例如写时复制页面）。内核的 `do_tlb_mod` 不会直接处理该异常，而是将其**转发**给用户态的异常处理程序（如 `pgfault_handler`）。转发过程为：`do_tlb_mod` 将当前 `Trapframe` 复制到用户异常栈 `UXSTACKTOP` 上，并将 `EPC` 修改为用户预先通过 `sys_set_pgfault_handler` 注册的异常处理入口地址，最后返回用户态执行该处理程序。用户态处理程序可通过 `COW` 机制复制页面、添加 `PTE_D` 权限后重新执行写入指令。因此选项 D 正确。[\analysis]
[\task]

### 注册 `env_user_tlb_mod_entry`

- **何时注册？**

由于这是在 Fork 的时候可能会出现的异常，因此我们需要在调用 `duppage` **之前**就先注册好。【具体原因可以看思考题 4.9 的解答】

> 由于子进程在被创建的时候被设置成了 `ENV_NOT_RUNNABLE`，在调整为可运行状态之前不会被调用，因此不要求子进程必须在 `duppage` 之前注册。
> 
> 但父进程一直可以被调用，随时可能发生 TLB Mod 异常，所以必须尽早注册。

---

- **怎么注册？**

我们的目的是让进程的 `env_user_tlb_mod_entry` 字段改为需要跳转的函数的地址，因此需要在**内核态**修改进程控制块。

但是我们 `fork` 函数是用户态函数，所以这里又要用到一个**系统调用**。

函数名为 `sys_set_tlb_mod_entry`，依然位于 `kern/syscall_all.c`。

函数的功能非常简单直观，这里直接给代码：

```C
// Exercise 4.12
int sys_set_tlb_mod_entry(u_int envid, u_int func) {
	struct Env *env;
	try(envid2env(envid, &env, 1));
	env->env_user_tlb_mod_entry = func;
	return 0;
}
```


[task]
[question]
关于微内核架构下 MOS 的写时复制（COW）和 fork 机制，以下说法错误的是（）
[\question]
[options]A fork 时对普通可写页面的处理是：取消 `PTE_D` 标志，并加上 `PTE_COW` 标志。[\options]
[options]B 若要写时复制保护机制能正常工作，必须先通过 `sys_set_tlb_mod_entry` 注册页写入异常处理函数。[\options]
[options]C 为了遍历父进程的用户空间页表，代码中使用了 `vpt` 和 `vpd` 指针，这利用了页目录的自映射机制。[\options]
[options]D 写时复制发生时（触发 TLB Mod 异常），物理内存的分配和数据拷贝操作是在内核态中由 `do_tlb_mod` 直接完成的。[\options]
[answer]D[\answer]
[analysis]
选项 A、B、C 均正确，选项 D 错误。

- 选项 A 正确：`fork` 中对普通可写页面（`PTE_D` 或可写且非共享）的处理是清除 `PTE_D` 标志位，添加 `PTE_COW` 标志位，实现写时复制保护。
- 选项 B 正确：MOS 微内核将 TLB Mod 异常转发给用户态处理，需要先通过 `sys_set_tlb_mod_entry` 注册用户态异常处理函数（如 `pgfault_handler`），否则 COW 无法正常进行。
- 选项 C 正确：`vpt`（虚拟页表）和 `vpd`（虚拟页目录）利用页表自映射机制，使得用户态可以通过固定虚拟地址直接访问页表项和页目录项，从而遍历地址空间。
- 选项 D **错误**：在微内核架构下，`do_tlb_mod` 并不直接完成物理内存分配和数据拷贝，而是将 `Trapframe` 复制到用户异常栈 `UXSTACKTOP` 上，将 `EPC` 设置为用户态注册的异常处理入口，**转发给用户态处理**。真正的页面分配和拷贝发生在用户态的 `pgfault_handler` 中。[\analysis]
[\task]

---

- **注册为哪一个函数？需要什么功能？**

我们虽然写好了这个系统调用，但是我们还没有写到底需要注册成哪一个函数。

这个函数才是真正实现写时复制机制的函数。我们需要将 `va` 的映射从**父进程的物理页**改为**复制**这个页面的**新页面**。 大致思路如下：

1. 现在的 `va` 映射的是父进程的物理页。我们先检查这个物理页到底能不能写时复制；
2. 如果可以写时复制，在用户 COW 临时区域（`UCOW`），建立临时映射 `UCOW` ——新页面，然后在 `UCOW` 所映射的物理页复制 `va` 所映射的物理页的内容；
3. 建立新映射 `va` ——新页面（无形中删掉了 `va` ——父进程页面的映射）；
4. 删除临时映射 `UCOW` ——新页面。

代码位于 `user/lib/fork.c`：

```C
// Exercise 4.13
static void __attribute__((noreturn)) cow_entry(struct Trapframe *tf) {
	u_int va = tf->cp0_badvaddr;
	u_int perm;

	perm = PTE_FLAGS(vpt[VPN(va)]);
	if ((perm & PTE_COW) == 0) {
		user_panic("PTE_COW not found, va=%08x, perm=%08x", va, perm);
	}

	perm = perm & (~PTE_COW);
	perm = perm | PTE_D;

	syscall_mem_alloc(0, (void *)UCOW, perm);

	memcpy((void *)UCOW, (void *)ROUNDDOWN(va, PAGE_SIZE), PAGE_SIZE);

	sys_mem_map(0, (void *)UCOW, 0, (void *)va, perm);

	sys_mem_unmap(0, (void *)UCOW);

	int r = syscall_set_trapframe(0, tf);
	user_panic("syscall_set_trapframe returned %d", r);
}
```

> 注意，这个函数是用户态函数，千万不可以使用 `page_alloc` 和 `page_insert` 等这样的内核态函数。
> 
> 正确的做法是使用系统调用切换到内核态，才能干内核干的事情。
> 
> 这也体现了**微内核**的优缺点：内核代码很少，能交给用户程序就交给用户程序，便于维护内核；但是需要频繁切换用户态和内核态，效率会降低。

[task]
[question]
在 `cow_entry` 中，当确认为写时复制页后，系统需要分配一页新的物理内存。为何代码中必须将新分配的物理页临时映射到一个特殊的虚拟地址（` UCOW `），而不是直接将其映射到发生错误的虚拟地址 ` va `?（）
[\question]
[options]A 直接映射到 `va` 会触发嵌套的 TLB Mod 异常，导致异常处理死循环。[\options]
[options]B 直接映射到 `va` 会立即覆盖原有的页表映射，导致后续无法读取并拷贝原物理页中的数据。[\options]
[options]C `UCOW` 是一段位于内核空间 `kseg0` 的特殊地址，只有通过它才能保证数据拷贝时的原子性。[\options]
[options]D 直接映射到 `va` 的操作受 MIPS 硬件限制，必须通过修改临时寄存器绕过限制。[\options]
[answer]B[\answer]
[analysis]
在写时复制（COW）的缺页处理中，`cow_entry` 需要完成以下步骤：
1. 分配一个新的物理页。
2. 将原物理页的内容**拷贝**到新物理页中。
3. 将新物理页映射到 `va`（原虚拟地址），并加上可写权限。

如果直接将新物理页映射到 `va`，则会**覆盖**原有的页表项（PTE），导致原物理页的映射丢失。此时再执行内存拷贝时，将无法通过原虚拟地址读取原物理页中的数据，因为 `va` 已经指向了新物理页。

因此，需要先将新物理页临时映射到一个特殊的虚拟地址 `UCOW`，通过 `UCOW` 访问新物理页，同时仍可通过原 `va` 访问原物理页，完成数据拷贝。拷贝完成后，再将 `va` 重新映射到新物理页。

- 选项 A 错误：直接映射 `va` 不会触发嵌套异常，因为此时页表项已更新为新页面。
- 选项 C 错误：`UCOW` 位于用户态保留地址，而非 `kseg0`；原子性与此无关。
- 选项 D 错误：MIPS 硬件没有此类限制。[\analysis]
[\task]

### 让子进程可运行

由于我们现在创建的子进程还是不可运行的状态，我们还需要写一个函数，让子进程的状态改为就绪。

这仍然是一个系统调用，比较简单，直接放代码：

```C
// Exercise 4.14
int sys_set_env_status(u_int envid, u_int status) {
	struct Env *env;

	if (status != ENV_RUNNABLE && status != ENV_NOT_RUNNABLE) {
		return -E_INVAL;
	}
	
	try(envid2env(envid, &env, 1));
	
	if (status != env->env_status) {
		if (status == ENV_RUNNABLE) {
			TAILQ_INSERT_TAIL(&env_sched_list, env, env_sched_link);
		} else if (status == ENV_NOT_RUNNABLE) {
			TAILQ_REMOVE(&env_sched_list, env, env_sched_link);
		}
	}
	
	env->env_status = status;
	
	// 如果要改变当前进程状态，无论改成什么，都一定不是可运行状态了
	if (env == curenv) {
		schedule(1);
	}
	return 0;
}
```

### 完整的 `fork` 函数

- **需要对哪些地址空间进行 COW 预处理（`duppage`）？**

**大部分用户地址空间**都需要被复制到子进程，映射相同的物理页。而以下地址空间不能：

1. **异常处理栈**：即 `[UXSTACKTOP - PGSIZE, UXSTACKTOP)`。
2. **页表自映射区域**：既然已经成为两个不同的进程了，那么页表也应该相互独立。而且页表本来就是对用户态只读的，不能设为 COW 和可写。
3. **非用户空间**：超出用户地址上限的区域不能被 `fork` 这一用户态函数所操作，自然不能复制。

---

现在可以开始梳理 `fork` 函数的具体步骤了：

1. 设置父进程的异常处理入口，并创建子进程（顺序可以交换）；
2. `duppage`；
3. 在注册子进程的异常处理入口后，将子进程的状态改为可运行。

```C
// Exercise 4.15
int fork(void) {
	u_int child;
	u_int i;

	if (env->env_user_tlb_mod_entry != (u_int)cow_entry) {
		try(syscall_set_tlb_mod_entry(0, cow_entry));
	}

	child = syscall_exofork();
	if (child == 0) {
		env = envs + ENVX(syscall_getenvid());
		return 0;
	}

	for (i = 0; i < PDX(UXSTACKTOP); i++) {
		if (vpd[i] & PTE_V) {
			for (u_int j = 0; j < PAGE_SIZE / sizeof(Pte); j++) {
				// 将页目录索引和页表索引合并为虚页号，再左移12为即为虚拟地址
				u_long va = (i * (PAGE_SIZE / sizeof(Pte)) + j) << PGSHIFT;
				// 与之前所说不同，或许是UXSTACKTOP-PAGESIZE和USTACKTOP之间的页保留？
				if (va >= USTACKTOP) {
					break;
				}
				if (vpt[VPN(va)] & PTE_V) {
					duppage(child, VPN(va));
				}
			}
		}
	}

	syscall_set_tlb_mod_entry(child, cow_entry);
	syscall_set_env_status(child, ENV_RUNNABLE);

	return child;
}
```

Fork 的完整过程到此完美结束。

> 补充：`syscall_exofork` 函数不同于其他的系统调用，被设计成了内联（`inline`）函数。这个的原因我用一个例题来解释（我感觉这个涉及了汇编的知识了，我暂时没有完全看懂，所以用 AI 帮我解释了，希望之后学完了记得更新这一部分博客）：

[task]
[question]
在 fork 的用户态代码中，对 `syscall_exofork` 的包装函数被设计为内联（`inline`）函数。这样设计的根本原因是?（）
[\question]
[options]A 提高进程创建的速度，减少函数调用的开销。[\options]
[options]B 避免在为栈页面设置写时复制（COW）保护之前，非内联函数返回修改栈帧导致另一进程的返回地址被意外覆盖。[\options]
[options]C 使得 `syscall_exofork` 能够直接访问 `fork` 函数中的局部变量。[\options]
[options]D MIPS 架构不允许在非叶函数中使用 `syscall` 汇编指令。[\options]
[answer]B[\answer]
[analysis]
在 MOS 的 `fork` 实现中，`fork` 函数需要将父进程的栈页也设置为写时复制（COW）。如果 `syscall_exofork` 不是内联函数，那么 `fork` 调用 `syscall_exofork` 时会执行 `jal` 指令，返回地址 `$ra` 会被压入父进程的栈中。随后父进程将该栈页标记为 COW 后，再通过 `syscall_exofork` 创建子进程。此时子进程复制了父进程的栈页（包括返回地址），但子进程返回用户态后执行的是 `jr $ra` 指令，而该返回地址指向的是 `fork` 函数中 `syscall_exofork` 调用之后的位置。问题在于：子进程并未经过 `syscall_exofork` 的内核入口，其 `$v0` 已被内核强制设为 0，但返回后可能因栈帧布局错误导致 PC 跳转到错误地址。

将 `syscall_exofork` 声明为内联函数可以避免产生 `jal` 调用，从而不向栈中压入返回地址，防止子进程在 `fork` 返回时因栈帧不一致而崩溃。这是设计的根本原因，而非单纯的性能优化（选项 A）。选项 C 和 D 无依据。因此答案为 B。[\analysis]
[\task]