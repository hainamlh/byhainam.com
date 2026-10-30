#!/usr/bin/env node
// Build script: reads content/letters/*.md and generates
// - letters/<slug>/index.html  (post pages)
// - index.html                (homepage, blog grid = 9 shown + rest hidden)
// - letters/index.html         (full archive, nothing hidden)
//
// Run with: node build.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = __dirname;
const CONTENT_DIR = path.join(ROOT, 'content', 'letters');
const BOOKS_CONTENT_DIR = path.join(ROOT, 'content', 'books');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const LETTERS_OUT = path.join(ROOT, 'letters');
const BOOKS_OUT = path.join(ROOT, 'sach');
const SETTINGS_FILE = path.join(ROOT, 'content', 'settings.md');

// ---- icon glyphs + tint presets, keyed by frontmatter `bg` field ----
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8A3.5 3.5 0 0 0 8 18a3 3 0 0 0 4-2V6a2 2 0 0 0-3-2z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 1 5.8A3.5 3.5 0 0 1 16 18a3 3 0 0 1-4-2"/></svg>';
const PRESETS = {
  dark:       { bg: 'linear-gradient(155deg,#1a1917,#2d2b28)', color: '#D8C9B3', border: '' },
  light:      { bg: '#FFFFFF', color: '#1A1A1A', border: 'border:1px solid var(--line)' },
  'light-green': { bg: '#E1F5EE', color: '#0F6E56', border: '' },
  'light-red':   { bg: '#FAECE7', color: '#A32D2D', border: '' },
};

// ---- social icons: admin picks platform + link in "Cài đặt giao diện" (content/settings.md) ----
const SOCIAL_ICONS = {
  substack: { label: 'Substack', svg: '<path d="M3 3h18v3.5H3V3zm0 5.5h18V12H3V8.5zM3 14h18v7l-9-4-9 4v-7z"/>' },
  facebook: { label: 'Facebook', svg: '<path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z"/>' },
  youtube:  { label: 'YouTube', svg: '<path d="M23 12s0-3.5-.4-5.2a3 3 0 0 0-2.1-2.1C18.8 4 12 4 12 4s-6.8 0-8.5.7a3 3 0 0 0-2.1 2.1C1 8.5 1 12 1 12s0 3.5.4 5.2a3 3 0 0 0 2.1 2.1C5.2 20 12 20 12 20s6.8 0 8.5-.7a3 3 0 0 0 2.1-2.1C23 15.5 23 12 23 12zM9.8 15.5v-7l6 3.5-6 3.5z"/>' },
  tiktok:   { label: 'TikTok', svg: '<path d="M16.5 2c.3 2.2 1.7 3.8 4 4.1v3a7 7 0 0 1-4-1.3v6.8a6 6 0 1 1-6-6c.3 0 .6 0 .9.1v3.1a3 3 0 1 0 2.1 2.9V2h3z"/>' },
  x:        { label: 'X', svg: '<path d="M3 3l7.4 9.6L3 21h2.6l6-6.7L16.9 21H21l-7.8-10.1L20.6 3h-2.6l-5.5 6.1L8 3H3zm3 1.7h2l9.9 13h-2L6 4.7z"/>' },
  zalo:     { label: 'Zalo', svg: '<rect x="2" y="2" width="20" height="20" rx="6"/><path fill="#fff" d="M7 8.3h5.6v1.4H8.9l3.8 4.6v1.2H7v-1.4h3.9L7 9.5V8.3zm7 0h1.5v7.2H14V8.3zm3-.3a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm-.75 1.8h1.5v5.7h-1.5V9.8z"/>' },
};

function socialIconsHtml(links) {
  const items = (links || []).filter(l => l && SOCIAL_ICONS[l.platform] && l.url);
  if (!items.length) return '';
  return `<div class="social-icons">
${items.map(l => {
    const icon = SOCIAL_ICONS[l.platform];
    if (l.platform === 'zalo') {
      return `      <a href="${l.url}" target="_blank" rel="noopener" aria-label="${icon.label}" class="icon-img"><img src="/zalo-icon.png" alt="Zalo"></a>`;
    }
    return `      <a href="${l.url}" target="_blank" rel="noopener" aria-label="${icon.label}"><svg viewBox="0 0 24 24" fill="currentColor">${icon.svg}</svg></a>`;
  }).join('\n')}
    </div>`;
}

function dateDisplay(d) {
  const dt = new Date(d);
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = dt.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function loadCollection(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const posts = files.map(file => {
    const slug = file.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    const { data, content } = matter(raw);
    return {
      slug,
      title: data.title || slug,
      date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
      dek: data.dek || '',
      read: data.read || '3 phút đọc',
      bg: data.bg || 'light',
      image: data.image || '',
      bodyMd: content.trim(),
    };
  });
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return posts;
}

function loadPosts() { return loadCollection(CONTENT_DIR); }
function loadBooks() { return loadCollection(BOOKS_CONTENT_DIR); }

// ---- small hex helpers so other theme tokens can follow the admin's 2 base colors ----
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex({ r, g, b }) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function luminance({ r, g, b }) { return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
// Nudge a color toward white (amt>0) or black (amt<0), amt in [-1,1].
function shade(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const target = amt > 0 ? 255 : 0;
  const k = Math.abs(amt);
  return rgbToHex({ r: r + (target - r) * k, g: g + (target - g) * k, b: b + (target - b) * k });
}

// ---- site-wide display overrides, set once in admin ("Cài đặt giao diện") ----
// Applies to every page: homepage, letters archive, and all post pages.
function loadSiteStyleCss() {
  if (!fs.existsSync(SETTINGS_FILE)) return '';
  const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
  const { data } = matter(raw);
  const rules = [];
  if (data.siteBg) {
    rules.push(`:root{--paper:${data.siteBg}}`);
    // --card is the "block" background (product cards, CTA box, alt sections) — keep it
    // close to the main background instead of staying hardcoded black.
    const isDark = luminance(hexToRgb(data.siteBg)) < 0.5;
    const card = shade(data.siteBg, isDark ? 0.08 : -0.04);
    const line = shade(data.siteBg, isDark ? 0.2 : -0.15);
    rules.push(`:root{--card:${card};--line:${line};--line-strong:${shade(data.siteBg, isDark ? 0.32 : -0.28)}}`);
  }
  if (data.siteColor) {
    rules.push(`:root{--ink:${data.siteColor}}`);
    // Hover/accent tokens (green, green-dark, gold) were hardcoded to always match the old
    // white ink — follow the chosen text color instead so hover states never go invisible.
    rules.push(`:root{--green:${data.siteColor};--green-dark:${data.siteColor};--gold:${data.siteColor}}`);
  }
  // Cỡ chữ chỉ áp cho nội dung bài viết (đổi cỡ chữ toàn site sẽ vỡ layout tiêu đề/nav).
  if (data.fontSize) rules.push(`.post-body{font-size:${data.fontSize}px}`);
  // Font chữ áp cho TOÀN site: style.css dùng var(--font-base) ở mọi nơi (nav, tiêu đề,
  // nút, nội dung bài viết...), nên chỉ cần đổi 1 biến này là đồng bộ toàn trang.
  if (data.fontFamily) rules.push(`:root{--font-base:${data.fontFamily}}`);
  return rules.join('\n');
}

function loadSocialLinks() {
  if (!fs.existsSync(SETTINGS_FILE)) return [];
  const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
  const { data } = matter(raw);
  return data.socialLinks || [];
}

function loadZaloUrl() {
  if (!fs.existsSync(SETTINGS_FILE)) return '';
  const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
  const { data } = matter(raw);
  return data.zaloUrl || '';
}

function tileHtml(post, tileClass) {
  if (post.image) return `<div class="${tileClass}"><img src="${post.image}" alt="${post.title}"></div>`;
  const preset = PRESETS[post.bg] || PRESETS.light;
  return `<div class="${tileClass}" style="background:${preset.bg};${preset.border}"><span style="color:${preset.color}">${ICON}</span></div>`;
}

// ---- "Bài liên quan" / "Sách khác": 3 most recent other items, so there's always more to read ----
function relatedRowHtml(post, basePath, heading) {
  return `        <a href="${basePath}${post.slug}/" class="related-row">
          ${tileHtml(post, 'related-thumb')}
          <div>
            <span class="related-date">${dateDisplay(post.date)}</span>
            <h3>${post.title}</h3>
          </div>
        </a>`;
}

function relatedSectionHtml(current, allPosts, basePath = '/letters/', heading = 'Bài liên quan') {
  const related = allPosts.filter(p => p.slug !== current.slug).slice(0, 3);
  if (!related.length) return '';
  return `<div class="related-posts">
    <h2 class="related-hd">${heading}</h2>
${related.map(p => relatedRowHtml(p, basePath)).join('\n')}
  </div>`;
}

function renderPostPage(post, tmpl, siteStyle, allPosts, socialLinks, basePath = '/letters/', relatedHeading = 'Bài liên quan') {
  const bodyHtml = marked.parse(post.bodyMd);
  return tmpl
    .replaceAll('{{TITLE}}', post.title)
    .replaceAll('{{DEK}}', post.dek)
    .replaceAll('{{DATE_DISPLAY}}', dateDisplay(post.date))
    .replaceAll('{{READ}}', post.read)
    .replace('{{SITE_STYLE}}', siteStyle)
    .replace('{{RELATED}}', relatedSectionHtml(post, allPosts, basePath, relatedHeading))
    .replaceAll('{{SOCIAL_ICONS}}', socialIconsHtml(socialLinks))
    .replace('{{BODY}}', bodyHtml);
}

// ---- "Sách khác"/archive: hàng ngang (ảnh bìa + tên/ghi chú) ----
function bookRowHtml(book, hidden, basePath = '/sach/') {
  const cls = hidden ? 'book-row blog-hidden' : 'book-row';
  return `      <a href="${basePath}${book.slug}/" class="${cls}">
        ${tileHtml(book, 'book-thumb')}
        <div>
          <h3>${book.title}</h3>
          <p>${book.dek}</p>
          <div class="book-meta">${book.read}</div>
        </div>
      </a>`;
}

const ARROW_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

// ---- "Sách nên đọc" trên trang chủ: thẻ nhỏ gọn, 3 cột (ảnh bìa + tên/tác giả/mô tả/Đọc ngay) ----
function bookMiniCardHtml(book, basePath = '/sach/') {
  return `      <a href="${basePath}${book.slug}/" class="book-mini">
        ${tileHtml(book, 'book-mini-thumb')}
        <div>
          <h3>${book.title}</h3>
          <div class="book-mini-author">${book.read}</div>
          <p>${book.dek}</p>
          <span class="book-mini-cta">Đọc ngay ${ARROW_SVG}</span>
        </div>
      </a>`;
}

function cardHtml(post, hidden, basePath = '/letters/') {
  const cls = hidden ? 'blog-card blog-hidden' : 'blog-card';
  return `      <a href="${basePath}${post.slug}/" class="${cls}">
        ${tileHtml(post, 'blog-tile')}
        <h3>${post.title}</h3>
        <p>${post.dek}</p>
        <div class="blog-meta">${dateDisplay(post.date)} · ${post.read}</div>
      </a>`;
}

function build() {
  const posts = loadPosts();
  const books = loadBooks();
  const siteStyle = loadSiteStyleCss();
  const socialLinks = loadSocialLinks();
  const socialIcons = socialIconsHtml(socialLinks);
  const zaloUrl = loadZaloUrl();
  const zaloIcon = socialIconsHtml(zaloUrl ? [{ platform: 'zalo', url: zaloUrl }] : []);
  let postTmpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'post.html'), 'utf-8');
  let bookTmpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'book.html'), 'utf-8');
  let homeTmpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'home.html'), 'utf-8');
  let archiveTmpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'letters-archive.html'), 'utf-8');
  let booksArchiveTmpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'books-archive.html'), 'utf-8');

  // Cache-bust style.css so a published CSS change shows up immediately instead of
  // being served stale from the browser/host cache (the file name never changed before).
  const cssHash = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'style.css'))).digest('hex').slice(0, 8);
  const cssHref = `/style.css?v=${cssHash}`;
  postTmpl = postTmpl.replace('/style.css', cssHref);
  bookTmpl = bookTmpl.replace('/style.css', cssHref);
  homeTmpl = homeTmpl.replace('/style.css', cssHref);
  archiveTmpl = archiveTmpl.replace('/style.css', cssHref);
  booksArchiveTmpl = booksArchiveTmpl.replace('/style.css', cssHref);

  // 1. individual post pages
  posts.forEach(post => {
    const outDir = path.join(LETTERS_OUT, post.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), renderPostPage(post, postTmpl, siteStyle, posts, socialLinks, '/letters/', 'Bài liên quan'));
  });

  // 1b. individual book pages
  books.forEach(book => {
    const outDir = path.join(BOOKS_OUT, book.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), renderPostPage(book, bookTmpl, siteStyle, books, socialLinks, '/sach/', 'Sách khác'));
  });

  // 2. homepage: Blog = first 9 visible, rest hidden; Sách nên đọc = 3 cuốn mới nhất, "Xem tất cả" -> /sach/
  const homeGrid = posts.map((p, i) => cardHtml(p, i >= 9)).join('\n');
  const bookSection = books.length ? `<section class="section book-section">
  <div class="wrap">
    <div class="book-hd">
      <div>
        <h2><span class="book-hd-dash"></span> Sách</h2>
        <p class="book-hd-sub">Những quyển sách về giao dịch, đầu tư tôi đã đọc và tâm đắc</p>
      </div>
      <a href="/sach/" class="book-viewall">Xem tất cả ${ARROW_SVG}</a>
    </div>
    <div class="book-grid3">
${books.slice(0, 3).map(b => bookMiniCardHtml(b, '/sach/')).join('\n')}
    </div>
  </div>
</section>` : '';
  fs.writeFileSync(path.join(ROOT, 'index.html'), homeTmpl
    .replace('{{BLOG_GRID}}', homeGrid)
    .replace('{{BOOK_SECTION}}', bookSection)
    .replace('{{SITE_STYLE}}', siteStyle)
    .replace('{{ZALO_ICON}}', zaloIcon)
    .replace('{{SOCIAL_ICONS_HERO}}', socialIcons)
    .replaceAll('{{SOCIAL_ICONS}}', socialIcons));

  // 3. full archive: nothing hidden
  const archiveGrid = posts.map(p => cardHtml(p, false)).join('\n');
  fs.mkdirSync(LETTERS_OUT, { recursive: true });
  fs.writeFileSync(path.join(LETTERS_OUT, 'index.html'), archiveTmpl.replace('{{BLOG_GRID_ALL}}', archiveGrid).replace('{{SITE_STYLE}}', siteStyle).replaceAll('{{SOCIAL_ICONS}}', socialIcons));

  // 4. full books archive: nothing hidden ("Xem tất cả" từ trang chủ trỏ về đây)
  const bookListAll = books.map(b => bookRowHtml(b, false, '/sach/')).join('\n');
  fs.mkdirSync(BOOKS_OUT, { recursive: true });
  fs.writeFileSync(path.join(BOOKS_OUT, 'index.html'), booksArchiveTmpl.replace('{{BOOK_LIST_ALL}}', bookListAll).replace('{{SITE_STYLE}}', siteStyle).replaceAll('{{SOCIAL_ICONS}}', socialIcons));

  console.log(`Built ${posts.length} posts, ${books.length} books -> homepage, letters archive, books archive, ${posts.length} post pages, ${books.length} book pages.`);
}

build();
