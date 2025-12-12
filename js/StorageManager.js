/**
 * Manages interactions with IndexedDB for storing complex objects like FileSystemDirectoryHandle.
 */
export class StorageManager {
    constructor(dbName = 'MindMapDB', storeName = 'handles') {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
    }

    /**
     * Opens and initializes the IndexedDB database.
     * @returns {Promise<IDBDatabase>}
     */
    async _getDB() {
        if (this.db) {
            return this.db;
        }
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject('Error opening IndexedDB.');
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
        });
    }

    /**
     * Stores a value in IndexedDB.
     * @param {string} key The key to store the value under.
     * @param {any} value The value to store (e.g., a DirectoryHandle).
     */
    async set(key, value) {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Retrieves a value from IndexedDB.
     * @param {string} key The key of the value to retrieve.
     * @returns {Promise<any>} The retrieved value.
     */
    async get(key) {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}