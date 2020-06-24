

import {ENVIRONMENT_IS_WORKER, ERRNO_CODES} from './constants.js';
import {ErrnoError, assert} 								from './utils.js';


var WORKERFS = {
	DIR_MODE:  16895,
	FILE_MODE: 33279,
	reader: 	 null,

	mount: (function(mount) {
		assert(ENVIRONMENT_IS_WORKER);

		if (!WORKERFS.reader) { 
			WORKERFS.reader = new FileReaderSync; 
		}

		var root = WORKERFS.createNode(null, '/', WORKERFS.DIR_MODE, 0);
		var createdParents = {};

		function ensureParent(path) {
			var parts  = path.split('/');
			var parent = root;

			for (var i = 0; i < parts.length - 1; i++) {
				var curr = parts.slice(0, i + 1).join('/');

				if (!createdParents[curr]) {
					createdParents[curr] = WORKERFS.createNode(parent, parts[i], WORKERFS.DIR_MODE, 0);
				}

				parent = createdParents[curr];
			}

			return parent;
		}

		function base(path) {
			var parts = path.split('/');

			return parts[parts.length-1];
		}

		Array.prototype.forEach.call(mount.opts['files'] || [], (function(file) {
			WORKERFS.createNode(
				ensureParent(file.name), 
				base(file.name), 
				WORKERFS.FILE_MODE, 
				0, 
				file, 
				file.lastModifiedDate
			);
		}));

		(mount.opts['blobs'] || []).forEach((function(obj) {
			WORKERFS.createNode(
				ensureParent(obj['name']),
				base(obj['name']),
				WORKERFS.FILE_MODE,
				0,
				obj['data']
			);
		}));

		(mount.opts['packages'] || []).forEach((function(pack) {
			pack['metadata'].files.forEach((function(file) {
				var name = file.filename.substr(1);

				WORKERFS.createNode(
					ensureParent(name),
					base(name),
					WORKERFS.FILE_MODE,
					0,
					pack['blob'].slice(file.start, file.end)
				);
			}));
		}));

		return root;
	}),

	createNode: (function(parent, name, mode, dev, contents, mtime) {
		var node = FS.createNode(parent, name, mode);

		node.mode 			= mode;
		node.node_ops 	= WORKERFS.node_ops;
		node.stream_ops = WORKERFS.stream_ops;
		node.timestamp 	= (mtime || new Date).getTime();

		assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);

		if (mode === WORKERFS.FILE_MODE) {
			node.size = contents.size;
			node.contents = contents;
		}
		else {
			node.size = 4096;
			node.contents = {};
		}

		if (parent) {
			parent.contents[name] = node;
		}

		return node;
	}),

	node_ops: {
		getattr: (function(node) {
			return {
				dev: 		 1,
				ino: 		 undefined,
				mode: 	 node.mode,
				nlink: 	 1,
				uid: 		 0,
				gid: 		 0,
				rdev: 	 undefined,
				size: 	 node.size,
				atime: 	 new Date(node.timestamp),
				mtime: 	 new Date(node.timestamp),
				ctime: 	 new Date(node.timestamp),
				blksize: 4096,
				blocks:  Math.ceil(node.size / 4096)
			};
		}),

		setattr: (function(node, attr) {
			if (attr.mode !== undefined) {
				node.mode = attr.mode;
			}

			if (attr.timestamp !== undefined) {
				node.timestamp = attr.timestamp;
			}
		}),

		lookup: (function(parent, name) {
			throw new ErrnoError(ERRNO_CODES.ENOENT);
		}),

		mknod: (function(parent, name, mode, dev) {
			throw new ErrnoError(ERRNO_CODES.EPERM);
		}),

		rename: (function(oldNode, newDir, newName) {
			throw new ErrnoError(ERRNO_CODES.EPERM);
		}),

		unlink: (function(parent, name) {
			throw new ErrnoError(ERRNO_CODES.EPERM);
		}),

		rmdir: (function(parent, name) {
			throw new ErrnoError(ERRNO_CODES.EPERM);
		}),

		readdir: (function(node) {
			var entries = ['.', '..'];

			for (var key in node.contents) {
				if (!node.contents.hasOwnProperty(key)) {
					continue;
				}

				entries.push(key);
			}

			return entries;
		}),

		symlink: (function(parent, newName, oldPath) {
			throw new ErrnoError(ERRNO_CODES.EPERM);
		}),

		readlink: (function(node) {
			throw new ErrnoError(ERRNO_CODES.EPERM);
		})
	},

	stream_ops: {
		read: (function(stream, buffer, offset, length, position) {
			if (position >= stream.node.size) { return 0; }

			var chunk = stream.node.contents.slice(position, position + length);
			var ab = WORKERFS.reader.readAsArrayBuffer(chunk);

			buffer.set(new Uint8Array(ab), offset);

			return chunk.size;
		}),

		write: (function(stream, buffer, offset, length, position) {
			throw new ErrnoError(ERRNO_CODES.EIO);
		}),

		llseek: (function(stream, offset, whence) {
			var position = offset;

			if (whence === 1) {
				position += stream.position;
			}
			else if (whence === 2) {
				if (FS.isFile(stream.node.mode)) {
					position += stream.node.size;
				}
			}

			if (position < 0) {
				throw new ErrnoError(ERRNO_CODES.EINVAL);
			}

			return position;
		})
	}
};


export default WORKERFS;
