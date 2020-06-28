

import utils 	 		 from './utils.js';
import memory  		 from './memory.js';
import runtime 		 from './runtime.js';
import environment from './environment.js';
import signal 		 from './signal.js';
import time 			 from './time.js';
import date 			 from './date.js';
import syscalls 	 from './syscalls.js';
import llvm 			 from './llvm.js';
import invoke 		 from './invoke.js';
import {Module} 	 from './module.js';


let ___emscripten_environ_constructor;


Module['asmGlobalArg'] = {};

Module['asmLibraryArg'] = {
	'abort': 									 utils.abort,
	'enlargeMemory': 					 memory.enlargeMemory,
	'getTotalMemory': 				 memory.getTotalMemory,
	'abortOnCannotGrowMemory': memory.abortOnCannotGrowMemory,
	'invoke_dii': 						 invoke.invoke_dii,
	'invoke_i': 							 invoke.invoke_i,
	'invoke_ii': 							 invoke.invoke_ii,
	'invoke_iifi': 						 invoke.invoke_iifi,
	'invoke_iii': 						 invoke.invoke_iii,
	'invoke_iiii': 						 invoke.invoke_iiii,
	'invoke_iiiii': 					 invoke.invoke_iiiii,
	'invoke_iiiiii': 					 invoke.invoke_iiiiii,
	'invoke_iiiiiii': 				 invoke.invoke_iiiiiii,
	'invoke_iiiiiiii': 				 invoke.invoke_iiiiiiii,
	'invoke_iiiiiiiii': 			 invoke.invoke_iiiiiiiii,
	'invoke_iiiiiiiiii': 			 invoke.invoke_iiiiiiiiii,
	'invoke_iiiiiiiiiii': 		 invoke.invoke_iiiiiiiiiii,
	'invoke_iiijj': 					 invoke.invoke_iiijj,
	'invoke_iij': 						 invoke.invoke_iij,
	'invoke_ji': 							 invoke.invoke_ji,
	'invoke_v': 							 invoke.invoke_v,
	'invoke_vi': 							 invoke.invoke_vi,
	'invoke_vii': 						 invoke.invoke_vii,
	'invoke_viid': 						 invoke.invoke_viid,
	'invoke_viidddddddd': 		 invoke.invoke_viidddddddd,
	'invoke_viii': 						 invoke.invoke_viii,
	'invoke_viiii': 					 invoke.invoke_viiii,
	'invoke_viiiii': 					 invoke.invoke_viiiii,
	'invoke_viiiiii': 				 invoke.invoke_viiiiii,
	'invoke_viiiiiiiii': 			 invoke.invoke_viiiiiiiii,
	'invoke_vij': 						 invoke.invoke_vij,
	'___assert_fail': 				 memory.___assert_fail,
	'___buildEnvironment': 		 environment.___buildEnvironment,
	'___clock_gettime': 			 environment.___clock_gettime,
	'___lock': 								 environment.___lock,
	'___map_file': 						 environment.___map_file,
	'___setErrNo': 						 environment.___setErrNo,
	'___syscall10': 					 syscalls.___syscall10,
	'___syscall114': 					 syscalls.___syscall114,
	'___syscall118': 					 syscalls.___syscall118,
	'___syscall140': 					 syscalls.___syscall140,
	'___syscall145': 					 syscalls.___syscall145,
	'___syscall146': 					 syscalls.___syscall146,
	'___syscall15': 					 syscalls.___syscall15,
	'___syscall180': 					 syscalls.___syscall180,
	'___syscall181': 					 syscalls.___syscall181,
	'___syscall183': 					 syscalls.___syscall183,
	'___syscall191': 					 syscalls.___syscall191,
	'___syscall192': 					 syscalls.___syscall192,
	'___syscall195': 					 syscalls.___syscall195,
	'___syscall197': 					 syscalls.___syscall197,
	'___syscall20': 					 syscalls.___syscall20,
	'___syscall220': 					 syscalls.___syscall220,
	'___syscall221': 					 syscalls.___syscall221,
	'___syscall3': 						 syscalls.___syscall3,
	'___syscall324': 					 syscalls.___syscall324,
	'___syscall33': 					 syscalls.___syscall33,
	'___syscall340': 					 syscalls.___syscall340,
	'___syscall38': 					 syscalls.___syscall38,
	'___syscall4': 						 syscalls.___syscall4,
	'___syscall5': 						 syscalls.___syscall5,
	'___syscall54': 					 syscalls.___syscall54,
	'___syscall6': 						 syscalls.___syscall6,
	'___syscall77': 					 syscalls.___syscall77,
	'___syscall83': 					 syscalls.___syscall83,
	'___syscall85': 					 syscalls.___syscall85,
	'___syscall91': 					 syscalls.___syscall91,
	'___syscall94': 					 syscalls.___syscall94,
	'___unlock': 							 environment.___unlock,
	'__exit': 								 environment.__exit,
	'_abort': 								 environment._abort,
	'_clock': 								 environment._clock,
	'_emscripten_longjmp': 		 environment._emscripten_longjmp,
	'_emscripten_memcpy_big':  memory._emscripten_memcpy_big,
	'_execvp': 								 environment._execvp,
	'_exit': 									 environment._exit,
	'_fork': 									 environment._fork,
	'_getenv': 								 environment._getenv,
	'_getpwnam': 							 environment._getpwnam,
	'_gettimeofday': 					 time._gettimeofday,
	'_gmtime_r': 							 time._gmtime_r,
	'_llvm_exp2_f64': 				 llvm._llvm_exp2_f64,
	'_llvm_log10_f64': 				 llvm._llvm_log10_f64,
	'_llvm_trap': 						 llvm._llvm_trap,
	'_localtime_r': 					 time._localtime_r,
	'_longjmp': 							 environment._longjmp,
	'_nanosleep': 						 environment._nanosleep,
	'_raise': 								 environment._raise,
	'_sigaction': 						 signal._sigaction,
	'_sigaddset': 						 signal._sigaddset,
	'_sigemptyset': 					 signal._sigemptyset,
	'_signal': 								 signal._signal,
	'_sigprocmask': 					 signal._sigprocmask,
	'_strftime': 							 date._strftime,
	'_sysconf': 							 environment._sysconf,
	'_system': 								 environment._system,
	'_time': 									 time._time,
	'_times': 								 time._times,
	'_waitpid': 							 environment._waitpid,
	'DYNAMICTOP_PTR': 				 memory.DYNAMICTOP_PTR,
	'STACKTOP': 							 runtime.STACKTOP
};


const setAsm = () => {
	const asm = Module['asm'](Module['asmGlobalArg'], Module['asmLibraryArg'], memory.buffer);

	Module['asm'] = asm;

	___emscripten_environ_constructor = Module['___emscripten_environ_constructor'] = (function() {
		return Module['asm']['___emscripten_environ_constructor'].apply(null, arguments);
	});

	time.__get_daylight = Module['__get_daylight'] = (function() {
		return Module['asm']['__get_daylight'].apply(null, arguments);
	});

	time.__get_timezone = Module['__get_timezone'] = (function() {
		return Module['asm']['__get_timezone'].apply(null, arguments);
	});

	time.__get_tzname = Module['__get_tzname'] = (function() {
		return Module['asm']['__get_tzname'].apply(null, arguments);
	});

	memory._emscripten_replace_memory = Module['_emscripten_replace_memory'] = (function() {
		return Module['asm']['_emscripten_replace_memory'].apply(null, arguments);
	});

	utils._free = Module['_free'] = (function() {
		return Module['asm']['_free'].apply(null, arguments);
	});

	memory._malloc = Module['_malloc'] = (function() {
		return Module['asm']['_malloc'].apply(null, arguments);
	});

	syscalls._memalign = Module['_memalign'] = (function() {
		return Module['asm']['_memalign'].apply(null, arguments);
	});

	utils._memset = Module['_memset'] = (function() {
		return Module['asm']['_memset'].apply(null, arguments);
	});

	memory.stackAlloc = Module['stackAlloc'] = (function() {
		return Module['asm']['stackAlloc'].apply(null, arguments);
	});

	invoke.stackRestore = Module['stackRestore'] = (function() {
		return Module['asm']['stackRestore'].apply(null, arguments);
	});

	invoke.stackSave = Module['stackSave'] = (function() {
		return Module['asm']['stackSave'].apply(null, arguments);
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


export default {
	___emscripten_environ_constructor,
	setAsm
};
