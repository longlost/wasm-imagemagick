

import {ERRNO_CODES} 				from './constants.js';
import {ErrnoError, assert} from './utils.js';
import PATH 				 				from './path.js';


const NODEFS = {
	isWindows: false,

	staticInit: (function() {
		NODEFS.isWindows = !!process.platform.match(/^win/);

		var flags = process['binding']('constants');

		if (flags['fs']) {
			flags = flags['fs'];
		}

		NODEFS.flagsForNodeMap = {
			'1024': flags['O_APPEND'],
			'64': flags['O_CREAT'],
			'128': flags['O_EXCL'],
			'0': flags['O_RDONLY'],
			'2': flags['O_RDWR'],
			'4096': flags['O_SYNC'],
			'512': flags['O_TRUNC'],
			'1': flags['O_WRONLY']
		}
	}),

	bufferFrom: (function(arrayBuffer) {
		return Buffer.alloc ? Buffer.from(arrayBuffer) : new Buffer(arrayBuffer);
	}),

	mount: (function(mount) {
		assert(ENVIRONMENT_IS_NODE);

		return NODEFS.createNode(null, '/', NODEFS.getMode(mount.opts.root), 0);
	}),

	createNode: (function(parent, name, mode, dev) {
		if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
			throw new ErrnoError(ERRNO_CODES.EINVAL);
		}

		var node = FS.createNode(parent, name, mode);

		node.node_ops = NODEFS.node_ops;
		node.stream_ops = NODEFS.stream_ops;

		return node;
	}),

	getMode: (function(path) {
		var stat;

		try {
			stat = fs.lstatSync(path);

			if (NODEFS.isWindows) {
				stat.mode = stat.mode | (stat.mode & 292) >> 2;
			}
		}
		catch (e) {
			if (!e.code) { throw e; }

			throw new ErrnoError(ERRNO_CODES[e.code]);
		}

		return stat.mode;
	}),

	realPath: (function(node) {
		var parts = [];

		while (node.parent !== node) {
			parts.push(node.name);
			node = node.parent;
		}

		parts.push(node.mount.opts.root);
		parts.reverse();

		return PATH.join.apply(null, parts);
	}),

	flagsForNode: (function(flags) {
		flags &= ~2097152;
		flags &= ~2048;
		flags &= ~32768;
		flags &= ~524288;

		var newFlags = 0;

		for (var k in NODEFS.flagsForNodeMap) {
			if (flags & k) {
				newFlags |= NODEFS.flagsForNodeMap[k];
				flags ^= k;
			}
		}

		if (!flags) {
			return newFlags
		}
		else {
			throw new ErrnoError(ERRNO_CODES.EINVAL);
		}
	}),

	node_ops: {
		getattr: (function(node) {
			var path = NODEFS.realPath(node);
			var stat;

			try {
				stat = fs.lstatSync(path);
			}
			catch (e) {
				if (!e.code) { throw e; }
				throw new ErrnoError(ERRNO_CODES[e.code]);
			}

			if (NODEFS.isWindows && !stat.blksize) {
				stat.blksize = 4096;
			}

			if (NODEFS.isWindows && !stat.blocks) {
				stat.blocks = (stat.size + stat.blksize - 1) / stat.blksize | 0;
			}

			return {
				dev: 		 stat.dev,
				ino: 		 stat.ino,
				mode: 	 stat.mode,
				nlink: 	 stat.nlink,
				uid: 		 stat.uid,
				gid: 		 stat.gid,
				rdev: 	 stat.rdev,
				size: 	 stat.size,
				atime: 	 stat.atime,
				mtime: 	 stat.mtime,
				ctime: 	 stat.ctime,
				blksize: stat.blksize,
				blocks:  stat.blocks
			};
		}),

		setattr: (function(node, attr) {
			var path = NODEFS.realPath(node);

			try {
				if (attr.mode !== undefined) {
					fs.chmodSync(path, attr.mode);
					node.mode = attr.mode;
				}

				if (attr.timestamp !== undefined) {
					var date = new Date(attr.timestamp);

					fs.utimesSync(path, date, date);
				}

				if (attr.size !== undefined) {
					fs.truncateSync(path, attr.size);
				}
			}
			catch (e) {
				if (!e.code) { throw e; }

				throw new ErrnoError(ERRNO_CODES[e.code]);
			}
		}),

		lookup: (function(parent, name) {
			var path = PATH.join2(NODEFS.realPath(parent), name);
			var mode = NODEFS.getMode(path);

			return NODEFS.createNode(parent, name, mode);
		}),

		mknod: (function(parent, name, mode, dev) {
			var node = NODEFS.createNode(parent, name, mode, dev);
			var path = NODEFS.realPath(node);

			try {
				if (FS.isDir(node.mode)) {
					fs.mkdirSync(path, node.mode);
				}
				else {
					fs.writeFileSync(path, '', {mode: node.mode});
				}
			}
			catch (e) {
				if (!e.code) { throw e; }

				throw new ErrnoError(ERRNO_CODES[e.code]);
			}

			return node;
		}),

		rename: (function(oldNode, newDir, newName) {
			var oldPath = NODEFS.realPath(oldNode);
			var newPath = PATH.join2(NODEFS.realPath(newDir), newName);

			try {
				fs.renameSync(oldPath, newPath);
			}
			catch (e) {
				if (!e.code) { throw e; }

				throw new ErrnoError(ERRNO_CODES[e.code]);
			}
		}),

		unlink: (function(parent, name) {
			var path = PATH.join2(NODEFS.realPath(parent), name);

			try {
				fs.unlinkSync(path);
			}
			catch (e) {
				if (!e.code) { throw e; }

				throw new ErrnoError(ERRNO_CODES[e.code]);
			}
		}),

		rmdir: (function(parent, name) {
			var path = PATH.join2(NODEFS.realPath(parent), name);

			try {
				fs.rmdirSync(path);
			}
			catch (e) {
				if (!e.code) { throw e; }

				throw new ErrnoError(ERRNO_CODES[e.code]);
			}
		}),

		readdir: (function(node) {
			var path = NODEFS.realPath(node);

			try {
				return fs.readdirSync(path);
			}
			catch (e) {
				if (!e.code) { throw e; }

				throw new ErrnoError(ERRNO_CODES[e.code]);
			}
		}),

		symlink: (function(parent, newName, oldPath) {
			var newPath = PATH.join2(NODEFS.realPath(parent), newName);

			try {
				fs.symlinkSync(oldPath, newPath);
			}
			catch (e) {
				if (!e.code) { throw e; }

				throw new ErrnoError(ERRNO_CODES[e.code]);
			}
		}),

		readlink: (function(node) {
			var path = NODEFS.realPath(node);

			try {
				path = fs.readlinkSync(path);
				path = PATH.relative(PATH.resolve(node.mount.opts.root), path);

				return path;
			}
			catch (e) {
				if (!e.code) { throw e; }

				throw new ErrnoError(ERRNO_CODES[e.code]);
			}
		})
	},

	stream_ops: {
		open: (function(stream) {
			var path = NODEFS.realPath(stream.node);

			try {
				if (FS.isFile(stream.node.mode)) {
					stream.nfd = fs.openSync(path, NODEFS.flagsForNode(stream.flags));
				}
			}
			catch (e) {
				if (!e.code) { throw e; }

				throw new ErrnoError(ERRNO_CODES[e.code]);
			}
		}),

		close: (function(stream) {
			try {
				if (FS.isFile(stream.node.mode) && stream.nfd) {
					fs.closeSync(stream.nfd);
				}
			}
			catch (e) {
				if (!e.code) { throw e; }

				throw new ErrnoError(ERRNO_CODES[e.code]);
			}
		}),

		read: (function(stream, buffer, offset, length,position) {
			if (length === 0) { return 0; }

			try {
				return fs.readSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position);
			}
			catch (e) {
				throw new ErrnoError(ERRNO_CODES[e.code]);
			}
		}),

		write: (function(stream, buffer, offset, length, position) {
			try {
				return fs.writeSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position);
			}
			catch (e) {
				throw new ErrnoError(ERRNO_CODES[e.code]);
			}
		}),

		llseek: (function(stream, offset, whence) {
			var position = offset;

			if (whence === 1) {
				position += stream.position;
			}
			else if (whence === 2) {
				if (FS.isFile(stream.node.mode)) {
					try {
						var stat = fs.fstatSync(stream.nfd);

						position += stat.size;
					}
					catch (e) {
						throw new ErrnoError(ERRNO_CODES[e.code]);
					}
				}
			}

			if (position < 0) {
				throw new ErrnoError(ERRNO_CODES.EINVAL);
			}

			return position;
		})
	}
};


export default NODEFS;

