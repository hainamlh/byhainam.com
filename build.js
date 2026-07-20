#!/usr/bin/env node
// Build script: reads content/letters/*.md and generates
// - letters/<slug>/index.html  (post pages)
// - index.html                (homepage, blog grid = 9 shown + rest hidden)
// - letters/index.html         (full archive, nothing hidden)
//
// Run with: node build.js

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = __dirname;
const CONTENT_DIR = path.join(ROOT, 'content', 'letters');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const LETTERS_OUT = path.join(ROOT, 'letters');

// ---- icon glyphs + tint presets, keyed by frontmatter `bg` field ----
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8A3.5 3.5 0 0 0 8 18a3 3 0 0 0 4-2V6a2 2 0 0 0-3-2z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 1 5.8A3.5 3.5 0 0 1 16 18a3 3 0 0 1-4-2"/></svg>';
const PRESETS = {
  dark:       { bg: 'linear-gradient(155deg,#1a1917,#2d2b28)', color: '#D8C9B3', border: '' },
  light:      { bg: '#FFFFFF', color: '#1A1A1A', border: 'border:1px solid var(--line)' },
  'light-green': { bg: '#E1F5EE', color: '#0F6E56', border: '' },
  'light-red':   { bg: '#FAECE7', color: '#A32D2D', border: '' },
};

function dateDisplay(d) {
  const dt = new Date(d);
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = dt.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function loadPosts() {
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  const posts = files.map(file => {
    const slug = file.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf-8');
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

function renderPostPage(post, tmpl) {
  const bodyHtml = marked.parse(post.bodyMd);
  return tmpl
    .replaceAll('{{TITLE}}', post.title)
    .replaceAll('{{DEK}}', post.dek)
    .replaceAll('{{DATE_DISPLAY}}', dateDisplay(post.date))
    .replaceAll('{{READ}}', post.read)
    .replace('{{BODY}}', bodyHtml);
}

function cardHtml(post, hidden) {
  const cls = hidden ? 'blog-card blog-hidden' : 'blog-card';
  const tile = post.image
    ? `<div class="blog-tile"><img src="${post.image}" alt="${post.title}"></div>`
    : (() => {
        const preset = PRESETS[post.bg] || PRESETS.light;
        return `<div class="blog-tile" style="background:${preset.bg};${preset.border}"><span style="color:${preset.color}">${ICON}</span></div>`;
      })();
  return `      <a href="/letters/${post.slug}/" class="${cls}">
        ${tile}
        <h3>${post.title}</h3>
        <p>${post.dek}</p>
        <div class="blog-meta">${dateDisplay(post.date)} · ${post.read}</div>
      </a>`;
}

function build() {
  const posts = loadPosts();
  const postTmpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'post.html'), 'utf-8');
  const homeTmpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'home.html'), 'utf-8');
  const archiveTmpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'letters-archive.html'), 'utf-8');

  // 1. individual post pages
  posts.forEach(post => {
    const outDir = path.join(LETTERS_OUT, post.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), renderPostPage(post, postTmpl));
  });

  // 2. homepage: first 9 visible, rest hidden behind Load More
  const homeGrid = posts.map((p, i) => cardHtml(p, i >= 9)).join('\n');
  fs.writeFileSync(path.join(ROOT, 'index.html'), homeTmpl.replace('{{BLOG_GRID}}', homeGrid));

  // 3. full archive: nothing hidden
  const archiveGrid = posts.map(p => cardHtml(p, false)).join('\n');
  fs.mkdirSync(LETTERS_OUT, { recursive: true });
  fs.writeFileSync(path.join(LETTERS_OUT, 'index.html'), archiveTmpl.replace('{{BLOG_GRID_ALL}}', archiveGrid));

  console.log(`Built ${posts.length} posts -> homepage, letters archive, ${posts.length} post pages.`);
}

build();
