

import memory from './memory.js';


const _sigaction = () => 0;

const _sigaddset = (set, signum) => {
	memory.exposed.HEAP32[set >> 2] = memory.exposed.HEAP32[set >> 2] | 1 << signum - 1;

	return 0;
};

const _sigemptyset = set => {
	memory.exposed.HEAP32[set >> 2] = 0;

	return 0;
};

const _signal = () => 0;

const _sigprocmask = () => 0;


export default {
	_sigaction,
	_sigaddset,
	_sigemptyset,
	_signal,
	_sigprocmask
};
