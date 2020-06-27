

import {HEAP32} from './memory.js';


const _sigaction = () => 0;

const _sigaddset = (set, signum) => {
	HEAP32[set >> 2] = HEAP32[set >> 2] | 1 << signum - 1;

	return 0;
};

const _sigemptyset = set => {
	HEAP32[set >> 2] = 0;

	return 0;
};

const _signal = () => 0;

const _sigprocmask = () => 0;


export {
	_sigaction,
	_sigaddset,
	_sigemptyset,
	_signal,
	_sigprocmask
};
