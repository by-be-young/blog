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