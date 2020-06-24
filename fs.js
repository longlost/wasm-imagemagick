
import {
	ERRNO_CODES
} 				 	from './constants.js';
import {
	ErrnoError,
	assert,
	err,
	getDevice,
	intArrayFromString,
	lengthBytesUTF8,
	out,
	registerDevice,
	stringToUTF8Array,
	UTF8ArrayToString
} 				 	from './utils.js';
import PATH from './path.js';
import TTY 	from './tty.js';


const window = window || self;


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


var FS = {
	root: null,
	mounts: [],
	devices: {},
	streams: [],
	nextInode: 1,
	nameTable: null,
	currentPath: '/',
	initialized: false,
	ignorePermissions: true,
	trackingDelegate: {},
	tracking: {
		openFlags: {
			READ: 1,
			WRITE: 2
		}
	},
	ErrnoError: null,
	genericErrors: {},
	filesystems: null,
	syncFSRequests: 0,

	handleFSError: (function(e) {
		if (!(e instanceof FS.ErrnoError)) { 
			throw e + ' : ' + stackTrace();
		}

		return ___setErrNo(e.errno);
	}),

	lookupPath: (function(path, opts) {
		path = PATH.resolve(FS.cwd(), path);
		opts = opts || {};

		if (!path) {
			return {path: '', node: null};
		}

		var defaults = {
			follow_mount: true,
			recurse_count: 0
		};

		for (var key in defaults) {
			if (opts[key] === undefined) {
				opts[key] = defaults[key];
			}
		}

		if (opts.recurse_count > 8) {
			throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
		}

		var parts = PATH.normalizeArray(
			path.split('/').filter((function(p) {
				return !!p;
			})),
			false
		);

		var current = FS.root;
		var current_path = '/';

		for (var i = 0; i < parts.length; i++) {
			var islast = i === parts.length - 1;

			if (islast && opts.parent) {
				break;
			}

			current 		 = FS.lookupNode(current, parts[i]);
			current_path = PATH.join2(current_path, parts[i]);

			if (FS.isMountpoint(current)) {
				if (!islast || islast && opts.follow_mount) {
					current = current.mounted.root;
				}
			}

			if (!islast || opts.follow) {
				var count = 0;

				while (FS.isLink(current.mode)) {
					var link = FS.readlink(current_path);

					current_path = PATH.resolve(PATH.dirname(current_path), link);

					var lookup = FS.lookupPath(current_path, {recurse_count: opts.recurse_count});

					current = lookup.node;

					if (count++ > 40) {
						throw new FS.ErrnoError(ERRNO_CODES.ELOOP);
					}
				}
			}
		}

		return {path: current_path, node: current};
	}),

	getPath: (function(node) {
		var path;

		while (true) {
			if (FS.isRoot(node)) {
				var mount = node.mount.mountpoint;

				if (!path) { return mount; }

				return mount[mount.length - 1] !== '/' ? mount + '/' + path : mount + path;
			}

			path = path ? node.name + '/' + path : node.name;
			node = node.parent;
		}
	}),

	hashName: (function(parentid, name) {
		var hash = 0;

		for (var i = 0; i < name.length; i++) {
			hash = (hash << 5) - hash + name.charCodeAt(i) | 0;
		}

		return (parentid + hash >>> 0) % FS.nameTable.length;
	}),

	hashAddNode: (function(node) {
		var hash = FS.hashName(node.parent.id, node.name);

		node.name_next = FS.nameTable[hash];
		FS.nameTable[hash] = node;
	}),

	hashRemoveNode: (function(node) {
		var hash = FS.hashName(node.parent.id, node.name);

		if (FS.nameTable[hash] === node) {
			FS.nameTable[hash] = node.name_next;
		}
		else {
			var current = FS.nameTable[hash];

			while (current) {
				if (current.name_next === node) {
					current.name_next = node.name_next;
					break;
				}

				current = current.name_next;
			}
		}
	}),

	lookupNode: (function(parent, name) {
		var err = FS.mayLookup(parent);

		if (err) {
			throw new FS.ErrnoError(err, parent);
		}

		var hash = FS.hashName(parent.id, name);

		for (var node = FS.nameTable[hash]; node; node = node.name_next) {
			var nodeName = node.name;

			if (node.parent.id === parent.id && nodeName === name) {
				return node;
			}
		}

		return FS.lookup(parent, name);
	}),

	createNode: (function(parent, name, mode, rdev) {
		if (!FS.FSNode) {
			FS.FSNode = (function(parent, name, mode, rdev) {
				if (!parent) {
					parent = this;
				}

				this.parent 		= parent;
				this.mount 			= parent.mount;
				this.mounted 		= null;
				this.id 				= FS.nextInode++;
				this.name 			= name;
				this.mode 			= mode;
				this.node_ops 	= {};
				this.stream_ops = {};
				this.rdev 			= rdev;
			});

			FS.FSNode.prototype = {};

			var readMode  = 292 | 73;
			var writeMode = 146;

			Object.defineProperties(FS.FSNode.prototype, {
				read: {
					get: (function() {
						return (this.mode & readMode) === readMode;
					}),

					set: (function(val) {
						val ? this.mode |= readMode : this.mode &= ~readMode;
					})
				},

				write: {
					get: (function() {
						return (this.mode & writeMode) === writeMode;
					}),

					set: (function(val) {
						val ? this.mode |= writeMode : this.mode &= ~writeMode;
					})
				},

				isFolder: {
					get: (function() {
						return FS.isDir(this.mode);
					})
				},

				isDevice: {
					get: (function() {
						return FS.isChrdev(this.mode);
					})
				}
			});
		}

		var node = new FS.FSNode(parent, name, mode, rdev);

		FS.hashAddNode(node);

		return node;
	}),

	destroyNode: (function(node) {
		FS.hashRemoveNode(node);
	}),

	isRoot: (function(node) {
		return node === node.parent;
	}),

	isMountpoint: (function(node) {
		return !!node.mounted;
	}),

	isFile: (function(mode) {
		return (mode & 61440) === 32768;
	}),

	isDir: (function(mode) {
		return (mode & 61440) === 16384;
	}),

	isLink: (function(mode) {
		return (mode & 61440) === 40960;
	}),

	isChrdev: (function(mode) {
		return (mode & 61440) === 8192;
	}),

	isBlkdev: (function(mode) {
		return (mode & 61440) === 24576;
	}),

	isFIFO: (function(mode) {
		return (mode & 61440) === 4096;
	}),

	isSocket: (function(mode) {
		return (mode & 49152) === 49152;
	}),

	flagModes: {
		'r': 0,
		'rs': 1052672,
		'r+': 2,
		'w': 577,
		'wx': 705,
		'xw': 705,
		'w+': 578,
		'wx+': 706,
		'xw+': 706,
		'a': 1089,
		'ax': 1217,
		'xa': 1217,
		'a+': 1090,
		'ax+': 1218,
		'xa+': 1218
	},

	modeStringToFlags: (function(str) {
		var flags = FS.flagModes[str];

		if (typeof flags === 'undefined') {
			throw new Error('Unknown file open mode: ' + str);
		}

		return flags;
	}),

	flagsToPermissionString: (function(flag) {
		var perms = ['r', 'w', 'rw'][flag & 3];

		if (flag & 512) {
			perms += 'w';
		}

		return perms;
	}),

	nodePermissions: (function(node, perms) {
		if (FS.ignorePermissions) {
			return 0;
		}

		if (perms.indexOf('r') !== -1 && !(node.mode & 292)) {
			return ERRNO_CODES.EACCES;
		}
		else if (perms.indexOf('w') !== -1 && !(node.mode & 146)) {
			return ERRNO_CODES.EACCES;
		}
		else if (perms.indexOf('x') !== -1 && !(node.mode & 73)) {
			return ERRNO_CODES.EACCES;
		}

		return 0;
	}),

	mayLookup: (function(dir) {
		var err = FS.nodePermissions(dir, 'x');

		if (err) { return err; }

		if (!dir.node_ops.lookup) { return ERRNO_CODES.EACCES; }

		return 0;
	}),

	mayCreate: (function(dir, name) {
		try {
			var node = FS.lookupNode(dir, name);

			return ERRNO_CODES.EEXIST;
		}
		catch (e) {}

		return FS.nodePermissions(dir, 'wx');
	}),

	mayDelete: (function(dir, name, isdir) {
		var node;

		try {
			node = FS.lookupNode(dir, name);
		}
		catch (e) {
			return e.errno;
		}

		var err = FS.nodePermissions(dir, 'wx');

		if (err) { return err; }

		if (isdir) {
			if (!FS.isDir(node.mode)) {
				return ERRNO_CODES.ENOTDIR;
			}

			if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
				return ERRNO_CODES.EBUSY;
			}
		}
		else {
			if (FS.isDir(node.mode)) {
				return ERRNO_CODES.EISDIR;
			}
		}

		return 0;
	}),

	mayOpen: (function(node, flags) {
		if (!node) {
			return ERRNO_CODES.ENOENT;
		}

		if (FS.isLink(node.mode)) {
			return ERRNO_CODES.ELOOP;
		}
		else if (FS.isDir(node.mode)) {
			if (FS.flagsToPermissionString(flags) !== 'r' || flags & 512) {
				return ERRNO_CODES.EISDIR;
			}
		}

		return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
	}),

	MAX_OPEN_FDS: 4096,

	nextfd: (function(fd_start, fd_end) {
		fd_start = fd_start || 0;
		fd_end 	 = fd_end 	|| FS.MAX_OPEN_FDS;

		for (var fd = fd_start; fd <= fd_end; fd++) {
			if (!FS.streams[fd]) {
				return fd;
			}
		}

		throw new FS.ErrnoError(ERRNO_CODES.EMFILE);
	}),

	getStream: (function(fd) {
		return FS.streams[fd];
	}),

	createStream: (function(stream, fd_start, fd_end) {
		if (!FS.FSStream) {
			FS.FSStream = (function() {});
			FS.FSStream.prototype = {};

			Object.defineProperties(FS.FSStream.prototype, {
				object: {
					get: (function() {
						return this.node;
					}),
					set: (function(val) {
						this.node = val;
					})
				},
				isRead: {
					get: (function() {
						return (this.flags & 2097155) !== 1;
					})
				},
				isWrite: {
					get: (function() {
						return (this.flags & 2097155) !== 0;
					})
				},
				isAppend: {
					get: (function() {
						return this.flags & 1024;
					})
				}
			});
		}

		var newStream = new FS.FSStream;

		for (var p in stream) {
			newStream[p] = stream[p];
		}

		stream = newStream;

		var fd = FS.nextfd(fd_start, fd_end);

		stream.fd 		 = fd;
		FS.streams[fd] = stream;

		return stream;
	}),

	closeStream: (function(fd) {
		FS.streams[fd] = null;
	}),

	chrdev_stream_ops: {
		open: (function(stream) {
			var device = FS.getDevice(stream.node.rdev);

			stream.stream_ops = device.stream_ops;

			if (stream.stream_ops.open) {
				stream.stream_ops.open(stream);
			}
		}),

		llseek: (function() {
			throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
		})
	},

	major: (function(dev) {
		return dev >> 8;
	}),

	minor: (function(dev) {
		return dev & 255;
	}),

	makedev: (function(ma, mi) {
		return ma << 8 | mi;
	}),

	registerDevice: (function(dev, ops) {
		FS.devices[dev] = {stream_ops: ops};
	}),

	getDevice: (function(dev) {
		return FS.devices[dev];
	}),

	getMounts: (function(mount) {
		var mounts = [];
		var check  = [mount];

		while (check.length) {
			var m = check.pop();

			mounts.push(m);
			check.push.apply(check, m.mounts);
		}

		return mounts;
	}),

	syncfs: (function(populate, callback) {
		if (typeof populate === 'function') {
			callback = populate;
			populate = false;
		}

		FS.syncFSRequests++;

		if (FS.syncFSRequests > 1) {
			console.log('warning: ' + FS.syncFSRequests + ' FS.syncfs operations in flight at once, probably just doing extra work');
		}

		var mounts 		= FS.getMounts(FS.root.mount);
		var completed = 0;

		function doCallback(err) {
			assert(FS.syncFSRequests > 0);

			FS.syncFSRequests--;

			return callback(err);
		}

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

		mounts.forEach((function(mount) {
			if (!mount.type.syncfs) {
				return done(null);
			}

			mount.type.syncfs(mount, populate, done);
		}));
	}),

	mount: (function(type, opts, mountpoint) {
		var root 	 = mountpoint === '/';
		var pseudo = !mountpoint;
		var node;

		if (root && FS.root) {
			throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
		}
		else if (!root && !pseudo) {
			var lookup = FS.lookupPath(mountpoint, {follow_mount: false});

			mountpoint = lookup.path;
			node = lookup.node;

			if (FS.isMountpoint(node)) {
				throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
			}

			if (!FS.isDir(node.mode)) {
				throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
			}
		}

		var mount = {
			type: 			type, 
			opts: 			opts, 
			mountpoint: mountpoint, 
			mounts: 		[]
		};

		var mountRoot = type.mount(mount);

		mountRoot.mount = mount;
		mount.root 			= mountRoot;

		if (root) {
			FS.root = mountRoot;
		}
		else if (node) {
			node.mounted = mount;

			if (node.mount) {
				node.mount.mounts.push(mount);
			}
		}

		return mountRoot;
	}),

	unmount: (function(mountpoint) {
		var lookup = FS.lookupPath(mountpoint, {follow_mount: false});

		if (!FS.isMountpoint(lookup.node)) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
		}

		var node 	 = lookup.node;
		var mount  = node.mounted;
		var mounts = FS.getMounts(mount);

		Object.keys(FS.nameTable).forEach((function(hash) {
			var current = FS.nameTable[hash];

			while (current) {
				var next = current.name_next;

				if (mounts.indexOf(current.mount) !== -1) {
					FS.destroyNode(current);
				}

				current = next;
			}
		}));

		node.mounted = null;

		var idx = node.mount.mounts.indexOf(mount);

		assert(idx !== -1);

		node.mount.mounts.splice(idx, 1);
	}),

	lookup: (function(parent, name) {
		return parent.node_ops.lookup(parent, name);
	}),

	mknod: (function(path, mode, dev) {
		var lookup = FS.lookupPath(path, {parent: true});
		var parent = lookup.node;
		var name 	 = PATH.basename(path);

		if (!name || name === '.' || name === '..') {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
		}

		var err = FS.mayCreate(parent, name);

		if (err) {
			throw new FS.ErrnoError(err);
		}

		if (!parent.node_ops.mknod) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM);
		}

		return parent.node_ops.mknod(parent, name, mode, dev);
	}),

	create: (function(path, mode) {
		mode = mode !== undefined ? mode : 438;
		mode &= 4095;
		mode |= 32768;

		return FS.mknod(path, mode, 0);
	}),

	mkdir: (function(path, mode) {
		mode = mode !== undefined ? mode : 511;
		mode &= 511 | 512;
		mode |= 16384;

		return FS.mknod(path, mode, 0);
	}),

	mkdirTree: (function(path, mode) {
		var dirs = path.split('/');
		var d 	 = '';

		for (var i = 0; i < dirs.length; ++i) {
			if (!dirs[i]) { continue; }

			d += '/' + dirs[i];

			try {
				FS.mkdir(d, mode);
			}
			catch (e) {
				if (e.errno != ERRNO_CODES.EEXIST) { throw e; }
			}
		}
	}),

	mkdev: (function(path, mode, dev) {
		if (typeof dev === 'undefined') {
			dev  = mode;
			mode = 438;
		}

		mode |= 8192;

		return FS.mknod(path, mode, dev);
	}),

	symlink: (function(oldpath, newpath) {
		if (!PATH.resolve(oldpath)) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
		}

		var lookup = FS.lookupPath(newpath, {parent: true});
		var parent = lookup.node;

		if (!parent) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
		}

		var newname = PATH.basename(newpath);
		var err = FS.mayCreate(parent, newname);

		if (err) {
			throw new FS.ErrnoError(err);
		}

		if (!parent.node_ops.symlink) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM);
		}

		return parent.node_ops.symlink(parent, newname, oldpath);
	}),

	rename: (function(old_path, new_path) {
		var old_dirname = PATH.dirname(old_path);
		var new_dirname = PATH.dirname(new_path);
		var old_name 		= PATH.basename(old_path);
		var new_name 		= PATH.basename(new_path);

		var lookup;
		var old_dir;
		var new_dir;

		try {
			lookup 	= FS.lookupPath(old_path, {parent: true});
			old_dir = lookup.node;
			lookup 	= FS.lookupPath(new_path, {parent: true});
			new_dir = lookup.node;
		}
		catch (e) {
			throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
		}

		if (!old_dir || !new_dir) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
		}

		if (old_dir.mount !== new_dir.mount) {
			throw new FS.ErrnoError(ERRNO_CODES.EXDEV);
		}

		var old_node = FS.lookupNode(old_dir, old_name);
		var relative = PATH.relative(old_path, new_dirname);

		if (relative.charAt(0) !== '.') {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
		}

		relative = PATH.relative(new_path, old_dirname);

		if (relative.charAt(0) !== '.') {
			throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
		}

		var new_node;

		try {
			new_node = FS.lookupNode(new_dir, new_name);
		}
		catch (e) {}

		if (old_node === new_node) { return; }

		var isdir = FS.isDir(old_node.mode);
		var err 	= FS.mayDelete(old_dir, old_name, isdir);

		if (err) {
			throw new FS.ErrnoError(err);
		}

		err = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);

		if (err) {
			throw new FS.ErrnoError(err);
		}

		if (!old_dir.node_ops.rename) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM);
		}

		if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
			throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
		}

		if (new_dir !== old_dir) {
			err = FS.nodePermissions(old_dir, 'w');

			if (err) {
				throw new FS.ErrnoError(err);
			}
		}

		try {
			if (FS.trackingDelegate['willMovePath']) {
				FS.trackingDelegate['willMovePath'](old_path, new_path);
			}
		}
		catch (e) {
			console.log("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
		}

		FS.hashRemoveNode(old_node);

		try {
			old_dir.node_ops.rename(old_node, new_dir, new_name);
		}
		catch (e) {
			throw e;
		}
		finally {
			FS.hashAddNode(old_node);
		}

		try {
			if (FS.trackingDelegate['onMovePath']) {
				FS.trackingDelegate['onMovePath'](old_path, new_path);
			}
		}
		catch (e) {
			console.log("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
		}
	}),

	rmdir: (function(path) {
		var lookup = FS.lookupPath(path, {parent: true});
		var parent = lookup.node;
		var name 	 = PATH.basename(path);
		var node 	 = FS.lookupNode(parent, name);
		var err 	 = FS.mayDelete(parent, name, true);

		if (err) {
			throw new FS.ErrnoError(err);
		}

		if (!parent.node_ops.rmdir) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM);
		}

		if (FS.isMountpoint(node)) {
			throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
		}

		try {
			if (FS.trackingDelegate['willDeletePath']) {
				FS.trackingDelegate['willDeletePath'](path);
			}
		}
		catch (e) {
			console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message);
		}

		parent.node_ops.rmdir(parent, name);
		FS.destroyNode(node);

		try {
			if (FS.trackingDelegate['onDeletePath']) {
				FS.trackingDelegate['onDeletePath'](path);
			}
		}
		catch (e) {
			console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message);
		}
	}),

	readdir: (function(path) {
		var lookup = FS.lookupPath(path, {follow: true});
		var node 	 = lookup.node;

		if (!node.node_ops.readdir) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
		}

		return node.node_ops.readdir(node);
	}),

	unlink: (function(path) {
		var lookup = FS.lookupPath(path, {parent: true});
		var parent = lookup.node;
		var name 	 = PATH.basename(path);
		var node 	 = FS.lookupNode(parent, name);
		var err 	 = FS.mayDelete(parent, name, false);

		if (err) {
			throw new FS.ErrnoError(err);
		}

		if (!parent.node_ops.unlink) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM);
		}

		if (FS.isMountpoint(node)) {
			throw new FS.ErrnoError(ERRNO_CODES.EBUSY);
		}

		try {
			if (FS.trackingDelegate['willDeletePath']) {
				FS.trackingDelegate['willDeletePath'](path);
			}
		}
		catch (e) {
			console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message);
		}

		parent.node_ops.unlink(parent, name);

		FS.destroyNode(node);

		try {
			if (FS.trackingDelegate['onDeletePath']) {
				FS.trackingDelegate['onDeletePath'](path);
			}
		}
		catch (e) {
			console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message);
		}
	}),

	readlink: (function(path) {
		var lookup = FS.lookupPath(path);
		var link 	 = lookup.node;

		if (!link) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
		}

		if (!link.node_ops.readlink) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
		}

		return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
	}),

	stat: (function(path, dontFollow) {
		var lookup = FS.lookupPath(path, {follow: !dontFollow});
		var node 	 = lookup.node;

		if (!node) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
		}

		if (!node.node_ops.getattr) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM);
		}

		return node.node_ops.getattr(node);
	}),

	lstat: (function(path) {
		return FS.stat(path, true);
	}),

	chmod: (function(path, mode, dontFollow) {
		var node;

		if (typeof path === 'string') {
			var lookup = FS.lookupPath(path, {follow: !dontFollow});

			node = lookup.node;
		}
		else {
			node = path;
		}

		if (!node.node_ops.setattr) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM);
		}

		node.node_ops.setattr(node, {
			mode: 		 mode & 4095 | node.mode & ~4095, 
			timestamp: Date.now()
		});
	}),

	lchmod: (function(path, mode) {
		FS.chmod(path, mode, true);
	}),

	fchmod: (function(fd, mode) {
		var stream = FS.getStream(fd);

		if (!stream) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF);
		}

		FS.chmod(stream.node, mode);
	}),

	chown: (function(path, uid, gid, dontFollow) {
		var node;

		if (typeof path === 'string') {
			var lookup = FS.lookupPath(path, {follow: !dontFollow});

			node = lookup.node;
		}
		else {
			node = path;
		}

		if (!node.node_ops.setattr) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM);
		}

		node.node_ops.setattr(node, {timestamp: Date.now()});
	}),

	lchown: (function(path, uid, gid) {
		FS.chown(path, uid, gid, true);
	}),

	fchown: (function(fd, uid, gid) {
		var stream = FS.getStream(fd);

		if (!stream) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF);
		}

		FS.chown(stream.node, uid, gid);
	}),

	truncate: (function(path, len) {
		if (len < 0) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
		}

		var node;

		if (typeof path === 'string') {
			var lookup = FS.lookupPath(path, {follow: true});

			node = lookup.node;
		}
		else {
			node = path;
		}

		if (!node.node_ops.setattr) {
			throw new FS.ErrnoError(ERRNO_CODES.EPERM);
		}

		if (FS.isDir(node.mode)) {
			throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
		}

		if (!FS.isFile(node.mode)) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
		}

		var err = FS.nodePermissions(node, 'w');

		if (err) {
			throw new FS.ErrnoError(err);
		}

		node.node_ops.setattr(node, {size: len, timestamp: Date.now()});
	}),

	ftruncate: (function(fd, len) {
		var stream = FS.getStream(fd);

		if (!stream) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF);
		}

		if ((stream.flags & 2097155) === 0) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
		}

		FS.truncate(stream.node, len);
	}),

	utime: (function(path, atime, mtime) {
		var lookup = FS.lookupPath(path, {follow: true});
		var node 	 = lookup.node;

		node.node_ops.setattr(node, {timestamp: Math.max(atime, mtime)});
	}),

	open: (function(path, flags, mode, fd_start, fd_end) {
		if (path === '') {
			throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
		}

		flags = typeof flags === 'string' ? FS.modeStringToFlags(flags) : flags;
		mode  = typeof mode === 'undefined' ? 438 : mode;

		if (flags & 64) {
			mode = mode & 4095 | 32768;
		}
		else {
			mode = 0;
		}

		var node;

		if (typeof path === 'object') {
			node = path;
		}
		else {
			path = PATH.normalize(path);

			try {
				var lookup = FS.lookupPath(path, {follow: !(flags & 131072)});

				node = lookup.node;
			}
			catch (e) {}
		}

		var created = false;

		if (flags & 64) {
			if (node) {
				if (flags & 128) {
					throw new FS.ErrnoError(ERRNO_CODES.EEXIST);
				}
			}
			else {
				node 		= FS.mknod(path, mode, 0);
				created = true;
			}
		}

		if (!node) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
		}

		if (FS.isChrdev(node.mode)) {
			flags &= ~512;
		}

		if (flags & 65536 && !FS.isDir(node.mode)) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
		}

		if (!created) {
			var err = FS.mayOpen(node, flags);

			if (err) {
				throw new FS.ErrnoError(err);
			}
		}

		if (flags & 512) {
			FS.truncate(node, 0);
		}

		flags &= ~(128 | 512);

		var stream = FS.createStream(
			{
				node: 			node,
				path: 			FS.getPath(node),
				flags: 			flags,
				seekable: 	true,
				position: 	0,
				stream_ops: node.stream_ops,
				ungotten: 	[],
				error: 			false
			},
			fd_start,
			fd_end
		);

		if (stream.stream_ops.open) {
			stream.stream_ops.open(stream);
		}

		try {
			if (FS.trackingDelegate['onOpenFile']) {
				var trackingFlags = 0;

				if ((flags & 2097155) !== 1) {
					trackingFlags |= FS.tracking.openFlags.READ;
				}

				if ((flags & 2097155) !== 0) {
					trackingFlags |= FS.tracking.openFlags.WRITE;
				}

				FS.trackingDelegate['onOpenFile'](path, trackingFlags);
			}
		}
		catch (e) {
			console.log("FS.trackingDelegate['onOpenFile']('" + path + "', flags) threw an exception: " + e.message);
		}

		return stream;
	}),

	close: (function(stream) {
		if (FS.isClosed(stream)) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF);
		}

		if (stream.getdents) {
			stream.getdents = null;
		}

		try {
			if (stream.stream_ops.close) {
				stream.stream_ops.close(stream);
			}
		}
		catch (e) {
			throw e;
		}
		finally {
			FS.closeStream(stream.fd);
		}

		stream.fd = null;
	}),

	isClosed: (function(stream) {
		return stream.fd === null;
	}),

	llseek: (function(stream, offset, whence) {
		if (FS.isClosed(stream)) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF);
		}

		if (!stream.seekable || !stream.stream_ops.llseek) {
			throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
		}

		stream.position = stream.stream_ops.llseek(stream, offset, whence);
		stream.ungotten = [];

		return stream.position;
	}),

	read: (function(stream, buffer, offset, length, position) {
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

		var seeking = typeof position !== 'undefined';

		if (!seeking) {
			position = stream.position;
		}
		else if (!stream.seekable) {
			throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
		}

		var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);

		if (!seeking) {
			stream.position += bytesRead;
		}

		return bytesRead;
	}),

	write: (function(stream, buffer, offset, length, position, canOwn) {
		if (length < 0 || position < 0) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
		}

		if (FS.isClosed(stream)) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF);
		}

		if ((stream.flags & 2097155) === 0) {
			throw new FS.ErrnoError(ERRNO_CODES.EBADF);
		}

		if (FS.isDir(stream.node.mode)) {
			throw new FS.ErrnoError(ERRNO_CODES.EISDIR);
		}

		if (!stream.stream_ops.write) {
			throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
		}

		if (stream.flags & 1024) {
			FS.llseek(stream, 0, 2);
		}

		var seeking = typeof position !== 'undefined';

		if (!seeking) {
			position = stream.position;
		}
		else if (!stream.seekable) {
			throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
		}

		var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);

		if (!seeking) {
			stream.position += bytesWritten;
		}

		try {
			if (stream.path && FS.trackingDelegate['onWriteToFile']) {
				FS.trackingDelegate['onWriteToFile'](stream.path);
			}
		}
		catch (e) {
			console.log("FS.trackingDelegate['onWriteToFile']('" + path + "') threw an exception: " + e.message);
		}

		return bytesWritten;
	}),

	allocate: (function(stream, offset, length) {
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
	}),

	mmap: (function(stream, buffer, offset, length, position, prot, flags) {
		if ((stream.flags & 2097155) === 1) {
			throw new FS.ErrnoError(ERRNO_CODES.EACCES);
		}

		if (!stream.stream_ops.mmap) {
			throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
		}

		return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags);
	}),

	msync: (function(stream, buffer, offset, length, mmapFlags) {
		if (!stream || !stream.stream_ops.msync) {
			return 0;
		}

		return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
	}),

	munmap: (function(stream) {
		return 0;
	}),

	ioctl: (function(stream, cmd, arg) {
		if (!stream.stream_ops.ioctl) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOTTY);
		}

		return stream.stream_ops.ioctl(stream, cmd, arg);
	}),

	readFile: (function(path, opts) {
		opts 					= opts 					|| {};
		opts.flags 		= opts.flags 		|| 'r';
		opts.encoding = opts.encoding || 'binary';

		if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
			throw new Error('Invalid encoding type "' + opts.encoding + '"');
		}

		var ret;
		var stream = FS.open(path, opts.flags);
		var stat 	 = FS.stat(path);
		var length = stat.size;
		var buf 	 = new Uint8Array(length);

		FS.read(stream, buf, 0, length, 0);

		if (opts.encoding === 'utf8') {
			ret = UTF8ArrayToString(buf, 0);
		}
		else if (opts.encoding === 'binary') {
			ret = buf;
		}

		FS.close(stream);

		return ret;
	}),

	writeFile: (function(path, data, opts) {
		opts 			 = opts 			|| {};
		opts.flags = opts.flags || 'w';

		var stream = FS.open(path, opts.flags, opts.mode);

		if (typeof data === 'string') {
			var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
			var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);

			FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
		}
		else if (ArrayBuffer.isView(data)) {
			FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
		}
		else {
			throw new Error('Unsupported data type');
		}

		FS.close(stream);
	}),

	cwd: (function() {
		return FS.currentPath;
	}),

	chdir: (function(path) {
		var lookup = FS.lookupPath(path, {follow: true});

		if (lookup.node === null) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
		}

		if (!FS.isDir(lookup.node.mode)) {
			throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
		}

		var err = FS.nodePermissions(lookup.node, 'x');

		if (err) {
			throw new FS.ErrnoError(err);
		}

		FS.currentPath = lookup.path;
	}),

	createDefaultDirectories: (function() {
		FS.mkdir('/tmp');
		FS.mkdir('/home');
		FS.mkdir('/home/web_user');
	}),

	createDefaultDevices: (function() {
		FS.mkdir('/dev');
		FS.registerDevice(FS.makedev(1, 3), {
			read:  (function() { return 0; }),
			write: (function(stream, buffer, offset, length,pos) { 
				return length; 
			})
		});
		FS.mkdev('/dev/null', FS.makedev(1, 3));
		TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
		TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
		FS.mkdev('/dev/tty',  FS.makedev(5, 0));
		FS.mkdev('/dev/tty1', FS.makedev(6, 0));

		var random_device;

		if (typeof crypto !== 'undefined') {
			var randomBuffer = new Uint8Array(1);

			random_device = (function() {
				crypto.getRandomValues(randomBuffer);

				return randomBuffer[0];
			});
		}
		else if (ENVIRONMENT_IS_NODE) {
			random_device = (function() {
				return require('crypto')['randomBytes'](1)[0];
			});
		}
		else {
			random_device = (function() {
				return Math.random() * 256 | 0;
			});
		}

		FS.createDevice('/dev', 'random', random_device);
		FS.createDevice('/dev', 'urandom', random_device);
		FS.mkdir('/dev/shm');
		FS.mkdir('/dev/shm/tmp');
	}),

	createSpecialDirectories: (function() {
		FS.mkdir('/proc');
		FS.mkdir('/proc/self');
		FS.mkdir('/proc/self/fd');
		FS.mount(
			{
				mount: (function() {
					var node = FS.createNode('/proc/self', 'fd', 16384 | 511, 73);

					node.node_ops = {
						lookup: (function(parent, name) {
							var fd 		 = +name;
							var stream = FS.getStream(fd);

							if (!stream) {
								throw new FS.ErrnoError(ERRNO_CODES.EBADF);
							}

							var ret = {
								parent: null,
								mount:  {mountpoint: 'fake'},
								node_ops: {
									readlink: (function() {
										return stream.path;
									})
								}
							};

							ret.parent = ret;

							return ret;
						})
					};

					return node;
				})
			},
			{},
			'/proc/self/fd'
		);
	}),

	createStandardStreams: (function() {
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

		var stdin = FS.open('/dev/stdin', 'r');

		assert(stdin.fd === 0, 'invalid handle for stdin (' + stdin.fd + ')');

		var stdout = FS.open('/dev/stdout', 'w');

		assert(stdout.fd === 1, 'invalid handle for stdout (' + stdout.fd + ')');

		var stderr = FS.open('/dev/stderr', 'w');

		assert(stderr.fd === 2, 'invalid handle for stderr (' + stderr.fd + ')');
	}),

	ensureErrnoError: (function() {
		if (FS.ErrnoError) { return; }

		FS.ErrnoError = ErrnoError;

		[ERRNO_CODES.ENOENT].forEach((function(code) {
			FS.genericErrors[code] = new FS.ErrnoError(code);
			FS.genericErrors[code].stack = '<generic error, no stack>'
		}));
	}),

	staticInit: (function() {
		FS.ensureErrnoError();
		FS.nameTable = new Array(4096);
		FS.mount(MEMFS, {}, '/');
		FS.createDefaultDirectories();
		FS.createDefaultDevices();
		FS.createSpecialDirectories();
		FS.filesystems = {
			'MEMFS': MEMFS,
			'IDBFS': IDBFS,
			'NODEFS': NODEFS,
			'WORKERFS': WORKERFS
		};
	}),

	init: (function(input, output, error) {
		assert(!FS.init.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');

		FS.init.initialized = true;
		FS.ensureErrnoError();
		Module['stdin']  = input  || Module['stdin'];
		Module['stdout'] = output || Module['stdout'];
		Module['stderr'] = error  || Module['stderr'];
		FS.createStandardStreams();
	}),

	quit: (function() {
		FS.init.initialized = false;

		for (var i = 0; i < FS.streams.length; i++) {
			var stream = FS.streams[i];

			if (!stream) {
				continue;
			}

			FS.close(stream);
		}
	}),

	getMode: (function(canRead, canWrite) {
		var mode = 0;

		if (canRead) {
			mode |= 292 | 73;
		}

		if (canWrite) {
			mode |= 146;
		}

		return mode;
	}),

	joinPath: (function(parts, forceRelative) {
		var path = PATH.join.apply(null, parts);

		if (forceRelative && path[0] == '/') {
			path = path.substr(1);
		}

		return path;
	}),

	absolutePath: (function(relative, base) {
		return PATH.resolve(base, relative);
	}),

	standardizePath: (function(path) {
		return PATH.normalize(path);
	}),

	findObject: (function(path, dontResolveLastLink) {
		var ret = FS.analyzePath(path, dontResolveLastLink);

		if (ret.exists) {
			return ret.object;
		}
		else {
			___setErrNo(ret.error);

			return null;
		}
	}),

	analyzePath: (function(path, dontResolveLastLink) {
		try {
			var lookup = FS.lookupPath(path, {follow: !dontResolveLastLink});

			path = lookup.path;
		}
		catch (e) {}

		var ret = {
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
			var lookup = FS.lookupPath(path, {parent: true});

			ret.parentExists = true;
			ret.parentPath 	 = lookup.path;
			ret.parentObject = lookup.node;
			ret.name 				 = PATH.basename(path);
			lookup 					 = FS.lookupPath(path, {follow: !dontResolveLastLink});
			ret.exists 			 = true;
			ret.path 				 = lookup.path;
			ret.object 			 = lookup.node;
			ret.name 				 = lookup.node.name;
			ret.isRoot 			 = lookup.path === '/'
		}
		catch (e) {
			ret.error = e.errno;
		}

		return ret;
	}),

	createFolder: (function(parent, name, canRead, canWrite) {
		var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
		var mode = FS.getMode(canRead, canWrite);

		return FS.mkdir(path, mode);
	}),

	createPath: (function(parent, path, canRead, canWrite) {
		parent = typeof parent === 'string' ? parent : FS.getPath(parent);

		var parts = path.split('/').reverse();

		while (parts.length) {
			var part = parts.pop();

			if (!part) { continue; }

			var current = PATH.join2(parent, part);

			try {
				FS.mkdir(current);
			}
			catch (e) {}

			parent = current;
		}

		return current;
	}),

	createFile: (function(parent, name, properties, canRead, canWrite) {
		var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
		var mode = FS.getMode(canRead, canWrite);

		return FS.create(path, mode);
	}),

	createDataFile: (function(parent, name, data, canRead, canWrite, canOwn) {
		var path = name ? 
			PATH.join2(typeof parent === 'string' ? 
				parent : 
				FS.getPath(parent), name) : 
			parent;

		var mode = FS.getMode(canRead, canWrite);
		var node = FS.create(path, mode);

		if (data) {
			if (typeof data === 'string') {
				var arr = new Array(data.length);

				for (var i = 0, len = data.length; i < len; ++i) {
					arr[i] = data.charCodeAt(i);
				}

				data = arr;
			}

			FS.chmod(node, mode | 146);

			var stream = FS.open(node, 'w');

			FS.write(stream, data, 0, data.length, 0, canOwn);
			FS.close(stream);
			FS.chmod(node, mode);
		}

		return node;
	}),

	createDevice: (function(parent, name, input, output) {
		var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
		var mode = FS.getMode(!!input, !!output);

		if (!FS.createDevice.major) {
			FS.createDevice.major = 64;
		}

		var dev = FS.makedev(FS.createDevice.major++, 0);

		FS.registerDevice(dev, {
			open: (function(stream) {
				stream.seekable = false;
			}),

			close: (function(stream) {
				if (output && output.buffer && output.buffer.length) {
					output(10);
				}
			}),

			read: (function(stream, buffer, offset, length, pos) {
				var bytesRead = 0;

				for (var i = 0; i < length; i++) {
					var result;

					try {
						result = input();
					}
					catch (e) {
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
			}),

			write: (function(stream, buffer, offset, length, pos) {
				for (var i = 0; i < length; i++) {
					try {
						output(buffer[offset + i]);
					}
					catch (e) {
						throw new FS.ErrnoError(ERRNO_CODES.EIO);
					}
				}

				if (length) {
					stream.node.timestamp = Date.now();
				}

				return i;
			})
		});

		return FS.mkdev(path, mode, dev);
	}),

	createLink: (function(parent, name, target, canRead, canWrite) {
		var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);

		return FS.symlink(target,path);
	}),

	forceLoadFile: (function(obj) {
		if (obj.isDevice || obj.isFolder || obj.link || obj.contents) { 
			return true; 
		}

		var success = true;

		if (typeof XMLHttpRequest !== 'undefined') {
			throw new Error('Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.');
		}
		else if (Module['read']) {
			try {
				obj.contents  = intArrayFromString(Module['read'](obj.url), true);
				obj.usedBytes = obj.contents.length;
			}
			catch (e) {
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
	}),

	createLazyFile: (function(parent, name, url, canRead, canWrite) {
		function LazyUint8Array() {
			this.lengthKnown = false;
			this.chunks 		 = [];
		}

		LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
			if (idx > this.length - 1 || idx < 0) {
				return undefined;
			}

			var chunkOffset = idx % this.chunkSize;
			var chunkNum 		= idx / this.chunkSize | 0;

			return this.getter(chunkNum)[chunkOffset];
		};

		LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
			this.getter = getter;
		};

		LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
			var xhr = new XMLHttpRequest;

			xhr.open('HEAD', url, false);
			xhr.send(null);

			if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) {
				throw new Error('Could not load ' + url + '. Status: ' + xhr.status);
			}

			var datalength = Number(xhr.getResponseHeader('Content-length'));
			var header;
			var hasByteServing = (header = xhr.getResponseHeader('Accept-Ranges')) 		&& header === 'bytes';
			var usesGzip 			 = (header = xhr.getResponseHeader('Content-Encoding')) && header === 'gzip';
			var chunkSize 		 = 1024 * 1024;

			if (!hasByteServing) {
				chunkSize = datalength;
			}

			var doXHR = (function(from, to) {
				if (from > to) {
					throw new Error('invalid range (' + from + ', ' + to + ') or no bytes requested!');
				}

				if (to > datalength - 1) {
					throw new Error('only ' + datalength + ' bytes available! programmer error!');
				}

				var xhr = new XMLHttpRequest;

				xhr.open('GET', url, false);

				if (datalength !== chunkSize) {
					xhr.setRequestHeader('Range', 'bytes=' + from + '-' + to);
				}

				if (typeof Uint8Array != 'undefined') {
					xhr.responseType = 'arraybuffer';
				}

				if (xhr.overrideMimeType) {
					xhr.overrideMimeType('text/plain; charset=x-user-defined');
				}

				xhr.send(null);

				if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) {
					throw new Error('Could not load ' + url + '. Status: ' + xhr.status);
				}

				if (xhr.response !== undefined) {
					return new Uint8Array(xhr.response || []);
				}
				else {
					return intArrayFromString(xhr.responseText || '', true);
				}
			});

			var lazyArray = this;

			lazyArray.setDataGetter((function(chunkNum) {
				var start = chunkNum * chunkSize;
				var end 	= (chunkNum + 1) * chunkSize - 1;

				end = Math.min(end, datalength - 1);

				if (typeof lazyArray.chunks[chunkNum] === 'undefined') {
					lazyArray.chunks[chunkNum] = doXHR(start, end);
				}

				if (typeof lazyArray.chunks[chunkNum] === 'undefined') {
					throw new Error('doXHR failed!');
				}

				return lazyArray.chunks[chunkNum];
			}));

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

		if (typeof XMLHttpRequest !== 'undefined') {
			if (!ENVIRONMENT_IS_WORKER) {
				throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
			}

			var lazyArray = new LazyUint8Array;

			Object.defineProperties(lazyArray, {
				length: {
					get: (function() {
						if (!this.lengthKnown) {
							this.cacheLength();
						}

						return this._length;
					})
				},
				chunkSize: {
					get: (function() {
						if (!this.lengthKnown) {
							this.cacheLength();
						}

						return this._chunkSize;
					})
				}
			});

			var properties = {isDevice: false, contents: lazyArray};
		}
		else {
			var properties = {isDevice: false, url: url};
		}

		var node = FS.createFile(parent, name, properties, canRead, canWrite);

		if (properties.contents) {
			node.contents = properties.contents;
		}
		else if (properties.url) {
			node.contents = null;
			node.url 			= properties.url;
		}

		Object.defineProperties(node, {
			usedBytes: {
				get: (function() {
					return this.contents.length;
				})
			}
		});

		var stream_ops = {};
		var keys 			 = Object.keys(node.stream_ops);

		keys.forEach((function(key) {
			var fn = node.stream_ops[key];

			stream_ops[key] = function forceLoadLazyFile() {
				if (!FS.forceLoadFile(node)) {
					throw new FS.ErrnoError(ERRNO_CODES.EIO);
				}

				return fn.apply(null, arguments);
			};
		}));

		stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
			if (!FS.forceLoadFile(node)) {
				throw new FS.ErrnoError(ERRNO_CODES.EIO);
			}

			var contents = stream.node.contents;

			if (position >= contents.length) { return 0; }

			var size = Math.min(contents.length - position, length);

			assert(size >= 0);

			if (contents.slice) {
				for (var i = 0; i < size; i++) {
					buffer[offset + i] = contents[position + i];
				}
			}
			else {
				for (var i = 0; i < size; i++) {
					buffer[offset + i] = contents.get(position + i);
				}
			}

			return size;
		};

		node.stream_ops = stream_ops;

		return node;
	}),

	createPreloadedFile: (function(parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
		Browser.init();

		function getUniqueRunDependency(id) {
			return id;
		}

		var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
		var dep 		 = getUniqueRunDependency('cp ' + fullname);

		function processData(byteArray) {
			function finish(byteArray) {
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
			}

			var handled = false;

			Module['preloadPlugins'].forEach((function(plugin) {
				if (handled) { return; }

				if (plugin['canHandle'](fullname)) {
					plugin['handle'](byteArray, fullname, finish, (function() {
						if (onerror) {
							onerror();
						}

						removeRunDependency(dep);
					}));

					handled = true;
				}
			}));

			if (!handled) {
				finish(byteArray);
			}
		}

		addRunDependency(dep);

		if (typeof url === 'string') {
			Browser.asyncLoad(
				url, 
				(function(byteArray) {
					processData(byteArray);
				}),
				onerror
			);
		}
		else {
			processData(url);
		}
	}),

	indexedDB: (function() {
		return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
	}),

	DB_NAME: (function() {
		return 'EM_FS_' + window.location.pathname;
	}),

	DB_VERSION: 		20,
	DB_STORE_NAME: 'FILE_DATA',

	saveFilesToDB: (function(paths, onload, onerror) {
		onload 	= onload 	|| (function() {});
		onerror = onerror || (function() {});

		var indexedDB = FS.indexedDB();

		try {
			var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
		}
		catch (e) {
			return onerror(e);
		}

		openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
			console.log('creating db');

			var db = openRequest.result;

			db.createObjectStore(FS.DB_STORE_NAME);
		};

		openRequest.onsuccess = function openRequest_onsuccess() {
			var db 					= openRequest.result;
			var transaction = db.transaction([FS.DB_STORE_NAME], 'readwrite');
			var files 			= transaction.objectStore(FS.DB_STORE_NAME);
			var ok 					= 0;
			var fail 				= 0;
			var total 			= paths.length;

			function finish() {
				if (fail == 0) {
					onload();
				}
				else {
					onerror();
				}
			}

			paths.forEach((function(path) {
				var putRequest = files.put(FS.analyzePath(path).object.contents, path);

				putRequest.onsuccess = function putRequest_onsuccess() {
					ok++;

					if (ok + fail == total) {
						finish();
					}
				};

				putRequest.onerror = function putRequest_onerror() {
					fail++;

					if (ok + fail == total) {
						finish();
					}
				};
			}));

			transaction.onerror = onerror;
		};

		openRequest.onerror = onerror;
	}),

	loadFilesFromDB: (function(paths, onload, onerror) {
		onload 	= onload 	|| (function() {});
		onerror = onerror || (function() {});

		var indexedDB = FS.indexedDB();

		try {
			var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
		}
		catch (e) {
			return onerror(e);
		}

		openRequest.onupgradeneeded = onerror;
		openRequest.onsuccess = function openRequest_onsuccess() {
			var db = openRequest.result;

			try {
				var transaction = db.transaction([FS.DB_STORE_NAME], 'readonly');
			}
			catch (e) {
				onerror(e);
				return;
			}

			var files = transaction.objectStore(FS.DB_STORE_NAME);
			var ok 		= 0;
			var fail 	= 0;
			var total = paths.length;

			function finish() {
				if (fail == 0) {
					onload();
				}
				else {
					onerror();
				}
			}

			paths.forEach((function(path) {
				var getRequest = files.get(path);

				getRequest.onsuccess = function getRequest_onsuccess() {
					if (FS.analyzePath(path).exists) {
						FS.unlink(path);
					}

					FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
					ok++;

					if (ok + fail == total) {
						finish();
					}
				};

				getRequest.onerror = function getRequest_onerror() {
					fail++;

					if (ok + fail == total) {
						finish();
					}
				};
			}));

			transaction.onerror = onerror;
		};

		openRequest.onerror = onerror;
	})
};


export default FS;
