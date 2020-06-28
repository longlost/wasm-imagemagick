

import {
	ERRNO_CODES
} from './constants.js';

import utils from './utils.js';
import PATH  from './path.js';

const MAX_OPEN_FDS 		 = 4096;
const streams 		 		 = [];
const trackingDelegate = {};

const tracking = {
	openFlags: {
		READ:  1,
		WRITE: 2
	}
};

let currentPath 			= '/';
let ignorePermissions = true;
let nextInode 				= 1;
let nameTable 				= new Array(4096);
let root 							= null;


const genericErrors = {};
const errorCode 	  = ERRNO_CODES.ENOENT;

genericErrors[errorCode] 			 = new utils.ErrnoError(errorCode);
genericErrors[errorCode].stack = '<generic error, no stack>';


const flagModes = {
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
};

const	modeStringToFlags = str => {
	const flags = flagModes[str];

	if (typeof flags === 'undefined') {
		throw new Error(`Unknown file open mode: ${str}`);
	}

	return flags;
};

const flagsToPermissionString = flag => {
	let perms = ['r', 'w', 'rw'][flag & 3];

	if (flag & 512) {
		perms += 'w';
	}

	return perms;
};

const cwd = () => currentPath;

const isBlkdev = mode => (mode & 61440) === 24576;

const isClosed = stream => stream.fd === null;

const isDir = mode => (mode & 61440) === 16384;

const isChrdev = mode => (mode & 61440) === 8192;

const isFIFO = mode => (mode & 61440) === 4096;

const isFile = mode => (mode & 61440) === 32768;

const isLink = mode => (mode & 61440) === 40960;

const isMountpoint = node => !!node.mounted;

const isRoot = node => node === node.parent;

const chrdev_stream_ops = {
	open(stream) {
		var device = utils.getDevice(stream.node.rdev);

		stream.stream_ops = device.stream_ops;

		if (stream.stream_ops.open) {
			stream.stream_ops.open(stream);
		}
	},

	llseek() {
		throw new utils.ErrnoError(ERRNO_CODES.ESPIPE);
	}
};


const FSNode = function(parent, name, mode, rdev) {
	if (!parent) {
		parent = this;
	}

	this.parent 		= parent;
	this.mount 			= parent.mount;
	this.mounted 		= null;
	this.id 				= nextInode++;
	this.name 			= name;
	this.mode 			= mode;
	this.node_ops 	= {};
	this.stream_ops = {};
	this.rdev 			= rdev;
};

FSNode.prototype = {};

const readMode  = 292 | 73;
const writeMode = 146;

Object.defineProperties(FSNode.prototype, {
	read: {
		get() {
			return (this.mode & readMode) === readMode;
		},

		set(val) {
			val ? this.mode |= readMode : this.mode &= ~readMode;
		}
	},

	write: {
		get() {
			return (this.mode & writeMode) === writeMode;
		},

		set(val) {
			val ? this.mode |= writeMode : this.mode &= ~writeMode;
		}
	},

	isFolder: {
		get() {
			return isDir(this.mode);
		}
	},

	isDevice: {
		get() {
			return isChrdev(this.mode);
		}
	}
});

const hashName = (parentid, name) => {
	let hash = 0;

	for (let i = 0; i < name.length; i++) {
		hash = (hash << 5) - hash + name.charCodeAt(i) | 0;
	}

	return (parentid + hash >>> 0) % nameTable.length;
};

const hashAddNode = node => {
	const hash = hashName(node.parent.id, node.name);

	node.name_next  = nameTable[hash];
	nameTable[hash] = node;
};

const createNode = (parent, name, mode, rdev) => {	
	const node = new FSNode(parent, name, mode, rdev);

	hashAddNode(node);

	return node;
};

const nodePermissions = (node, perms) => {
	if (ignorePermissions) {
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
};

const mayLookup = dir => {
	const err = nodePermissions(dir, 'x');

	if (err) { return err; }

	if (!dir.node_ops.lookup) { return ERRNO_CODES.EACCES; }

	return 0;
};

const lookup = (parent, name) => parent.node_ops.lookup(parent, name);

const lookupNode = (parent, name) => {
	const err = mayLookup(parent);

	if (err) {
		throw new utils.ErrnoError(err, parent);
	}

	const hash = hashName(parent.id, name);

	for (let node = nameTable[hash]; node; node = node.name_next) {
		const nodeName = node.name;

		if (node.parent.id === parent.id && nodeName === name) {
			return node;
		}
	}

	return lookup(parent, name);
};

const getPath = node => {
	let path;

	while (true) {
		if (isRoot(node)) {
			const mount = node.mount.mountpoint;

			if (!path) { return mount; }

			return mount[mount.length - 1] !== '/' ? mount + '/' + path : mount + path;
		}

		path = path ? node.name + '/' + path : node.name;
		node = node.parent;
	}
};


// TODO:
//
// There is a circular dependency between 'lookupPath' and 'readlink'.
// Can this be resolved?
let readlink;

const defaults = {
	follow_mount:  true,
	recurse_count: 0
};

const lookupPath = (path, opts = {}) => {
	path = PATH.resolve(cwd(), path);

	if (!path) {
		return {path: '', node: null};
	}

	opts = {...defaults, ...opts};

	if (opts.recurse_count > 8) {
		throw new utils.ErrnoError(ERRNO_CODES.ELOOP);
	}

	const parts = PATH.normalizeArray(
		path.split('/').filter(p => !!p),
		false
	);

	const last 			 = parts.length - 1;
	let current 		 = root;
	let current_path = '/';

	for (var index = 0; index < parts.length; index++) {
		const islast = index === last;

		if (islast && opts.parent) {
			break;
		}

		current 		 = lookupNode(current, 			parts[index]);
		current_path = PATH.join2(current_path, parts[index]);

		if (isMountpoint(current)) {
			if (!islast || islast && opts.follow_mount) {
				current = current.mounted.root;
			}
		}

		if (!islast || opts.follow) {
			let count = 0;

			while (isLink(current.mode)) {
				const link = readlink(current_path);

				current_path = PATH.resolve(PATH.dirname(current_path), link);

				const lookup = lookupPath(current_path, {recurse_count: opts.recurse_count});

				current = lookup.node;

				if (count++ > 40) {
					throw new utils.ErrnoError(ERRNO_CODES.ELOOP);
				}
			}
		}
	}

	return {path: current_path, node: current};
};

// Circular dependency with 'lookupPath'.
readlink = path => {
	const {node: link} = lookupPath(path);

	if (!link) {
		throw new utils.ErrnoError(ERRNO_CODES.ENOENT);
	}

	if (!link.node_ops.readlink) {
		throw new utils.ErrnoError(ERRNO_CODES.EINVAL);
	}

	return PATH.resolve(getPath(link.parent), link.node_ops.readlink(link));
};

const readdir = path => {
	const {node} = FS.lookupPath(path, {follow: true});

	if (!node.node_ops.readdir) {
		throw new FS.utils.ErrnoError(ERRNO_CODES.ENOTDIR);
	}

	return node.node_ops.readdir(node);
};

const stat = (path, dontFollow) => {
	const {node} = lookupPath(path, {follow: !dontFollow});

	if (!node) {
		throw new utils.ErrnoError(ERRNO_CODES.ENOENT);
	}

	if (!node.node_ops.getattr) {
		throw new utils.ErrnoError(ERRNO_CODES.EPERM);
	}

	return node.node_ops.getattr(node);
};

const mayCreate = (dir, name) => {
	try {
		const node = lookupNode(dir, name);

		return ERRNO_CODES.EEXIST;
	}
	catch (_) {}

	return nodePermissions(dir, 'wx');
};

const mknod = (path, mode, dev) => {
	const {node: parent} = lookupPath(path, {parent: true});
	const name 	 				 = PATH.basename(path);

	if (!name || name === '.' || name === '..') {
		throw new utils.ErrnoError(ERRNO_CODES.EINVAL);
	}

	const error = mayCreate(parent, name);

	if (error) {
		throw new utils.ErrnoError(error);
	}

	if (!parent.node_ops.mknod) {
		throw new utils.ErrnoError(ERRNO_CODES.EPERM);
	}

	return parent.node_ops.mknod(parent, name, mode, dev);
};

const mkdir = (path, mode) => {
	mode = mode !== undefined ? mode : 511;
	mode &= 511 | 512;
	mode |= 16384;

	return mknod(path, mode, 0);
};

const mayOpen = (node, flags) => {
	if (!node) {
		return ERRNO_CODES.ENOENT;
	}

	if (isLink(node.mode)) {
		return ERRNO_CODES.ELOOP;
	}
	else if (isDir(node.mode)) {
		if (flagsToPermissionString(flags) !== 'r' || flags & 512) {
			return ERRNO_CODES.EISDIR;
		}
	}

	return nodePermissions(node, flagsToPermissionString(flags));
};

const truncate = (path, len) => {
	if (len < 0) {
		throw new utils.ErrnoError(ERRNO_CODES.EINVAL);
	}

	let node;

	if (typeof path === 'string') {
		const lookup = lookupPath(path, {follow: true});

		node = lookup.node;
	}
	else {
		node = path;
	}

	if (!node.node_ops.setattr) {
		throw new utils.ErrnoError(ERRNO_CODES.EPERM);
	}

	if (isDir(node.mode)) {
		throw new utils.ErrnoError(ERRNO_CODES.EISDIR);
	}

	if (!isFile(node.mode)) {
		throw new utils.ErrnoError(ERRNO_CODES.EINVAL);
	}

	const error = nodePermissions(node, 'w');

	if (error) {
		throw new utils.ErrnoError(error);
	}

	node.node_ops.setattr(node, {size: len, timestamp: Date.now()});
};

const nextfd = (fd_start, fd_end) => {
	fd_start = fd_start || 0;
	fd_end 	 = fd_end 	|| MAX_OPEN_FDS;

	for (let fd = fd_start; fd <= fd_end; fd++) {
		if (!streams[fd]) {
			return fd;
		}
	}

	throw new utils.ErrnoError(ERRNO_CODES.EMFILE);
};


const FSStream 		 = function() {};
FSStream.prototype = {};

Object.defineProperties(FSStream.prototype, {
	object: {
		get() {
			return this.node;
		},
		set(val) {
			this.node = val;
		}
	},
	isRead: {
		get() {
			return (this.flags & 2097155) !== 1;
		}
	},
	isWrite: {
		get() {
			return (this.flags & 2097155) !== 0;
		}
	},
	isAppend: {
		get() {
			return this.flags & 1024;
		}
	}
});

const createStream = (stream, fd_start, fd_end) => {	
	const newStream = new FSStream;

	for (const p in stream) {
		newStream[p] = stream[p];
	}

	stream = newStream;

	const fd = nextfd(fd_start, fd_end);

	stream.fd 	= fd;
	streams[fd] = stream;

	return stream;
};

const open = (path, flags, mode, fd_start, fd_end) => {
	if (path === '') {
		throw new utils.ErrnoError(ERRNO_CODES.ENOENT);
	}

	flags = typeof flags === 'string' ? modeStringToFlags(flags) : flags;
	mode  = typeof mode === 'undefined' ? 438 : mode;

	if (flags & 64) {
		mode = mode & 4095 | 32768;
	}
	else {
		mode = 0;
	}

	let node;

	if (typeof path === 'object') {
		node = path;
	}
	else {
		path = PATH.normalize(path);

		try {
			const lookup = lookupPath(path, {follow: !(flags & 131072)});

			node = lookup.node;
		}
		catch (_) {}
	}

	let created = false;

	if (flags & 64) {
		if (node) {
			if (flags & 128) {
				throw new utils.ErrnoError(ERRNO_CODES.EEXIST);
			}
		}
		else {
			node 		= mknod(path, mode, 0);
			created = true;
		}
	}

	if (!node) {
		throw new utils.ErrnoError(ERRNO_CODES.ENOENT);
	}

	if (isChrdev(node.mode)) {
		flags &= ~512;
	}

	if (flags & 65536 && !isDir(node.mode)) {
		throw new utils.ErrnoError(ERRNO_CODES.ENOTDIR);
	}

	if (!created) {
		const error = mayOpen(node, flags);

		if (error) {
			throw new utils.ErrnoError(error);
		}
	}

	if (flags & 512) {
		truncate(node, 0);
	}

	flags &= ~(128 | 512);

	const stream = createStream(
		{
			node,
			path: 			getPath(node),
			flags,
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
		if (trackingDelegate['onOpenFile']) {
			let trackingFlags = 0;

			if ((flags & 2097155) !== 1) {
				trackingFlags |= tracking.openFlags.READ;
			}

			if ((flags & 2097155) !== 0) {
				trackingFlags |= tracking.openFlags.WRITE;
			}

			trackingDelegate['onOpenFile'](path, trackingFlags);
		}
	}
	catch (error) {
		console.log(`FS.trackingDelegate['onOpenFile']('${path}', flags) threw an exception: ${error.message}`);
	}

	return stream;
};

const llseek = (stream, offset, whence) => {
	if (isClosed(stream)) {
		throw new utils.ErrnoError(ERRNO_CODES.EBADF);
	}

	if (!stream.seekable || !stream.stream_ops.llseek) {
		throw new utils.ErrnoError(ERRNO_CODES.ESPIPE);
	}

	stream.position = stream.stream_ops.llseek(stream, offset, whence);
	stream.ungotten = [];

	return stream.position;
};

const write = (stream, buffer, offset, length, position, canOwn) => {
	if (length < 0 || position < 0) {
		throw new utils.ErrnoError(ERRNO_CODES.EINVAL);
	}

	if (isClosed(stream)) {
		throw new utils.ErrnoError(ERRNO_CODES.EBADF);
	}

	if ((stream.flags & 2097155) === 0) {
		throw new utils.ErrnoError(ERRNO_CODES.EBADF);
	}

	if (isDir(stream.node.mode)) {
		throw new utils.ErrnoError(ERRNO_CODES.EISDIR);
	}

	if (!stream.stream_ops.write) {
		throw new utils.ErrnoError(ERRNO_CODES.EINVAL);
	}

	if (stream.flags & 1024) {
		llseek(stream, 0, 2);
	}

	const seeking = typeof position !== 'undefined';

	if (!seeking) {
		position = stream.position;
	}
	else if (!stream.seekable) {
		throw new utils.ErrnoError(ERRNO_CODES.ESPIPE);
	}

	const bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);

	if (!seeking) {
		stream.position += bytesWritten;
	}

	try {
		if (stream.path && trackingDelegate['onWriteToFile']) {
			trackingDelegate['onWriteToFile'](stream.path);
		}
	}
	catch (error) {
		console.log(`FS.trackingDelegate['onWriteToFile']('${path}') threw an exception: ${error.message}`);
	}

	return bytesWritten;
};

const closeStream = fd => {
	streams[fd] = null;
};

const close = stream => {
	if (isClosed(stream)) {
		throw new utils.ErrnoError(ERRNO_CODES.EBADF);
	}

	if (stream.getdents) {
		stream.getdents = null;
	}

	try {
		if (stream.stream_ops.close) {
			stream.stream_ops.close(stream);
		}
	}
	catch (error) {
		throw error;
	}
	finally {
		closeStream(stream.fd);
	}

	stream.fd = null;
};

const writeFile = (path, data, opts = {}) => {
	const {canOwn, flags = 'w', mode} = opts;

	const stream = open(path, flags, mode);

	if (typeof data === 'string') {
		const buf 					 = new Uint8Array(utils.lengthBytesUTF8(data) + 1);
		const actualNumBytes = utils.stringToUTF8Array(data, buf, 0, buf.length);

		write(stream, buf, 0, actualNumBytes, undefined, canOwn);
	}
	else if (ArrayBuffer.isView(data)) {
		write(stream, data, 0, data.byteLength, undefined, canOwn);
	}
	else {
		throw new Error('Unsupported data type');
	}

	close(stream);
};

const chmod = (path, mode, dontFollow) => {
	let node;

	if (typeof path === 'string') {
		const lookup = lookupPath(path, {follow: !dontFollow});

		node = lookup.node;
	}
	else {
		node = path;
	}

	if (!node.node_ops.setattr) {
		throw new utils.ErrnoError(ERRNO_CODES.EPERM);
	}

	node.node_ops.setattr(node, {
		mode: 		 mode & 4095 | node.mode & ~4095, 
		timestamp: Date.now()
	});
};

const utime = (path, atime, mtime) => {
	const {node} = lookupPath(path, {follow: true});

	node.node_ops.setattr(node, {timestamp: Math.max(atime, mtime)});
};

const mayDelete = (dir, name, isdir) => {
	let node;

	try {
		node = lookupNode(dir, name);
	}
	catch (error) {
		return error.errno;
	}

	const error = nodePermissions(dir, 'wx');

	if (error) { return error; }

	if (isdir) {
		if (!isDir(node.mode)) {
			return ERRNO_CODES.ENOTDIR;
		}

		if (isRoot(node) || getPath(node) === cwd()) {
			return ERRNO_CODES.EBUSY;
		}
	}
	else {
		if (isDir(node.mode)) {
			return ERRNO_CODES.EISDIR;
		}
	}

	return 0;
};

const hashRemoveNode = node => {
	const hash = hashName(node.parent.id, node.name);

	if (nameTable[hash] === node) {
		nameTable[hash] = node.name_next;
	}
	else {
		let current = nameTable[hash];

		while (current) {
			if (current.name_next === node) {
				current.name_next = node.name_next;
				break;
			}

			current = current.name_next;
		}
	}
};

const destroyNode = node => {
	hashRemoveNode(node);
};

const rmdir = path => {
	const {node: parent} = lookupPath(path, {parent: true});
	const name 	 				 = PATH.basename(path);
	const node 	 				 = lookupNode(parent, name);
	const error 	 			 = mayDelete(parent, name, true);

	if (error) {
		throw new utils.ErrnoError(error);
	}

	if (!parent.node_ops.rmdir) {
		throw new utils.ErrnoError(ERRNO_CODES.EPERM);
	}

	if (isMountpoint(node)) {
		throw new utils.ErrnoError(ERRNO_CODES.EBUSY);
	}

	try {
		if (trackingDelegate['willDeletePath']) {
			trackingDelegate['willDeletePath'](path);
		}
	}
	catch (err) {
		console.log(`FS.trackingDelegate['willDeletePath']('${path}') threw an exception: ${err.message}`);
	}

	parent.node_ops.rmdir(parent, name);
	destroyNode(node);

	try {
		if (trackingDelegate['onDeletePath']) {
			trackingDelegate['onDeletePath'](path);
		}
	}
	catch (err) {
		console.log(`FS.trackingDelegate['onDeletePath']('${path}') threw an exception: ${err.message}`);
	}
};

const unlink = path => {
	const {node: parent} = lookupPath(path, {parent: true});
	const name 	 				 = PATH.basename(path);
	const node 	 				 = lookupNode(parent, name);
	const error 	 			 = mayDelete(parent, name, false);

	if (error) {
		throw new utils.ErrnoError(error);
	}

	if (!parent.node_ops.unlink) {
		throw new utils.ErrnoError(ERRNO_CODES.EPERM);
	}

	if (isMountpoint(node)) {
		throw new utils.ErrnoError(ERRNO_CODES.EBUSY);
	}

	try {
		if (trackingDelegate['willDeletePath']) {
			trackingDelegate['willDeletePath'](path);
		}
	}
	catch (err) {
		console.log(`FS.trackingDelegate['willDeletePath']('${path}') threw an exception: ${err.message}`);
	}

	parent.node_ops.unlink(parent, name);

	destroyNode(node);

	try {
		if (trackingDelegate['onDeletePath']) {
			trackingDelegate['onDeletePath'](path);
		}
	}
	catch (err) {
		console.log(`FS.trackingDelegate['onDeletePath']('${path}') threw an exception: ${err.message}`);
	}
};


export default {
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
};
