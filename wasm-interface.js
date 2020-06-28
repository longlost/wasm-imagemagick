

// TODO:
//
// 		Update webpack to v5.x and change module extentions to .mjs for use in Node.


import {
	ENVIRONMENT_IS_NODE,
} from './constants.js';

import {
	ExitStatus,
	Module
} from './module.js';

import utils 					 from './utils.js';
import memory 				 from './memory.js';
import environment 		 from './environment.js';
import runtime 				 from './runtime.js';
import asm 						 from './asm.js';
import TTY 						 from './tty.js';
import NODEFS 				 from './nodefs.js';
import FS 						 from './fs.js';
import integrateWasmJS from './integrate.js';


memory.updateGlobalBufferViews();
integrateWasmJS();


const STATIC_BASE = 1024;

memory.STATICTOP = STATIC_BASE + 1212304;

runtime.__ATINIT__.push({
	func: (function() {
		asm.___emscripten_environ_constructor();
	})
});

Module['STATIC_BASE'] = STATIC_BASE;
Module['STATIC_BUMP'] = 1212304;

memory.STATICTOP += 16;
memory.STATICTOP += 16;
memory.STATICTOP += 16;
memory.STATICTOP += 16;


if (ENVIRONMENT_IS_NODE) {
	environment._emscripten_get_now = function _emscripten_get_now_actual() {
		const t = process['hrtime']();

		return t[0] * 1e3 + t[1] / 1e6;
	};
}
else if (
	typeof self === 'object' && 
	self['performance'] && 
	typeof self['performance']['now'] === 'function'
) {
	environment._emscripten_get_now = () => self['performance']['now']();
}
else if (typeof performance === 'object' && typeof performance['now'] === 'function') {
	environment._emscripten_get_now = () => performance['now']();
}
else {
	environment._emscripten_get_now = Date.now;
}


FS.staticInit();


runtime.__ATINIT__.unshift(() => {
	if (!Module['noFSInit'] && !FS.init.initialized) {
		FS.init();
	}
});

runtime.__ATMAIN__.push(() => {
	FS.ignorePermissions = false;
});

runtime.__ATEXIT__.push(() => {
	FS.quit();
});

runtime.__ATINIT__.unshift(() => {
	TTY.init();
});

runtime.__ATEXIT__.push(() => {
	TTY.shutdown();
});


if (ENVIRONMENT_IS_NODE) {
	NODEFS.staticInit();
}


let STACK_BASE 	 = 0;
let STACK_MAX  	 = 0;
let DYNAMIC_BASE = 0;


const alignMemory = (size, factor) => {

	const STACK_ALIGN = 16;

	if (!factor) {
		factor = STACK_ALIGN;
	}

	return Math.ceil(size / factor) * factor;
};

memory.DYNAMICTOP_PTR = memory.staticAlloc(4);
STACK_BASE 		 = runtime.STACKTOP = alignMemory(memory.STATICTOP);
STACK_MAX 		 = STACK_BASE + memory.TOTAL_STACK;
DYNAMIC_BASE 	 = alignMemory(STACK_MAX);

memory.HEAP32[memory.DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;

memory.staticSealed = true;


asm.setAsm();


const callMain = (...args) => {
	runtime.ensureInitRuntime();

	const argc = args.length + 1;
	const argv = memory.stackAlloc((argc + 1) * 4);

	memory.HEAP32[argv >> 2] = memory.allocateUTF8OnStack(Module['thisProgram']);

	for (let i = 1; i < argc; i++) {
		memory.HEAP32[(argv >> 2) + i] = memory.allocateUTF8OnStack(args[i - 1]);
	}

	memory.HEAP32[(argv >> 2) + argc] = 0;

	try {
		const ret = Module['_main'](argc, argv, 0);

		runtime.exit(ret, true);
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

			utils.err(`exception thrown: ${toLog}`);

			Module['quit'](1, e);
		}
	}
};


Module['abort'] = utils.abort;


if (Module['preInit']) {
	if (typeof Module['preInit'] === 'function') {
		Module['preInit'] = [Module['preInit']];
	}

	while (Module['preInit'].length > 0) {
		Module['preInit'].pop()();
	}
}

if (Module['noInitialRun']) {
	runtime.shouldRunNow = false;
}

Module['noExitRuntime'] = true;


runtime.run();


export {
	FS,
	callMain
};
