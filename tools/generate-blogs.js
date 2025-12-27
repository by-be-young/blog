import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

const ROOT = path.resolve(process.cwd());
const BLOGS_DIR = path.join(ROOT, 'blogs');
const OUTPUT_JSON = path.join(ROOT, 'data', 'blogs.json');

function toPosix(p) {
    return p.split(path.sep).join('/');
}

function normalizeTags(tags) {
    if (!tags) return [];
    if (Array.isArray(tags)) {
        return tags.map(String).map(s => s.trim()).filter(Boolean);
    }
    if (typeof tags === 'string') {
        return tags
            .split(/[,，]/)
            .map(s => s.trim())
            .filter(Boolean);
    }
    return [];
}

function normalizeDate(value, fallbackDate) {
    if (typeof value === 'string' && value.trim()) {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return d;
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    return fallbackDate;
}

function formatDateYYYYMMDD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function extractExcerpt(markdown, maxLen = 80) {
    const noFrontMatter = markdown.replace(/^---\s*[\s\S]*?\s*---\s*/m, '');
    const lines = noFrontMatter
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)
        .filter(l => !l.startsWith('#'))
        .filter(l => !l.startsWith('```'));

    const first = lines[0] ?? '';
    const oneLine = first.replace(/\s+/g, ' ');
    if (oneLine.length <= maxLen) return oneLine;
    return oneLine.slice(0, maxLen).trimEnd() + '...';
}

// FNV-1a 32-bit hash -> stable numeric id
function stableIdFromString(input) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

async function listMarkdownFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await listMarkdownFiles(full)));
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
            files.push(full);
        }
    }

    return files;
}

async function main() {
    const mdFiles = await listMarkdownFiles(BLOGS_DIR);
    mdFiles.sort((a, b) => a.localeCompare(b, 'zh-CN'));

    const seenIds = new Set();
    const blogs = [];

    for (const filePath of mdFiles) {
        const relFromRoot = toPosix(path.relative(ROOT, filePath));
        const raw = await fs.readFile(filePath, 'utf8');
        const stat = await fs.stat(filePath);
        const fallbackDate = stat.mtime;

        const parsed = matter(raw);
        const data = parsed.data ?? {};

        const title =
            (typeof data.title === 'string' && data.title.trim())
                ? data.title.trim()
                : path.basename(filePath, path.extname(filePath));

        const dateObj = normalizeDate(data.date, fallbackDate);
        const date = formatDateYYYYMMDD(dateObj);

        const excerpt =
            (typeof data.excerpt === 'string' && data.excerpt.trim())
                ? data.excerpt.trim()
                : extractExcerpt(raw);

        const tags = normalizeTags(data.tags);

        // support recommended flag in front-matter: accept either 'recommended' or Chinese '推荐'
        const recommended = Boolean(data.recommended) || Boolean(data['推荐']);

        // Prefer explicit id if provided; else derive stable one from path
        let id = Number.isFinite(Number(data.id)) ? Number(data.id) : stableIdFromString(relFromRoot);
        while (seenIds.has(id)) id++;
        seenIds.add(id);

        blogs.push({
            id,
            title,
            excerpt,
            date,
            image: 'assets/images/blog_bg.png',
            tags,
            contentFile: relFromRoot,
            recommended
        });
    }

    // Default ordering: newest first
    blogs.sort((a, b) => new Date(b.date) - new Date(a.date));

    await fs.mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
    await fs.writeFile(OUTPUT_JSON, JSON.stringify(blogs, null, 4) + '\n', 'utf8');

    console.log(`[generate] Wrote ${blogs.length} posts -> ${toPosix(path.relative(ROOT, OUTPUT_JSON))}`);
}

main().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
