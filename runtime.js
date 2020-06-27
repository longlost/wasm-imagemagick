
import {ABORT, EXITSTATUS} 	from './utils.js';
import {ExitStatus, Module} from './module.js';


const __ATPRERUN__ 		 = [];
const __ATINIT__ 			 = [];
const __ATMAIN__ 			 = [];
const __ATEXIT__ 			 = [];
const __ATPOSTRUN__ 	 = [];
let runtimeInitialized = false;
let runtimeExited 		 = false;
let shouldRunNow 			 = true;


const addOnPreRun = cb => {
	__ATPRERUN__.unshift(cb);
};

const callRuntimeCallbacks = callbacks => {

	while (callbacks.length > 0) {
		const callback = callbacks.shift();

		if (typeof callback === 'function') {
			callback();
			continue;
		}

		const {arg, func} = callback;

		if (typeof func === 'number') {

			if (arg === undefined) {
				Module['dynCall_v'](func);
			}
			else {
				Module['dynCall_vi'](func, arg);
			}
		}
		else {
			func(arg === undefined ? null : arg);
		}
	}
};

const preRun = () => {
	if (Module['preRun']) {

		if (typeof Module['preRun'] === 'function') { 
			Module['preRun'] = [Module['preRun']];

			while (Module['preRun'].length) {
				addOnPreRun(Module['preRun'].shift());
			}
		}

		callRuntimeCallbacks(__ATPRERUN__);
	}
};

const ensureInitRuntime = () => {
	if (runtimeInitialized) { return; }

	runtimeInitialized = true;
	callRuntimeCallbacks(__ATINIT__);
};

const preMain = () => {
	callRuntimeCallbacks(__ATMAIN__);
};

const exitRuntime = () => {
	callRuntimeCallbacks(__ATEXIT__);
	runtimeExited = true;
};

const postRun = () => {
	if (Module['postRun']) {

		if (typeof Module['postRun'] === 'function') {
			Module['postRun'] = [Module['postRun']];
		}

		while (Module['postRun'].length) {
			addOnPostRun(Module['postRun'].shift());
		}
	}

	callRuntimeCallbacks(__ATPOSTRUN__);
};

const addOnPostRun = cb => {
	__ATPOSTRUN__.unshift(cb);
};


let runDependencies 			= 0;
let dependenciesFulfilled = null;


dependenciesFulfilled = function runCaller() {
	if (!Module['calledRun']) {
		run();
	}

	if (!Module['calledRun']) {
		dependenciesFulfilled = runCaller;
	}
};

const addRunDependency = id => {
	runDependencies++;

	if (Module['monitorRunDependencies']) {
		Module['monitorRunDependencies'](runDependencies);
	}
};

const removeRunDependency = id => {
	runDependencies--;

	if (Module['monitorRunDependencies']) {
		Module['monitorRunDependencies'](runDependencies);
	}

	if (runDependencies == 0) {

		if (dependenciesFulfilled) {
			const callback = dependenciesFulfilled;

			dependenciesFulfilled = null;
			callback();
		}
	}
};

const doRun = args => {
	if (Module['calledRun']) { return; }

	Module['calledRun'] = true;

	if (ABORT) { return; }

	ensureInitRuntime();
	preMain();

	if (Module['onRuntimeInitialized']) {
		Module['onRuntimeInitialized']();
	}

	if (Module['_main'] && shouldRunNow) {
		Module['callMain'](args);
	}

	postRun();
};

const run = args => {
	args = args || Module['arguments'];

	if (runDependencies > 0) { return; }

	preRun();

	if (runDependencies > 0) { return; }

	if (Module['calledRun']) { return; }	

	if (Module['setStatus']) {
		Module['setStatus']('Running...');

		setTimeout(() => {

			setTimeout(() => {
				Module['setStatus']('');
			}, 1);

			doRun(args);
		}, 1);
	}
	else {
		doRun(args);
	}
};

Module['run'] = run;

let STACKTOP = 0;

const exit = (status, implicit) => {
	if (implicit && Module['noExitRuntime'] && status === 0) { return; }

	if (!Module['noExitRuntime']) {
		ABORT 		 = true;
		EXITSTATUS = status;
		STACKTOP 	 = 0;

		exitRuntime();
	}

	Module['quit'](status, new ExitStatus(status));
};


export {
	__ATEXIT__,
	__ATINIT__,
	__ATMAIN__,
	STACKTOP,
	addRunDependency,
	ensureInitRuntime,
	exit,
	removeRunDependency,
	run,
	runtimeInitialized,
	shouldRunNow
};
