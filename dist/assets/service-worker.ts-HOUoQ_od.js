chrome.runtime.onMessage.addListener((e,o,i)=>{if(e.type==="download-images")for(const n of e.images)chrome.downloads.download({url:n.url,filename:n.filename,conflictAction:"uniquify"})});
