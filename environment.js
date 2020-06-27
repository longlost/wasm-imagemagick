

import {
	ERRNO_CODES,
	PAGE_SIZE
} from './constants.js';

import {
	_free, 
	ENVIRONMENT_IS_NODE, 
	ENVIRONMENT_IS_WEB, 
	ENVIRONMENT_IS_WORKER, 
	abort
}	from './utils.js';

import {
	HEAP32,
	Pointer_stringify,
	allocateUTF8,
	getMemory, 
	writeAsciiToMemory
} from './memory.js';

import {Module} 						from './module.js';
import {runtimeInitialized} from './runtime.js';


const ENV 					 = {};
const MAX_ENV_VALUES = 64;
const TOTAL_ENV_SIZE = 1024;

// NOT an arrow function since it's being used as 
// a function object with ___buildEnvironment.called assignment.
function ___buildEnvironment(environ) {
	let poolPtr;
	let envPtr;

	if (!___buildEnvironment.called) {
		___buildEnvironment.called = true;

		ENV['USER'] = ENV['LOGNAME'] = 'web_user';
		ENV['PATH'] = '/';
		ENV['PWD'] 	= '/';
		ENV['HOME'] = '/home/web_user';
		ENV['LANG'] = 'C.UTF-8';
		ENV['_'] 		= Module['thisProgram'];

		poolPtr = getMemory(TOTAL_ENV_SIZE);
		envPtr 	= getMemory(MAX_ENV_VALUES * 4);

		HEAP32[envPtr >> 2]  = poolPtr;
		HEAP32[environ >> 2] = envPtr;
	}
	else {
		envPtr 	= HEAP32[environ >> 2];
		poolPtr = HEAP32[envPtr >> 2];
	}

	let lines 		= [];
	let totalSize = 0;

	for (const key in ENV) {
		if (typeof ENV[key] === 'string') {
			const line = `${key}=${ENV[key]}`;

			lines.push(line);
			totalSize += line.length;
		}
	}

	if (totalSize > TOTAL_ENV_SIZE) {
		throw new Error('Environment size exceeded TOTAL_ENV_SIZE!');
	}

	const ptrSize = 4;

	lines.forEach((line, index) => {
		writeAsciiToMemory(line, poolPtr);

		HEAP32[envPtr + index * ptrSize >> 2] = poolPtr;
		poolPtr += line.length + 1;
	});

	HEAP32[envPtr + lines.length * ptrSize >> 2] = 0;
}

const _emscripten_get_now = () => {
	abort();
};

const _emscripten_get_now_is_monotonic = () => (
	ENVIRONMENT_IS_NODE || 
	(ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && 
	self['performance'] && 
	self['performance']['now'];
);

const ___setErrNo = value => {
	if (Module['___errno_location']) {
		HEAP32[Module['___errno_location']() >> 2] = value;
	}

	return value;
};

const _clock_gettime = (clk_id, tp) => {
	let now;

	if (clk_id === 0) {
		now = Date.now();
	}
	else if (clk_id === 1 && _emscripten_get_now_is_monotonic()) {
		now = _emscripten_get_now();
	}
	else {
		___setErrNo(ERRNO_CODES.EINVAL);
		return - 1;
	}

	HEAP32[tp >> 2] 		= now / 1e3 | 0;
	HEAP32[tp + 4 >> 2] = now % 1e3 * 1e3 * 1e3 | 0;

	return 0;
};

const ___clock_gettime = (...args) => _clock_gettime(...args);

const ___lock = () => {};

const ___map_file = (pathname, size) => {
	___setErrNo(ERRNO_CODES.EPERM);

	return -1;
};

const ___unlock = () => {};

const __exit = status => {
	exit(status);
};

const _abort = () => {
	Module['abort']();
};

// NOT an arrow function since it's being used as 
// a function object with _clock.start assignment.
function _clock() {
	if (_clock.start === undefined) {
		_clock.start = Date.now();
	}

	return (Date.now() - _clock.start) * (1e6 / 1e3) | 0;
}

const _longjmp = (env, value) => {
	Module['setThrew'](env, value || 1);

	throw 'longjmp';
};

const _emscripten_longjmp = (env, value) => {
	_longjmp(env, value);
};

const _execl = () => {
	___setErrNo(ERRNO_CODES.ENOEXEC);

	return -1;
};

const _execvp = (...args) => _execl(...args);

const _exit = status => {
	__exit(status);
};

const _fork = () => {
	___setErrNo(ERRNO_CODES.EAGAIN);

	return -1;
};

// NOT an arrow function since it's being used as 
// a function object with _getenv.ret assignment.
function _getenv(name) {
	if (name === 0) { return 0; }

	name = Pointer_stringify(name);

	if (!ENV.hasOwnProperty(name)) { return 0; }

	if (_getenv.ret) {
		_free(_getenv.ret);
	}

	_getenv.ret = allocateUTF8(ENV[name]);

	return _getenv.ret;
}

const _getpwnam = () => {
	throw 'getpwnam: TODO';
};

const _usleep = useconds => {
	const msec = useconds / 1e3;

	if (
		(ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && 
		self['performance'] && 
		self['performance']['now']
	) {
		const start = self['performance']['now']();

		while (self['performance']['now']() - start < msec) {}
	}
	else {
		const start = Date.now();

		while(Date.now() - start < msec) {}
	}

	return 0;
};

const _nanosleep = (rqtp, rmtp) => {
	const seconds 		= HEAP32[rqtp >> 2];
	const nanoseconds = HEAP32[rqtp + 4 >> 2];

	if (rmtp !== 0) {
		HEAP32[rmtp >> 2] 		= 0;
		HEAP32[rmtp + 4 >> 2] = 0;
	}

	return _usleep(seconds * 1e6 + nanoseconds / 1e3);
};

const _raise = sig => {
	___setErrNo(ERRNO_CODES.ENOSYS);

	return -1;
};

const _sysconf = name => {
	switch(name) {
		case 30:
			return PAGE_SIZE;
		case 85:
			const maxHeapSize = 2 * 1024 * 1024 * 1024 - 65536;

			return maxHeapSize / PAGE_SIZE;
		case 132:
		case 133:
		case 12:
		case 137:
		case 138:
		case 15:
		case 235:
		case 16:
		case 17:
		case 18:
		case 19:
		case 20:
		case 149:
		case 13:
		case 10:
		case 236:
		case 153:
		case 9:
		case 21:
		case 22:
		case 159:
		case 154:
		case 14:
		case 77:
		case 78:
		case 139:
		case 80:
		case 81:
		case 82:
		case 68:
		case 67:
		case 164:
		case 11:
		case 29:
		case 47:
		case 48:
		case 95:
		case 52:
		case 51:
		case 46:
			return 200809;
		case 79:
			return 0;
		case 27:
		case 246:
		case 127:
		case 128:
		case 23:
		case 24:
		case 160:
		case 161:
		case 181:
		case 182:
		case 242:
		case 183:
		case 184:
		case 243:
		case 244:
		case 245:
		case 165:
		case 178:
		case 179:
		case 49:
		case 50:
		case 168:
		case 169:
		case 175:
		case 170:
		case 171:
		case 172:
		case 97:
		case 76:
		case 32:
		case 173:
		case 35:
			return -1;
		case 176:
		case 177:
		case 7:
		case 155:
		case 8:
		case 157:
		case 125:
		case 126:
		case 92:
		case 93:
		case 129:
		case 130:
		case 131:
		case 94:
		case 91:
			return 1;
		case 74:
		case 60:
		case 69:
		case 70:
		case 4:
			return 1024;
		case 31:
		case 42:
		case 72:
			return 32;
		case 87:
		case 26:
		case 33:
			return 2147483647;
		case 34:
		case 1:
			return 47839;
		case 38:
		case 36:
			return 99;
		case 43:
		case 37:
			return 2048;
		case 0:
			return 2097152;
		case 3:
			return 65536;
		case 28:
			return 32768;
		case 44:
			return 32767;
		case 75:
			return 16384;
		case 39:
			return 1e3;
		case 89:
			return 700;
		case 71:
			return 256;
		case 40:
			return 255;
		case 2:
			return 100;
		case 180:
			return 64;
		case 25:
			return 20;
		case 5:
			return 16;
		case 6:
			return 6;
		case 73:
			return 4;
		case 84: {
			if (typeof navigator === 'object') {
				return navigator['hardwareConcurrency'] || 1;
			}

			return 1;
		};
	}

	___setErrNo(ERRNO_CODES.EINVAL);

	return -1;
};

const _system = command => {
	___setErrNo(ERRNO_CODES.EAGAIN);

	return -1;
};

const _wait = stat_loc => {
	___setErrNo(ERRNO_CODES.ECHILD);

	return -1;
};

const _waitpid = (...args) => _wait(...args);


export {
	___buildEnvironment,
	___clock_gettime,
	___lock,
	___map_file,
	___setErrNo,
	___unlock,
	__exit,
	_abort,
	_clock,
	_emscripten_get_now,
	_emscripten_longjmp,
	_execvp,
	_exit,
	_fork,
	_getenv,
	_getpwnam,
	_longjmp,
	_nanosleep,
	_raise,
	_sysconf,
	_system,
	_waitpid
};