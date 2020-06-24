
import {
	_free,
	_memset,
	abort,
} from './utils.js';

import {
	___assert_fail,
	_emscripten_memcpy_big,
	_emscripten_replace_memory,
	_malloc,
	DYNAMICTOP_PTR,
	abortOnCannotGrowMemory,
	buffer,
	enlargeMemory,
	getTotalMemory,
	stackAlloc,
} from './memory.js';

import {
	__get_daylight,
	__get_timezone,
	__get_tzname
} from './time.js';

import {
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
} from './syscalls.js';

import {
	_llvm_exp2_f64,
	_llvm_log10_f64,
	_llvm_trap,
} from './llvm.js';

import {
	stackRestore,
	invoke_dii,
	invoke_i,
	invoke_ii,
	invoke_iifi,
	invoke_iii,
	invoke_iiii,
	invoke_iiiii,
	invoke_iiiiii,
	invoke_iiiiiii,
	invoke_iiiiiiii,
	invoke_iiiiiiiii,
	invoke_iiiiiiiiii,
	invoke_iiiiiiiiiii,
	invoke_iiijj,
	invoke_iij,
	invoke_ji,
	invoke_v,
	invoke_vi,
	invoke_vii,
	invoke_viid,
	invoke_viidddddddd,
	invoke_viii,
	invoke_viiii,
	invoke_viiiii,
	invoke_viiiiii,
	invoke_viiiiiiiii,
	invoke_vij,
} from './invoke.js';

import {Module} from './module.js';


let ___emscripten_environ_constructor;


Module['asmGlobalArg'] = {};

Module['asmLibraryArg'] = {
	'abort': abort,
	'enlargeMemory': enlargeMemory,
	'getTotalMemory': getTotalMemory,
	'abortOnCannotGrowMemory': abortOnCannotGrowMemory,
	'invoke_dii': invoke_dii,
	'invoke_i': invoke_i,
	'invoke_ii': invoke_ii,
	'invoke_iifi': invoke_iifi,
	'invoke_iii': invoke_iii,
	'invoke_iiii': invoke_iiii,
	'invoke_iiiii': invoke_iiiii,
	'invoke_iiiiii': invoke_iiiiii,
	'invoke_iiiiiii': invoke_iiiiiii,
	'invoke_iiiiiiii': invoke_iiiiiiii,
	'invoke_iiiiiiiii': invoke_iiiiiiiii,
	'invoke_iiiiiiiiii': invoke_iiiiiiiiii,
	'invoke_iiiiiiiiiii': invoke_iiiiiiiiiii,
	'invoke_iiijj': invoke_iiijj,
	'invoke_iij': invoke_iij,
	'invoke_ji': invoke_ji,
	'invoke_v': invoke_v,
	'invoke_vi': invoke_vi,
	'invoke_vii': invoke_vii,
	'invoke_viid': invoke_viid,
	'invoke_viidddddddd': invoke_viidddddddd,
	'invoke_viii': invoke_viii,
	'invoke_viiii': invoke_viiii,
	'invoke_viiiii': invoke_viiiii,
	'invoke_viiiiii':invoke_viiiiii,
	'invoke_viiiiiiiii': invoke_viiiiiiiii,
	'invoke_vij': invoke_vij,
	'___assert_fail': ___assert_fail,
	'___buildEnvironment': ___buildEnvironment,
	'___clock_gettime': ___clock_gettime,
	'___lock': ___lock,
	'___map_file': ___map_file,
	'___setErrNo': ___setErrNo,
	'___syscall10': ___syscall10,
	'___syscall114': ___syscall114,
	'___syscall118': ___syscall118,
	'___syscall140': ___syscall140,
	'___syscall145': ___syscall145,
	'___syscall146': ___syscall146,
	'___syscall15': ___syscall15,
	'___syscall180': ___syscall180,
	'___syscall181': ___syscall181,
	'___syscall183': ___syscall183,
	'___syscall191': ___syscall191,
	'___syscall192': ___syscall192,
	'___syscall195': ___syscall195,
	'___syscall197': ___syscall197,
	'___syscall20': ___syscall20,
	'___syscall220': ___syscall220,
	'___syscall221': ___syscall221,
	'___syscall3': ___syscall3,
	'___syscall324': ___syscall324,
	'___syscall33': ___syscall33,
	'___syscall340': ___syscall340,
	'___syscall38': ___syscall38,
	'___syscall4': ___syscall4,
	'___syscall5': ___syscall5,
	'___syscall54': ___syscall54,
	'___syscall6': ___syscall6,
	'___syscall77': ___syscall77,
	'___syscall83': ___syscall83,
	'___syscall85': ___syscall85,
	'___syscall91': ___syscall91,
	'___syscall94': ___syscall94,
	'___unlock': ___unlock,
	'__exit': __exit,
	'_abort': _abort,
	'_clock': _clock,
	'_emscripten_longjmp': _emscripten_longjmp,
	'_emscripten_memcpy_big': _emscripten_memcpy_big,
	'_execvp': _execvp,
	'_exit': _exit,
	'_fork': _fork,
	'_getenv': _getenv,
	'_getpwnam': _getpwnam,
	'_gettimeofday': _gettimeofday,
	'_gmtime_r': _gmtime_r,
	'_llvm_exp2_f64': _llvm_exp2_f64,
	'_llvm_log10_f64': _llvm_log10_f64,
	'_llvm_trap': _llvm_trap,
	'_localtime_r': _localtime_r,
	'_longjmp': _longjmp,
	'_nanosleep': _nanosleep,
	'_raise': _raise,
	'_sigaction': _sigaction,
	'_sigaddset': _sigaddset,
	'_sigemptyset': _sigemptyset,
	'_signal': _signal,
	'_sigprocmask': _sigprocmask,
	'_strftime': _strftime,
	'_sysconf': _sysconf,
	'_system': _system,
	'_time': _time,
	'_times': _times,
	'_waitpid': _waitpid,
	'DYNAMICTOP_PTR': DYNAMICTOP_PTR,
	'STACKTOP': STACKTOP
};


const setAsm = () => {
	const asm = Module['asm'](Module.['asmGlobalArg'], Module.['asmLibraryArg'], buffer);

	Module['asm'] = asm;

	___emscripten_environ_constructor = Module['___emscripten_environ_constructor'] = (function() {
		return Module['asm']['___emscripten_environ_constructor'].apply(null, arguments);
	});

	__get_daylight = Module['__get_daylight'] = (function() {
		return Module['asm']['__get_daylight'].apply(null, arguments);
	});

	__get_timezone = Module['__get_timezone'] = (function() {
		return Module['asm']['__get_timezone'].apply(null, arguments);
	});

	__get_tzname = Module['__get_tzname'] = (function() {
		return Module['asm']['__get_tzname'].apply(null, arguments);
	});

	_emscripten_replace_memory = Module['_emscripten_replace_memory'] = (function() {
		return Module['asm']['_emscripten_replace_memory'].apply(null, arguments);
	});

	_free = Module['_free'] = (function() {
		return Module['asm']['_free'].apply(null, arguments);
	});

	_malloc = Module['_malloc'] = (function() {
		return Module['asm']['_malloc'].apply(null, arguments);
	});

	_memalign = Module['_memalign'] = (function() {
		return Module['asm']['_memalign'].apply(null, arguments);
	});

	_memset = Module['_memset'] = (function() {
		return Module['asm']['_memset'].apply(null, arguments);
	});

	stackAlloc = Module['stackAlloc'] = (function() {
		return Module['asm']['stackAlloc'].apply(null, arguments);
	});

	stackRestore = Module['stackRestore'] = (function() {
		return Module['asm']['stackRestore'].apply(null, arguments);
	});

	Module['___errno_location'] = (function() {
		return Module['asm']['___errno_location'].apply(null, arguments);
	});

	Module['_main'] = (function() {
		return Module['asm']['_main'].apply(null, arguments);
	});

	Module['setThrew'] = (function() {
		return Module['asm']['setThrew'].apply(null, arguments);
	});

	Module['stackSave'] = (function() {
		return Module['asm']['stackSave'].apply(null, arguments);
	});

	Module['dynCall_dii'] = (function() {
		return Module['asm']['dynCall_dii'].apply(null, arguments);
	});

	Module['dynCall_i'] = (function() {
		return Module['asm']['dynCall_i'].apply(null, arguments);
	});

	Module['dynCall_ii'] = (function() {
		return Module['asm']['dynCall_ii'].apply(null, arguments);
	});

	Module['dynCall_iifi'] = (function() {
		return Module['asm']['dynCall_iifi'].apply(null, arguments);
	});

	Module['dynCall_iii'] = (function() {
		return Module['asm']['dynCall_iii'].apply(null, arguments);
	});

	Module['dynCall_iiii'] = (function() {
		return Module['asm']['dynCall_iiii'].apply(null, arguments);
	});

	Module['dynCall_iiiii'] = (function() {
		return Module['asm']['dynCall_iiiii'].apply(null, arguments);
	});

	Module['dynCall_iiiiii'] = (function() {
		return Module['asm']['dynCall_iiiiii'].apply(null, arguments);
	});

	Module['dynCall_iiiiiii'] = (function() {
		return Module['asm']['dynCall_iiiiiii'].apply(null, arguments);
	});

	Module['dynCall_iiiiiiii'] = (function() {
		return Module['asm']['dynCall_iiiiiiii'].apply(null, arguments);
	});

	Module['dynCall_iiiiiiiii'] = (function() {
		return Module['asm']['dynCall_iiiiiiiii'].apply(null, arguments);
	});

	Module['dynCall_iiiiiiiiii'] = (function() {
		return Module['asm']['dynCall_iiiiiiiiii'].apply(null, arguments);
	});

	Module['dynCall_iiiiiiiiiii'] = (function() {
		return Module['asm']['dynCall_iiiiiiiiiii'].apply(null, arguments);
	});

	Module['dynCall_iiijj'] = (function() {
		return Module['asm']['dynCall_iiijj'].apply(null, arguments);
	});

	Module['dynCall_iij'] = (function() {
		return Module['asm']['dynCall_iij'].apply(null, arguments);
	});

	Module['dynCall_ji'] = (function() {
		return Module['asm']['dynCall_ji'].apply(null, arguments);
	});

	Module['dynCall_v'] = (function() {
		return Module['asm']['dynCall_v'].apply(null, arguments);
	});

	Module['dynCall_vi'] = (function() {
		return Module['asm']['dynCall_vi'].apply(null, arguments);
	});

	Module['dynCall_vii'] = (function() {
		return Module['asm']['dynCall_vii'].apply(null, arguments);
	});

	Module['dynCall_viid'] = (function() {
		return Module['asm']['dynCall_viid'].apply(null, arguments);
	});

	Module['dynCall_viidddddddd'] = (function() {
		return Module['asm']['dynCall_viidddddddd'].apply(null, arguments);
	});

	Module['dynCall_viii'] = (function() {
		return Module['asm']['dynCall_viii'].apply(null, arguments);
	});

	Module['dynCall_viiii'] = (function() {
		return Module['asm']['dynCall_viiii'].apply(null, arguments);
	});

	Module['dynCall_viiiii'] = (function() {
		return Module['asm']['dynCall_viiiii'].apply(null, arguments);
	});

	Module['dynCall_viiiiii'] = (function() {
		return Module['asm']['dynCall_viiiiii'].apply(null, arguments);
	});

	Module['dynCall_viiiiiiiii'] = (function() {
		return Module['asm']['dynCall_viiiiiiiii'].apply(null, arguments);
	});

	Module['dynCall_vij'] = (function() {
		return Module['asm']['dynCall_vij'].apply(null, arguments);
	});

	Module['asm'] = asm;
};


export {
	___emscripten_environ_constructor,
	setAsm
};
