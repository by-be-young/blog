# 5.1

```C
int sys_write_dev(u_int va, u_int pa, u_int len) {
    if (len != 1 && len != 2 && len != 4) {
        return -E_INVAL;
    }
    if (is_illegal_va_range(va, len)) {
        return -E_INVAL;
    }
    if (!(pa >= 0x180001F0 && pa < 0x180001F8) && !(pa == 0x180003F8) &&
        !(pa == 0x180003FD)) {
        return -E_INVAL;
    }
    if (((pa >= 0x180001F1 && pa < 0x180001F8) || (pa == 0x180003FD)) &&
        len != 1) {
        return -E_INVAL;
    }

    if (len == 1) {
        iowrite8(*(uint8_t *)va, pa);
    } else if (len == 2) {
        iowrite16(*(uint16_t *)va, pa);
    } else if (len == 4) {
        iowrite32(*(uint32_t *)va, pa);
    } else {
        return -E_INVAL;
    }

    return 0;
}

int sys_read_dev(u_int va, u_int pa, u_int len) {
    if (len != 1 && len != 2 && len != 4) {
        return -E_INVAL;
    }
    if (is_illegal_va_range(va, len)) {
        return -E_INVAL;
    }
    if (!(pa >= 0x180001F0 && pa < 0x180001F8) && !(pa == 0x180003F8) &&
        !(pa == 0x180003FD)) {
        return -E_INVAL;
    }
    if (((pa >= 0x180001F1 && pa < 0x180001F8) || (pa == 0x180003FD)) &&
        len != 1) {
        return -E_INVAL;
    }
    
    if (len == 1) {
        *(uint8_t *)va = ioread8(pa);
    } else if (len == 2) {
        *(uint16_t *)va = ioread16(pa);
    } else if (len == 4) {
        *(uint32_t *)va = ioread32(pa);
    } else {
        return -E_INVAL;
    }

    return 0;
}
```

# 5.2

```C
int syscall_write_dev(void *va, u_int dev, u_int size) {
    return msyscall(SYS_write_dev, va, dev, size);
}

int syscall_read_dev(void *va, u_int dev, u_int size) {
    return msyscall(SYS_read_dev, va, dev, size);
}
```

# 5.3

```C
void ide_read(u_int diskno, u_int secno, void *dst, u_int nsecs) {
    uint8_t temp;
    u_int offset = 0, max = nsecs + secno;
    panic_on(diskno >= 2);

    while (secno < max) {
        temp = wait_ide_ready();
        
        temp = 1;
        panic_on(syscall_write_dev(&temp, MALTA_IDE_NSECT, 1));

        temp = secno & 0xff;
        panic_on(syscall_write_dev(&temp, MALTA_IDE_LBAL, 1));

        temp = (secno >> 8) & 0xff;
        panic_on(syscall_write_dev(&temp, MALTA_IDE_LBAM, 1));

        temp = (secno >> 16) & 0xff;
        panic_on(syscall_write_dev(&temp, MALTA_IDE_LBAH, 1));

        temp = ((secno >> 24) & 0x0f) | MALTA_IDE_LBA | (diskno << 4);
        panic_on(syscall_write_dev(&temp, MALTA_IDE_DEVICE, 1));

        temp = MALTA_IDE_CMD_PIO_READ;
        panic_on(syscall_write_dev(&temp, MALTA_IDE_STATUS, 1));

        temp = wait_ide_ready();

        for (int i = 0; i < SECT_SIZE / 4; i++) {
            panic_on(syscall_read_dev(dst + offset + i * 4, MALTA_IDE_DATA, 4));
        }

        panic_on(syscall_read_dev(&temp, MALTA_IDE_STATUS, 1));

        offset += SECT_SIZE;
        secno += 1;
    }
}

void ide_write(u_int diskno, u_int secno, void *src, u_int nsecs) {
    uint8_t temp;
    u_int offset = 0, max = nsecs + secno;
    panic_on(diskno >= 2);

    while (secno < max) {
        temp = wait_ide_ready();
        
        temp = 1;
        panic_on(syscall_write_dev(&temp, MALTA_IDE_NSECT, 1));

        temp = secno & 0xff;
        panic_on(syscall_write_dev(&temp, MALTA_IDE_LBAL, 1));

        temp = (secno >> 8) & 0xff;
        panic_on(syscall_write_dev(&temp, MALTA_IDE_LBAM, 1));

        temp = (secno >> 16) & 0xff;
        panic_on(syscall_write_dev(&temp, MALTA_IDE_LBAH, 1));

        temp = ((secno >> 24) & 0x0f) | MALTA_IDE_LBA | (diskno << 4);
        panic_on(syscall_write_dev(&temp, MALTA_IDE_DEVICE, 1));

        temp = MALTA_IDE_CMD_PIO_WRITE;
        panic_on(syscall_write_dev(&temp, MALTA_IDE_STATUS, 1));

        temp = wait_ide_ready();

        for (int i = 0; i < SECT_SIZE / 4; i++) {
            panic_on(syscall_write_dev(src + offset + i * 4, MALTA_IDE_DATA, 4));
        }

        panic_on(syscall_read_dev(&temp, MALTA_IDE_STATUS, 1));

        offset += SECT_SIZE;
        secno += 1;
    }
}
```

# 5.4

```C
void free_block(u_int blockno) {
    if (blockno == 0 || blockno >= super->s_nblocks) {
        return;
    }
    
    bitmap[blockno / 32] |= 1 << (blockno & 0x1f);
    write_block(blockno / BLOCK_SIZE_BIT + 2);

    if (block_is_mapped(blockno)) {
        unmap_block(blockno);
    }
}
```

# 5.5

```C
struct File *create_file(struct File *dirf) {
    int nblk = dirf->f_size / BLOCK_SIZE;

    for (int i = 0; i < nblk; ++i) {
        int bno;
        
        if (i < NDIRECT) {
            bno = dirf->f_direct[i];
        } else {
            bno = ((int *)(disk[dirf->f_indirect].data))[i];
        }

        struct File *blk = (struct File *)(disk[bno].data);

        for (struct File *f = blk; f < blk + FILE2BLK; ++f) {
            if (f->f_name[0] == '\0') {
                return f;
            }
        }
    }

    int bno = make_link_block(dirf, nblk);
    return (struct File *)(disk[bno].data);
}
```

# 5.6

```C
void *disk_addr(u_int blockno) {
    return (void *)(DISKMAP + blockno * BLOCK_SIZE);
}
```

# 5.7

```C
int map_block(u_int blockno) {
    if (block_is_mapped(blockno)) {
        return 0;
    }
    
    return syscall_mem_alloc(0, disk_addr(blockno), PTE_D);
}

void unmap_block(u_int blockno) {
    void *va = block_is_mapped(blockno);
    
    if (!block_is_free(blockno) && block_is_dirty(blockno)) {
        write_block(blockno);
    }

    panic_on(syscall_mem_unmap(0, va));
    user_assert(!block_is_mapped(blockno));
}
```

# 5.8

```C
int dir_lookup(struct File *dir, char *name, struct File **file) {
    u_int nblock = dir->f_size / BLOCK_SIZE;

    for (int i = 0; i < nblock; i++) {
        void *blk;
        try(file_get_block(dir, i, &blk));

        struct File *files = (struct File *)blk;

        for (struct File *f = files; f < files + FILE2BLK; ++f) {
            if (strcmp(name, f->f_name) == 0) {
                *file = f;
                f->f_dir = dir;
                return 0;
            }
        }
    }

    return -E_NOT_FOUND;
}
```

# 5.9

```C
int open(const char *path, int mode) {
    int r;
    struct Fd *fd;
    
    r = fd_alloc(&fd);
    if (r) {
        return r;
    }

    r = fsipc_open(path, mode, fd);
    if (r) {
        return r;
    }

    char *va = fd2data(fd);
    struct Filefd *ffd = (struct Filefd *)fd;
    u_int size = ffd->f_file.f_size;
    u_int fileid = ffd->f_fileid;

    for (int i = 0; i < size; i += PTMAP) {
        r = fsipc_map(fileid, i, va + i);
        if (r) {
            return r;
        }
    }

    return fd2num(fd);
}
```

# 5.10

```C
int read(int fdnum, void *buf, u_int n) {
    int r;
    struct Dev *dev;
    struct Fd *fd;
    
    if ((r = fd_lookup(fdnum, &fd)) < 0 || (r = dev_lookup(fd->fd_dev_id, &dev)) < 0) {
        return r;
    }

    if ((fd->fd_omode & O_ACCMODE) == O_WRONLY) {
        return -E_INVAL;
    }

    r = dev->dev_read(fd, buf, n, fd->fd_offset);
    
    if (r > 0) {
        fd->fd_offset += r;
    }

    return r;
}
```

# 5.11

```C
void serve_remove(u_int envid, struct Fsreq_remove *rq) {
    int r = file_remove(rq->req_path);
    ipc_send(envid, r, 0, 0);
}
```

# 5.12

```C
int fsipc_remove(const char *path) {
    if (strlen(path) == 0 || strlen(path) > MAXPATHLEN) {
        return -E_BAD_PATH;
    }

    struct Fsreq_remove *req = (struct Fsreq_remove *)fsipcbuf;
    strcpy((char *)req->req_path, path);
    
    return fsipc(FSREQ_REMOVE, req, 0, 0);
}
```

# 5.13

```C
int remove(const char *path) {
    return fsipc_remove(path);
}
```