
import utils from './utils.js';
import mod 	 from './module.js';


// Exposed to allow set/update from other modules.
const exposed = {
	STACKTOP: 						 0,
	dependenciesFulfilled: null,
	runtimeInitialized: 	 false,
	shouldRunNow: 				 false
};


const __ATPRERUN__ 		 = [];
const __ATINIT__ 			 = [];
const __ATMAIN__ 			 = [];
const __ATEXIT__ 			 = [];
const __ATPOSTRUN__ 	 = [];
let runtimeExited 		 = false;


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
				mod.Module['dynCall_v'](func);
			}
			else {
				mod.Module['dynCall_vi'](func, arg);
			}
		}
		else {
			func(arg === undefined ? null : arg);
		}
	}
};

const preRun = () => {
	if (mod.Module['preRun']) {

		if (typeof mod.Module['preRun'] === 'function') { 
			mod.Module['preRun'] = [mod.Module['preRun']];

			while (mod.Module['preRun'].length) {
				addOnPreRun(mod.Module['preRun'].shift());
			}
		}

		callRuntimeCallbacks(__ATPRERUN__);
	}
};

const ensureInitRuntime = () => {
	if (exposed.runtimeInitialized) { return; }

	exposed.runtimeInitialized = true;

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
	if (mod.Module['postRun']) {

		if (typeof mod.Module['postRun'] === 'function') {
			mod.Module['postRun'] = [mod.Module['postRun']];
		}

		while (mod.Module['postRun'].length) {
			addOnPostRun(mod.Module['postRun'].shift());
		}
	}

	callRuntimeCallbacks(__ATPOSTRUN__);
};

const addOnPostRun = cb => {
	__ATPOSTRUN__.unshift(cb);
};


let runDependencies = 0;

const doRun = args => {
	if (mod.Module['calledRun']) { return; }

	mod.Module['calledRun'] = true;

	if (utils.exposed.ABORT) { return; }

	ensureInitRuntime();
	preMain();

	if (mod.Module['onRuntimeInitialized']) {
		mod.Module['onRuntimeInitialized']();
	}

	if (mod.Module['_main'] && exposed.shouldRunNow) {
		mod.Module['callMain'](args);
	}

	postRun();
};

const run = args => {
	args = args || mod.Module['arguments'];

	if (runDependencies > 0) { return; }

	preRun();

	if (runDependencies > 0) { return; }

	if (mod.Module['calledRun']) { return; }	

	if (mod.Module['setStatus']) {
		mod.Module['setStatus']('Running...');

		setTimeout(() => {

			setTimeout(() => {
				mod.Module['setStatus']('');
			}, 1);

			doRun(args);
		}, 1);
	}
	else {
		doRun(args);
	}
};

mod.Module['run'] = run;

const exit = (status, implicit) => {
	if (implicit && mod.Module['noExitRuntime'] && status === 0) { return; }

	if (!mod.Module['noExitRuntime']) {
		utils.exposed.ABORT 		 = true;
		utils.exposed.EXITSTATUS = status;
		exposed.STACKTOP 				 = 0;

		exitRuntime();
	}

	mod.Module['quit'](status, new mod.ExitStatus(status));
};

const addRunDependency = id => {
	runDependencies++;

	if (mod.Module['monitorRunDependencies']) {
		mod.Module['monitorRunDependencies'](runDependencies);
	}
};

const removeRunDependency = id => {
	runDependencies--;

	if (mod.Module['monitorRunDependencies']) {
		mod.Module['monitorRunDependencies'](runDependencies);
	}

	if (runDependencies === 0) {

		if (exposed.dependenciesFulfilled) {
			const callback = exposed.dependenciesFulfilled;

			exposed.dependenciesFulfilled = null;

			callback();
		}
	}
};


export default {
	__ATEXIT__,
	__ATINIT__,
	__ATMAIN__,
	addRunDependency,
	ensureInitRuntime,
	exit,
	exposed,
	removeRunDependency,
	run
};
