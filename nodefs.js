

import {ENVIRONMENT_IS_NODE, ERRNO_CODES}  from './constants.js';
import {ErrnoError, assert} 							 from './utils.js';
import {createNode, isDir, isFile, isLink} from './fs-shared.js';
import PATH 				 											 from './path.js';

let fs;

const NODEFS = {
	isWindows: false,

	staticInit() {

		fs = require('fs');

		NODEFS.isWindows = !!process.platform.match(/^win/);

		let flags = process['binding']('constants');

		if (flags['fs']) {
			flags = flags['fs'];
		}

		NODEFS.flagsForNodeMap = {
			'1024': flags['O_APPEND'],
			'64': 	flags['O_CREAT'],
			'128': 	flags['O_EXCL'],
			'0': 		flags['O_RDONLY'],
			'2': 		flags['O_RDWR'],
			'4096': flags['O_SYNC'],
			'512': 	flags['O_TRUNC'],
			'1': 		flags['O_WRONLY']
		};
	},

	bufferFrom: arrayBuffer => Buffer.alloc ? Buffer.from(arrayBuffer) : new Buffer(arrayBuffer),

	mount({opts}) {
		assert(ENVIRONMENT_IS_NODE);

		return NODEFS.createNode(null, '/', NODEFS.getMode(opts.root), 0);
	},

	createNode(parent, name, mode, dev) {
		if (!isDir(mode) && !isFile(mode) && !isLink(mode)) {
			throw new ErrnoError(ERRNO_CODES.EINVAL);
		}

		const node = createNode(parent, name, mode);

		node.node_ops 	= NODEFS.node_ops;
		node.stream_ops = NODEFS.stream_ops;

		return node;
	},

	getMode(path) {
		let stat;

		try {
			stat = fs.lstatSync(path);

			if (NODEFS.isWindows) {
				stat.mode = stat.mode | (stat.mode & 292) >> 2;
			}
		}
		catch (error) {
			if (!error.code) { throw error; }

			throw new ErrnoError(ERRNO_CODES[error.code]);
		}

		return stat.mode;
	},

	realPath(node) {
		const parts = [];

		while (node.parent !== node) {
			parts.push(node.name);
			node = node.parent;
		}

		parts.push(node.mount.opts.root);
		parts.reverse();

		return PATH.join(...parts);
	},

	flagsForNode(flags) {
		flags &= ~2097152;
		flags &= ~2048;
		flags &= ~32768;
		flags &= ~524288;

		let newFlags = 0;

		for (const k in NODEFS.flagsForNodeMap) {
			if (flags & k) {
				newFlags |= NODEFS.flagsForNodeMap[k];
				flags ^= k;
			}
		}

		if (!flags) {
			return newFlags;
		}
		else {
			throw new ErrnoError(ERRNO_CODES.EINVAL);
		}
	},

	node_ops: {
		getattr(node) {
			const path = NODEFS.realPath(node);
			let stat;

			try {
				stat = fs.lstatSync(path);
			}
			catch (error) {
				if (!error.code) { throw error; }
				throw new ErrnoError(ERRNO_CODES[error.code]);
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
		},

		setattr(node, attr) {
			const path = NODEFS.realPath(node);

			try {
				if (attr.mode !== undefined) {
					fs.chmodSync(path, attr.mode);
					node.mode = attr.mode;
				}

				if (attr.timestamp !== undefined) {
					const date = new Date(attr.timestamp);

					fs.utimesSync(path, date, date);
				}

				if (attr.size !== undefined) {
					fs.truncateSync(path, attr.size);
				}
			}
			catch (error) {
				if (!error.code) { throw error; }

				throw new ErrnoError(ERRNO_CODES[error.code]);
			}
		},

		lookup(parent, name) {
			const path = PATH.join2(NODEFS.realPath(parent), name);
			const mode = NODEFS.getMode(path);

			return NODEFS.createNode(parent, name, mode);
		},

		mknod(parent, name, mode, dev) {
			const node = NODEFS.createNode(parent, name, mode, dev);
			const path = NODEFS.realPath(node);

			try {
				if (isDir(node.mode)) {
					fs.mkdirSync(path, node.mode);
				}
				else {
					fs.writeFileSync(path, '', {mode: node.mode});
				}
			}
			catch (error) {
				if (!error.code) { throw error; }

				throw new ErrnoError(ERRNO_CODES[error.code]);
			}

			return node;
		},

		rename(oldNode, newDir, newName) {
			const oldPath = NODEFS.realPath(oldNode);
			const newPath = PATH.join2(NODEFS.realPath(newDir), newName);

			try {
				fs.renameSync(oldPath, newPath);
			}
			catch (error) {
				if (!error.code) { throw error; }

				throw new ErrnoError(ERRNO_CODES[error.code]);
			}
		},

		unlink(parent, name) {
			const path = PATH.join2(NODEFS.realPath(parent), name);

			try {
				fs.unlinkSync(path);
			}
			catch (error) {
				if (!error.code) { throw error; }

				throw new ErrnoError(ERRNO_CODES[error.code]);
			}
		},

		rmdir(parent, name) {
			const path = PATH.join2(NODEFS.realPath(parent), name);

			try {
				fs.rmdirSync(path);
			}
			catch (error) {
				if (!error.code) { throw error; }

				throw new ErrnoError(ERRNO_CODES[error.code]);
			}
		},

		readdir(node) {
			const path = NODEFS.realPath(node);

			try {
				return fs.readdirSync(path);
			}
			catch (error) {
				if (!error.code) { throw error; }

				throw new ErrnoError(ERRNO_CODES[error.code]);
			}
		},

		symlink(parent, newName, oldPath) {
			const newPath = PATH.join2(NODEFS.realPath(parent), newName);

			try {
				fs.symlinkSync(oldPath, newPath);
			}
			catch (error) {
				if (!error.code) { throw error; }

				throw new ErrnoError(ERRNO_CODES[error.code]);
			}
		},

		readlink(node) {
			let path = NODEFS.realPath(node);

			try {
				path = fs.readlinkSync(path);
				path = PATH.relative(PATH.resolve(node.mount.opts.root), path);

				return path;
			}
			catch (error) {
				if (!error.code) { throw error; }

				throw new ErrnoError(ERRNO_CODES[error.code]);
			}
		}
	},

	stream_ops: {
		open(stream) {
			const path = NODEFS.realPath(stream.node);

			try {
				if (isFile(stream.node.mode)) {
					stream.nfd = fs.openSync(path, NODEFS.flagsForNode(stream.flags));
				}
			}
			catch (error) {
				if (!error.code) { throw error; }

				throw new ErrnoError(ERRNO_CODES[error.code]);
			}
		},

		close(stream) {
			try {
				if (isFile(stream.node.mode) && stream.nfd) {
					fs.closeSync(stream.nfd);
				}
			}
			catch (error) {
				if (!error.code) { throw error; }

				throw new ErrnoError(ERRNO_CODES[error.code]);
			}
		},

		read(stream, buffer, offset, length, position) {
			if (length === 0) { return 0; }

			try {
				return fs.readSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position);
			}
			catch (error) {
				throw new ErrnoError(ERRNO_CODES[error.code]);
			}
		},

		write(stream, buffer, offset, length, position) {
			try {
				return fs.writeSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position);
			}
			catch (error) {
				throw new ErrnoError(ERRNO_CODES[error.code]);
			}
		},

		llseek(stream, offset, whence) {
			let position = offset;

			if (whence === 1) {
				position += stream.position;
			}
			else if (whence === 2) {
				if (isFile(stream.node.mode)) {
					try {
						var stat = fs.fstatSync(stream.nfd);

						position += stat.size;
					}
					catch (error) {
						throw new ErrnoError(ERRNO_CODES[error.code]);
					}
				}
			}

			if (position < 0) {
				throw new ErrnoError(ERRNO_CODES.EINVAL);
			}

			return position;
		}
	}
};


export default NODEFS;
