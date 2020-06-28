

import {ENVIRONMENT_IS_WORKER, ERRNO_CODES} from './constants.js';

import utils 		from './utils.js';
import fsShared	from './fs-shared.js';


const base = path => {
	const parts = path.split('/');

	return parts[parts.length - 1];
};


const WORKERFS = {
	DIR_MODE:  16895,
	FILE_MODE: 33279,
	reader: 	 null,

	mount({opts}) {
		utils.assert(ENVIRONMENT_IS_WORKER);

		if (!WORKERFS.reader) { 
			WORKERFS.reader = new FileReaderSync; 
		}

		const ensureParent = (parent, path) => {
			const parts  				 = path.split('/');
			const createdParents = {};

			parts.forEach((part, index) => {
				const curr = parts.slice(0, index + 1).join('/');

				if (!createdParents[curr]) {
					createdParents[curr] = WORKERFS.createNode(parent, part, WORKERFS.DIR_MODE, 0);
				}

				parent = createdParents[curr];
			});				

			return parent;
		};

		const root = WORKERFS.createNode(null, '/', WORKERFS.DIR_MODE, 0);

		const {blobs = [], files = [], packages = []} = opts;
		
		files.forEach(file => {
			WORKERFS.createNode(
				ensureParent(root, file.name), 
				base(file.name), 
				WORKERFS.FILE_MODE, 
				0, 
				file, 
				file.lastModifiedDate
			);
		});

		blobs.forEach(obj => {
			WORKERFS.createNode(
				ensureParent(root, obj.name),
				base(obj.name),
				WORKERFS.FILE_MODE,
				0,
				obj.data
			);
		});

		packages.forEach(pack => {
			pack.metadata.files.forEach(file => {
				const name = file.filename.substr(1);

				WORKERFS.createNode(
					ensureParent(root, name),
					base(name),
					WORKERFS.FILE_MODE,
					0,
					pack.blob.slice(file.start, file.end)
				);
			});
		});

		return root;
	},

	createNode(parent, name, mode, dev, contents, mtime) {
		const node = fsShared.createNode(parent, name, mode);

		node.mode 			= mode;
		node.node_ops 	= WORKERFS.node_ops;
		node.stream_ops = WORKERFS.stream_ops;
		node.timestamp 	= (mtime || new Date).getTime();

		utils.assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);

		if (mode === WORKERFS.FILE_MODE) {
			node.size 		= contents.size;
			node.contents = contents;
		}
		else {
			node.size 		= 4096;
			node.contents = {};
		}

		if (parent) {
			parent.contents[name] = node;
		}

		return node;
	},

	node_ops: {
		getattr(node) {
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
		},

		setattr(node, attr) {
			if (attr.mode !== undefined) {
				node.mode = attr.mode;
			}

			if (attr.timestamp !== undefined) {
				node.timestamp = attr.timestamp;
			}
		},

		lookup(parent, name) {
			throw new utils.ErrnoError(ERRNO_CODES.ENOENT);
		},

		mknod(parent, name, mode, dev) {
			throw new utils.ErrnoError(ERRNO_CODES.EPERM);
		},

		rename(oldNode, newDir, newName) {
			throw new utils.ErrnoError(ERRNO_CODES.EPERM);
		},

		unlink(parent, name) {
			throw new utils.ErrnoError(ERRNO_CODES.EPERM);
		},

		rmdir(parent, name) {
			throw new utils.ErrnoError(ERRNO_CODES.EPERM);
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

		symlink(parent, newName, oldPath) {
			throw new utils.ErrnoError(ERRNO_CODES.EPERM);
		},

		readlink(node) {
			throw new utils.ErrnoError(ERRNO_CODES.EPERM);
		}
	},

	stream_ops: {
		read(stream, buffer, offset, length, position) {
			if (position >= stream.node.size) { return 0; }

			const chunk = stream.node.contents.slice(position, position + length);
			const ab 		= WORKERFS.reader.readAsArrayBuffer(chunk);

			buffer.set(new Uint8Array(ab), offset);

			return chunk.size;
		},

		write() {
			throw new utils.ErrnoError(ERRNO_CODES.EIO);
		},

		llseek(stream, offset, whence) {
			let position = offset;

			if (whence === 1) {
				position += stream.position;
			}
			else if (whence === 2) {
				if (fsShared.isFile(stream.node.mode)) {
					position += stream.node.size;
				}
			}

			if (position < 0) {
				throw new utils.ErrnoError(ERRNO_CODES.EINVAL);
			}

			return position;
		}
	}
};


export default WORKERFS;
