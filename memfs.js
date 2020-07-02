

import {ERRNO_CODES} from './constants.js';
import utils 				 from './utils.js';
import memory 			 from './memory.js';
import fsShared 		 from './fs-shared.js';


const MEMFS = {
	ops_table: null,

	mount: () => MEMFS.createNode(null, '/', 16384 | 511, 0),

	createNode(parent, name, mode, dev) {

		if (fsShared.isBlkdev(mode) || fsShared.isFIFO(mode)) {
			throw new utils.ErrnoError(ERRNO_CODES.EPERM);
		}

		if (!MEMFS.ops_table) {
			MEMFS.ops_table = {
				dir: {
					node: {
						getattr: MEMFS.node_ops.getattr,
						setattr: MEMFS.node_ops.setattr,
						lookup:  MEMFS.node_ops.lookup,
						mknod: 	 MEMFS.node_ops.mknod,
						rename:  MEMFS.node_ops.rename,
						unlink:  MEMFS.node_ops.unlink,
						rmdir: 	 MEMFS.node_ops.rmdir,
						readdir: MEMFS.node_ops.readdir,
						symlink: MEMFS.node_ops.symlink
					},
					stream: {
						llseek: MEMFS.stream_ops.llseek
					}
				},
				file: {
					node: {
						getattr: MEMFS.node_ops.getattr,
						setattr: MEMFS.node_ops.setattr
					},
					stream: {
						llseek: 	MEMFS.stream_ops.llseek,
						read: 		MEMFS.stream_ops.read,
						write: 		MEMFS.stream_ops.write,
						allocate: MEMFS.stream_ops.allocate,
						mmap: 		MEMFS.stream_ops.mmap,
						msync: 		MEMFS.stream_ops.msync
					}
				},
				link: {
					node: {
						getattr: 	MEMFS.node_ops.getattr,
						setattr: 	MEMFS.node_ops.setattr,
						readlink: MEMFS.node_ops.readlink
					},
					stream: {}
				},
				chrdev: {
					node: {
						getattr: MEMFS.node_ops.getattr,
						setattr: MEMFS.node_ops.setattr
					},
					stream: fsShared.chrdev_stream_ops
				}
			};
		}

		const node = fsShared.createNode(parent, name, mode, dev);

		if (fsShared.isDir(node.mode)) {
			node.node_ops 	= MEMFS.ops_table.dir.node;
			node.stream_ops = MEMFS.ops_table.dir.stream;
			node.contents 	= {};
		}
		else if (fsShared.isFile(node.mode)) {
			node.node_ops 	= MEMFS.ops_table.file.node;
			node.stream_ops = MEMFS.ops_table.file.stream;
			node.usedBytes 	= 0;
			node.contents 	= null;
		}
		else if (fsShared.isLink(node.mode)) {
			node.node_ops 	= MEMFS.ops_table.link.node;
			node.stream_ops = MEMFS.ops_table.link.stream;
		}
		else if (fsShared.isChrdev(node.mode)) {
			node.node_ops 	= MEMFS.ops_table.chrdev.node;
			node.stream_ops = MEMFS.ops_table.chrdev.stream;
		}

		node.timestamp = Date.now();

		if (parent) {
			parent.contents[name] = node;
		}

		return node;
	},

	getFileDataAsRegularArray(node) {
		const {contents, usedBytes} = node;

		if (contents && contents.subarray) {
			const arr = [];

			for(let i = 0; i < usedBytes; ++i) {
				arr.push(contents[i]);
			}

			return arr;
		}

		return contents;
	},

	getFileDataAsTypedArray(node) {
		const {contents, usedBytes} = node;

		if (!contents) {
			return new Uint8Array;
		}

		if (contents.subarray) {
			return contents.subarray(0, usedBytes);
		}

		return new Uint8Array(contents);
	},

	expandFileStorage(node, newCapacity) {

		if (node.contents && node.contents.subarray && newCapacity > node.contents.length) {
			node.contents  = MEMFS.getFileDataAsRegularArray(node);
			node.usedBytes = node.contents.length;
		}

		if (!node.contents || node.contents.subarray) {
			const prevCapacity = node.contents ? node.contents.length : 0;

			if (prevCapacity >= newCapacity) { return; }

			const CAPACITY_DOUBLING_MAX = 1024 * 1024;

			newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) | 0);

			if (prevCapacity != 0) {
				newCapacity = Math.max(newCapacity, 256);
			}

			const oldContents = node.contents;

			node.contents = new Uint8Array(newCapacity);

			if (node.usedBytes > 0) {
				node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
			}

			return;
		}

		if (!node.contents && newCapacity > 0) {
			node.contents = [];
		}

		while (node.contents.length < newCapacity) {
			node.contents.push(0);
		}
	},

	resizeFileStorage(node, newSize) {
		if (node.usedBytes == newSize) { return; }

		if (newSize == 0) {
			node.contents  = null;
			node.usedBytes = 0;

			return;
		}

		if (!node.contents || node.contents.subarray) {
			const oldContents = node.contents;

			node.contents = new Uint8Array(new ArrayBuffer(newSize));

			if (oldContents) {
				node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)));
			}

			node.usedBytes = newSize;

			return;
		}

		if (!node.contents) {
			node.contents = [];
		}

		if (node.contents.length > newSize) {
			node.contents.length = newSize;
		}
		else {
			while(node.contents.length < newSize) {
				node.contents.push(0);
			}

			node.usedBytes = newSize;
		}
	},

	node_ops: {
		getattr(node) {
			const {id, link, mode, rdev, timestamp, usedBytes} = node;
			const attr = {};

			attr.dev 	 = fsShared.isChrdev(mode) ? id : 1;
			attr.ino 	 = id;
			attr.mode  = mode;
			attr.nlink = 1;
			attr.uid 	 = 0;
			attr.gid 	 = 0;
			attr.rdev  = rdev;

			if (fsShared.isDir(mode)) {
				attr.size = 4096;
			}
			else if (fsShared.isFile(mode)) {
				attr.size = usedBytes;
			}
			else if (fsShared.isLink(mode)) {
				attr.size = link.length;
			}
			else {
				attr.size = 0;
			}

			attr.atime 	 = new Date(timestamp);
			attr.mtime 	 = new Date(timestamp);
			attr.ctime 	 = new Date(timestamp);
			attr.blksize = 4096;
			attr.blocks  = Math.ceil(attr.size / attr.blksize);

			return attr;
		},

		setattr(node, attr) {
			const {mode, size, timestamp} = attr;

			if (mode !== undefined) {
				node.mode = mode;
			}

			if (timestamp !== undefined) {
				node.timestamp = timestamp;
			}

			if (size !== undefined) {
				MEMFS.resizeFileStorage(node, size);
			}
		},

		lookup(parent, name) {
			throw fsShared.genericErrors[ERRNO_CODES.ENOENT];
		},

		mknod: (parent, name, mode, dev) => MEMFS.createNode(parent, name, mode, dev),

		rename(old_node, new_dir, new_name) {
			if (fsShared.isDir(old_node.mode)) {
				let new_node;

				try {
					new_node = fsShared.lookupNode(new_dir, new_name);
				}
				catch (_) {}

				if (new_node) {
					for (const i in new_node.contents) {
						throw new utils.ErrnoError(ERRNO_CODES.ENOTEMPTY);
					}
				}
			}

			delete old_node.parent.contents[old_node.name];

			old_node.name 						 = new_name;
			new_dir.contents[new_name] = old_node;
			old_node.parent 					 = new_dir;
		},

		unlink(parent, name) {
			delete parent.contents[name];
		},

		rmdir(parent, name) {
			const node = fsShared.lookupNode(parent, name);

			for (const i in node.contents) {
				throw new utils.ErrnoError(ERRNO_CODES.ENOTEMPTY);
			}

			delete parent.contents[name];
		},

		readdir(node) {
			const entries = ['.', '..'];

			for (const key in node.contents) {
				if (!node.contents.hasOwnProperty(key)) {
					continue;
				}

				entries.push(key);
			}

			return entries;
		},

		symlink(parent, newname, oldpath) {
			const node = MEMFS.createNode(parent, newname, 511 | 40960, 0);

			node.link = oldpath;

			return node;
		},

		readlink(node) {
			if (!fsShared.isLink(node.mode)) {
				throw new utils.ErrnoError(ERRNO_CODES.EINVAL);
			}

			return node.link;
		}
	},

	stream_ops: {
		read(stream, buffer, offset, length, position) {
			const {contents, usedBytes} = stream.node;

			if (position >= usedBytes) { return 0; }

			const size = Math.min(usedBytes - position, length);

			utils.assert(size >= 0);

			if (size > 8 && contents.subarray) {
				buffer.set(contents.subarray(position, position + size), offset);
			}
			else {
				for (let i = 0; i < size; i++) {
					buffer[offset + i] = contents[position + i];
				}
			}

			return size;
		},

		write(stream, buffer, offset, length, position, canOwn) {
			if (!length) { return 0; }

			const node = stream.node;

			node.timestamp = Date.now();

			if (buffer.subarray && (!node.contents || node.contents.subarray)) {
				if (canOwn) {
					node.contents  = buffer.subarray(offset, offset + length);
					node.usedBytes = length;

					return length;
				}
				else if (node.usedBytes === 0 && position === 0) {
					node.contents  = new Uint8Array(buffer.subarray(offset, offset + length));
					node.usedBytes = length;

					return length;
				}
				else if (position + length <= node.usedBytes) {
					node.contents.set(buffer.subarray(offset, offset + length), position);

					return length;
				}
			}

			MEMFS.expandFileStorage(node, position + length);

			if (node.contents.subarray && buffer.subarray) {
				node.contents.set(buffer.subarray(offset, offset + length), position);
			} 
			else {
				for (let i = 0; i < length; i++) {
					node.contents[position + i] = buffer[offset + i];
				}
			}

			node.usedBytes = Math.max(node.usedBytes, position + length);

			return length;
		},

		llseek(stream, offset, whence) { 
			let position = offset;

			if (whence === 1) {
				position += stream.position;
			}
			else if (whence === 2) {
				if (fsShared.isFile(stream.node.mode)) {
					position += stream.node.usedBytes;
				}
			}

			if (position < 0) {
				throw new utils.ErrnoError(ERRNO_CODES.EINVAL);
			}

			return position;
		},

		allocate(stream, offset, length) {
			MEMFS.expandFileStorage(stream.node, offset + length);
			stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
		},

		mmap(stream, buffer, offset, length, position, prot, flags) {
			if (!fsShared.isFile(stream.node.mode)) {
				throw new utils.ErrnoError(ERRNO_CODES.ENODEV);
			}

			let ptr;
			let allocated;
			let contents = stream.node.contents;

			if (!(flags & 2) && (contents.buffer === buffer || contents.buffer === buffer.buffer)) {
				allocated = false;
				ptr 			= contents.byteOffset;
			}
			else {
				if (position > 0 || position + length < stream.node.usedBytes) {
					if (contents.subarray) {
						contents = contents.subarray(position, position + length);
					}
					else {
						contents = Array.prototype.slice.call(contents, position, position + length);
					}
				}

				allocated = true;
				ptr 			= memory.exposed._malloc(length);

				if (!ptr) {
					throw new utils.ErrnoError(ERRNO_CODES.ENOMEM);
				}

				buffer.set(contents, ptr);
			}

			return {ptr, allocated};
		},

		msync(stream, buffer, offset, length, mmapFlags) {
			if (!fsShared.isFile(stream.node.mode)) {
				throw new utils.ErrnoError(ERRNO_CODES.ENODEV);
			}

			if (mmapFlags & 2) {
				return 0;
			}

			MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);

			return 0;
		}
	}
};


export default MEMFS;
