

import {ERRNO_CODES, PAGE_SIZE} from './constants.js';
import {_free, _memset, ErrnoError, abort, assert, stringToUTF8Array} from './utils.js';
import {Pointer_stringify} from './memory.js';
import PATH 				 from './path.js';
import FS 					 from './fs.js';


const stringToUTF8 = (str, outPtr, maxBytesToWrite) => 
											 stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);


var SYSCALLS = {
	DEFAULT_POLLMASK: 5,
	mappings: 				{},
	umask: 						511,

	calculateAt: (function(dirfd, path) {
		if (path[0] !== '/') {
			var dir;

			if (dirfd === -100) {
				dir = FS.cwd();
			}
			else {
				var dirstream = FS.getStream(dirfd);

				if (!dirstream) {
					throw new ErrnoError(ERRNO_CODES.EBADF);
				}

				dir = dirstream.path;
			}

			path = PATH.join2(dir, path);
		}

		return path;
	}),

	doStat: (function(func, path, buf) {
		try {
			var stat = func(path);
		}
		catch (e) {
			if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
				return -ERRNO_CODES.ENOTDIR;
			}

			throw e;
		}

		HEAP32[buf >> 2] 			= stat.dev;
		HEAP32[buf + 4 >> 2] 	= 0;
		HEAP32[buf + 8 >> 2] 	= stat.ino;
		HEAP32[buf + 12 >> 2] = stat.mode;
		HEAP32[buf + 16 >> 2] = stat.nlink;
		HEAP32[buf + 20 >> 2] = stat.uid;
		HEAP32[buf + 24 >> 2] = stat.gid;
		HEAP32[buf + 28 >> 2] = stat.rdev;
		HEAP32[buf + 32 >> 2] = 0;
		HEAP32[buf + 36 >> 2] = stat.size;
		HEAP32[buf + 40 >> 2] = 4096;
		HEAP32[buf + 44 >> 2] = stat.blocks;
		HEAP32[buf + 48 >> 2] = stat.atime.getTime() / 1e3 | 0;
		HEAP32[buf + 52 >> 2] = 0;
		HEAP32[buf + 56 >> 2] = stat.mtime.getTime() / 1e3 | 0;
		HEAP32[buf + 60 >> 2] = 0;
		HEAP32[buf + 64 >> 2] = stat.ctime.getTime() / 1e3 | 0;
		HEAP32[buf + 68 >> 2] = 0;
		HEAP32[buf + 72 >> 2] = stat.ino;

		return 0;
	}),

	doMsync: (function(addr, stream, len, flags) {
		var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));

		FS.msync(stream, buffer, 0, len, flags);
	}),

	doMkdir: (function(path, mode) {
		path = PATH.normalize(path);

		if (path[path.length - 1] === '/') {
			path = path.substr(0, path.length - 1);
		}

		FS.mkdir(path, mode, 0);

		return 0;
	}),

	doMknod: (function(path, mode, dev) {
		switch (mode & 61440) {
			case 32768:
			case 8192:
			case 24576:
			case 4096:
			case 49152:
				break;
			default:
				return -ERRNO_CODES.EINVAL;
		}

		FS.mknod(path, mode, dev);

		return 0;
	}),

	doReadlink: (function(path, buf, bufsize) {
		if (bufsize <= 0) {
			return -ERRNO_CODES.EINVAL;
		}

		var ret = FS.readlink(path);
		var len = Math.min(bufsize, lengthBytesUTF8(ret));
		var endChar = HEAP8[buf + len];

		stringToUTF8(ret, buf, bufsize + 1);

		HEAP8[buf + len] = endChar;

		return len;
	}),

	doAccess: (function(path, amode) {
		if (amode & ~7) {
			return -ERRNO_CODES.EINVAL;
		}

		var node;
		var lookup = FS.lookupPath(path, {follow: true});

		node = lookup.node;

		var perms = '';

		if (amode & 4) {
			perms += 'r';
		}

		if (amode & 2) {
			perms += 'w';
		}

		if (amode & 1) {
			perms += 'x';
		}

		if (perms && FS.nodePermissions(node, perms)) {
			return -ERRNO_CODES.EACCES;
		}

		return 0;
	}),

	doDup: (function(path, flags, suggestFD) {
		var suggest = FS.getStream(suggestFD);

		if (suggest) {
			FS.close(suggest);
		}

		return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
	}),

	doReadv: (function(stream, iov, iovcnt, offset) {
		var ret = 0;

		for (var i = 0; i < iovcnt; i++) {
			var ptr  = HEAP32[iov + i * 8 >> 2];
			var len  = HEAP32[iov + (i * 8 + 4) >> 2];
			var curr = FS.read(stream, HEAP8, ptr, len, offset);

			if (curr < 0) { return -1; }

			ret += curr;

			if (curr < len) { break; }
		}

		return ret;
	}),

	doWritev: (function(stream, iov, iovcnt, offset) {
		var ret = 0;

		for (var i = 0; i < iovcnt; i++) {
			var ptr  = HEAP32[iov + i * 8 >> 2];
			var len  = HEAP32[iov + (i * 8 + 4) >> 2];
			var curr = FS.write(stream, HEAP8, ptr, len, offset);

			if (curr < 0) { return - 1; }

			ret += curr;
		}

		return ret;
	}),

	varargs: 0,

	get: (function(varargs) {
		SYSCALLS.varargs += 4;

		var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];

		return ret;
	}),

	getStr: (function() {
		var ret = Pointer_stringify(SYSCALLS.get());

		return ret;
	}),

	getStreamFromFD: (function() { 
		var stream = FS.getStream(SYSCALLS.get());

		if (!stream) {
			throw new ErrnoError(ERRNO_CODES.EBADF);
		}

		return stream;
	}),

	getSocketFromFD: (function() {
		var socket = SOCKFS.getSocket(SYSCALLS.get());

		if (!socket) {
			throw new ErrnoError(ERRNO_CODES.EBADF);
		}

		return socket;
	}),

	getSocketAddress: (function(allowNull) {
		var addrp 	= SYSCALLS.get();
		var addrlen = SYSCALLS.get();

		if (allowNull && addrp === 0) { return null; }

		var info = __read_sockaddr(addrp, addrlen);

		if (info.errno) {
			throw new ErrnoError(info.errno);
		}

		info.addr = DNS.lookup_addr(info.addr) || info.addr;

		return info;
	}),

	get64: (function() {
		var low  = SYSCALLS.get();
		var high = SYSCALLS.get();

		if (low >= 0) {
			assert(high === 0);
		}
		else {
			assert(high === -1);
		}

		return low;
	}),

	getZero: (function() {
		assert(SYSCALLS.get() === 0);
	})
};





function ___syscall10(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var path = SYSCALLS.getStr();

		FS.unlink(path);

		return 0;
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall114(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		abort('cannot wait on child processes');
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall118(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var stream = SYSCALLS.getStreamFromFD();

		return 0;
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall140(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var stream 			= SYSCALLS.getStreamFromFD();
		var offset_high = SYSCALLS.get();
		var offset_low 	= SYSCALLS.get();
		var result 			= SYSCALLS.get();
		var whence 			= SYSCALLS.get();
		var offset 			= offset_low;

		FS.llseek(stream, offset, whence);
		HEAP32[result >> 2] = stream.position;

		if (stream.getdents && offset === 0 && whence === 0) {
			stream.getdents = null;
		}

		return 0;
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall145(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var stream = SYSCALLS.getStreamFromFD();
		var iov 	 = SYSCALLS.get();
		var iovcnt = SYSCALLS.get();

		return SYSCALLS.doReadv(stream, iov, iovcnt);
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall146(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var stream = SYSCALLS.getStreamFromFD();
		var iov 	 = SYSCALLS.get();
		var iovcnt = SYSCALLS.get();

		return SYSCALLS.doWritev(stream, iov, iovcnt);
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall15(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var path = SYSCALLS.getStr();
		var mode = SYSCALLS.get();

		FS.chmod(path, mode);

		return 0;
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall180(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var stream = SYSCALLS.getStreamFromFD();
		var buf 	 = SYSCALLS.get();
		var count  = SYSCALLS.get();
		var zero 	 = SYSCALLS.getZero();
		var offset = SYSCALLS.get64();

		return FS.read(stream, HEAP8, buf, count, offset);
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall181(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var stream = SYSCALLS.getStreamFromFD();
		var buf 	 = SYSCALLS.get();
		var count  = SYSCALLS.get();
		var zero 	 = SYSCALLS.getZero();
		var offset = SYSCALLS.get64();

		return FS.write(stream, HEAP8, buf, count, offset);
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall183(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var buf  = SYSCALLS.get();
		var size = SYSCALLS.get();

		if (size === 0) {
			return -ERRNO_CODES.EINVAL;
		}

		var cwd = FS.cwd();
		var cwdLengthInBytes = lengthBytesUTF8(cwd);

		if (size < cwdLengthInBytes + 1) {
			return -ERRNO_CODES.ERANGE;
		}

		stringToUTF8(cwd, buf, size);

		return buf;
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall191(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var resource = SYSCALLS.get();
		var rlim 		 = SYSCALLS.get();

		HEAP32[rlim >> 2]      =- 1;
		HEAP32[rlim + 4 >> 2]  =- 1;
		HEAP32[rlim + 8 >> 2]  =- 1;
		HEAP32[rlim + 12 >> 2] =- 1;

		return 0;
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);

		return -e.errno;
	}
}

let _memalign;

function ___syscall192(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var addr 	= SYSCALLS.get();
		var len 	= SYSCALLS.get();
		var prot 	= SYSCALLS.get();
		var flags = SYSCALLS.get();
		var fd 		= SYSCALLS.get();
		var off 	= SYSCALLS.get();

		off <<= 12;

		var ptr;
		var allocated = false;

		if (fd === -1) {
			ptr = _memalign(PAGE_SIZE, len);

			if (!ptr) {
				return -ERRNO_CODES.ENOMEM;
			}

			_memset(ptr, 0, len);
			allocated = true;
		}
		else {
			var info = FS.getStream(fd);

			if (!info) {
				return -ERRNO_CODES.EBADF;
			}

			var res = FS.mmap(info, HEAPU8, addr, len, off, prot, flags);

			ptr = res.ptr;
			allocated = res.allocated;
		}

		SYSCALLS.mappings[ptr] = {
			malloc: 	 ptr,
			len: 			 len,
			allocated: allocated,
			fd: 			 fd,
			flags: 		 flags
		};

		return ptr;
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall195(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var path = SYSCALLS.getStr();
		var buf  = SYSCALLS.get();

		return SYSCALLS.doStat(FS.stat, path, buf);
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall197(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var stream = SYSCALLS.getStreamFromFD();
		var buf 	 = SYSCALLS.get();

		return SYSCALLS.doStat(FS.stat, stream.path, buf);
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

var PROCINFO = {ppid: 1, pid: 42, sid: 42, pgid: 42};

function ___syscall20(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		return PROCINFO.pid;
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall220(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var stream = SYSCALLS.getStreamFromFD();
		var dirp 	 = SYSCALLS.get();
		var count  = SYSCALLS.get();

		if (!stream.getdents) {
			stream.getdents = FS.readdir(stream.path);
		}

		var pos = 0;

		while (stream.getdents.length > 0 && pos + 268 <= count) {
			var id;
			var type;
			var name = stream.getdents.pop();

			if (name[0] === '.') {
				id 	 = 1;
				type = 4;
			}
			else {
				var child = FS.lookupNode(stream.node,name);

				id 	 = child.id;
				type = FS.isChrdev(child.mode) ? 
								 2 : 
								 FS.isDir(child.mode) ? 
								 	4 : 
								 	FS.isLink(child.mode) ? 
								 		10 : 
								 		8;
			}

			HEAP32[dirp + pos >> 2] 		= id;
			HEAP32[dirp + pos + 4 >> 2] = stream.position;
			HEAP16[dirp + pos + 8 >> 1] = 268;
			HEAP8[dirp + pos + 10 >> 0] = type;

			stringToUTF8(name, dirp + pos + 11, 256);
			pos += 268;
		}

		return pos;
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall221(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var stream = SYSCALLS.getStreamFromFD();
		var cmd 	 = SYSCALLS.get();

		switch (cmd) {
			case 0: {
				var arg = SYSCALLS.get();

				if (arg < 0) {
					return -ERRNO_CODES.EINVAL;
				}

				var newStream;

				newStream = FS.open(stream.path, stream.flags, 0, arg);

				return newStream.fd;
			};
			case 1:
			case 2:
				return 0;
			case 3:
				return stream.flags;
			case 4: {
				var arg = SYSCALLS.get();

				stream.flags |= arg;

				return 0;
			};
			case 12: {
				var arg = SYSCALLS.get();
				var offset = 0;

				HEAP16[arg + offset >> 1] = 2;

				return 0;
			};
			case 13:
			case 14:
				return 0;
			case 16:
			case 8:
				return -ERRNO_CODES.EINVAL;
			case 9:
				___setErrNo(ERRNO_CODES.EINVAL);

				return -1;
			default: {
				return -ERRNO_CODES.EINVAL;
			};
		}
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall3(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var stream = SYSCALLS.getStreamFromFD();
		var buf 	 = SYSCALLS.get();
		var count  = SYSCALLS.get();

		return FS.read(stream, HEAP8, buf, count);
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall324(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var stream = SYSCALLS.getStreamFromFD();
		var mode 	 = SYSCALLS.get();
		var offset = SYSCALLS.get64();
		var len 	 = SYSCALLS.get64();

		assert(mode === 0);

		FS.allocate(stream, offset, len);

		return 0;
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall33(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var path 	= SYSCALLS.getStr();
		var amode = SYSCALLS.get();

		return SYSCALLS.doAccess(path, amode);
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall340(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var pid 			= SYSCALLS.get();
		var resource 	= SYSCALLS.get();
		var new_limit = SYSCALLS.get();
		var old_limit = SYSCALLS.get();

		if (old_limit) {
			HEAP32[old_limit >> 2] 			=- 1;
			HEAP32[old_limit + 4 >> 2] 	=- 1;
			HEAP32[old_limit + 8 >> 2] 	=- 1;
			HEAP32[old_limit + 12 >> 2] =- 1;
		}

		return 0;
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall38(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var old_path = SYSCALLS.getStr();
		var new_path = SYSCALLS.getStr();

		FS.rename(old_path, new_path);

		return 0;
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall4(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var stream = SYSCALLS.getStreamFromFD();
		var buf 	 = SYSCALLS.get();
		var count  = SYSCALLS.get();

		return FS.write(stream, HEAP8, buf, count);
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall5(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var pathname = SYSCALLS.getStr();
		var flags 	 = SYSCALLS.get();
		var mode 		 = SYSCALLS.get();
		var stream 	 = FS.open(pathname, flags, mode);

		return stream.fd;
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall54(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var stream = SYSCALLS.getStreamFromFD();
		var op 		 = SYSCALLS.get();

		switch (op) {
			case 21509:
			case 21505: {
				if (!stream.tty) {
					return -ERRNO_CODES.ENOTTY;
				}

				return 0;
			};
			case 21510:
			case 21511:
			case 21512:
			case 21506:
			case 21507:
			case 21508: {
				if (!stream.tty) {
					return -ERRNO_CODES.ENOTTY;
				}

				return 0;
			};
			case 21519: {
				if (!stream.tty) {
					return -ERRNO_CODES.ENOTTY;
				}

				var argp = SYSCALLS.get();

				HEAP32[argp >> 2] = 0;

				return 0;
			};
			case 21520: {
				if (!stream.tty) {
					return -ERRNO_CODES.ENOTTY;
				}

				return -ERRNO_CODES.EINVAL;
			};
			case 21531: {
				var argp = SYSCALLS.get();

				return FS.ioctl(stream, op, argp);
			};
			case 21523: {
				if (!stream.tty) {
					return -ERRNO_CODES.ENOTTY;
				}

				return 0;
			};
			case 21524: {
				if (!stream.tty) {
					return -ERRNO_CODES.ENOTTY;
				}

				return 0;
			};
			default:
				abort('bad ioctl syscall ' + op);
		}
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall6(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var stream = SYSCALLS.getStreamFromFD();

		FS.close(stream);

		return 0;
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall77(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var who 	= SYSCALLS.get();
		var usage = SYSCALLS.get();

		_memset(usage, 0, 136);

		HEAP32[usage >> 2] 			= 1;
		HEAP32[usage + 4 >> 2] 	= 2;
		HEAP32[usage + 8 >> 2] 	= 3;
		HEAP32[usage + 12 >> 2] = 4;

		return 0;
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall83(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var target 	 = SYSCALLS.getStr();
		var linkpath = SYSCALLS.getStr();

		FS.symlink(target, linkpath);

		return 0;
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall85(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var path 		= SYSCALLS.getStr();
		var buf 		= SYSCALLS.get();
		var bufsize = SYSCALLS.get();

		return SYSCALLS.doReadlink(path, buf, bufsize);
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall91(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var addr = SYSCALLS.get();
		var len  = SYSCALLS.get();
		var info = SYSCALLS.mappings[addr];

		if (!info) { return 0; }

		if (len === info.len) {
			var stream = FS.getStream(info.fd);

			SYSCALLS.doMsync(addr, stream, len, info.flags);
			FS.munmap(stream);
			SYSCALLS.mappings[addr] = null;

			if (info.allocated) {
				_free(info.malloc);
			}
		}

		return 0;
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}

function ___syscall94(which, varargs) {
	SYSCALLS.varargs = varargs;

	try {
		var fd 	 = SYSCALLS.get();
		var mode = SYSCALLS.get();

		FS.fchmod(fd, mode);

		return 0;
	}
	catch (e) {
		if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) {
			abort(e);
		}

		return -e.errno;
	}
}


export {
	___syscall10,
	___syscall114,
	___syscall118,
	___syscall140,
	___syscall145,
	___syscall146,
	___syscall15,
	___syscall180,
	___syscall181,
	___syscall183,
	___syscall191,
	___syscall192,
	___syscall195,
	___syscall197,
	___syscall20,
	___syscall220,
	___syscall221,
	___syscall3,
	___syscall324,
	___syscall33,
	___syscall340,
	___syscall38,
	___syscall4,
	___syscall5,
	___syscall54,
	___syscall6,
	___syscall77,
	___syscall83,
	___syscall85,
	___syscall91,
	___syscall94,
	_memalign
};
