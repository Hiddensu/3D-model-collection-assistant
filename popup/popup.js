const collectCurrentBtn = document.getElementById('collectCurrentBtn');
const collectBtnText = document.getElementById('collectBtnText');
const pageTip = document.getElementById('pageTip');
const totalBadge = document.getElementById('totalBadge');
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const searchInput = document.getElementById('searchInput');
const platformFilter = document.getElementById('platformFilter');
const categoryFilter = document.getElementById('categoryFilter');
const targetCategorySelect = document.getElementById('targetCategorySelect');
const exportBtn = document.getElementById('exportBtn');
const manageCategoryBtn = document.getElementById('manageCategoryBtn');
const categoryModal = document.getElementById('categoryModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const newCatInput = document.getElementById('newCatInput');
const addCatBtn = document.getElementById('addCatBtn');
const catList = document.getElementById('catList');
const langToggleBtn = document.getElementById('langToggleBtn');

const i18nAppTitle = document.getElementById('i18nAppTitle');
const modalTitle = document.getElementById('modalTitle');
const emptyTitle = document.getElementById('emptyTitle');
const emptyDesc = document.getElementById('emptyDesc');

let collections = [];
let categories = ['默认'];
let currentPageModel = null;
let currentLang = 'zh';

const I18N = {
  zh: {
    appTitle: '3D 模型收藏夹',
    manageCat: '管理分组',
    collectBtn: '收藏当前打开的模型',
    collectedBtn: '已收藏此模型 (点击移除)',
    saving: '保存中...',
    totalCount: (n) => `共 ${n} 个`,
    searchPlaceholder: '搜索模型标题或作者...',
    exportBtn: '导出',
    allCats: '全部分组',
    allPlatforms: '全部站点',
    emptyTitle: '收藏夹还是空的',
    emptyDesc: '打开任意支持的模型页面，点击右上角的「收藏当前打开的模型」或页面右下角的「收藏模型」悬浮按钮即可。',
    modalTitle: '分组管理',
    newCatPlaceholder: '新建分组名称...',
    addBtn: '添加',
    deleteBtn: '删除',
    delConfirm: '删除',
    notSupported: '当前标签页不是支持的模型详情页',
    detected: '已检测到支持的模型站点',
    currentIdentified: (title) => `当前识别: ${title.slice(0, 24)}...`,
    defaultCat: '默认',
    platformNames: {
      intl: 'MakerWorld 国际站',
      cn: 'MakerWorld 国内站',
      printables: 'Printables',
      thingiverse: 'Thingiverse',
      thangs: 'Thangs',
      cults3d: 'Cults3D'
    }
  },
  en: {
    appTitle: '3D Model Collector',
    manageCat: 'Categories',
    collectBtn: 'Collect Current Model',
    collectedBtn: 'Collected (Click to Remove)',
    saving: 'Saving...',
    totalCount: (n) => `Total: ${n}`,
    searchPlaceholder: 'Search by title or creator...',
    exportBtn: 'Export',
    allCats: 'All Categories',
    allPlatforms: 'All Platforms',
    emptyTitle: 'Collection is empty',
    emptyDesc: 'Open any supported 3D model page and click "Collect Current Model" to save it.',
    modalTitle: 'Manage Categories',
    newCatPlaceholder: 'New category name...',
    addBtn: 'Add',
    deleteBtn: 'Delete',
    delConfirm: 'Delete',
    notSupported: 'Current tab is not a supported 3D model page',
    detected: 'Supported 3D platform detected',
    currentIdentified: (title) => `Identified: ${title.slice(0, 24)}...`,
    defaultCat: 'Default',
    platformNames: {
      intl: 'MakerWorld (Global)',
      cn: 'MakerWorld (CN)',
      printables: 'Printables',
      thingiverse: 'Thingiverse',
      thangs: 'Thangs',
      cults3d: 'Cults3D'
    }
  }
};

function t(key, ...args) {
  const dict = I18N[currentLang] || I18N.zh;
  const val = dict[key];
  if (typeof val === 'function') return val(...args);
  return val || key;
}

function applyLanguageUI() {
  langToggleBtn.textContent = currentLang === 'zh' ? 'EN' : '中';
  i18nAppTitle.textContent = t('appTitle');
  manageCategoryBtn.textContent = t('manageCat');
  exportBtn.textContent = t('exportBtn');
  searchInput.placeholder = t('searchPlaceholder');
  modalTitle.textContent = t('modalTitle');
  newCatInput.placeholder = t('newCatPlaceholder');
  addCatBtn.textContent = t('addBtn');
  emptyTitle.textContent = t('emptyTitle');
  emptyDesc.textContent = t('emptyDesc');

  platformFilter.options[0].textContent = t('allPlatforms');
  updateCategorySelects();
  updateCollectBtnState();
}

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

function updateCategorySelects() {
  const currentFilterVal = categoryFilter.value;
  const currentTargetVal = targetCategorySelect.value;

  categoryFilter.innerHTML = `<option value="all">${t('allCats')}</option>`;
  targetCategorySelect.innerHTML = '';

  categories.forEach(cat => {
    const displayCat = (cat === '默认' || cat === 'Default') ? t('defaultCat') : cat;

    const optFilter = document.createElement('option');
    optFilter.value = cat;
    optFilter.textContent = displayCat;
    categoryFilter.appendChild(optFilter);

    const optTarget = document.createElement('option');
    optTarget.value = cat;
    optTarget.textContent = displayCat;
    targetCategorySelect.appendChild(optTarget);
  });

  if (categories.includes(currentFilterVal) || currentFilterVal === 'all') {
    categoryFilter.value = currentFilterVal;
  }
  if (categories.includes(currentTargetVal)) {
    targetCategorySelect.value = currentTargetVal;
  }
}

function renderCategoryModalList() {
  catList.innerHTML = '';
  categories.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'cat-item';

    const span = document.createElement('span');
    span.textContent = (cat === '默认' || cat === 'Default') ? t('defaultCat') : cat;
    item.appendChild(span);

    if (cat !== '默认' && cat !== 'Default') {
      const delBtn = document.createElement('button');
      delBtn.className = 'cat-del-btn';
      delBtn.textContent = t('deleteBtn');
      delBtn.addEventListener('click', () => {
        categories = categories.filter(c => c !== cat);
        collections.forEach(m => {
          if (m.category === cat) m.category = '默认';
        });
        chrome.storage.local.set({ mw_categories: categories, mw_collections: collections }, () => {
          updateCategorySelects();
          renderCategoryModalList();
          render();
        });
      });
      item.appendChild(delBtn);
    }

    catList.appendChild(item);
  });
}

async function checkCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;

  const valid = /(makerworld\.com|printables\.com|thingiverse\.com|thangs\.com|cults3d\.com)/i.test(tab.url);
  if (!valid) {
    collectCurrentBtn.disabled = true;
    collectCurrentBtn.style.opacity = '0.6';
    collectCurrentBtn.style.cursor = 'not-allowed';
    pageTip.textContent = t('notSupported');
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: 'GET_PAGE_MODEL' }, (res) => {
    if (chrome.runtime.lastError || !res || !res.model) {
      pageTip.textContent = t('detected');
    } else {
      currentPageModel = res.model;
      const displayTitle = currentLang === 'en' ? (currentPageModel.titleOriginal || currentPageModel.title) : currentPageModel.title;
      pageTip.textContent = t('currentIdentified', displayTitle);
      const exist = collections.find(m => m.id === currentPageModel.id);
      if (exist && exist.category) {
        targetCategorySelect.value = exist.category;
      }
    }
    updateCollectBtnState();
  });
}

function updateCollectBtnState() {
  if (!currentPageModel) return;
  const exists = collections.some(m => m.id === currentPageModel.id);
  if (exists) {
    collectCurrentBtn.classList.add('collected');
    collectCurrentBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
      </svg>
      <span>${t('collectedBtn')}</span>
    `;
  } else {
    collectCurrentBtn.classList.remove('collected');
    collectCurrentBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
      </svg>
      <span>${t('collectBtn')}</span>
    `;
  }
}

async function loadData() {
  chrome.storage.local.get(['mw_collections', 'mw_categories', 'mw_lang'], async (res) => {
    currentLang = res.mw_lang || 'zh';
    categories = res.mw_categories && res.mw_categories.length > 0 ? res.mw_categories : ['默认'];
    if (!categories.includes('默认')) categories.unshift('默认');

    let rawList = res.mw_collections || [];
    let updated = false;

    for (let item of rawList) {
      if (item.platform === 'mw_intl') { item.platform = 'intl'; updated = true; }
      if (item.platform === 'mw_cn') { item.platform = 'cn'; updated = true; }
      if (item.id && item.id.startsWith('mw_intl_')) { item.id = item.id.replace('mw_intl_', 'intl_'); updated = true; }
      if (item.id && item.id.startsWith('mw_cn_')) { item.id = item.id.replace('mw_cn_', 'cn_'); updated = true; }
      if (!item.category) { item.category = '默认'; updated = true; }

      if (item.creator) {
        const cleanC = item.creator.toLowerCase().trim();
        if (cleanC.includes('浏览历史') || cleanC.includes('history')) {
          item.creator = '';
          updated = true;
        }
      }

      if (item.coverUrl && item.coverUrl.startsWith('//')) {
        item.coverUrl = 'https:' + item.coverUrl;
        updated = true;
      }

      if (item.creator && item.platform === 'printables' && /^\d+/.test(item.creator)) {
        item.creator = item.creator.replace(/^\d+/, '');
        updated = true;
      }

      if (currentLang === 'zh' && item.title && !/[\u4e00-\u9fa5]/.test(item.title)) {
        item.titleOriginal = item.titleOriginal || item.title;
        const trans = await requestTranslate(item.title);
        if (trans && trans !== item.title) {
          item.title = trans;
          updated = true;
        }
      }
    }

    collections = rawList;
    if (updated) {
      chrome.storage.local.set({ mw_collections: collections });
    }

    applyLanguageUI();
    totalBadge.textContent = t('totalCount', collections.length);
    render();
  });
}

function render() {
  const keyword = searchInput.value.trim().toLowerCase();
  const platform = platformFilter.value;
  const category = categoryFilter.value;

  const filtered = collections.filter(item => {
    if (platform !== 'all' && item.platform !== platform) return false;
    if (category !== 'all' && (item.category || '默认') !== category) return false;
    if (keyword) {
      const matchTitle = (item.title || '').toLowerCase().includes(keyword);
      const matchOrig = (item.titleOriginal || '').toLowerCase().includes(keyword);
      const matchCreator = (item.creator || '').toLowerCase().includes(keyword);
      if (!matchTitle && !matchOrig && !matchCreator) return false;
    }
    return true;
  });

  listEl.innerHTML = '';

  if (filtered.length === 0) {
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';

    const defaultImg = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="%23f1f5f9"/></svg>';
    
    const img = document.createElement('img');
    img.src = item.coverUrl || defaultImg;
    img.onerror = () => { img.src = defaultImg; };

    const info = document.createElement('div');
    info.className = 'info';

    const title = document.createElement('div');
    title.className = 'title';
    
    const showTitle = currentLang === 'en' ? (item.titleOriginal || item.title) : item.title;
    title.textContent = showTitle;
    title.title = item.titleOriginal ? `${showTitle}\n(Original: ${item.titleOriginal})` : showTitle;

    const meta = document.createElement('div');
    meta.className = 'meta';

    const dict = I18N[currentLang] || I18N.zh;
    const tag = document.createElement('span');
    tag.className = `tag ${item.platform}`;
    tag.textContent = dict.platformNames[item.platform] || item.platform;
    meta.appendChild(tag);

    const catSelect = document.createElement('select');
    catSelect.className = 'card-cat-select';
    categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = (c === '默认' || c === 'Default') ? t('defaultCat') : c;
      if (c === (item.category || '默认')) opt.selected = true;
      catSelect.appendChild(opt);
    });
    catSelect.addEventListener('change', (e) => {
      item.category = e.target.value;
      chrome.storage.local.set({ mw_collections: collections }, () => {
        if (categoryFilter.value !== 'all') render();
      });
    });
    meta.appendChild(catSelect);

    if (item.creator) {
      const creator = document.createElement('span');
      creator.className = 'creator';
      creator.textContent = `@${item.creator}`;
      meta.appendChild(creator);
    }

    info.appendChild(title);
    info.appendChild(meta);

    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.title = t('deleteBtn');
    delBtn.textContent = t('deleteBtn');

    card.appendChild(img);
    card.appendChild(info);
    card.appendChild(delBtn);

    const openUrl = () => chrome.tabs.create({ url: item.url });
    title.addEventListener('click', openUrl);
    img.addEventListener('click', openUrl);

    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeCollection(item.id);
    });

    listEl.appendChild(card);
  });
}

function removeCollection(id) {
  collections = collections.filter(m => m.id !== id);
  chrome.storage.local.set({ mw_collections: collections }, () => {
    loadData();
  });
}

collectCurrentBtn.addEventListener('click', async () => {
  if (!currentPageModel) return;

  const index = collections.findIndex(m => m.id === currentPageModel.id);
  if (index >= 0) {
    collections.splice(index, 1);
  } else {
    collectCurrentBtn.querySelector('span').textContent = t('saving');
    if (currentLang === 'zh' && !/[\u4e00-\u9fa5]/.test(currentPageModel.title)) {
      const translated = await requestTranslate(currentPageModel.titleOriginal || currentPageModel.title);
      currentPageModel.title = translated;
    }
    currentPageModel.category = targetCategorySelect.value || '默认';
    collections.unshift(currentPageModel);
  }

  chrome.storage.local.set({ mw_collections: collections }, () => {
    loadData();
  });
});

langToggleBtn.addEventListener('click', () => {
  currentLang = currentLang === 'zh' ? 'en' : 'zh';
  chrome.storage.local.set({ mw_lang: currentLang }, () => {
    applyLanguageUI();
    totalBadge.textContent = t('totalCount', collections.length);
    render();
  });
});

manageCategoryBtn.addEventListener('click', () => {
  renderCategoryModalList();
  categoryModal.style.display = 'flex';
});

closeModalBtn.addEventListener('click', () => {
  categoryModal.style.display = 'none';
});

categoryModal.addEventListener('click', (e) => {
  if (e.target === categoryModal) categoryModal.style.display = 'none';
});

addCatBtn.addEventListener('click', () => {
  const val = newCatInput.value.trim();
  if (!val) return;
  if (!categories.includes(val)) {
    categories.push(val);
    chrome.storage.local.set({ mw_categories: categories }, () => {
      newCatInput.value = '';
      updateCategorySelects();
      renderCategoryModalList();
      render();
    });
  }
});

searchInput.addEventListener('input', render);
platformFilter.addEventListener('change', render);
categoryFilter.addEventListener('change', render);

exportBtn.addEventListener('click', () => {
  const data = {
    categories: categories,
    collections: collections
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `3d-models-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

checkCurrentTab();
loadData();