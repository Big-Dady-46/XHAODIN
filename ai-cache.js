// ==========================================================================
// XHAODIN AI - Web Data Collector & Cache System
// Fetches live data when online, caches for offline use
// ==========================================================================

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'data', 'ai_cache.json');
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

class AICache {
  constructor() {
    this.cache = this.load();
    this.isOnline = true;
    this.lastFetch = this.cache._meta?.lastFetch || 0;
  }

  load() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      }
    } catch (e) {}
    return { _meta: { lastFetch: 0 }, trending: {}, wiki: {}, news: {}, programming: {} };
  }

  save() {
    this.cache._meta = { lastFetch: Date.now() };
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.cache, null, 2), 'utf8');
    } catch (e) {}
  }

  needsRefresh() {
    return Date.now() - this.lastFetch > CACHE_TTL;
  }

  fetchUrl(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, { timeout: 8000, headers: { 'User-Agent': 'XHAODIN-AI/1.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this.fetchUrl(res.headers.location).then(resolve).catch(reject);
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
  }

  async fetchTrendingTopics() {
    try {
      // Wikipedia "Did you know" + trending articles
      const raw = await this.fetchUrl('https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/08/29');
      const data = JSON.parse(raw);
      const items = [];
      if (data.events) {
        data.events.slice(0, 10).forEach(e => {
          items.push({ text: e.text, year: e.year, type: 'event' });
        });
      }
      if (data.births) {
        data.births.slice(0, 5).forEach(e => {
          items.push({ text: e.text, year: e.year, type: 'birth' });
        });
      }
      this.cache.trending = { onThisDay: items, fetchedAt: Date.now() };
      console.log('[AI Cache] Trending data fetched:', items.length, 'items');
    } catch (e) {
      console.warn('[AI Cache] Trending fetch failed:', e.message);
    }
  }

  async fetchWikipediaSummary(topic) {
    try {
      const clean = topic.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
      const raw = await this.fetchUrl(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean)}`);
      const data = JSON.parse(raw);
      if (data.extract) {
        this.cache.wiki[clean.toLowerCase()] = {
          title: data.title,
          extract: data.extract,
          url: data.content_urls?.desktop?.page || '',
          fetchedAt: Date.now()
        };
        this.save();
        return data.extract;
      }
    } catch (e) {}
    return null;
  }

  async fetchTechNews() {
    try {
      // Hacker News top stories
      const idsRaw = await this.fetchUrl('https://hacker-news.firebaseio.com/v0/topstories.json');
      const ids = JSON.parse(idsRaw).slice(0, 10);
      const stories = [];
      for (const id of ids) {
        try {
          const storyRaw = await this.fetchUrl(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          const story = JSON.parse(storyRaw);
          if (story && story.title) {
            stories.push({ title: story.title, url: story.url || '', score: story.score || 0 });
          }
        } catch (e) {}
      }
      this.cache.news = { tech: stories, fetchedAt: Date.now() };
      console.log('[AI Cache] Tech news fetched:', stories.length, 'stories');
    } catch (e) {
      console.warn('[AI Cache] Tech news fetch failed:', e.message);
    }
  }

  async fetchWeather(city) {
    try {
      const raw = await this.fetchUrl(`https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+%h+%w&lang=en`);
      return raw.trim();
    } catch (e) {
      return null;
    }
  }

  async refreshAll() {
    if (!this.needsRefresh()) {
      console.log('[AI Cache] Cache is fresh, skipping refresh');
      return;
    }
    console.log('[AI Cache] Refreshing web data...');
    await Promise.all([
      this.fetchTrendingTopics(),
      this.fetchTechNews()
    ]);
    this.lastFetch = Date.now();
    this.save();
    console.log('[AI Cache] Refresh complete');
  }

  getWikipediaSummary(topic) {
    const clean = topic.toLowerCase().trim();
    const cached = this.cache.wiki[clean];
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      return cached.extract;
    }
    return null;
  }

  getTrending() {
    return this.cache.trending?.onThisDay || [];
  }

  getTechNews() {
    return this.cache.news?.tech || [];
  }

  searchCache(query) {
    const q = query.toLowerCase();
    // Search wiki cache
    for (const [key, val] of Object.entries(this.cache.wiki)) {
      if (q.includes(key) || key.includes(q.split(' ').slice(0, 2).join('_'))) {
        return val.extract;
      }
    }
    return null;
  }
}

module.exports = new AICache();
