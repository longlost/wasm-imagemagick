

import {
	ERRNO_CODES, 
	PAGE_SIZE
} from './constants.js';

import utils 	from './utils.js';
import memory from './memory.js';
import PATH 	from './path.js';
import FS 		from './fs.js';


// Exposed to allow set/update in other modules.
const exposed = {
	// Set later in 'asm.js'.
	_memalign: null
};


const stringToUTF8 = (str, outPtr, maxBytesToWrite) => 
											 utils.stringToUTF8Array(str, memory.exposed.HEAPU8, outPtr, maxBytesToWrite);


const SYSCALLS = {
	DEFAULT_POLLMASK: 5,
	mappings: 				{},
	umask: 						511,

	calculateAt(dirfd, path) {
		if (path[0] !== '/') {
			let dir;

			if (dirfd === -100) {
				dir = FS.cwd();
			}
			else {
				const dirstream = FS.getStream(dirfd);

				if (!dirstream) {
					throw new utils.ErrnoError(ERRNO_CODES.EBADF);
				}

				dir = dirstream.path;
			}

			path = PATH.join2(dir, path);
		}

		return path;
	},

	doStat(func, path, buf) {

		let stat;

		try {
			stat = func(path);
		}
		catch (error) {
			if (error && error.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(error.node))) {
				return -ERRNO_CODES.ENOTDIR;
			}

			throw error;
		}

		memory.exposed.HEAP32[buf >> 2] 		 = stat.dev;
		memory.exposed.HEAP32[buf + 4 >> 2]  = 0;
		memory.exposed.HEAP32[buf + 8 >> 2]  = stat.ino;
		memory.exposed.HEAP32[buf + 12 >> 2] = stat.mode;
		memory.exposed.HEAP32[buf + 16 >> 2] = stat.nlink;
		memory.exposed.HEAP32[buf + 20 >> 2] = stat.uid;
		memory.exposed.HEAP32[buf + 24 >> 2] = stat.gid;
		memory.exposed.HEAP32[buf + 28 >> 2] = stat.rdev;
		memory.exposed.HEAP32[buf + 32 >> 2] = 0;
		memory.exposed.HEAP32[buf + 36 >> 2] = stat.size;
		memory.exposed.HEAP32[buf + 40 >> 2] = 4096;
		memory.exposed.HEAP32[buf + 44 >> 2] = stat.blocks;
		memory.exposed.HEAP32[buf + 48 >> 2] = stat.atime.getTime() / 1e3 | 0;
		memory.exposed.HEAP32[buf + 52 >> 2] = 0;
		memory.exposed.HEAP32[buf + 56 >> 2] = stat.mtime.getTime() / 1e3 | 0;
		memory.exposed.HEAP32[buf + 60 >> 2] = 0;
		memory.exposed.HEAP32[buf + 64 >> 2] = stat.ctime.getTime() / 1e3 | 0;
		memory.exposed.HEAP32[buf + 68 >> 2] = 0;
		memory.exposed.HEAP32[buf + 72 >> 2] = stat.ino;

		return 0;
	},

	doMsync(addr, stream, len, flags) {
		const buffer = new Uint8Array(memory.exposed.HEAPU8.subarray(addr, addr + len));

		FS.msync(stream, buffer, 0, len, flags);
	},

	doMkdir(path, mode) {
		path = PATH.normalize(path);

		if (path[path.length - 1] === '/') {
			path = path.substr(0, path.length - 1);
		}

		FS.mkdir(path, mode, 0);

		return 0;
	},

	doMknod(path, mode, dev) {
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
	},

	doReadlink(path, buf, bufsize) {
		if (bufsize <= 0) {
			return -ERRNO_CODES.EINVAL;
		}

		const ret 		= FS.readlink(path);
		const len 		= Math.min(bufsize, utils.lengthBytesUTF8(ret));
		const endChar = memory.exposed.HEAP8[buf + len];

		stringToUTF8(ret, buf, bufsize + 1);

		memory.exposed.HEAP8[buf + len] = endChar;

		return len;
	},

	doAccess(path, amode) {
		if (amode & ~7) {
			return -ERRNO_CODES.EINVAL;
		}
		
		const {node} = FS.lookupPath(path, {follow: true});

		let perms = '';

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
	},

	doDup(path, flags, suggestFD) {
		const suggest = FS.getStream(suggestFD);

		if (suggest) {
			FS.close(suggest);
		}

		return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
	},

	doReadv(stream, iov, iovcnt, offset) {
		let ret = 0;

		for (let i = 0; i < iovcnt; i++) {
			const ptr  = memory.exposed.HEAP32[iov + i * 8 >> 2];
			const len  = memory.exposed.HEAP32[iov + (i * 8 + 4) >> 2];
			const curr = FS.read(stream, memory.exposed.HEAP8, ptr, len, offset);

			if (curr < 0) { return -1; }

			ret += curr;

			if (curr < len) { break; }
		}

		return ret;
	},

	doWritev(stream, iov, iovcnt, offset) {
		let ret = 0;

		for (let i = 0; i < iovcnt; i++) {
			const ptr  = memory.exposed.HEAP32[iov + i * 8 >> 2];
			const len  = memory.exposed.HEAP32[iov + (i * 8 + 4) >> 2];
			const curr = FS.write(stream, memory.exposed.HEAP8, ptr, len, offset);

			if (curr < 0) { return - 1; }

			ret += curr;
		}

		return ret;
	},

	varargs: 0,

	get(varargs) {
		SYSCALLS.varargs += 4;

		return memory.exposed.HEAP32[SYSCALLS.varargs - 4 >> 2];
	},

	getStr() {
		return memory.Pointer_stringify(SYSCALLS.get());
	},

	getStreamFromFD() { 
		const stream = FS.getStream(SYSCALLS.get());

		if (!stream) {
			throw new utils.ErrnoError(ERRNO_CODES.EBADF);
		}

		return stream;
	},

	// NOT used. There is no 'SOCKFS' code.

	// getSocketFromFD() {
	// 	const socket = SOCKFS.getSocket(SYSCALLS.get());

	// 	if (!socket) {
	// 		throw new utils.ErrnoError(ERRNO_CODES.EBADF);
	// 	}

	// 	return socket;
	// },

	// NOT used. There is no code for '__read_sockaddr' or 'DNS'.

	// getSocketAddress(allowNull) {
	// 	const addrp 	= SYSCALLS.get();
	// 	const addrlen = SYSCALLS.get();

	// 	if (allowNull && addrp === 0) { return null; }

	// 	const info = __read_sockaddr(addrp, addrlen);

	// 	if (info.errno) {
	// 		throw new utils.ErrnoError(info.errno);
	// 	}

	// 	info.addr = DNS.lookup_addr(info.addr) || info.addr;

	// 	return info;
	// },

	get64() {
		const low  = SYSCALLS.get();
		const high = SYSCALLS.get();

		if (low >= 0) {
			utils.assert(high === 0);
		}
		else {
			utils.assert(high === -1);
		}

		return low;
	},

	getZero() {
		utils.assert(SYSCALLS.get() === 0);
	}
};


const handleError = error => {
	if (typeof FS === 'undefined' || !(error instanceof FS.ErrnoError)) {
		utils.abort(error);
	}

	return -error.errno;
};

const ___syscall10 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const path = SYSCALLS.getStr();

		FS.unlink(path);

		return 0;
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall114 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		utils.abort('cannot wait on child processes');
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall118 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		SYSCALLS.getStreamFromFD();

		return 0;
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall140 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const stream 			= SYSCALLS.getStreamFromFD();
		const offset_high = SYSCALLS.get();
		const offset_low 	= SYSCALLS.get();
		const result 			= SYSCALLS.get();
		const whence 			= SYSCALLS.get();
		const offset 			= offset_low;

		FS.llseek(stream, offset, whence);
		memory.exposed.HEAP32[result >> 2] = stream.position;

		if (stream.getdents && offset === 0 && whence === 0) {
			stream.getdents = null;
		}

		return 0;
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall145 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const stream = SYSCALLS.getStreamFromFD();
		const iov 	 = SYSCALLS.get();
		const iovcnt = SYSCALLS.get();

		return SYSCALLS.doReadv(stream, iov, iovcnt);
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall146 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const stream = SYSCALLS.getStreamFromFD();
		const iov 	 = SYSCALLS.get();
		const iovcnt = SYSCALLS.get();

		return SYSCALLS.doWritev(stream, iov, iovcnt);
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall15 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const path = SYSCALLS.getStr();
		const mode = SYSCALLS.get();

		FS.chmod(path, mode);

		return 0;
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall180 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const stream = SYSCALLS.getStreamFromFD();
		const buf 	 = SYSCALLS.get();
		const count  = SYSCALLS.get();
		const zero 	 = SYSCALLS.getZero();
		const offset = SYSCALLS.get64();

		return FS.read(stream, memory.exposed.HEAP8, buf, count, offset);
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall181 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const stream = SYSCALLS.getStreamFromFD();
		const buf 	 = SYSCALLS.get();
		const count  = SYSCALLS.get();
		const zero 	 = SYSCALLS.getZero();
		const offset = SYSCALLS.get64();

		return FS.write(stream, memory.exposed.HEAP8, buf, count, offset);
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall183 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const buf  = SYSCALLS.get();
		const size = SYSCALLS.get();

		if (size === 0) {
			return -ERRNO_CODES.EINVAL;
		}

		const cwd 						 = FS.cwd();
		const cwdLengthInBytes = utils.lengthBytesUTF8(cwd);

		if (size < cwdLengthInBytes + 1) {
			return -ERRNO_CODES.ERANGE;
		}

		stringToUTF8(cwd, buf, size);

		return buf;
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall191 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const resource = SYSCALLS.get();
		const rlim 		 = SYSCALLS.get();

		memory.exposed.HEAP32[rlim >> 2]      =- 1;
		memory.exposed.HEAP32[rlim + 4 >> 2]  =- 1;
		memory.exposed.HEAP32[rlim + 8 >> 2]  =- 1;
		memory.exposed.HEAP32[rlim + 12 >> 2] =- 1;

		return 0;
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall192 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const addr 	= SYSCALLS.get();
		const len 	= SYSCALLS.get();
		const prot 	= SYSCALLS.get();
		const flags = SYSCALLS.get();
		const fd 		= SYSCALLS.get();
		let off 		= SYSCALLS.get();

		off <<= 12;

		let ptr;
		let allocated = false;

		if (fd === -1) {
			ptr = exposed._memalign(PAGE_SIZE, len);

			if (!ptr) {
				return -ERRNO_CODES.ENOMEM;
			}

			utils.exposed._memset(ptr, 0, len);
			allocated = true;
		}
		else {
			const info = FS.getStream(fd);

			if (!info) {
				return -ERRNO_CODES.EBADF;
			}

			const res = FS.mmap(info, memory.exposed.HEAPU8, addr, len, off, prot, flags);

			ptr 			= res.ptr;
			allocated = res.allocated;
		}

		SYSCALLS.mappings[ptr] = {
			malloc: ptr,
			len,
			allocated,
			fd,
			flags
		};

		return ptr;
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall195 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const path = SYSCALLS.getStr();
		const buf  = SYSCALLS.get();

		return SYSCALLS.doStat(FS.stat, path, buf);
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall197 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const stream = SYSCALLS.getStreamFromFD();
		const buf 	 = SYSCALLS.get();

		return SYSCALLS.doStat(FS.stat, stream.path, buf);
	}
	catch (error) {
		return handleError(error);
	}
};


const ___syscall20 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const PROCINFO = {ppid: 1, pid: 42, sid: 42, pgid: 42};

		return PROCINFO.pid;
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall220 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const stream = SYSCALLS.getStreamFromFD();
		const dirp 	 = SYSCALLS.get();
		const count  = SYSCALLS.get();

		if (!stream.getdents) {
			stream.getdents = FS.readdir(stream.path);
		}

		let pos = 0;

		while (stream.getdents.length > 0 && pos + 268 <= count) {
			let id;
			let type;

			const name = stream.getdents.pop();

			if (name[0] === '.') {
				id 	 = 1;
				type = 4;
			}
			else {
				const child = FS.lookupNode(stream.node, name);

				id 	 = child.id;
				type = FS.isChrdev(child.mode) ? 
								 2 : 
								 FS.isDir(child.mode) ? 
								 	4 : 
								 	FS.isLink(child.mode) ? 
								 		10 : 
								 		8;
			}

			memory.exposed.HEAP32[dirp + pos >> 2] 		 = id;
			memory.exposed.HEAP32[dirp + pos + 4 >> 2] = stream.position;
			memory.exposed.HEAP16[dirp + pos + 8 >> 1] = 268;
			memory.exposed.HEAP8[dirp + pos + 10 >> 0] = type;

			stringToUTF8(name, dirp + pos + 11, 256);
			pos += 268;
		}

		return pos;
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall221 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const stream = SYSCALLS.getStreamFromFD();
		const cmd 	 = SYSCALLS.get();

		switch (cmd) {
			case 0: {
				const arg = SYSCALLS.get();

				if (arg < 0) {
					return -ERRNO_CODES.EINVAL;
				}

				const newStream = FS.open(stream.path, stream.flags, 0, arg);

				return newStream.fd;
			};
			case 1:
			case 2:
				return 0;
			case 3:
				return stream.flags;
			case 4: {
				const arg = SYSCALLS.get();

				stream.flags |= arg;

				return 0;
			};
			case 12: {
				const arg 	 = SYSCALLS.get();
				const offset = 0;

				memory.exposed.HEAP16[arg + offset >> 1] = 2;

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
	catch (error) {
		return handleError(error);
	}
};

const ___syscall3 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const stream = SYSCALLS.getStreamFromFD();
		const buf 	 = SYSCALLS.get();
		const count  = SYSCALLS.get();

		return FS.read(stream, memory.exposed.HEAP8, buf, count);
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall324 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const stream = SYSCALLS.getStreamFromFD();
		const mode 	 = SYSCALLS.get();
		const offset = SYSCALLS.get64();
		const len 	 = SYSCALLS.get64();

		utils.assert(mode === 0);

		FS.allocate(stream, offset, len);

		return 0;
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall33 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const path 	= SYSCALLS.getStr();
		const amode = SYSCALLS.get();

		return SYSCALLS.doAccess(path, amode);
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall340 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const pid 			= SYSCALLS.get();
		const resource 	= SYSCALLS.get();
		const new_limit = SYSCALLS.get();
		const old_limit = SYSCALLS.get();

		if (old_limit) {
			memory.exposed.HEAP32[old_limit >> 2] 		 =- 1;
			memory.exposed.HEAP32[old_limit + 4 >> 2]  =- 1;
			memory.exposed.HEAP32[old_limit + 8 >> 2]  =- 1;
			memory.exposed.HEAP32[old_limit + 12 >> 2] =- 1;
		}

		return 0;
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall38 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const old_path = SYSCALLS.getStr();
		const new_path = SYSCALLS.getStr();

		FS.rename(old_path, new_path);

		return 0;
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall4 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const stream = SYSCALLS.getStreamFromFD();
		const buf 	 = SYSCALLS.get();
		const count  = SYSCALLS.get();

		return FS.write(stream, memory.exposed.HEAP8, buf, count);
	}
	catch (error) {
		return handleError(error);
	}
}

const ___syscall5 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const pathname = SYSCALLS.getStr();
		const flags 	 = SYSCALLS.get();
		const mode 		 = SYSCALLS.get();
		const stream 	 = FS.open(pathname, flags, mode);

		return stream.fd;
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall54 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const stream = SYSCALLS.getStreamFromFD();
		const op 		 = SYSCALLS.get();

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

				const argp = SYSCALLS.get();

				memory.exposed.HEAP32[argp >> 2] = 0;

				return 0;
			};
			case 21520: {
				if (!stream.tty) {
					return -ERRNO_CODES.ENOTTY;
				}

				return -ERRNO_CODES.EINVAL;
			};
			case 21531: {
				const argp = SYSCALLS.get();

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
				utils.abort(`bad ioctl syscall ${op}`);
		}
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall6 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const stream = SYSCALLS.getStreamFromFD();

		FS.close(stream);

		return 0;
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall77 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const who 	= SYSCALLS.get();
		const usage = SYSCALLS.get();

		utils.exposed._memset(usage, 0, 136);

		memory.exposed.HEAP32[usage >> 2] 		 = 1;
		memory.exposed.HEAP32[usage + 4 >> 2]  = 2;
		memory.exposed.HEAP32[usage + 8 >> 2]  = 3;
		memory.exposed.HEAP32[usage + 12 >> 2] = 4;

		return 0;
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall83 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const target 	 = SYSCALLS.getStr();
		const linkpath = SYSCALLS.getStr();

		FS.symlink(target, linkpath);

		return 0;
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall85 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const path 		= SYSCALLS.getStr();
		const buf 		= SYSCALLS.get();
		const bufsize = SYSCALLS.get();

		return SYSCALLS.doReadlink(path, buf, bufsize);
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall91 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const addr = SYSCALLS.get();
		const len  = SYSCALLS.get();
		const info = SYSCALLS.mappings[addr];

		if (!info) { return 0; }

		if (len === info.len) {
			const stream = FS.getStream(info.fd);

			SYSCALLS.doMsync(addr, stream, len, info.flags);
			FS.munmap(stream);
			SYSCALLS.mappings[addr] = null;

			if (info.allocated) {
				utils.exposed._free(info.malloc);
			}
		}

		return 0;
	}
	catch (error) {
		return handleError(error);
	}
};

const ___syscall94 = (which, varargs) => {
	SYSCALLS.varargs = varargs;

	try {
		const fd 	 = SYSCALLS.get();
		const mode = SYSCALLS.get();

		FS.fchmod(fd, mode);

		return 0;
	}
	catch (error) {
		return handleError(error);
	}
};


export default {
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
	exposed
};
