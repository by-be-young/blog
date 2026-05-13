# 4.1

```asm
#include <asm/asm.h>

LEAF(msyscall)
	syscall
	jr ra
END(msyscall)
```

# 4.2

```C
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

# 4.3

```C
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

	if (checkperm != 0) {
		if (e != curenv && e->env_parent_id != curenv->env_id) {
			return -E_BAD_ENV;
		}
	}

	*penv = e;
	return 0;
}
```

# 4.4

```C
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

# 4.5

```C
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

# 4.6

```C
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

# 4.7

```C
void __attribute__((noreturn)) sys_yield(void) {
	schedule(1);
}
```

# 4.8

```C
int sys_ipc_recv(u_int dstva) {
	if (dstva != 0 && is_illegal_va(dstva)) {
		return -E_INVAL;
	}

	curenv->env_ipc_recving = 1;
	curenv->env_ipc_dstva = dstva;
	curenv->env_status = ENV_NOT_RUNNABLE; 
	TAILQ_REMOVE(&env_sched_list, curenv, env_sched_link);
	
	((struct Trapframe *)KSTACKTOP - 1)->regs[2] = 0;
	schedule(1);
}
```

```C
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

# 4.9

```C
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

# 4.10

```C
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

# 4.11

```C
void do_tlb_mod(struct Trapframe *tf) {
	struct Trapframe tmp_tf = *tf;

	if (tf->regs[29] < USTACKTOP || tf->regs[29] >= UXSTACKTOP) {
		tf->regs[29] = UXSTACKTOP;
	}
	tf->regs[29] -= sizeof(struct Trapframe);
	*(struct Trapframe *)tf->regs[29] = tmp_tf;
	
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

# 4.12

```C
int sys_set_tlb_mod_entry(u_int envid, u_int func) {
	struct Env *env;
	try(envid2env(envid, &env, 1));
	env->env_user_tlb_mod_entry = func;
	return 0;
}
```

# 4.13

```C
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

# 4.14

```C
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
	
	if (env == curenv) {
		schedule(1);
	}
	return 0;
}
```

# 4.15

```C
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
				u_long va = (i * (PAGE_SIZE / sizeof(Pte)) + j) << PGSHIFT;
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