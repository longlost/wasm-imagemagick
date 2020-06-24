





function _sigaction(signum, act, oldact) {
	return 0;
}

function _sigaddset(set, signum) {
	HEAP32[set >> 2] = HEAP32[set >> 2] | 1 << signum - 1;

	return 0;
}

function _sigemptyset(set) {
	HEAP32[set >> 2] = 0;

	return 0;
}

var __sigalrm_handler = 0;

function _signal(sig, func) {
	if (sig == 14) {
		__sigalrm_handler = func;
	}

	return 0;
}

function _sigprocmask() {
	return 0;
}


