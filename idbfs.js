

import {
	chmod,
	isDir,
	isFile,
	lookupPath,
	mkdir,
	readdir,
	rmdir,
	stat,
	unlink,
	utime,
	writeFile
} from './fs-shared.js';

import {assert} from './utils.js';
import PATH 		from './path.js';
import MEMFS 		from './memfs.js';


window = window || self;


const isRealDir = p => p !== '.' && p !== '..';

const toAbsolute = root => p => PATH.join2(root, p);


const IDBFS = {
	dbs: {},

	indexedDB() {
		if (typeof indexedDB !== 'undefined') { return indexedDB; }

		let ret = null;

		if (typeof window === 'object') {
			ret = window.indexedDB 			 || 
						window.mozIndexedDB 	 || 
						window.webkitIndexedDB || 
						window.msIndexedDB;
		}

		assert(ret, 'IDBFS used, but indexedDB not supported');

		return ret;
	},

	DB_VERSION: 		21,
	DB_STORE_NAME: 'FILE_DATA',

	mount: (...args) => MEMFS.mount(...args),

	syncfs(mount, populate, callback) {
		IDBFS.getLocalSet(mount, (err, local) => {
			if (err) {
				return callback(err);
			}

			IDBFS.getRemoteSet(mount, (err, remote) => {
				if (err) {
					return callback(err);
				}

				const src = populate ? remote : local;
				const dst = populate ? local 	: remote;

				IDBFS.reconcile(src, dst, callback);
			});
		});
	},

	getDB(name, callback) {
		const db = IDBFS.dbs[name];

		if (db) {
			return callback(null, db);
		}

		let request;

		try {
			request = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
		}
		catch (error) {
			return callback(error);
		}

		if (!request) { 
			return callback('Unable to connect to IndexedDB');
		}

		request.onupgradeneeded = event => {
			const {result: db, transaction} = event.target;

			let fileStore;

			if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
				fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
			}
			else {
				fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
			}

			if (!fileStore.indexNames.contains('timestamp')) {
				fileStore.createIndex('timestamp', 'timestamp', {unique: false});
			}
		};

		request.onsuccess = () => {
			const db 				= request.result;
			IDBFS.dbs[name] = db;

			callback(null, db);
		};

		request.onerror = event => {
			callback(request.error);
			event.preventDefault();
		};
	},

	getLocalSet(mount, callback) {
		const entries = {};		

		const check = readdir(mount.mountpoint).
										filter(isRealDir).
										map(toAbsolute(mount.mountpoint));

		while (check.length) {
			const path = check.pop();
			let static;

			try {
				static = stat(path);
			}
			catch (error) {
				return callback(error);
			}

			if (isDir(static.mode)) {
				check.push.apply(check, readdir(path).filter(isRealDir).map(toAbsolute(path)));
			}

			entries[path] = {timestamp: static.mtime};
		}

		return callback(null, {type: 'local', entries});
	},

	getRemoteSet(mount, callback) {
		const entries = {};

		IDBFS.getDB(mount.mountpoint, (err, db) => {
			if (err) {
				return callback(err);
			}

			try {
				const transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readonly');

				transaction.onerror = event => {
					callback(transaction.error);
					event.preventDefault();
				};

				const store = transaction.objectStore(IDBFS.DB_STORE_NAME);
				const index = store.index('timestamp');

				index.openKeyCursor().onsuccess = event => {
					const cursor = event.target.result;

					if (!cursor) {
						return callback(null, {type: 'remote', db, entries});
					}

					entries[cursor.primaryKey] = {timestamp: cursor.key};
					cursor.continue();
				};
			}
			catch (error) {
				return callback(error);
			}
		});
	},

	loadLocalEntry(path, callback) {
		let static;
		let node;

		try {
			const lookup = lookupPath(path);

			node 	 = lookup.node;
			static = stat(path);
		}
		catch (error) {
			return callback(error);
		}

		const {mode, mtime} = static;

		if (isDir(mode)) {
			return callback(null, {timestamp: mtime, mode});
		}
		else if (isFile(mode)) {
			node.contents = MEMFS.getFileDataAsTypedArray(node);

			return callback(null, {timestamp: mtime, mode, contents: node.contents});
		}
		else {
			return callback(new Error('node type not supported'));
		}
	},

	storeLocalEntry(path, entry, callback) {
		try {

			const {contents, mode, timestamp} = entry;

			if (isDir(mode)) {
				mkdir(path, mode);
			}
			else if (isFile(mode)) {
				writeFile(path, contents, {canOwn: true});
			}
			else {
				return callback(new Error('node type not supported'));
			}

			chmod(path, mode);
			utime(path, timestamp, timestamp);
		}
		catch (error) {
			return callback(error);
		}

		callback(null);
	},

	removeLocalEntry(path, callback) {
		try {

			// Used to check for errors??
			lookupPath(path);

			const {mode} = stat(path);

			if (isDir(mode)) {
				rmdir(path);
			}
			else if (isFile(mode)) {
				unlink(path);
			}
		}
		catch (error) {
			return callback(error);
		}

		callback(null);
	},

	loadRemoteEntry(store, path, callback) {
		const request = store.get(path);

		request.onsuccess = event => {
			callback(null, event.target.result);
		};

		request.onerror = event => {
			callback(request.error);
			event.preventDefault();
		};
	},

	storeRemoteEntry(store, path, entry, callback) {
		const request = store.put(entry, path);

		request.onsuccess = () => {
			callback(null);
		};

		request.onerror = event => {
			callback(request.error);
			event.preventDefault();
		};
	},

	removeRemoteEntry(store, path, callback) {
		const request = store.delete(path);

		request.onsuccess = () => {
			callback(null);
		};

		request.onerror = event => {
			callback(request.error);
			event.preventDefault();
		};
	},

	reconcile(src, dst, callback) {		
		const create = [];
		let total  	 = 0;

		Object.keys(src.entries).forEach(key => {
			const entry  = src.entries[key];
			const entry2 = dst.entries[key];

			if (!entry2 || entry.timestamp > entry2.timestamp) {
				create.push(key);
				total++;
			}
		});

		const remove = [];

		Object.keys(dst.entries).forEach(key => {
			const entry = src.entries[key];

			if (!entry) {
				remove.push(key);
				total++;
			}
		});

		if (!total) {
			return callback(null);
		}

		const db 					= src.type === 'remote' ? src.db : dst.db;
		const transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readwrite');
		const store 			= transaction.objectStore(IDBFS.DB_STORE_NAME);
		let completed 		= 0;

		// NOT an arrow function since it is being used as 
		// a function object with the 'done.errored' assignment.
		function done(err) {
			if (err) {
				if (!done.errored) {
					done.errored = true;
					return callback(err);
				}

				return;
			}

			if (++completed >= total) {
				return callback(null);
			}
		}

		transaction.onerror = event => {
			done(transaction.error);
			event.preventDefault();
		};

		create.sort().forEach(path => {
			if (dst.type === 'local') {
				IDBFS.loadRemoteEntry(store, path, (err, entry) => {
					if (err) { return done(err); }

					IDBFS.storeLocalEntry(path, entry, done);
				});
			}
			else {
				IDBFS.loadLocalEntry(path, (err, entry) => {
					if (err) { return done(err); }

					IDBFS.storeRemoteEntry(store, path, entry, done);
				});
			}
		});

		remove.sort().reverse().forEach(path => {
			if (dst.type === 'local') {
				IDBFS.removeLocalEntry(path, done);
			}
			else {
				IDBFS.removeRemoteEntry(store, path, done);
			}
		});
	}
};


export default IDBFS;
