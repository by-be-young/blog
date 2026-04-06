import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

const ROOT = path.resolve(process.cwd());
const BLOGS_DIR = path.join(ROOT, 'blogs');
const BACKGROUND_DIR = path.join(ROOT, 'assets', 'images', 'background');
const OUTPUT_JSON = path.join(ROOT, 'data', 'blogs.json');
const SERIES_JSON = path.join(ROOT, 'data', 'series.json');
const ANNOUNCEMENTS_JSON = path.join(ROOT, 'data', 'announcements.json');
const BACKGROUND_JSON = path.join(ROOT, 'data', 'background-images.json');
const LEARNING_FIRST_TAGS = new Set(['二上', '二下']);
const HOME_CATEGORY = {
    LEARNING: '学习',
    ENTERTAINMENT: '娱乐'
};

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
        let d = new Date(value);
        if (Number.isNaN(d.getTime()) && value.includes(' ')) {
            d = new Date(value.replace(' ', 'T'));
        }
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

function resolveHomeCategoryByTags(tags) {
    const firstTag = Array.isArray(tags) && typeof tags[0] === 'string' ? tags[0].trim() : '';
    if (LEARNING_FIRST_TAGS.has(firstTag)) {
        return HOME_CATEGORY.LEARNING;
    }
    return HOME_CATEGORY.ENTERTAINMENT;
}

function normalizeSeries(value) {
    if (typeof value === 'string' && value.trim()) {
        return value.trim();
    }

    if (Array.isArray(value)) {
        const firstValid = value.find(item => typeof item === 'string' && item.trim());
        return firstValid ? firstValid.trim() : '';
    }

    if (value && typeof value === 'object') {
        if (typeof value.title === 'string' && value.title.trim()) return value.title.trim();
        if (typeof value.name === 'string' && value.name.trim()) return value.name.trim();
    }

    return '';
}

async function appendAnnouncementIfProvided() {
    const args = process.argv.slice(2).map(a => String(a)).filter(Boolean);
    const message = args.join(' ').trim();
    if (!message) return false;

    const now = new Date();
    const date = formatDateYYYYMMDD(now);
    const item = {
        id: Date.now(),
        date,
        message
    };

    let existing = [];
    try {
        const raw = await fs.readFile(ANNOUNCEMENTS_JSON, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) existing = parsed;
    } catch (e) {
        // if file doesn't exist or invalid, start fresh
        existing = [];
    }

    existing.unshift(item);
    await fs.mkdir(path.dirname(ANNOUNCEMENTS_JSON), { recursive: true });
    await fs.writeFile(ANNOUNCEMENTS_JSON, JSON.stringify(existing, null, 4) + '\n', 'utf8');

    console.log(`[generate] Added announcement (${date}): ${message}`);
    return true;
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

async function generateBackgroundImagesManifest() {
    let entries = [];
    try {
        entries = await fs.readdir(BACKGROUND_DIR, { withFileTypes: true });
    } catch (e) {
        entries = [];
    }

    const images = entries
        .filter(entry => entry.isFile())
        .map(entry => entry.name)
        .filter(name => /\.(png|jpe?g|webp|gif|avif)$/i.test(name))
        .sort((a, b) => a.localeCompare(b, 'zh-CN'))
        .map(name => toPosix(path.join('assets', 'images', 'background', name)));

    const payload = { images };
    await fs.mkdir(path.dirname(BACKGROUND_JSON), { recursive: true });
    await fs.writeFile(BACKGROUND_JSON, JSON.stringify(payload, null, 4) + '\n', 'utf8');

    console.log(`[generate] Wrote ${images.length} background images -> ${toPosix(path.relative(ROOT, BACKGROUND_JSON))}`);
}

async function main() {
    const runTime = new Date();
    const runDateText = formatDateYYYYMMDD(runTime);

    let previousManifestMtime = null;
    try {
        const manifestStat = await fs.stat(OUTPUT_JSON);
        previousManifestMtime = manifestStat.mtime;
    } catch (e) {
        previousManifestMtime = null;
    }

    await appendAnnouncementIfProvided();
    await generateBackgroundImagesManifest();

    let existingBlogs = [];
    try {
        const existingRaw = await fs.readFile(OUTPUT_JSON, 'utf8');
        const parsed = JSON.parse(existingRaw);
        if (Array.isArray(parsed)) {
            existingBlogs = parsed;
        }
    } catch (e) {
        existingBlogs = [];
    }

    const existingBlogByContentFile = new Map();
    existingBlogs.forEach(item => {
        if (!item || typeof item !== 'object') return;
        const key = typeof item.contentFile === 'string' ? item.contentFile.trim() : '';
        if (key) {
            existingBlogByContentFile.set(key, item);
        }
    });

    const mdFiles = await listMarkdownFiles(BLOGS_DIR);
    mdFiles.sort((a, b) => a.localeCompare(b, 'zh-CN'));

    const seenIds = new Set();
    const blogs = [];

    for (const filePath of mdFiles) {
        const relFromRoot = toPosix(path.relative(ROOT, filePath));
        const raw = await fs.readFile(filePath, 'utf8');
        const stat = await fs.stat(filePath);
        const fallbackDate = stat.mtime;
        const existingBlog = existingBlogByContentFile.get(relFromRoot);

        const parsed = matter(raw);
        const data = parsed.data ?? {};

        const title =
            (typeof data.title === 'string' && data.title.trim())
                ? data.title.trim()
                : path.basename(filePath, path.extname(filePath));

        const existingDate = (existingBlog && typeof existingBlog.date === 'string') ? existingBlog.date : '';
        const fallbackPreservedDate = normalizeDate(existingDate, fallbackDate);
        const dateObj = normalizeDate(data.date, fallbackPreservedDate);
        const date = formatDateYYYYMMDD(dateObj);

        let lastEditedDate = null;

        if (existingBlog) {
            const modifiedSinceLastGenerate = previousManifestMtime
                ? fallbackDate.getTime() > previousManifestMtime.getTime()
                : false;

            if (modifiedSinceLastGenerate) {
                lastEditedDate = runDateText;
            }
        }

        const excerpt =
            (typeof data.excerpt === 'string' && data.excerpt.trim())
                ? data.excerpt.trim()
                : extractExcerpt(raw);

        // derive tags/keywords from folder structure under `blogs/`
        // relFromBlogs e.g. "二上/离散二/总复习/离散数学题型总复习.md"
        const relFromBlogs = toPosix(path.relative(BLOGS_DIR, filePath));
        const dirParts = relFromBlogs.split('/').slice(0, -1).filter(Boolean);
        // take first three folders as keywords (用户保证只有三个关键词)
        const tags = dirParts.slice(0, 3);
        const category = resolveHomeCategoryByTags(tags);

        // blog type comes from front-matter `type` if provided
        const type = (typeof data.type === 'string' && data.type.trim()) ? data.type.trim() : null;
        const series = normalizeSeries(data.series);

        // support recommended flag in front-matter: accept either 'recommended' or Chinese '推荐'
        const recommended = Boolean(data.recommended) || Boolean(data['推荐']);

        // Prefer explicit id if provided; else derive stable one from path
        let id = Number.isFinite(Number(data.id)) ? Number(data.id) : stableIdFromString(relFromRoot);
        while (seenIds.has(id)) id++;
        seenIds.add(id);

        const blogItem = {
            id,
            title,
            excerpt,
            date,
            image: 'assets/images/blog_bg.png',
            tags,
            category,
            type,
            series: series || null,
            contentFile: relFromRoot,
            recommended
        };

        if (lastEditedDate) {
            blogItem.lastEditedDate = lastEditedDate;
        }

        blogs.push(blogItem);
    }

    // Default ordering: newest first
    blogs.sort((a, b) => new Date(b.date) - new Date(a.date));

    await fs.mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
    await fs.writeFile(OUTPUT_JSON, JSON.stringify(blogs, null, 4) + '\n', 'utf8');

    const seriesMap = new Map();
    for (const blog of blogs) {
        const seriesName = (typeof blog.series === 'string') ? blog.series.trim() : '';
        if (!seriesName) continue;

        if (!seriesMap.has(seriesName)) {
            seriesMap.set(seriesName, []);
        }
        seriesMap.get(seriesName).push(blog);
    }

    const seriesList = Array.from(seriesMap.entries())
        .map(([name, posts]) => {
            const sortedPosts = posts
                .slice()
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            return {
                id: stableIdFromString(`series:${name}`),
                title: name,
                coverImage: 'assets/images/background/bg2.png',
                count: sortedPosts.length,
                posts: sortedPosts.map(post => ({
                    id: post.id,
                    title: post.title,
                    date: post.date,
                    contentFile: post.contentFile
                }))
            };
        })
        .sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.title.localeCompare(b.title, 'zh-CN');
        });

    await fs.mkdir(path.dirname(SERIES_JSON), { recursive: true });
    await fs.writeFile(SERIES_JSON, JSON.stringify(seriesList, null, 4) + '\n', 'utf8');

    console.log(`[generate] Wrote ${blogs.length} posts -> ${toPosix(path.relative(ROOT, OUTPUT_JSON))}`);
    console.log(`[generate] Wrote ${seriesList.length} series -> ${toPosix(path.relative(ROOT, SERIES_JSON))}`);
}

main().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
