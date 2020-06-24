

import {Module} from './module.js';


const __ATPRERUN__ 		 = [];
const __ATINIT__ 			 = [];
const __ATMAIN__ 			 = [];
const __ATEXIT__ 			 = [];
const __ATPOSTRUN__ 	 = [];
let runtimeInitialized = false;
let runtimeExited 		 = false;

var shouldRunNow = true;




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

		const func = callback.func;

		if (typeof func === 'number') {

			if (callback.arg === undefined) {
				Module['dynCall_v'](func);
			}
			else {
				Module['dynCall_vi'](func, callback.arg);
			}
		}
		else {
			func(callback.arg === undefined ? null : callback.arg);
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

function ensureInitRuntime() {
	if (runtimeInitialized) { return; }

	runtimeInitialized = true;
	callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
	callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
	callRuntimeCallbacks(__ATEXIT__);
	runtimeExited = true;
}

function postRun() {
	if (Module['postRun']) {

		if (typeof Module['postRun'] === 'function') {
			Module['postRun'] = [Module['postRun']];
		}

		while (Module['postRun'].length) {
			addOnPostRun(Module['postRun'].shift());
		}
	}

	callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPostRun(cb) {
	__ATPOSTRUN__.unshift(cb);
}


var runDependencies 			= 0;
var runDependencyWatcher 	= null;
var dependenciesFulfilled = null;



dependenciesFulfilled = function runCaller() {
	if (!Module['calledRun']) {
		run();
	}

	if (!Module['calledRun']) {
		dependenciesFulfilled = runCaller;
	}
};


function addRunDependency(id) {
	runDependencies++;

	if (Module['monitorRunDependencies']) {
		Module['monitorRunDependencies'](runDependencies);
	}
}

function removeRunDependency(id) {
	runDependencies--;

	if (Module['monitorRunDependencies']) {
		Module['monitorRunDependencies'](runDependencies);
	}

	if (runDependencies == 0) {

		if (runDependencyWatcher !== null) {
			clearInterval(runDependencyWatcher);
			runDependencyWatcher = null;
		}

		if (dependenciesFulfilled) {
			const callback = dependenciesFulfilled;

			dependenciesFulfilled = null;
			callback();
		}
	}
}



function run(args) {
	args = args || Module['arguments'];

	if (runDependencies > 0) { return;}

	preRun();

	if (runDependencies > 0) { return; }

	if (Module['calledRun']) { return; }

	function doRun() {
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
	}

	if (Module['setStatus']) {
		Module['setStatus']('Running...');

		setTimeout((function() {

			setTimeout((function() {
				Module['setStatus']('');
			}), 1);

			doRun();
		}), 1);
	}
	else {
		doRun();
	}
}

Module['run'] = run;


var initialStackTop;

function exit(status, implicit) {
	if (implicit && Module['noExitRuntime'] && status === 0) { return; }

	if (!Module['noExitRuntime']) {
		ABORT 		 = true;
		EXITSTATUS = status;
		STACKTOP 	 = initialStackTop;

		exitRuntime();
	}

	Module['quit'](status, new ExitStatus(status));
}


export {
	__ATEXIT__,
	__ATINIT__,
	__ATMAIN__,
	ensureInitRuntime,
	exit,
	runtimeInitialized,
	shouldRunNow
};
