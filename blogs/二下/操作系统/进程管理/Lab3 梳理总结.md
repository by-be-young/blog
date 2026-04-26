---
type: 待完善
excerpt: 2421操作系统Lab3课下实验Exercise习题总结及个人答案
---
# 3.1

```C
void env_init(void) {
    int i;
    
    LIST_INIT(&env_free_list);
    TAILQ_INIT(&env_sched_list);
    
    for (i = NENV - 1; i >= 0; i--) {
        envs[i].env_status = ENV_FREE;
        LIST_INSERT_HEAD(&env_free_list, &envs[i], env_link);
    }
    
    struct Page *p;
    panic_on(page_alloc(&p));
    p->pp_ref++;
    
    base_pgdir = (Pde *)page2kva(p);
    map_segment(base_pgdir, 0, PADDR(pages), UPAGES,
                ROUND(npage * sizeof(struct Page), PAGE_SIZE), PTE_G);
    map_segment(base_pgdir, 0, PADDR(envs), UENVS, ROUND(NENV * sizeof(struct Env), PAGE_SIZE),
                PTE_G);
}
```

# 3.2

```C
static void map_segment(Pde *pgdir, u_int asid, u_long pa, u_long va, u_int size, u_int perm) {
    assert(pa % PAGE_SIZE == 0);
    assert(va % PAGE_SIZE == 0);
    assert(size % PAGE_SIZE == 0);
    
    for (int i = 0; i < size; i += PAGE_SIZE) {
        page_insert(pgdir, asid, pa2page(pa + i), va + i, perm);
    }
}
```

# 3.3

```C
static int env_setup_vm(struct Env *e) {
    struct Page *p;
    try(page_alloc(&p));
    
    p->pp_ref++;
    e->env_pgdir = (Pde *)page2kva(p);
    
    memcpy(e->env_pgdir + PDX(UTOP), base_pgdir + PDX(UTOP),
           sizeof(Pde) * (PDX(UVPT) - PDX(UTOP)));
    
    e->env_pgdir[PDX(UVPT)] = PADDR(e->env_pgdir) | PTE_V;
    return 0;
}
```

# 3.4

```C
int env_alloc(struct Env **new, u_int parent_id) {
    int r;
    struct Env *e;
    
    e = LIST_FIRST(&env_free_list);
    if (e == NULL) {
        return -E_NO_FREE_ENV;
    }
    
    r = env_setup_vm(e);
    if (r != 0) {
        return r;
    }
    
    e->env_user_tlb_mod_entry = 0;
    e->env_runs = 0;
    e->env_id = mkenvid(e);
    e->env_parent_id = parent_id;
    r = asid_alloc(&e->env_asid);
    if (r != 0) {
        return r;
    }
    
    e->env_tf.cp0_status = STATUS_IM7 | STATUS_IE | STATUS_EXL | STATUS_UM;
    e->env_tf.regs[29] = USTACKTOP - sizeof(int) - sizeof(char **);
    
    LIST_REMOVE(e, env_link);
    
    *new = e;
    return 0;
}
```

# 3.5

```C
static int load_icode_mapper(void *data, u_long va, size_t offset, u_int perm, const void *src,
                             size_t len) {
    struct Env *env = (struct Env *)data;
    struct Page *p;
    int r;
    
    r = page_alloc(&p);
    if (r != 0) {
        return r;
    }
    
    if (src != NULL) {
        memcpy((void *)(page2kva(p) + offset), src, len);
    }
    
    return page_insert(env->env_pgdir, env->env_asid, p, va, perm);
}
```

# 3.6

```C
static void load_icode(struct Env *e, const void *binary, size_t size) {
    const Elf32_Ehdr *ehdr = elf_from(binary, size);
    if (!ehdr) {
        panic("bad elf at %x", binary);
    }
    
    size_t ph_off;
    ELF_FOREACH_PHDR_OFF(ph_off, ehdr) {
        Elf32_Phdr *ph = (Elf32_Phdr *)(binary + ph_off);
        if (ph->p_type == PT_LOAD) {
            panic_on(elf_load_seg(ph, binary + ph->p_offset, load_icode_mapper, e));
        }
    }
    
    e->env_tf.cp0_epc = ehdr->e_entry;
}
```

# 3.7

```C
struct Env *env_create(const void *binary, size_t size, int priority) {
    struct Env *e;
    int r = env_alloc(&e, 0);
    if (r < 0) {
        panic("env_alloc failed: %d", r);
    }
    
    e->env_pri = priority;
    e->env_status = ENV_RUNNABLE;
    load_icode(e, binary, size);
    TAILQ_INSERT_HEAD(&env_sched_list, e, env_sched_link);
    
    return e;
}
```