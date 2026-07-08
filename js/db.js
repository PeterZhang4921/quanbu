/* 泉簿 · IndexedDB 数据层
 * 数据与代码分离：升级 App 不会动这里的账目。
 * v2：新增 projects 表（出差/项目记账）。 */
const DB = (() => {
  const NAME = 'quanbu';
  const VERSION = 2;
  const STORE = 'tx';
  const PROJ = 'projects';
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
        if (!db.objectStoreNames.contains(PROJ)) {
          db.createObjectStore(PROJ, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }

  function os(name, mode) {
    return open().then((db) => db.transaction(name, mode).objectStore(name));
  }

  function reqToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return {
    // ---- 账目 ----
    async add(record) {
      const store = await os(STORE, 'readwrite');
      await reqToPromise(store.add(record));
      return record;
    },
    async put(record) {
      const store = await os(STORE, 'readwrite');
      await reqToPromise(store.put(record));
      return record;
    },
    async remove(id) {
      const store = await os(STORE, 'readwrite');
      return reqToPromise(store.delete(id));
    },
    async all() {
      const store = await os(STORE, 'readonly');
      const list = await reqToPromise(store.getAll());
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

    // ---- 项目 ----
    async addProject(p) {
      const store = await os(PROJ, 'readwrite');
      await reqToPromise(store.add(p));
      return p;
    },
    async putProject(p) {
      const store = await os(PROJ, 'readwrite');
      await reqToPromise(store.put(p));
      return p;
    },
    async removeProject(id) {
      const store = await os(PROJ, 'readwrite');
      return reqToPromise(store.delete(id));
    },
    async allProjects() {
      const store = await os(PROJ, 'readonly');
      return reqToPromise(store.getAll());
    },
  };
})();
