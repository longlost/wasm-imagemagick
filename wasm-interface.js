

// TODO:
//
// 		Update webpack to v5.x and change module extentions to .mjs for use in Node.


import {
	ENVIRONMENT_IS_NODE,
} from './constants.js';

import {
	abort,
	err,
} from './utils.js';

import {
	ExitStatus,
	Module
} from './module.js';

import {
	DYNAMICTOP_PTR,
	HEAP32,
	STATICTOP,
	TOTAL_STACK,
	allocateUTF8OnStack,
	stackAlloc,
	staticAlloc,
	updateGlobalBufferViews
} from './memory.js';

import {
	_emscripten_get_now,
	staticSealed
} from './environment.js';

import {
	__ATEXIT__,
	__ATINIT__,
	__ATMAIN__,
	ensureInitRuntime,
	exit,
	shouldRunNow
} from './runtime.js';

import {
	___emscripten_environ_constructor,
	setAsm
} from './asm.js';

import TTY 						 from './tty.js';
import NODEFS 				 from './nodefs.js';
import FS 						 from './fs.js';
import integrateWasmJS from './integrate.js';


updateGlobalBufferViews();
integrateWasmJS();


const STATIC_BASE = 1024;

STATICTOP = STATIC_BASE + 1212304;

__ATINIT__.push({
	func: (function() {
		___emscripten_environ_constructor();
	})
});

Module['STATIC_BASE'] = STATIC_BASE;
Module['STATIC_BUMP'] = 1212304;

STATICTOP += 16;
STATICTOP += 16;
STATICTOP += 16;
STATICTOP += 16;


if (ENVIRONMENT_IS_NODE) {
	_emscripten_get_now = function _emscripten_get_now_actual() {
		const t = process['hrtime']();

		return t[0] * 1e3 + t[1] / 1e6;
	};
}
else if (
	typeof self === 'object' && 
	self['performance'] && 
	typeof self['performance']['now'] === 'function'
) {
	_emscripten_get_now = () => self['performance']['now']();
}
else if (typeof performance === 'object' && typeof performance['now'] === 'function') {
	_emscripten_get_now = () => performance['now']();
}
else {
	_emscripten_get_now = Date.now;
}


FS.staticInit();


__ATINIT__.unshift(() => {
	if (!Module['noFSInit'] && !FS.init.initialized) {
		FS.init();
	}
});

__ATMAIN__.push(() => {
	FS.ignorePermissions = false;
});

__ATEXIT__.push(() => {
	FS.quit();
});

__ATINIT__.unshift(() => {
	TTY.init();
});

__ATEXIT__.push(() => {
	TTY.shutdown();
});


if (ENVIRONMENT_IS_NODE) {
	NODEFS.staticInit();
}


let STACK_BASE 	 = 0;
let STACKTOP 	 	 = 0;
let STACK_MAX  	 = 0;
let DYNAMIC_BASE = 0;


const alignMemory = (size, factor) => {

	const STACK_ALIGN = 16;

	if (!factor) {
		factor = STACK_ALIGN;
	}

	return Math.ceil(size / factor) * factor;
};

DYNAMICTOP_PTR = staticAlloc(4);
STACK_BASE 		 = STACKTOP = alignMemory(STATICTOP);
STACK_MAX 		 = STACK_BASE + TOTAL_STACK;
DYNAMIC_BASE 	 = alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;

staticSealed = true;


setAsm();


const callMain = (...args) => {
	ensureInitRuntime();

	const argc = args.length + 1;
	const argv = stackAlloc((argc + 1) * 4);

	HEAP32[argv >> 2] = allocateUTF8OnStack(Module['thisProgram']);

	for (let i = 1; i < argc; i++) {
		HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1]);
	}

	HEAP32[(argv >> 2) + argc] = 0;

	try {
		const ret = Module['_main'](argc, argv, 0);

		exit(ret, true);
	}
	catch (e) {
		if (e instanceof ExitStatus) {
			return;
		}
		else if (e === 'SimulateInfiniteLoop') {
			Module['noExitRuntime'] = true;

			return;
		}
		else {
			let toLog = e;

			if (e && typeof e === 'object' && e.stack) {
				toLog = [e, e.stack];
			}

			err(`exception thrown: ${toLog}`);

			Module['quit'](1, e);
		}
	}
};


Module['abort'] = abort;


if (Module['preInit']) {
	if (typeof Module['preInit'] === 'function') {
		Module['preInit'] = [Module['preInit']];
	}

	while (Module['preInit'].length > 0) {
		Module['preInit'].pop()();
	}
}

if (Module['noInitialRun']) {
	shouldRunNow = false;
}

Module['noExitRuntime'] = true;


run();


export {
	FS,
	callMain
};
