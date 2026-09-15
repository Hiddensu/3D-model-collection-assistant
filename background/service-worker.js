async function translateWithYoudao(text) {
  try {
    const url = `https://fanyi.youdao.com/translate?&doctype=json&type=AUTO&i=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.translateResult && Array.isArray(data.translateResult)) {
        const trans = data.translateResult.map(para => para.map(item => item.tgt).join('')).join(' ').trim();
        if (trans && trans !== text) return trans;
      }
    }
  } catch (e) {}
  return null;
}

async function translateWithMyMemory(text) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.responseData && data.responseData.translatedText) {
        const trans = data.responseData.translatedText.trim();
        if (trans && trans !== text && !trans.toLowerCase().includes('mymemory')) return trans;
      }
    }
  } catch (e) {}
  return null;
}

async function translateWithGoogle(text) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data[0] && Array.isArray(data[0])) {
        const trans = data[0].map(item => item[0]).join('').trim();
        if (trans && trans !== text) return trans;
      }
    }
  } catch (e) {}
  return null;
}

async function handleTranslate(text) {
  if (!text || /[\u4e00-\u9fa5]/.test(text)) {
    return text;
  }
  const youdaoResult = await translateWithYoudao(text);
  if (youdaoResult) return youdaoResult;

  const myMemoryResult = await translateWithMyMemory(text);
  if (myMemoryResult) return myMemoryResult;

  const googleResult = await translateWithGoogle(text);
  if (googleResult) return googleResult;

  return text;
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === 'TRANSLATE') {
    handleTranslate(req.text).then(result => sendResponse({ result }));
    return true;
  }
});