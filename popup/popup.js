const collectCurrentBtn = document.getElementById('collectCurrentBtn');
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

let collections = [];
let categories = ['默认'];
let currentPageModel = null;

const PLATFORM_NAMES = {
  intl: 'MakerWorld 国际站',
  cn: 'MakerWorld 国内站',
  printables: 'Printables',
  thingiverse: 'Thingiverse',
  thangs: 'Thangs',
  cults3d: 'Cults3D'
};

const INVALID_CREATORS = new Set([
  '浏览历史', '浏览记录', '历史记录', 'history', 'browse history',
  '登录', '注册', 'login', 'sign in', 'sign up', 'makerworld',
  'admin', 'administrator', '官方', '首页', 'home'
]);

function requestTranslate(text) {
  return new Promise((resolve) => {
    if (!text || /[\u4e00-\u9fa5]/.test(text)) {
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

  categoryFilter.innerHTML = '<option value="all">全部分组</option>';
  targetCategorySelect.innerHTML = '';

  categories.forEach(cat => {
    const optFilter = document.createElement('option');
    optFilter.value = cat;
    optFilter.textContent = cat;
    categoryFilter.appendChild(optFilter);

    const optTarget = document.createElement('option');
    optTarget.value = cat;
    optTarget.textContent = cat;
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
    span.textContent = cat;

    item.appendChild(span);

    if (cat !== '默认') {
      const delBtn = document.createElement('button');
      delBtn.className = 'cat-del-btn';
      delBtn.textContent = '删除';
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
    pageTip.textContent = '当前标签页不是支持的模型详情页';
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: 'GET_PAGE_MODEL' }, (res) => {
    if (chrome.runtime.lastError || !res || !res.model) {
      pageTip.textContent = '已检测到支持的模型站点';
    } else {
      currentPageModel = res.model;
      pageTip.textContent = `当前识别: ${currentPageModel.title.slice(0, 24)}...`;
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
      已收藏此模型 (点击移除)
    `;
  } else {
    collectCurrentBtn.classList.remove('collected');
    collectCurrentBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
      </svg>
      收藏当前打开的模型
    `;
  }
}

async function loadData() {
  chrome.storage.local.get(['mw_collections', 'mw_categories'], async (res) => {
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
        if (INVALID_CREATORS.has(cleanC) || cleanC.includes('浏览历史')) {
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

      if (item.title && !/[\u4e00-\u9fa5]/.test(item.title)) {
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

    totalBadge.textContent = `共 ${collections.length} 个`;
    updateCategorySelects();
    updateCollectBtnState();
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
    title.textContent = item.title;
    title.title = item.titleOriginal ? `${item.title}\n(原名: ${item.titleOriginal})` : item.title;

    const meta = document.createElement('div');
    meta.className = 'meta';

    const tag = document.createElement('span');
    tag.className = `tag ${item.platform}`;
    tag.textContent = PLATFORM_NAMES[item.platform] || item.platform;
    meta.appendChild(tag);

    const catSelect = document.createElement('select');
    catSelect.className = 'card-cat-select';
    categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
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
    delBtn.title = '删除记录';
    delBtn.textContent = '删除';

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
    collectCurrentBtn.textContent = '保存中...';
    if (!/[\u4e00-\u9fa5]/.test(currentPageModel.title)) {
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