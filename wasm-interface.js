

import {PROGRAM_STRING} from './constants.js';
import utils 						from './utils.js';
import memory 					from './memory.js';
import FS 							from './fs.js';
import asm 							from './asm.js';


let main;
const directory = '/pictures';

FS.mkdir(directory);
FS.chdir(directory);

// Wait for 'asm.init' to complete no matter how
// many times 'callMain' is called before it does.
const initGen = function* (waiting = true) {
	const queue = [];

	// Initialize wasm, then resolve all
	// invocations waiting in the queue.
	const startup = async () => {

		main = await asm.init();

		queue.forEach(resolver => {
			resolver();
		});

		waiting = false;
	};

	// First iteration.
	yield startup();

	// Queue up all invocations that come in
	// before wasm has finished initializing.
	while (waiting) {
		let resolver;

		const promise = new Promise(resolve => {
			resolver = resolve;
		});

		queue.push(resolver);

		yield promise;
	}

	return;
};

const init = initGen();


const callMain = async commands => {
	const {done, value} = init.next();

	if (!done) {
		await value;
	}

	const argc = commands.length + 1;
	const argv = memory.exposed.stackAlloc((argc + 1) * 4);

	memory.exposed.HEAP32[argv >> 2] = memory.allocateUTF8OnStack(PROGRAM_STRING);

	for (let i = 1; i < argc; i++) {
		memory.exposed.HEAP32[(argv >> 2) + i] = memory.allocateUTF8OnStack(commands[i - 1]);
	}

	memory.exposed.HEAP32[(argv >> 2) + argc] = 0;

	try {
		const ret = main(argc, argv, 0);

		utils.exit(ret, true);

		return utils.getOutput();
	}
	catch (error) {

		if (error instanceof utils.ExitStatus) {
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

			utils.err(`Exception thrown: ${toLog}`);

			utils.quit(1, error);
		}
	}
};

// Start wasm.
init.next();


export {
	FS,
	callMain
};
