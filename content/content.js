(function () {
  'use strict';

  let currentLang = 'zh';

  function requestTranslate(text) {
    return new Promise((resolve) => {
      if (currentLang === 'en' || !text || /[\u4e00-\u9fa5]/.test(text)) {
        return resolve(text);
      }
      chrome.runtime.sendMessage({ action: 'TRANSLATE', text }, (resp) => {
        if (chrome.runtime.lastError || !resp || !resp.result) {
          resolve(text);
        } else {
          resolve(resp.result);
        }
      });
    });
  }

  function parsePlatformInfo() {
    const host = window.location.hostname;
    const url = window.location.href;

    if (host.includes('makerworld.com.cn')) {
      const match = url.match(/\/models\/(\d+)/i) || url.match(/\/design\/(\d+)/i);
      return match ? { platform: 'cn', id: match[1] } : null;
    }
    if (host.includes('makerworld.com')) {
      const match = url.match(/\/models\/(\d+)/i) || url.match(/\/design\/(\d+)/i);
      return match ? { platform: 'intl', id: match[1] } : null;
    }
    if (host.includes('printables.com')) {
      const match = url.match(/\/model\/(\d+)/i);
      return match ? { platform: 'printables', id: match[1] } : null;
    }
    if (host.includes('thingiverse.com')) {
      const match = url.match(/\/thing[:/](\d+)/i);
      return match ? { platform: 'thingiverse', id: match[1] } : null;
    }
    if (host.includes('thangs.com')) {
      const match = url.match(/\/3d-model\/.*?(\d+)$/i) || url.match(/\/m\/([a-zA-Z0-9_-]+)/i);
      return match ? { platform: 'thangs', id: match[1] } : null;
    }
    if (host.includes('cults3d.com')) {
      const match = url.match(/\/3d-model\/[^/]+\/([^/?#]+)/i) || url.match(/\/(?:en|fr|es|de)\/3d-model\/[^/]+\/([^/?#]+)/i);
      return match ? { platform: 'cults3d', id: match[1] } : null;
    }
    return null;
  }

  function cleanTitle(raw, platform, id) {
    if (!raw) return `Model ${id}`;
    let title = raw;

    if (platform === 'cn' || platform === 'intl') {
      title = title.replace(/\s*[-_|]\s*(免费\s*3D\s*打印模型|Free\s*3D\s*Print.*|MakerWorld.*|拓竹.*)$/i, '');
      title = title.replace(/\s*[-_|]\s*MakerWorld.*$/i, '');
      title = title.replace(/\s*[-_|]\s*免费.*$/i, '');
    } else if (platform === 'printables') {
      title = title.replace(/\s*\|\s*Printables\.com.*$/i, '');
    } else if (platform === 'thingiverse') {
      title = title.replace(/\s*by\s+.*?-\s*Thingiverse.*$/i, '');
      title = title.replace(/\s*-\s*Thingiverse.*$/i, '');
    } else if (platform === 'thangs') {
      title = title.replace(/\s*\|\s*Thangs.*$/i, '');
    } else if (platform === 'cults3d') {
      title = title.replace(/\s*·.*Cults.*$/i, '');
      title = title.replace(/\s*\|\s*Cults.*$/i, '');
      title = title.replace(/\s*·\s*3D\s*model.*$/i, '');
    }

    title = title.replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '').trim();
    return title || `Model ${id}`;
  }

  const INVALID_CREATORS = new Set([
    '浏览历史', '浏览记录', '历史记录', 'history', 'browse history',
    '登录', '注册', 'login', 'sign in', 'sign up', 'makerworld',
    'admin', 'administrator', '官方', '首页', 'home'
  ]);

  function isInvalidCreator(name) {
    if (!name) return true;
    const lower = name.toLowerCase().trim();
    return INVALID_CREATORS.has(lower) || INVALID_CREATORS.has(lower.replace(/\s+/g, ''));
  }

  function extractCreator(platform) {
    if (platform === 'cn' || platform === 'intl') {
      const mwSelectors = [
        '[class*="authorName"]',
        '[class*="creator-name"]',
        '[class*="creatorName"]',
        '[class*="design-user"] [class*="name"]',
        '[class*="user-info"] [class*="name"]',
        '.design-header a[href*="/u/"]',
        '.design-detail a[href*="/u/"]'
      ];
      for (const sel of mwSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          let txt = el.innerText.replace(/[@\s]/g, '').trim();
          txt = txt.replace(/^\d+/, '').trim();
          if (txt && !isInvalidCreator(txt)) return txt;
        }
      }

      const allUserLinks = Array.from(document.querySelectorAll('a[href*="/u/"], a[href*="/user/"]'));
      for (const link of allUserLinks) {
        if (link.closest('header, nav, [class*="nav"], [class*="header"], [class*="sidebar"]')) continue;
        let txt = link.innerText.replace(/[@\s]/g, '').trim();
        txt = txt.replace(/^\d+/, '').trim();
        if (txt && !isInvalidCreator(txt)) return txt;
      }
      return '';
    }

    if (platform === 'cults3d') {
      const creatorLink = document.querySelector('a[href*="/users/"][class*="nick"], a[href^="/en/users/"], a[href^="/users/"], .creator-name, .author a');
      if (creatorLink) {
        let name = creatorLink.innerText.trim();
        if (name && !isInvalidCreator(name)) return name;
      }
    }

    if (platform === 'printables') {
      const link = document.querySelector('a[href*="/@"]');
      if (link) {
        const hrefMatch = (link.getAttribute('href') || '').match(/\/@([a-zA-Z0-9_.-]+)/);
        if (hrefMatch && hrefMatch[1] && !isInvalidCreator(hrefMatch[1])) {
          return hrefMatch[1].trim();
        }
      }
      const el = document.querySelector('.user-info, .author-name, .user-name');
      if (el) {
        let txt = el.innerText.replace(/[@\s]/g, '').trim();
        txt = txt.replace(/^\d+/, '').trim();
        if (txt && !isInvalidCreator(txt)) return txt;
      }
    }

    if (platform === 'thingiverse') {
      const thingUserEl = document.querySelector('a[href*="/users/"], a[href^="/users/"], div[class*="CreatorName"] a, div[class*="design-by"] a');
      if (thingUserEl) {
        const hrefMatch = (thingUserEl.getAttribute('href') || '').match(/\/users\/([a-zA-Z0-9_.-]+)/);
        if (hrefMatch && hrefMatch[1] && !isInvalidCreator(hrefMatch[1])) {
          return hrefMatch[1].trim();
        }
        let txt = thingUserEl.innerText.replace(/[@\s]/g, '').trim();
        if (txt && !isInvalidCreator(txt)) return txt;
      }
    }

    const creatorEl = document.querySelector('a[href*="/u/"], a[href*="/user/"], a[href*="/@"], [class*="creator-name"], [class*="author"]');
    if (creatorEl) {
      if (!creatorEl.closest('header, nav, [class*="nav"], [class*="header"]')) {
        let txt = creatorEl.innerText.replace(/[@\s]/g, '').trim();
        txt = txt.replace(/^\d+/, '').trim();
        if (txt && !isInvalidCreator(txt)) return txt;
      }
    }
    return '';
  }

  function sanitizeUrl(u) {
    if (!u) return '';
    u = u.trim();
    if (u.startsWith('//')) return 'https:' + u;
    return u;
  }

  function getImgSrc(img) {
    if (!img) return '';
    const src = img.getAttribute('data-origin') ||
                img.getAttribute('data-full') ||
                img.getAttribute('data-src') ||
                img.getAttribute('data-lazy-src') ||
                img.src || '';
    return sanitizeUrl(src);
  }

  function extractCoverImage(platform) {
    if (platform === 'cn' || platform === 'intl') {
      const mwOgImage = document.querySelector('meta[property="og:image"]')?.content;
      if (mwOgImage && !mwOgImage.includes('logo') && !mwOgImage.includes('default') && !mwOgImage.includes('placeholder')) {
        return sanitizeUrl(mwOgImage);
      }

      const mwHeroSelectors = [
        '.swiper-slide-active img',
        '.ant-carousel .slick-active img',
        '[class*="design-carousel"] img',
        '[class*="image-viewer"] img',
        '[class*="detail-cover"] img',
        '[class*="mainImage"] img'
      ];
      for (const sel of mwHeroSelectors) {
        const el = document.querySelector(sel);
        if (el && !el.closest('[class*="recommend"], [class*="related"], [class*="similar"], [class*="model-card"]')) {
          const s = getImgSrc(el);
          if (s && !s.includes('avatar') && !s.includes('icon')) return s;
        }
      }
    }

    if (platform === 'cults3d') {
      const gifAnchor = document.querySelector('a[href*=".gif"], a[data-full*=".gif"]');
      if (gifAnchor) {
        const href = gifAnchor.getAttribute('href') || gifAnchor.getAttribute('data-full');
        if (href && !href.includes('avatar')) return sanitizeUrl(href);
      }

      const gifImgs = Array.from(document.querySelectorAll('img, source')).filter(el => {
        const src = (el.getAttribute('src') || '') + ' ' + (el.getAttribute('srcset') || '') + ' ' + (el.getAttribute('data-src') || '');
        return /\.gif(?:[?#]|$)/i.test(src) && !src.includes('avatar') && !src.includes('loading');
      });

      if (gifImgs.length > 0) {
        const target = gifImgs[0];
        let foundUrl = target.getAttribute('data-full') || target.getAttribute('data-src') || target.src;
        if (!foundUrl && target.getAttribute('srcset')) {
          const parts = target.getAttribute('srcset').split(',');
          foundUrl = parts[parts.length - 1].trim().split(' ')[0];
        }
        if (foundUrl) return sanitizeUrl(foundUrl);
      }

      const cultsHero = document.querySelector('.slideshow img, .swiper-slide img, picture.illustration img, .t-illustration img, [data-controller*="carousel"] img');
      if (cultsHero) {
        const s = getImgSrc(cultsHero);
        if (s && !s.includes('avatar')) return s;
      }
    }

    const gifCandidate = document.querySelector('img[src*=".gif"], img[data-src*=".gif"], a[href*=".gif"]');
    if (gifCandidate) {
      let gSrc = gifCandidate.tagName === 'A' ? gifCandidate.getAttribute('href') : getImgSrc(gifCandidate);
      gSrc = sanitizeUrl(gSrc);
      if (gSrc && !gSrc.includes('loading') && !gSrc.includes('spinner') && !gSrc.includes('avatar')) {
        return gSrc;
      }
    }

    if (platform === 'thingiverse') {
      const heroSelectors = [
        'div[class*="main-slide"] img',
        'div[class*="MainSlider"] img',
        'div[class*="gallery-slider"] img',
        'div[class*="ImageSlider"] img',
        'div[class*="carousel"] img',
        'img[class*="main-image"]',
        'img[class*="MainImage"]',
        'div[class*="thing-page-image"] img'
      ];
      for (const sel of heroSelectors) {
        const img = document.querySelector(sel);
        const s = getImgSrc(img);
        if (s && !s.includes('placeholder') && !s.includes('avatar') && !s.includes('icon')) return s;
      }

      const cdnImgs = Array.from(document.querySelectorAll('img[src*="cdn.thingiverse.com/renders"], img[src*="cdn.thingiverse.com/assets"]'));
      for (const img of cdnImgs) {
        const s = getImgSrc(img);
        if (!s.includes('avatar') && !s.includes('thumb') && !s.includes('icon')) {
          if (img.naturalWidth > 150 || img.width > 150) return s;
        }
      }
      if (cdnImgs.length > 0) return getImgSrc(cdnImgs[0]);
    }

    const ogImage = document.querySelector('meta[property="og:image"]')?.content || '';
    if (ogImage && !ogImage.includes('placeholder') && !ogImage.includes('default-card') && !ogImage.includes('logo')) {
      return sanitizeUrl(ogImage);
    }

    const mainImg = document.querySelector('.carousel img, .main-image img, .design-detail-cover img, [class*="cover"] img, [class*="gallery"] img, picture img');
    if (mainImg) {
      if (!mainImg.closest('[class*="recommend"], [class*="related"], [class*="similar"], [class*="model-card"]')) {
        const mainSrc = getImgSrc(mainImg);
        if (mainSrc && !mainSrc.includes('avatar') && !mainSrc.includes('icon')) return mainSrc;
      }
    }

    return sanitizeUrl(ogImage);
  }

  function extractRawModel() {
    const info = parsePlatformInfo();
    if (!info) return null;

    const { platform, id } = info;
    let rawTitle = '';
    const h1 = document.querySelector('h1');
    const specificTitle = document.querySelector('.design-title, [class*="designTitle"], [class*="model-title"], [class*="detailHeaderTitle"]');

    if (specificTitle && specificTitle.innerText.trim()) {
      rawTitle = specificTitle.innerText.trim();
    } else if (h1 && h1.innerText.trim()) {
      rawTitle = h1.innerText.trim();
    } else {
      const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
      rawTitle = ogTitle || document.title || `Model ${id}`;
    }

    const titleOriginal = cleanTitle(rawTitle, platform, id);
    const coverUrl = extractCoverImage(platform);
    const creator = extractCreator(platform);

    return {
      id: `${platform}_${id}`,
      platformId: id,
      title: titleOriginal,
      titleOriginal: titleOriginal,
      coverUrl: coverUrl,
      creator: creator,
      platform: platform,
      category: '默认',
      url: window.location.href.split('?')[0],
      createdAt: Date.now()
    };
  }

  function showToast(msg) {
    let toast = document.getElementById('mw-collect-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'mw-collect-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  function updateFloatingBtnText(btn, isCollected) {
    const textSpan = btn.querySelector('#mw-btn-text');
    if (isCollected) {
      textSpan.textContent = currentLang === 'en' ? 'Collected' : '已收藏';
    } else {
      textSpan.textContent = currentLang === 'en' ? 'Collect Model' : '收藏模型';
    }
  }

  function injectFloatingBtn() {
    const info = parsePlatformInfo();
    if (!info || document.getElementById('mw-floating-collect-btn')) return;

    const fullId = `${info.platform}_${info.id}`;
    const btn = document.createElement('div');
    btn.id = 'mw-floating-collect-btn';
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
      </svg>
      <span id="mw-btn-text"></span>
    `;

    chrome.storage.local.get(['mw_collections', 'mw_lang'], (res) => {
      currentLang = res.mw_lang || 'zh';
      const list = res.mw_collections || [];
      const isCollected = list.some(m => m.id === fullId);
      if (isCollected) btn.classList.add('collected');
      updateFloatingBtnText(btn, isCollected);
    });

    btn.addEventListener('click', async () => {
      const rawModel = extractRawModel();
      if (!rawModel) {
        showToast(currentLang === 'en' ? 'Failed to extract model info' : '未能识别到当前模型信息');
        return;
      }

      btn.querySelector('#mw-btn-text').textContent = currentLang === 'en' ? 'Processing...' : '处理中...';
      if (currentLang === 'zh') {
        const translatedTitle = await requestTranslate(rawModel.titleOriginal);
        rawModel.title = translatedTitle;
      }

      chrome.storage.local.get(['mw_collections'], (res) => {
        let list = res.mw_collections || [];
        const index = list.findIndex(m => m.id === rawModel.id);

        if (index >= 0) {
          list.splice(index, 1);
          chrome.storage.local.set({ mw_collections: list }, () => {
            btn.classList.remove('collected');
            updateFloatingBtnText(btn, false);
            showToast(currentLang === 'en' ? 'Removed from collection' : '已取消收藏');
          });
        } else {
          list.unshift(rawModel);
          chrome.storage.local.set({ mw_collections: list }, () => {
            btn.classList.add('collected');
            updateFloatingBtnText(btn, true);
            showToast(currentLang === 'en' ? 'Saved to collection!' : '收藏成功，已存入插件');
          });
        }
      });
    });

    document.body.appendChild(btn);
  }

  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'GET_PAGE_MODEL') {
      const raw = extractRawModel();
      if (!raw) {
        sendResponse({ model: null });
      } else {
        if (currentLang === 'zh') {
          requestTranslate(raw.titleOriginal).then(translated => {
            raw.title = translated;
            sendResponse({ model: raw });
          });
        } else {
          sendResponse({ model: raw });
        }
      }
      return true;
    }
  });

  setTimeout(injectFloatingBtn, 800);
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      const exist = document.getElementById('mw-floating-collect-btn');
      if (exist) exist.remove();
      setTimeout(injectFloatingBtn, 800);
    }
  }).observe(document, { subtree: true, childList: true });
})();