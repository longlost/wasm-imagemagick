

import {Module} from './module.js';


// Set in 'asm.js' 'setAsm' function.
let stackRestore;
let stackSave;


const invoke_dii = (index, a1, a2) => {
	const sp = stackSave();

	try {
		return Module['dynCall_dii'](index, a1, a2);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_i = index => {
	const sp = stackSave();

	try {
		return Module['dynCall_i'](index);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_ii = (index, a1) => {
	const sp = stackSave();

	try {
		return Module['dynCall_ii'](index, a1);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_iifi = (index, a1, a2, a3) => {
	const sp = stackSave();

	try {
		return Module['dynCall_iifi'](index, a1, a2, a3);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_iii = (index, a1, a2) => {
	const sp = stackSave();

	try {
		return Module['dynCall_iii'](index, a1, a2);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_iiii = (index, a1, a2, a3) => {
	const sp = stackSave();

	try {
		return Module['dynCall_iiii'](index, a1, a2, a3);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_iiiii = (index, a1, a2, a3, a4) => {
	const sp = stackSave();

	try {
		return Module['dynCall_iiiii'](index, a1, a2, a3, a4);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_iiiiii = (index, a1, a2, a3, a4, a5) => {
	const sp = stackSave();

	try {
		return Module['dynCall_iiiiii'](index, a1, a2, a3, a4, a5);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_iiiiiii = (index, a1, a2, a3, a4, a5, a6) => {
	const sp = stackSave();

	try {
		return Module['dynCall_iiiiiii'](index, a1, a2, a3, a4, a5, a6);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_iiiiiiii = (index, a1, a2, a3, a4, a5, a6, a7) => {
	const sp = stackSave();

	try {
		return Module['dynCall_iiiiiiii'](index, a1, a2, a3, a4, a5, a6, a7);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_iiiiiiiii = (index, a1, a2, a3, a4, a5, a6, a7, a8) => {
	const sp = stackSave();

	try {
		return Module['dynCall_iiiiiiiii'](index, a1, a2, a3, a4, a5, a6, a7, a8);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_iiiiiiiiii = (index, a1, a2, a3, a4, a5, a6, a7, a8, a9) => {
	const sp = stackSave();

	try {
		return Module['dynCall_iiiiiiiiii'](index, a1, a2, a3, a4, a5, a6, a7, a8, a9);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_iiiiiiiiiii = (index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) => {
	const sp = stackSave();

	try {
		return Module['dynCall_iiiiiiiiiii'](index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_iiijj = (index, a1, a2, a3, a4, a5, a6) => {
	const sp = stackSave();

	try {
		return Module['dynCall_iiijj'](index, a1, a2, a3, a4, a5, a6);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_iij = (index, a1, a2, a3) => {
	const sp = stackSave();

	try {
		return Module['dynCall_iij'](index, a1, a2, a3);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_ji = (index, a1) => {
	const sp = stackSave();

	try {
		return Module['dynCall_ji'](index, a1);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_v = index => {
	const sp = stackSave();

	try {
		Module['dynCall_v'](index);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_vi = (index, a1) => {
	const sp = stackSave();

	try {
		Module['dynCall_vi'](index, a1);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_vii = (index, a1, a2) => {
	const sp = stackSave();

	try {
		Module['dynCall_vii'](index, a1, a2);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_viid = (index, a1, a2, a3) => {
	const sp = stackSave();

	try {
		Module['dynCall_viid'](index, a1, a2, a3);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_viidddddddd = (index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) => {
	const sp = stackSave();

	try {
		Module['dynCall_viidddddddd'](index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_viii = (index, a1, a2, a3) => {
	const sp = stackSave();

	try {
		Module['dynCall_viii'](index, a1, a2, a3);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_viiii = (index, a1, a2, a3, a4) => {
	const sp = stackSave();

	try {
		Module['dynCall_viiii'](index, a1, a2, a3, a4);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_viiiii = (index, a1, a2, a3, a4, a5) => {
	const sp = stackSave();

	try {
		Module['dynCall_viiiii'](index, a1, a2, a3, a4, a5);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_viiiiii = (index, a1, a2, a3, a4, a5, a6) => {
	const sp = stackSave();

	try {
		Module['dynCall_viiiiii'](index, a1, a2, a3, a4, a5, a6);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_viiiiiiiii = (index, a1, a2, a3, a4, a5, a6, a7, a8, a9) => {
	const sp = stackSave();

	try {
		Module['dynCall_viiiiiiiii'](index, a1, a2, a3, a4, a5, a6, a7, a8, a9);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};

const invoke_vij = (index, a1, a2, a3) => {
	const sp = stackSave();

	try {
		Module['dynCall_vij'](index, a1, a2, a3);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
};


export default {
	stackRestore,
	stackSave,
	invoke_dii,
	invoke_i,
	invoke_ii,
	invoke_iifi,
	invoke_iii,
	invoke_iiii,
	invoke_iiiii,
	invoke_iiiiii,
	invoke_iiiiiii,
	invoke_iiiiiiii,
	invoke_iiiiiiiii,
	invoke_iiiiiiiiii,
	invoke_iiiiiiiiiii,
	invoke_iiijj,
	invoke_iij,
	invoke_ji,
	invoke_v,
	invoke_vi,
	invoke_vii,
	invoke_viid,
	invoke_viidddddddd,
	invoke_viii,
	invoke_viiii,
	invoke_viiiii,
	invoke_viiiiii,
	invoke_viiiiiiiii,
	invoke_vij,
};
