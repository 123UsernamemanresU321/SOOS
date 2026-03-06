/* ============================================================
   SESSION ORDER OS — IndexedDB Storage Layer
   ============================================================ */

const DB = (() => {
    const DB_NAME = 'SessionOrderOS';
    const DB_VERSION = 1;
    let _db = null;

    const STORES = {
        students: { keyPath: 'id', indexes: ['name', 'grade'] },
        sessions: { keyPath: 'id', indexes: ['studentId', 'startTime', 'status'] },
        incidents: { keyPath: 'id', indexes: ['sessionId', 'studentId', 'category', 'severity', 'timestamp'] },
        methodology: { keyPath: 'id' },
        preferences: { keyPath: 'key' }
    };

    /** Open / initialize the database */
    function open() {
        return new Promise((resolve, reject) => {
            if (_db) return resolve(_db);
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                for (const [name, config] of Object.entries(STORES)) {
                    if (!db.objectStoreNames.contains(name)) {
                        const store = db.createObjectStore(name, { keyPath: config.keyPath });
                        if (config.indexes) {
                            config.indexes.forEach(idx => store.createIndex(idx, idx, { unique: false }));
                        }
                    }
                }
            };

            request.onsuccess = (e) => {
                _db = e.target.result;
                resolve(_db);
            };

            request.onerror = (e) => reject(e.target.error);
        });
    }

    /** Generic transaction helper */
    function tx(storeName, mode = 'readonly') {
        return _db.transaction(storeName, mode).objectStore(storeName);
    }

    /** Add a record */
    function add(storeName, record) {
        return new Promise((resolve, reject) => {
            const store = tx(storeName, 'readwrite');
            const req = store.add(record);
            req.onsuccess = () => resolve(record);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /** Put (upsert) a record */
    function put(storeName, record) {
        return new Promise((resolve, reject) => {
            const store = tx(storeName, 'readwrite');
            const req = store.put(record);
            req.onsuccess = () => resolve(record);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /** Get a single record by key */
    function get(storeName, key) {
        return new Promise((resolve, reject) => {
            const store = tx(storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /** Get all records from a store */
    function getAll(storeName) {
        return new Promise((resolve, reject) => {
            const store = tx(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /** Get records by index value */
    function getByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const store = tx(storeName);
            const index = store.index(indexName);
            const req = index.getAll(value);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /** Delete a record */
    function remove(storeName, key) {
        return new Promise((resolve, reject) => {
            const store = tx(storeName, 'readwrite');
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /** Clear all records from a store */
    function clear(storeName) {
        return new Promise((resolve, reject) => {
            const store = tx(storeName, 'readwrite');
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /** Count records in a store */
    function count(storeName) {
        return new Promise((resolve, reject) => {
            const store = tx(storeName);
            const req = store.count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /** Export all stores to a JSON object */
    async function exportAll() {
        const data = {};
        for (const name of Object.keys(STORES)) {
            data[name] = await getAll(name);
        }
        data._meta = { exportedAt: new Date().toISOString(), version: DB_VERSION };
        return data;
    }

    /** Import data from a JSON object (merges) */
    async function importAll(data) {
        for (const name of Object.keys(STORES)) {
            if (data[name] && Array.isArray(data[name])) {
                for (const record of data[name]) {
                    await put(name, record);
                }
            }
        }
    }

    /** Seed demo data if stores are empty */
    async function seedIfEmpty() {
        const studentCount = await count('students');
        if (studentCount > 0) return;

        const demoStudents = [
            { id: Utils.generateId(), name: 'Marcus Aurelius', grade: 8, streak: 4, points: 120, createdAt: Utils.now() },
            { id: Utils.generateId(), name: 'Julius Caesar', grade: 9, streak: 2, points: 85, createdAt: Utils.now() },
            { id: Utils.generateId(), name: 'Seneca Young', grade: 8, streak: 7, points: 200, createdAt: Utils.now() },
        ];
        for (const s of demoStudents) await add('students', s);

        // Seed default methodology
        const defaultMethodology = Methodology.getDefaultConfig();
        await put('methodology', { id: 'default', config: defaultMethodology, updatedAt: Utils.now() });

        // Seed preferences
        await put('preferences', { key: 'workerUrl', value: '' });
        await put('preferences', { key: 'theme', value: 'light' });
        await put('preferences', { key: 'aiModel', value: 'deepseek-chat' });
        await put('preferences', { key: 'temperature', value: 0.7 });
        await put('preferences', { key: 'systemPrompt', value: '' });
        await put('preferences', { key: 'dataAnonymization', value: true });
    }

    return { open, add, put, get, getAll, getByIndex, remove, clear, count, exportAll, importAll, seedIfEmpty };
})();
