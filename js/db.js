/* 泉簿 · IndexedDB 数据层
 * 数据与代码分离：升级 App 不会动这里的账目。 */
const DB = (() => {
  const NAME = 'quanbu';
  const VERSION = 1;
  const STORE = 'tx';
  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: 'id' });
          os.createIndex('date', 'date', { unique: false });
        }
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }

  function tx(mode) {
    return open().then((db) => db.transaction(STORE, mode).objectStore(STORE));
  }

  function reqToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return {
    async add(record) {
      const store = await tx('readwrite');
      await reqToPromise(store.add(record));
      return record;
    },
    async put(record) {
      const store = await tx('readwrite');
      await reqToPromise(store.put(record));
      return record;
    },
    async remove(id) {
      const store = await tx('readwrite');
      return reqToPromise(store.delete(id));
    },
    async all() {
      const store = await tx('readonly');
      const list = await reqToPromise(store.getAll());
      // 按日期倒序、同日按创建时间倒序
      return list.sort((a, b) =>
        b.date.localeCompare(a.date) || (b.createdAt - a.createdAt));
    },
    // 导入备份：整表替换
    async replaceAll(records) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(STORE, 'readwrite');
        const store = t.objectStore(STORE);
        store.clear();
        for (const r of records) store.put(r);
        t.oncomplete = () => resolve(records.length);
        t.onerror = () => reject(t.error);
      });
    },
  };
})();
