
import {
	ALLOC_STATIC, 
	ASMJS_PAGE_SIZE,
	WASM_PAGE_SIZE
} from './constants.js';

import {
	UTF8ArrayToString, 
	abort, 
	alignUp, 
	assert, 
	err, 
	lengthBytesUTF8, 
	stringToUTF8Array
} from './utils.js';

import {Module} from './module.js';


const TOTAL_STACK  = Module['TOTAL_STACK']  || 5242880;
let 	TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;


if (TOTAL_MEMORY < TOTAL_STACK) {
	err('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK = ' + TOTAL_STACK + ')');
}

let STATICTOP 		 = 0;
let DYNAMICTOP_PTR = 0;

// Set after 'asm' in 'wasm-interface'.
let _emscripten_replace_memory;
let _malloc;
let stackAlloc;


const staticAlloc = size => {
	const ret = STATICTOP;

	STATICTOP = STATICTOP + size + 15 & -16;

	return ret;
};


let buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;


const _emscripten_memcpy_big = (dest, src, num) => {
	HEAPU8.set(HEAPU8.subarray(src, src + num), dest);

	return dest;
};

const updateGlobalBuffer = buf => {
	Module['buffer'] = buffer = buf;
};

const updateGlobalBufferViews = () => {
	Module['HEAP8'] 	= HEAP8 	= new Int8Array(buffer);
	Module['HEAP16'] 	= HEAP16 	= new Int16Array(buffer);
	Module['HEAP32'] 	= HEAP32 	= new Int32Array(buffer);
	Module['HEAPU8'] 	= HEAPU8 	= new Uint8Array(buffer);
	Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
	Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
	Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
	Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
};

const enlargeMemory = () => {
	const PAGE_MULTIPLE = Module['usingWasm'] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE;
	const LIMIT 				= 2147483648 - PAGE_MULTIPLE;

	if (HEAP32[DYNAMICTOP_PTR >> 2] > LIMIT) {
		return false;
	}


	const MIN_TOTAL_MEMORY = 16777216;
	const OLD_TOTAL_MEMORY = TOTAL_MEMORY;

	TOTAL_MEMORY = Math.max(TOTAL_MEMORY, MIN_TOTAL_MEMORY);

	while (TOTAL_MEMORY < HEAP32[DYNAMICTOP_PTR >> 2]) {

		if (TOTAL_MEMORY <= 536870912) {
			TOTAL_MEMORY = alignUp(2 * TOTAL_MEMORY, PAGE_MULTIPLE);
		}
		else {
			TOTAL_MEMORY = Math.min(alignUp((3 * TOTAL_MEMORY + 2147483648) / 4, PAGE_MULTIPLE), LIMIT);
		}
	}

	const replacement = Module['reallocBuffer'](TOTAL_MEMORY);

	if (!replacement || replacement.byteLength !== TOTAL_MEMORY) {
		TOTAL_MEMORY = OLD_TOTAL_MEMORY;

		return false;
	}

	updateGlobalBuffer(replacement);
	updateGlobalBufferViews();

	return true;
};

const dynamicAlloc = size => {
	const ret = HEAP32[DYNAMICTOP_PTR >> 2];
	const end = ret + size + 15 & -16;

	HEAP32[DYNAMICTOP_PTR >> 2] = end;

	if (end >= TOTAL_MEMORY) {
		var success = enlargeMemory();

		if (!success) {
			HEAP32[DYNAMICTOP_PTR >> 2] = ret;

			return 0;
		}
	}

	return ret;
};

const setValue = (ptr, value, type, noSafe) => {

	let tempDouble;
	type = type || 'i8';

	if (type.charAt(type.length - 1) === '*') {
		type = 'i32';
	}

	switch (type) {
		case 'i1':
			HEAP8[ptr >> 0] = value;
			break;
		case'i8': 
			HEAP8[ptr >> 0] = value;
			break;
		case 'i16':
			HEAP16[ptr >> 1] = value;
			break;
		case 'i32':
			HEAP32[ptr >> 2] = value;
			break;
		case 'i64':
			tempDouble = value >>> 0;
			tempI64 = [
				tempDouble, 
				(
					+Math.abs(tempDouble) >= 1 ? 
						tempDouble > 0 ? 
					 		(Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : 
					 		~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 
					0
				)
			]; 
			HEAP32[ptr >> 2] 		 = tempI64[0];
			HEAP32[ptr + 4 >> 2] = tempI64[1];
			break;
		case 'float':
			HEAPF32[ptr >> 2] = value;
			break;
		case 'double':
			HEAPF64[ptr >> 3] = value;
			break;
		default:
			abort('invalid type for setValue: ' + type);
	}
};

const getNativeTypeSize = type => {
	switch(type) {
		case 'i1':
		case 'i8':
			return 1;
		case 'i16':
			return 2;
		case 'i32':
			return 4;
		case 'i64':
			return 8;
		case 'float':
			return 4;
		case 'double':
			return 8;
		default:
			{
				if (type[type.length - 1] === '*') {
					return 4;
				}
				else if (type[0] === 'i') {
					const bits = parseInt(type.substr(1));

					assert(bits % 8 === 0);

					return bits / 8;
				}
				else {
					return 0;
				}
			};
	}
};

const allocate = (slab, types, allocator, ptr) => {
	let zeroinit;
	let size;

	if (typeof slab === 'number') {
		zeroinit = true;
		size 		 = slab
	}
	else {
		zeroinit = false;
		size 		 = slab.length
	}

	const ALLOC_NONE = 4;
	const singleType = typeof types === 'string' ? types : null;
	let ret;

	if (allocator == ALLOC_NONE) {
		ret = ptr;
	}
	else {
		ret = [
			typeof _malloc === 'function' ? _malloc : staticAlloc,
			stackAlloc,
			staticAlloc,
			dynamicAlloc
		][
			allocator === undefined ? ALLOC_STATIC : allocator
		](Math.max(size, singleType ? 1 : types.length));
	}

	if (zeroinit) {
		let stop;

		ptr = ret;

		assert((ret & 3) == 0);

		stop = ret + (size & ~3);

		for (; ptr < stop; ptr += 4) {
			HEAP32[ptr >> 2] = 0;
		}

		stop = ret + size;

		while (ptr < stop) {
			HEAP8[ptr++ >> 0] = 0;
		}

		return ret;
	}

	if (singleType === 'i8') {
		if (slab.subarray || slab.slice) {
			HEAPU8.set(slab, ret);
		}
		else {
			HEAPU8.set(new Uint8Array(slab), ret);
		}

		return ret;
	}

	let i = 0;
	let	type;
	let typeSize;
	let previousType;

	while (i < size) {
		const curr = slab[i];

		type = singleType || types[i];

		if (type === 0) {
			i++;
			continue;
		}

		if (type == 'i64') {
			type = 'i32';
		}

		setValue(ret + i, curr, type);

		if (previousType !== type) {
			typeSize 		 = getNativeTypeSize(type);
			previousType = type
		}

		i += typeSize;
	}

	return ret;
};


const UTF8ToString = ptr => UTF8ArrayToString(HEAPU8, ptr);


const Pointer_stringify = (ptr, length) => {
	if (length === 0 || !ptr) { return ''; }

	let hasUtf = 0;
	let t;
	let i = 0;

	while (true) {
		t = HEAPU8[ptr + i >> 0];
		hasUtf |= t;

		if (t == 0 && !length) {
			break;
		}

		i++;

		if (length && i == length) {
			break;
		}

		if (!length) {
			length = i;
		}

		let ret = '';

		if (hasUtf < 128) {
			const MAX_CHUNK = 1024;
			let curr;

			while (length > 0) {
				curr 	= String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
				ret 	= ret ? ret + curr : curr;

				ptr 	 += MAX_CHUNK;
				length -= MAX_CHUNK;
			}

			return ret;
		}

		return UTF8ToString(ptr);
	}
};

const ___assert_fail = (condition, filename, line, func) => {
	abort(
		'Assertion failed: ' + 
		Pointer_stringify(condition) + ', at: ' + 
		[filename ? Pointer_stringify(filename) : 'unknown filename', line, func ? Pointer_stringify(func) : 'unknown function']
	);
};

const abortOnCannotGrowMemory = () => {
	abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH = 1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC = 0 ');
};

const allocateUTF8 = str => {
	const size = lengthBytesUTF8(str) + 1;
	const ret  = _malloc(size);

	if (ret) {
		stringToUTF8Array(str, HEAP8, ret, size);
	}

	return ret;
};

const allocateUTF8OnStack = str => {
	const size = lengthBytesUTF8(str) + 1;
	const ret  = stackAlloc(size);

	stringToUTF8Array(str, HEAP8, ret, size);

	return ret;
}

let staticSealed = false;

const getMemory = size => {
	if (!staticSealed) { return; }

	staticAlloc(size);

	if (!runtimeInitialized) { return; }

	dynamicAlloc(size);

	return _malloc(size);
};

const getTotalMemory = () => TOTAL_MEMORY;

const writeArrayToMemory = (array, buffer) => {
	HEAP8.set(array, buffer);
};

const writeAsciiToMemory = (str, buffer, dontAddNull) => {
	for (let i = 0; i < str.length; ++i) {
		HEAP8[buffer++ >> 0] = str.charCodeAt(i);
	}

	if (!dontAddNull) {
		HEAP8[buffer >> 0] = 0;
	}
};


if (!Module['reallocBuffer']) {
	Module['reallocBuffer'] = size => {
		let ret;

		try {
			const oldHEAP8 = HEAP8;
			ret 				 	 = new ArrayBuffer(size);
			const temp 		 = new Int8Array(ret);

			temp.set(oldHEAP8)
		}
		catch (_) {
			return false;
		}

		const success = _emscripten_replace_memory(ret);

		if (!success) { 
			return false;
		}

		return ret;
	};
}


if (Module['buffer']) {
	buffer = Module['buffer'];
}
else {

	if (typeof WebAssembly === 'object' && typeof WebAssembly.Memory === 'function') {
		Module['wasmMemory'] = new WebAssembly.Memory({
			'initial' : TOTAL_MEMORY / WASM_PAGE_SIZE
		});
		buffer = Module['wasmMemory'].buffer;
	}
	else {
		buffer = new ArrayBuffer(TOTAL_MEMORY);
	}

	Module['buffer'] = buffer;
}


export {
	___assert_fail,
	_emscripten_memcpy_big,
	_emscripten_replace_memory,
	_malloc,
	DYNAMICTOP_PTR,
	HEAP8,
	HEAP16,
	HEAP32,
	HEAPU8,
	STATICTOP,
	TOTAL_STACK,
	Pointer_stringify,
	abortOnCannotGrowMemory,
	allocate,
	allocateUTF8,
	allocateUTF8OnStack,
	buffer,
	enlargeMemory,
	getMemory,
	getTotalMemory,
	stackAlloc,
	staticSealed,
	updateGlobalBuffer,
	updateGlobalBufferViews,
	writeArrayToMemory,
	writeAsciiToMemory
};
