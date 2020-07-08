

import mod 				 from './module.js';
import utils 			 from './utils.js';
import memory 		 from './memory.js';
import runtime 		 from './runtime.js';
import environment from './environment.js';
import FS 				 from './fs.js';
import asm 				 from './asm.js';


const directory = '/pictures';

FS.mkdir(directory);
FS.chdir(directory);


asm.setAsm();


const callMain = (args = []) => {
	runtime.ensureInitRuntime();

	const argc = args.length + 1;
	const argv = memory.exposed.stackAlloc((argc + 1) * 4);

	memory.exposed.HEAP32[argv >> 2] = memory.allocateUTF8OnStack(mod.Module['thisProgram']);

	for (let i = 1; i < argc; i++) {
		memory.exposed.HEAP32[(argv >> 2) + i] = memory.allocateUTF8OnStack(args[i - 1]);
	}

	memory.exposed.HEAP32[(argv >> 2) + argc] = 0;

	try {
		const ret = mod.Module['_main'](argc, argv, 0);

		runtime.exit(ret, true);
	}
	catch (error) {

		if (error instanceof mod.ExitStatus) {
			return;
		}
		else if (error === 'SimulateInfiniteLoop') {
			return;
		}
		else {
			let toLog = error;

			if (error && typeof error === 'object' && error.stack) {
				toLog = [error, error.stack];
			}

			utils.err(`exception thrown: ${toLog}`);

			utils.quit(1, error);
		}
	}
};


export {
	FS,
	callMain
};
