

import {
	ENVIRONMENT_IS_WEB,
	ENVIRONMENT_IS_WORKER,
	ENVIRONMENT_IS_NODE,
	ENVIRONMENT_IS_SHELL
} from './constants.js';

import {
	err,
	out,
} from './utils.js';

import {
	reader,
	readBinary
} from './read.js';


const Module = {};


Module['arguments'] 	= [];
Module['thisProgram'] = './this.program';

Module['quit'] = (status, toThrow) => {
	throw toThrow;
};

Module['preRun']  = []; 
Module['postRun'] = [];

Module['read'] 			 = reader;
Module['readBinary'] = readBinary;

Module['print'] 	 = out;
Module['printErr'] = err;

Module['preloadedImages'] = {};
Module['preloadedAudios'] = {};


function ExitStatus(status) {
	this.name 	 = 'ExitStatus';
	this.message = 'Program terminated with exit(' + status + ')';
	this.status  = status;
}

ExitStatus.prototype = new Error;
ExitStatus.prototype.constructor = ExitStatus;


let scriptDirectory = '';


if (ENVIRONMENT_IS_NODE) {
	scriptDirectory = __dirname + '/';

	if (process['argv'].length > 1) {
		Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
	}

	Module['arguments'] = process['argv'].slice(2);

	process['on']('uncaughtException', ex => {
		if (!(ex instanceof ExitStatus)) {
			throw ex;
		}
	});

	process['on']('unhandledRejection', (reason, p) => {
		process['exit'](1);
	});

	Module['quit'] = status => {
		process['exit'](status);
	};

	Module['inspect'] = () => {
		return '[Emscripten Module object]';
	};
}

else if (ENVIRONMENT_IS_SHELL) {

	if (typeof scriptArgs !== 'undefined') {
		Module['arguments'] = scriptArgs;
	}
	else if (typeof arguments !== 'undefined') {
		Module['arguments'] = arguments;
	}

	if (typeof quit === 'function') {
		Module['quit'] = status => {
			quit(status);
		};
	}
}

else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {

	if (ENVIRONMENT_IS_WEB) {
		if (document.currentScript) {
			scriptDirectory = document.currentScript.src;
		}
	}
	else {
		scriptDirectory = self.location.href;
	}

	if (scriptDirectory.indexOf('blob:') !== 0) {
		scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf('/') + 1);
	}
	else {
		scriptDirectory = '';
	}
}


export {
	ExitStatus,
	Module, 
	scriptDirectory
};
