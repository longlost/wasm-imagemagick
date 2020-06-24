

let stackRestore;


function invoke_dii(index, a1, a2) {
	var sp = stackSave();

	try {
		return Module['dynCall_dii'](index, a1, a2);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_i(index) {
	var sp = stackSave();

	try {
		return Module['dynCall_i'](index);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_ii(index, a1) {
	var sp = stackSave();

	try {
		return Module['dynCall_ii'](index, a1);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_iifi(index, a1, a2, a3) {
	var sp = stackSave();

	try {
		return Module['dynCall_iifi'](index, a1, a2, a3);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_iii(index, a1, a2) {
	var sp = stackSave();

	try {
		return Module['dynCall_iii'](index, a1, a2);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_iiii(index, a1, a2, a3) {
	var sp = stackSave();

	try {
		return Module['dynCall_iiii'](index, a1, a2, a3);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_iiiii(index, a1, a2, a3, a4) {
	var sp = stackSave();

	try {
		return Module['dynCall_iiiii'](index, a1, a2, a3, a4);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_iiiiii(index, a1, a2, a3, a4, a5) {
	var sp = stackSave();

	try {
		return Module['dynCall_iiiiii'](index, a1, a2, a3, a4, a5);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_iiiiiii(index, a1, a2, a3, a4, a5, a6) {
	var sp = stackSave();

	try {
		return Module['dynCall_iiiiiii'](index, a1, a2, a3, a4, a5, a6);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_iiiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
	var sp = stackSave();

	try {
		return Module['dynCall_iiiiiiii'](index, a1, a2, a3, a4, a5, a6, a7);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_iiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8) {
	var sp = stackSave();

	try {
		return Module['dynCall_iiiiiiiii'](index, a1, a2, a3, a4, a5, a6, a7, a8);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_iiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
	var sp = stackSave();

	try {
		return Module['dynCall_iiiiiiiiii'](index, a1, a2, a3, a4, a5, a6, a7, a8, a9);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_iiiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) {
	var sp = stackSave();

	try {
		return Module['dynCall_iiiiiiiiiii'](index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_iiijj(index, a1, a2, a3, a4, a5, a6) {
	var sp = stackSave();

	try {
		return Module['dynCall_iiijj'](index, a1, a2, a3, a4, a5, a6);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_iij(index, a1, a2, a3) {
	var sp = stackSave();

	try {
		return Module['dynCall_iij'](index, a1, a2, a3);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_ji(index, a1) {
	var sp = stackSave();

	try {
		return Module['dynCall_ji'](index, a1);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_v(index) {
	var sp = stackSave();

	try {
		Module['dynCall_v'](index);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_vi(index, a1) {
	var sp = stackSave();

	try {
		Module['dynCall_vi'](index, a1);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_vii(index, a1, a2) {
	var sp = stackSave();

	try {
		Module['dynCall_vii'](index, a1, a2);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_viid(index, a1, a2, a3) {
	var sp = stackSave();

	try {
		Module['dynCall_viid'](index, a1, a2, a3);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_viidddddddd(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) {
	var sp = stackSave();

	try {
		Module['dynCall_viidddddddd'](index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_viii(index, a1, a2, a3) {
	var sp = stackSave();

	try {
		Module['dynCall_viii'](index, a1, a2, a3);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_viiii(index, a1, a2, a3, a4) {
	var sp = stackSave();

	try {
		Module['dynCall_viiii'](index, a1, a2, a3, a4);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_viiiii(index, a1, a2, a3, a4, a5) {
	var sp = stackSave();

	try {
		Module['dynCall_viiiii'](index, a1, a2, a3, a4, a5);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_viiiiii(index, a1, a2, a3, a4, a5, a6) {
	var sp = stackSave();

	try {
		Module['dynCall_viiiiii'](index, a1, a2, a3, a4, a5, a6);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_viiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
	var sp = stackSave();

	try {
		Module['dynCall_viiiiiiiii'](index, a1, a2, a3, a4, a5, a6, a7, a8, a9);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}

function invoke_vij(index, a1, a2, a3) {
	var sp = stackSave();

	try {
		Module['dynCall_vij'](index, a1, a2, a3);
	}
	catch (e) {
		stackRestore(sp);

		if (typeof e !== 'number' && e !== 'longjmp') { throw e; }

		Module['setThrew'](1, 0);
	}
}


export {
	stackRestore,
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
