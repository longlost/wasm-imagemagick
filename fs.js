
import {ERRNO_CODES} from './constants.js';

import {
	ErrnoError,
	assert,
	getDevice,
	intArrayFromString,
	registerDevice,
	stringToUTF8Array,
	UTF8ArrayToString
} from './utils.js';

import {Module} from './module.js';

import {
	addRunDependency,
	removeRunDependency
} from './runtime.js';

import {___setErrNo} from './environment.js';

import {
	MAX_OPEN_FDS,
	chmod,
	chrdev_stream_ops,
	close,
	closeStream,
	createNode,
	createStream,
	currentPath,
	cwd,
	destroyNode,
	flagModes,
	flagsToPermissionString,
	genericErrors,
	getPath,
	hashName,
	hashAddNode,
	hashRemoveNode,
	ignorePermissions,
	isBlkdev,
	isChrdev,
	isClosed,
	isDir,
	isFIFO,
	isFile,
	isLink,
	isMountpoint,
	isRoot,
	llseek,
	lookup,
	lookupNode,
	lookupPath,
	mayCreate,
	mayDelete,
	mayLookup,
	mayOpen,
	mkdir,
	mknod,
	modeStringToFlags,
	nameTable,
	nextfd,
	nextInode,
	nodePermissions,
	open,
	readdir,
	readlink,
	rmdir,
	root,
	stat,
	streams,
	tracking,
	trackingDelegate,
	truncate,
	unlink,
	utime,
	write,
	writeFile
} from './fs-shared.js';

import PATH  		from './path.js';
import TTY 	 		from './tty.js';
import MEMFS 		from './memfs.js';
import IDBFS 		from './idbfs.js';
import NODEFS 	from './nodefs.js';
import WORKERFS from './workerfs.js';


window = window || self;


const demangle = func => func;

const demangleAll = text => {
	const regex = /__Z[\w\d_]+/g;

	return text.replace(regex, x => {
		const y = demangle(x);

		return x === y ? x : x + ` [${y}]`;
	});
};

const jsStackTrace = () => {
	let err = new Error;

	if (!err.stack) {
		try {
			throw new Error(0);
		}
		catch (error) {
			err = error;
		}

		if (!err.stack) {
			return '(no stack trace available)';
		}
	}

	return err.stack.toString();
};

const stackTrace = () => {
	const js = jsStackTrace();

	return demangleAll(js);
};


const FS = {
	root,
	mounts: [],
	streams,
	nextInode,
	nameTable,
	currentPath,
	initialized: false,
	ignorePermissions,
	trackingDelegate,
	tracking,
	ErrnoError,
	genericErrors,
	filesystems: null,
	syncFSRequests: 0,
	lookupPath,
	getPath,
	hashName,
	hashAddNode,
	hashRemoveNode,
	lookupNode,
	createStream,
	closeStream,
	chrdev_stream_ops,
	createNode,
	destroyNode,
	isRoot,
	isMountpoint,
	isFile,
	isDir,
	isLink,
	isChrdev,
	isBlkdev,
	isFIFO,
	flagModes,
	modeStringToFlags,
	flagsToPermissionString,
	nodePermissions,
	mayLookup,
	mayCreate,
	mayDelete,
	mayOpen,
	MAX_OPEN_FDS,
	nextfd,
	registerDevice,
	getDevice,
	lookup,
	mknod,
	mkdir,
	rmdir,
	readdir,
	unlink,
	readlink,
	stat,
	chmod,
	truncate,
	utime,
	open,
	close,
	isClosed,
	llseek,
	write,
	writeFile,
	cwd,

	handleFSError(error) {
		if (!(error instanceof FS.ErrnoError)) { 
			throw `${error} : ${stackTrace()}`;
		}

		return ___setErrNo(e.errno);
	},	

	isSocket: mode => (mode & 49152) === 49152,	

	getStream: fd => FS.streams[fd],	

	major: dev => dev >> 8,

	minor: dev => dev & 255,

	makedev: (ma, mi) => ma << 8 | mi,	

	getMounts(mount) {
		const mounts = [];
		const check  = [mount];

		while (check.length) {
			const m = check.pop();

			mounts.push(m);
			check.push(...m.mounts);
		}

		return mounts;
	},

	syncfs(populate, callback) {
		if (typeof populate === 'function') {
			callback = populate;
			populate = false;
		}

		FS.syncFSRequests++;

		if (FS.syncFSRequests > 1) {
			console.log(`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
		}

		const mounts 	= FS.getMounts(FS.root.mount);
		let completed = 0;

		const doCallback = err => {
			assert(FS.syncFSRequests > 0);

			FS.syncFSRequests--;

			return callback(err);
		};

		// Not an arrow function since it is being used as 
		// a function object with the assignment to 'done.errored'.
		function done(err) {
			if (err) {
				if (!done.errored) {
					done.errored = true;

					return doCallback(err);
				}

				return;
			}

			if (++completed >= mounts.length) {
				doCallback(null);
			}
		}

		mounts.forEach(mount => {
			if (!mount.type.syncfs) {
				return done(null);
			}

			mount.type.syncfs(mount, populate, done);
		});
	},

	mount(type, opts, mountpoint) {
		const isRoot = mountpoint === '/';
		const pseudo = !mountpoint;
		let node;

		if (isRoot && FS.root) {
			throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
		}
		else if (!isRoot && !pseudo) {
			const lookup = FS.lookupPath(mountpoint, {follow_mount: false});

			mountpoint = lookup.path;
			node 			 = lookup.node;

			if (FS.isMountpoint(node)) {
				throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
			}

			if (!FS.isDir(node.mode)) {
				throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
			}
		}

		const mount = {
			type, 
			opts, 
			mountpoint, 
			mounts: []
		};

		const mountRoot = type.mount(mount);

		mountRoot.mount = mount;
		mount.root 			= mountRoot;

		if (isRoot) {
			FS.root = mountRoot;
		}
		else if (node) {
			node.mounted = mount;

			if (node.mount) {
				node.mount.mounts.push(mount);
			}
		}

		return mountRoot;
	},

	unmount(mountpoint) {
		const {node} = FS.lookupPath(mountpoint, {follow_mount: false});

		if (!FS.isMountpoint(node)) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
		}

		const mount  = node.mounted;
		const mounts = FS.getMounts(mount);

		Object.keys(FS.nameTable).forEach(hash => {
			let current = FS.nameTable[hash];

			while (current) {
				const next = current.name_next;

				if (mounts.indexOf(current.mount) !== -1) {
					FS.destroyNode(current);
				}

				current = next;
			}
		});

		node.mounted = null;

		const index = node.mount.mounts.indexOf(mount);

		assert(index !== -1);

		node.mount.mounts.splice(index, 1);
	},

	create(path, mode) {
		mode = mode !== undefined ? mode : 438;
		mode &= 4095;
		mode |= 32768;

		return FS.mknod(path, mode, 0);
	},

	mkdirTree(path, mode) {
		const dirs = path.split('/');
		let d 	 	 = '';

		dirs.forEach(dir => {
			if (!dir) { return; }

			d += `/${dir}`;

			try {
				FS.mkdir(d, mode);
			}
			catch (error) {
				if (error.errno !== ERRNO_CODES.EEXIST) { throw error; }
			}
		});			
	},

	mkdev(path, mode, dev) {
		if (typeof dev === 'undefined') {
			dev  = mode;
			mode = 438;
		}

		mode |= 8192;

		return FS.mknod(path, mode, dev);
	},

	symlink(oldpath, newpath) {
		if (!PATH.resolve(oldpath)) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
		}

		const {node: parent} = FS.lookupPath(newpath, {parent: true});

		if (!parent) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
		}

		const newname = PATH.basename(newpath);
		const error = FS.mayCreate(parent, newname);

		if (error) {
			throw new FS.ErrnoError(error);
		}

		if (!parent.node_ops.symlink) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM);
		}

		return parent.node_ops.symlink(parent, newname, oldpath);
	},

	rename(old_path, new_path) {
		const old_dirname = PATH.dirname(old_path);
		const new_dirname = PATH.dirname(new_path);
		const old_name 		= PATH.basename(old_path);
		const new_name 		= PATH.basename(new_path);

		let lookup;
		let old_dir;
		let new_dir;

		try {
			lookup 	= FS.lookupPath(old_path, {parent: true});
			old_dir = lookup.node;
			lookup 	= FS.lookupPath(new_path, {parent: true});
			new_dir = lookup.node;
		}
		catch (_) {
			throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
		}

		if (!old_dir || !new_dir) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
		}

		if (old_dir.mount !== new_dir.mount) {
			throw new FS.ErrnoError(ERRNO_CODES.EXDEV);
		}

		const old_node = FS.lookupNode(old_dir, old_name);
		let relative 	 = PATH.relative(old_path, new_dirname);

		if (relative.charAt(0) !== '.') {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
		}

		relative = PATH.relative(new_path, old_dirname);

		if (relative.charAt(0) !== '.') {
			throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
		}

		let new_node;

		try {
			new_node = FS.lookupNode(new_dir, new_name);
		}
		catch (_) {}

		if (old_node === new_node) { return; }

		const isdir = FS.isDir(old_node.mode);
		let error 	= FS.mayDelete(old_dir, old_name, isdir);

		if (error) {
			throw new FS.ErrnoError(error);
		}

		error = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);

		if (error) {
			throw new FS.ErrnoError(error);
		}

		if (!old_dir.node_ops.rename) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM);
		}

		if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
			throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
		}

		if (new_dir !== old_dir) {
			error = FS.nodePermissions(old_dir, 'w');

			if (error) {
				throw new FS.ErrnoError(error);
			}
		}

		try {
			if (FS.trackingDelegate['willMovePath']) {
				FS.trackingDelegate['willMovePath'](old_path, new_path);
			}
		}
		catch (err) {
			console.log(`FS.trackingDelegate['willMovePath']('${old_path}', '${new_path}') threw an exception: ${err.message}`);
		}

		FS.hashRemoveNode(old_node);

		try {
			old_dir.node_ops.rename(old_node, new_dir, new_name);
		}
		catch (err) {
			throw err;
		}
		finally {
			FS.hashAddNode(old_node);
		}

		try {
			if (FS.trackingDelegate['onMovePath']) {
				FS.trackingDelegate['onMovePath'](old_path, new_path);
			}
		}
		catch (err) {
			console.log(`FS.trackingDelegate['onMovePath']('${old_path}', '${new_path}') threw an exception: ${err.message}`);
		}
	},

	lstat: path => FS.stat(path, true),

	lchmod(path, mode) {
		FS.chmod(path, mode, true);
	},

	fchmod(fd, mode) {
		const stream = FS.getStream(fd);

		if (!stream) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF);
		}

		FS.chmod(stream.node, mode);
	},

	chown(path, uid, gid, dontFollow) {
		let node;

		if (typeof path === 'string') {
			const lookup = FS.lookupPath(path, {follow: !dontFollow});

			node = lookup.node;
		}
		else {
			node = path;
		}

		if (!node.node_ops.setattr) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM);
		}

		node.node_ops.setattr(node, {timestamp: Date.now()});
	},

	lchown(path, uid, gid) {
		FS.chown(path, uid, gid, true);
	},

	fchown(fd, uid, gid) {
		const stream = FS.getStream(fd);

		if (!stream) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF);
		}

		FS.chown(stream.node, uid, gid);
	},

	ftruncate(fd, len) {
		const stream = FS.getStream(fd);

		if (!stream) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF);
		}

		if ((stream.flags & 2097155) === 0) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
		}

		FS.truncate(stream.node, len);
	},

	read(stream, buffer, offset, length, position) {
		if (length < 0 || position < 0) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
		}

		if (FS.isClosed(stream)) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF);
		}

		if ((stream.flags & 2097155) === 1) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF);
		}

		if (FS.isDir(stream.node.mode)) {
			throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
		}

		if (!stream.stream_ops.read) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
		}

		const seeking = typeof position !== 'undefined';

		if (!seeking) {
			position = stream.position;
		}
		else if (!stream.seekable) {
			throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
		}

		const bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);

		if (!seeking) {
			stream.position += bytesRead;
		}

		return bytesRead;
	},

	allocate(stream, offset, length) {
		if (FS.isClosed(stream)) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF);
		}

		if (offset < 0 || length <= 0) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
		}

		if ((stream.flags & 2097155) === 0) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF);
		}

		if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
			throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
		}

		if (!stream.stream_ops.allocate) {
			throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
		}

		stream.stream_ops.allocate(stream, offset, length);
	},

	mmap(stream, buffer, offset, length, position, prot, flags) {
		if ((stream.flags & 2097155) === 1) {
			throw new FS.ErrnoError(ERRNO_CODES.EACCES);
		}

		if (!stream.stream_ops.mmap) {
			throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
		}

		return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags);
	},

	msync(stream, buffer, offset, length, mmapFlags) {
		if (!stream || !stream.stream_ops.msync) {
			return 0;
		}

		return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
	},

	munmap: () => 0,

	ioctl(stream, cmd, arg) {
		if (!stream.stream_ops.ioctl) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOTTY);
		}

		return stream.stream_ops.ioctl(stream, cmd, arg);
	},

	readFile(path, opts = {}) {
		const {encoding = 'binary', flags = 'r'} = opts;

		if (encoding !== 'utf8' && encoding !== 'binary') {
			throw new Error(`Invalid encoding type '${encoding}'`);
		}

		const stream 				 = FS.open(path, flags);
		const {size: length} = FS.stat(path);
		const buf 	 				 = new Uint8Array(length);
		let ret;

		FS.read(stream, buf, 0, length, 0);

		if (encoding === 'utf8') {
			ret = UTF8ArrayToString(buf, 0);
		}
		else if (encoding === 'binary') {
			ret = buf;
		}

		FS.close(stream);

		return ret;
	},

	chdir(path) {
		const lookup = FS.lookupPath(path, {follow: true});

		if (lookup.node === null) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
		}

		if (!FS.isDir(lookup.node.mode)) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
		}

		const error = FS.nodePermissions(lookup.node, 'x');

		if (error) {
			throw new FS.ErrnoError(error);
		}

		currentPath = lookup.path;
	},

	createDefaultDirectories() {
		FS.mkdir('/tmp');
		FS.mkdir('/home');
		FS.mkdir('/home/web_user');
	},

	createDefaultDevices() {
		FS.mkdir('/dev');
		FS.registerDevice(FS.makedev(1, 3), {
			read:  () => 0,
			write: (stream, buffer, offset, length, pos) => length
		});
		FS.mkdev('/dev/null', FS.makedev(1, 3));
		TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
		TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
		FS.mkdev('/dev/tty',  FS.makedev(5, 0));
		FS.mkdev('/dev/tty1', FS.makedev(6, 0));

		let random_device;

		if (typeof crypto !== 'undefined') {
			const randomBuffer = new Uint8Array(1);

			random_device = () => {
				crypto.getRandomValues(randomBuffer);

				return randomBuffer[0];
			};
		}
		else if (ENVIRONMENT_IS_NODE) {
			random_device = () => require('crypto')['randomBytes'](1)[0];
		}
		else {
			random_device = () => Math.random() * 256 | 0;
		}

		FS.createDevice('/dev', 'random',  random_device);
		FS.createDevice('/dev', 'urandom', random_device);
		FS.mkdir('/dev/shm');
		FS.mkdir('/dev/shm/tmp');
	},

	createSpecialDirectories() {
		FS.mkdir('/proc');
		FS.mkdir('/proc/self');
		FS.mkdir('/proc/self/fd');
		FS.mount(
			{
				mount() {
					const node = FS.createNode('/proc/self', 'fd', 16384 | 511, 73);

					node.node_ops = {
						lookup(parent, name) {
							const fd 		 = +name;
							const stream = FS.getStream(fd);

							if (!stream) {
								throw new FS.ErrnoError(ERRNO_CODES.EBADF);
							}

							const ret = {
								parent: null,
								mount: {
									mountpoint: 'fake'
								},
								node_ops: {
									readlink: () => stream.path
								}
							};

							ret.parent = ret;

							return ret;
						}
					};

					return node;
				}
			},
			{},
			'/proc/self/fd'
		);
	},

	createStandardStreams() {
		if (Module['stdin']) {
			FS.createDevice('/dev', 'stdin', Module['stdin']);
		}
		else {
			FS.symlink('/dev/tty', '/dev/stdin');
		}

		if (Module['stdout']) {
			FS.createDevice('/dev', 'stdout', null, Module['stdout']);
		}
		else {
			FS.symlink('/dev/tty', '/dev/stdout');
		}

		if (Module['stderr']) {
			FS.createDevice('/dev', 'stderr', null, Module['stderr']);
		}
		else {
			FS.symlink('/dev/tty1', '/dev/stderr');
		}

		const stdin = FS.open('/dev/stdin', 'r');

		assert(stdin.fd === 0, `invalid handle for stdin ('${stdin.fd}')`);

		const stdout = FS.open('/dev/stdout', 'w');

		assert(stdout.fd === 1, `invalid handle for stdout ('${stdout.fd}')`);

		const stderr = FS.open('/dev/stderr', 'w');

		assert(stderr.fd === 2, `invalid handle for stderr ('${stderr.fd}')`);
	},

	staticInit() {
		FS.mount(MEMFS, {}, '/');
		FS.createDefaultDirectories();
		FS.createDefaultDevices();
		FS.createSpecialDirectories();
		FS.filesystems = {
			'MEMFS': 		MEMFS,
			'IDBFS': 		IDBFS,
			'NODEFS': 	NODEFS,
			'WORKERFS': WORKERFS
		};
	},

	init(input, output, error) {
		assert(!FS.init.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');

		FS.init.initialized = true;
		Module['stdin']  = input  || Module['stdin'];
		Module['stdout'] = output || Module['stdout'];
		Module['stderr'] = error  || Module['stderr'];
		FS.createStandardStreams();
	},

	quit() {
		FS.init.initialized = false;

		FS.streams.forEach(stream => {
			if (stream) {
				FS.close(stream);
			}			
		});
	},

	getMode(canRead, canWrite) {
		let mode = 0;

		if (canRead) {
			mode |= 292 | 73;
		}

		if (canWrite) {
			mode |= 146;
		}

		return mode;
	},

	joinPath(parts, forceRelative) {
		let path = PATH.join(...parts);

		if (forceRelative && path[0] === '/') {
			path = path.substr(1);
		}

		return path;
	},

	absolutePath: (relative, base) => PATH.resolve(base, relative),

	standardizePath: path => PATH.normalize(path),

	findObject(path, dontResolveLastLink) {
		const {error, exists, object} = FS.analyzePath(path, dontResolveLastLink);

		if (exists) {
			return object;
		}
		else {
			___setErrNo(error);

			return null;
		}
	},

	analyzePath(path, dontResolveLastLink) {
		try {
			const lookup = FS.lookupPath(path, {follow: !dontResolveLastLink});

			path = lookup.path;
		}
		catch (_) {}

		const ret = {
			isRoot: 			false,
			exists: 			false,
			error: 				0,
			name: 				null,
			path: 				null,
			object: 			null,
			parentExists: false,
			parentPath: 	null,
			parentObject: null
		};

		try {
			let lookup = FS.lookupPath(path, {parent: true});

			ret.parentExists = true;
			ret.parentPath 	 = lookup.path;
			ret.parentObject = lookup.node;
			ret.name 				 = PATH.basename(path);

			lookup = FS.lookupPath(path, {follow: !dontResolveLastLink});

			ret.exists = true;
			ret.path 	 = lookup.path;
			ret.object = lookup.node;
			ret.name 	 = lookup.node.name;
			ret.isRoot = lookup.path === '/'
		}
		catch (error) {
			ret.error = error.errno;
		}

		return ret;
	},

	createFolder(parent, name, canRead, canWrite) {
		const path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
		const mode = FS.getMode(canRead, canWrite);

		return FS.mkdir(path, mode);
	},

	createPath(parent, path, canRead, canWrite) {
		parent = typeof parent === 'string' ? parent : FS.getPath(parent);

		const parts = path.split('/');
		let current;

		parts.forEach(part => {
			if (!part) { return; }

			current = PATH.join2(parent, part);

			try {
				FS.mkdir(current);
			}
			catch (_) {}

			parent = current;
		});

		return current;
	},

	createFile(parent, name, properties, canRead, canWrite) {
		const path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
		const mode = FS.getMode(canRead, canWrite);

		return FS.create(path, mode);
	},

	createDataFile(parent, name, data, canRead, canWrite, canOwn) {
		const path = name ? 
									 PATH.join2(typeof parent === 'string' ? 
										 parent : 
										 FS.getPath(parent), name) : 
									 parent;

		const mode = FS.getMode(canRead, canWrite);
		const node = FS.create(path, mode);

		if (data) {
			if (typeof data === 'string') {

				const charCodes = data.split('').map(char => char.charCodeAt(0));

				data = charCodes;


				// var arr = new Array(data.length);

				// for (var i = 0, len = data.length; i < len; ++i) {
				// 	arr[i] = data.charCodeAt(i);
				// }

				// data = arr;
			}

			FS.chmod(node, mode | 146);

			const stream = FS.open(node, 'w');

			FS.write(stream, data, 0, data.length, 0, canOwn);
			FS.close(stream);
			FS.chmod(node, mode);
		}

		return node;
	},

	createDevice(parent, name, input, output) {
		const path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
		const mode = FS.getMode(!!input, !!output);

		if (!FS.createDevice.major) {
			FS.createDevice.major = 64;
		}

		const dev = FS.makedev(FS.createDevice.major++, 0);

		FS.registerDevice(dev, {
			open(stream) {
				stream.seekable = false;
			},

			close(stream) {
				if (output && output.buffer && output.buffer.length) {
					output(10);
				}
			},

			read(stream, buffer, offset, length, pos) {
				let bytesRead = 0;

				for (let i = 0; i < length; i++) {
					let result;

					try {
						result = input();
					}
					catch (_) {
						throw new FS.ErrnoError(ERRNO_CODES.EIO);
					}

					if (result === undefined && bytesRead === 0) {
						throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
					}

					if (result === null || result === undefined) { break; }

					bytesRead++;
					buffer[offset + i] = result;
				}

				if (bytesRead) {
					stream.node.timestamp = Date.now();
				}

				return bytesRead;
			},

			write(stream, buffer, offset, length, pos) {
				for (var i = 0; i < length; i++) {
					try {
						output(buffer[offset + i]);
					}
					catch (_) {
						throw new FS.ErrnoError(ERRNO_CODES.EIO);
					}
				}

				if (length) {
					stream.node.timestamp = Date.now();
				}

				return i;
			}
		});

		return FS.mkdev(path, mode, dev);
	},

	createLink(parent, name, target) {
		const path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);

		return FS.symlink(target, path);
	},

	forceLoadFile(obj) {
		if (obj.isDevice || obj.isFolder || obj.link || obj.contents) { 
			return true; 
		}

		let success = true;

		if (typeof XMLHttpRequest !== 'undefined') {
			throw new Error('Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.');
		}
		else if (Module['read']) {
			try {
				obj.contents  = intArrayFromString(Module['read'](obj.url), true);
				obj.usedBytes = obj.contents.length;
			}
			catch (_) {
				success = false;
			}
		}
		else {
			throw new Error('Cannot load without read() or XMLHttpRequest.');
		}

		if (!success) {
			___setErrNo(ERRNO_CODES.EIO);
		}

		return success;
	},

	createLazyFile(parent, name, url, canRead, canWrite) {
		function LazyUint8Array() {
			this.lengthKnown = false;
			this.chunks 		 = [];
		}

		LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
			if (idx > this.length - 1 || idx < 0) {
				return undefined;
			}

			const chunkOffset = idx % this.chunkSize;
			const chunkNum 		= idx / this.chunkSize | 0;

			return this.getter(chunkNum)[chunkOffset];
		};

		LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
			this.getter = getter;
		};

		LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
			const xhr = new XMLHttpRequest;

			xhr.open('HEAD', url, false);
			xhr.send(null);

			if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) {
				throw new Error(`Could not load ${url}. Status: ${xhr.status}`);
			}

			let datalength = Number(xhr.getResponseHeader('Content-length'));
			let chunkSize  = 1024 * 1024;
			let header;

			const hasByteServing = (header = xhr.getResponseHeader('Accept-Ranges')) 		&& header === 'bytes';
			const usesGzip 			 = (header = xhr.getResponseHeader('Content-Encoding')) && header === 'gzip';

			if (!hasByteServing) {
				chunkSize = datalength;
			}

			const doXHR = (from, to) => {
				if (from > to) {
					throw new Error(`invalid range ('${from}', '${to}') or no bytes requested!`);
				}

				if (to > datalength - 1) {
					throw new Error(`only ${datalength}' bytes available! programmer error!`);
				}

				const xhr = new XMLHttpRequest;

				xhr.open('GET', url, false);

				if (datalength !== chunkSize) {
					xhr.setRequestHeader('Range', `bytes=${from}-${to}`);
				}

				if (typeof Uint8Array != 'undefined') {
					xhr.responseType = 'arraybuffer';
				}

				if (xhr.overrideMimeType) {
					xhr.overrideMimeType('text/plain; charset=x-user-defined');
				}

				xhr.send(null);

				if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) {
					throw new Error(`Could not load ${url}. Status: ${xhr.status}`);
				}

				if (xhr.response !== undefined) {
					return new Uint8Array(xhr.response || []);
				}
				else {
					return intArrayFromString(xhr.responseText || '', true);
				}
			};

			const lazyArray = this;

			lazyArray.setDataGetter(chunkNum => {
				const start = chunkNum * chunkSize;
				let end 		= (chunkNum + 1) * chunkSize - 1;

				end = Math.min(end, datalength - 1);

				if (typeof lazyArray.chunks[chunkNum] === 'undefined') {
					lazyArray.chunks[chunkNum] = doXHR(start, end);
				}

				if (typeof lazyArray.chunks[chunkNum] === 'undefined') {
					throw new Error('doXHR failed!');
				}

				return lazyArray.chunks[chunkNum];
			});

			if (usesGzip || !datalength) {
				chunkSize  = datalength = 1;
				datalength = this.getter(0).length;
				chunkSize  = datalength;

				console.log('LazyFiles on gzip forces download of the whole file when length is accessed');
			}

			this._length 		 = datalength;
			this._chunkSize  = chunkSize;
			this.lengthKnown = true;
		};

		let properties;

		if (typeof XMLHttpRequest !== 'undefined') {
			if (!ENVIRONMENT_IS_WORKER) {
				throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
			}

			const lazyArray = new LazyUint8Array;

			Object.defineProperties(lazyArray, {
				length: {
					get() {
						if (!this.lengthKnown) {
							this.cacheLength();
						}

						return this._length;
					}
				},
				chunkSize: {
					get() {
						if (!this.lengthKnown) {
							this.cacheLength();
						}

						return this._chunkSize;
					}
				}
			});

			properties = {isDevice: false, contents: lazyArray};
		}
		else {
			properties = {isDevice: false, url};
		}

		const node = FS.createFile(parent, name, properties, canRead, canWrite);

		if (properties.contents) {
			node.contents = properties.contents;
		}
		else if (properties.url) {
			node.contents = null;
			node.url 			= properties.url;
		}

		Object.defineProperties(node, {
			usedBytes: {
				get() {
					return this.contents.length;
				}
			}
		});

		const keys = Object.keys(node.stream_ops);

		const stream_ops = keys.reduce((accum, key) => {
			const fn = node.stream_ops[key];

			const forceLoadLazyFile = (...args) => {
				if (!FS.forceLoadFile(node)) {
					throw new FS.ErrnoError(ERRNO_CODES.EIO);
				}

				return fn(...args);
			};

			accum[key] = forceLoadLazyFile;

			return accum;
		}, {});

		stream_ops.read = (stream, buffer, offset, length, position) => {
			if (!FS.forceLoadFile(node)) {
				throw new FS.ErrnoError(ERRNO_CODES.EIO);
			}

			const {contents} = stream.node;

			if (position >= contents.length) { return 0; }

			const size = Math.min(contents.length - position, length);

			assert(size >= 0);

			if (contents.slice) {
				for (let i = 0; i < size; i++) {
					buffer[offset + i] = contents[position + i];
				}
			}
			else {
				for (let i = 0; i < size; i++) {
					buffer[offset + i] = contents.get(position + i);
				}
			}

			return size;
		};

		node.stream_ops = stream_ops;

		return node;
	},

	createPreloadedFile(parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
		Browser.init();

		const getUniqueRunDependency = id => id;

		const fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
		const dep 		 = getUniqueRunDependency(`cp ${fullname}`);

		const processData = byteArray => {
			const finish = byteArray => {
				if (preFinish) {
					preFinish();
				}

				if (!dontCreateFile) {
					FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
				}

				if (onload) {
					onload();
				}

				removeRunDependency(dep);
			};

			let handled = false;

			Module['preloadPlugins'].forEach(plugin => {
				if (handled) { return; }

				if (plugin['canHandle'](fullname)) {
					plugin['handle'](byteArray, fullname, finish, () => {
						if (onerror) {
							onerror();
						}

						removeRunDependency(dep);
					});

					handled = true;
				}
			});

			if (!handled) {
				finish(byteArray);
			}
		};

		addRunDependency(dep);

		if (typeof url === 'string') {
			Browser.asyncLoad(
				url, 
				processData,
				onerror
			);
		}
		else {
			processData(url);
		}
	},

	indexedDB: () => window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB,

	DB_NAME: () => `EM_FS_${window.location.pathname}`,

	DB_VERSION: 		20,
	DB_STORE_NAME: 'FILE_DATA',

	saveFilesToDB(paths, onload = () => {}, onerror = () => {}) {		
		const indexedDB = FS.indexedDB();
		let openRequest,

		try {
			openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
		}
		catch (error) {
			return onerror(error);
		}

		openRequest.onupgradeneeded = () => {
			console.log('creating db');

			const db = openRequest.result;

			db.createObjectStore(FS.DB_STORE_NAME);
		};

		openRequest.onsuccess = () => {
			const db 					= openRequest.result;
			const transaction = db.transaction([FS.DB_STORE_NAME], 'readwrite');
			const files 			= transaction.objectStore(FS.DB_STORE_NAME);
			const total 			= paths.length;

			let ok 	 = 0;
			let fail = 0;

			const finish = () => {
				if (fail == 0) {
					onload();
				}
				else {
					onerror();
				}
			};

			paths.forEach(path => {
				const putRequest = files.put(FS.analyzePath(path).object.contents, path);

				putRequest.onsuccess = () => {
					ok++;

					if (ok + fail === total) {
						finish();
					}
				};

				putRequest.onerror = () => {
					fail++;

					if (ok + fail === total) {
						finish();
					}
				};
			});

			transaction.onerror = onerror;
		};

		openRequest.onerror = onerror;
	},

	loadFilesFromDB(paths, onload = () => {}, onerror = () => {}) {
		const indexedDB = FS.indexedDB();
		let openRequest;

		try {
			openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
		}
		catch (error) {
			return onerror(error);
		}

		openRequest.onupgradeneeded = onerror;

		openRequest.onsuccess = () => {
			const db = openRequest.result;
			let transaction;

			try {
				transaction = db.transaction([FS.DB_STORE_NAME], 'readonly');
			}
			catch (error) {
				onerror(error);

				return;
			}

			const files = transaction.objectStore(FS.DB_STORE_NAME);
			const total = paths.length;

			let ok 		= 0;
			let fail 	= 0;

			const finish = () => {
				if (fail == 0) {
					onload();
				}
				else {
					onerror();
				}
			};

			paths.forEach(path => {
				const getRequest = files.get(path);

				getRequest.onsuccess = () => {
					if (FS.analyzePath(path).exists) {
						FS.unlink(path);
					}

					FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);

					ok++;

					if (ok + fail === total) {
						finish();
					}
				};

				getRequest.onerror = () => {
					fail++;

					if (ok + fail === total) {
						finish();
					}
				};
			});

			transaction.onerror = onerror;
		};

		openRequest.onerror = onerror;
	}
};


export default FS;
