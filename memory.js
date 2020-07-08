
import {
	ALLOC_STATIC,
	STATIC_BASE,
	WASM_PAGE_SIZE
} from './constants.js';

import mod 	 from './module.js';
import utils from './utils.js';


// Exposed to be set/updated in other modules.
const exposed = {
	DYNAMICTOP_PTR: 0,
	HEAP8: 					null,
	HEAP16: 	 			null,
	HEAP32: 	 			null,
	HEAPU8: 	 			null,
	STACKTOP: 			0,
	STATICTOP: 			0,
	// Set with 'setAsm' in 'wasm-interface'.
	_emscripten_replace_memory: null,
	_malloc: 			null,
	buffer: 			null,
	stackAlloc: 	null,
	staticSealed: false,
	wasmMemory: 	null
};


const TOTAL_STACK  = mod.Module['TOTAL_STACK']  || 5242880;
let 	TOTAL_MEMORY = mod.Module['TOTAL_MEMORY'] || 16777216;


exposed.STATICTOP = STATIC_BASE + 1212304;
exposed.STATICTOP += 16;
exposed.STATICTOP += 16;
exposed.STATICTOP += 16;
exposed.STATICTOP += 16;


if (TOTAL_MEMORY < TOTAL_STACK) {
	utils.err(`TOTAL_MEMORY should be larger than TOTAL_STACK, was ${TOTAL_MEMORY}! (TOTAL_STACK = ${TOTAL_STACK})`);
}


if (typeof WebAssembly === 'object' && typeof WebAssembly.Memory === 'function') {
	exposed.wasmMemory = new WebAssembly.Memory({
		'initial' : TOTAL_MEMORY / WASM_PAGE_SIZE
	});
	
	exposed.buffer = exposed.wasmMemory.buffer;
}
else {
	exposed.buffer = new ArrayBuffer(TOTAL_MEMORY);
}


const staticAlloc = size => {

	const ret = exposed.STATICTOP;

	exposed.STATICTOP = exposed.STATICTOP + size + 15 & -16;

	return ret;
};

let HEAPU16, HEAPU32, HEAPF32, HEAPF64;

const _emscripten_memcpy_big = (dest, src, num) => {
	exposed.HEAPU8.set(exposed.HEAPU8.subarray(src, src + num), dest);

	return dest;
};

const updateGlobalBuffer = buf => {
	mod.Module['buffer'] = exposed.buffer = buf;
};

const updateGlobalBufferViews = () => {
	mod.Module['HEAP8'] 	= exposed.HEAP8  = new Int8Array(exposed.buffer);
	mod.Module['HEAP16'] 	= exposed.HEAP16 = new Int16Array(exposed.buffer);
	mod.Module['HEAP32'] 	= exposed.HEAP32 = new Int32Array(exposed.buffer);
	mod.Module['HEAPU8'] 	= exposed.HEAPU8 = new Uint8Array(exposed.buffer);
	mod.Module['HEAPU16'] = HEAPU16 			 = new Uint16Array(exposed.buffer);
	mod.Module['HEAPU32'] = HEAPU32 			 = new Uint32Array(exposed.buffer);
	mod.Module['HEAPF32'] = HEAPF32 			 = new Float32Array(exposed.buffer);
	mod.Module['HEAPF64'] = HEAPF64 			 = new Float64Array(exposed.buffer);
};

const wasmReallocBuffer = size => {
	const old 		= exposed.buffer;
	const oldSize = old.byteLength;

	size = utils.alignUp(size, WASM_PAGE_SIZE);

	try {

		const wasmPageSize = 64 * 1024;
		const result 			 = exposed.wasmMemory.grow((size - oldSize) / wasmPageSize);

		if (result !== (-1 | 0)) {
			return exposed.buffer = exposed.wasmMemory.buffer;
		}
		else {
			return null;
		}
	}
	catch (_) {
		return null;
	}
};

const enlargeMemory = () => {
	const LIMIT = 2147483648 - WASM_PAGE_SIZE;

	if (exposed.HEAP32[exposed.DYNAMICTOP_PTR >> 2] > LIMIT) {
		return false;
	}

	const MIN_TOTAL_MEMORY = 16777216;
	const OLD_TOTAL_MEMORY = TOTAL_MEMORY;

	TOTAL_MEMORY = Math.max(TOTAL_MEMORY, MIN_TOTAL_MEMORY);

	while (TOTAL_MEMORY < exposed.HEAP32[exposed.DYNAMICTOP_PTR >> 2]) {

		if (TOTAL_MEMORY <= 536870912) {
			TOTAL_MEMORY = utils.alignUp(2 * TOTAL_MEMORY, WASM_PAGE_SIZE);
		}
		else {
			TOTAL_MEMORY = Math.min(utils.alignUp((3 * TOTAL_MEMORY + 2147483648) / 4, WASM_PAGE_SIZE), LIMIT);
		}
	}

	const replacement = wasmReallocBuffer(TOTAL_MEMORY);

	if (!replacement || replacement.byteLength !== TOTAL_MEMORY) {
		TOTAL_MEMORY = OLD_TOTAL_MEMORY;

		return false;
	}

	updateGlobalBuffer(replacement);
	updateGlobalBufferViews();

	return true;
};

const dynamicAlloc = size => {

	const ret = exposed.HEAP32[exposed.DYNAMICTOP_PTR >> 2];
	const end = ret + size + 15 & -16;

	exposed.HEAP32[exposed.DYNAMICTOP_PTR >> 2] = end;

	if (end >= TOTAL_MEMORY) {
		var success = enlargeMemory();

		if (!success) {
			exposed.HEAP32[exposed.DYNAMICTOP_PTR >> 2] = ret;

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
			exposed.HEAP8[ptr >> 0] = value;
			break;
		case'i8': 
			exposed.HEAP8[ptr >> 0] = value;
			break;
		case 'i16':
			exposed.HEAP16[ptr >> 1] = value;
			break;
		case 'i32':
			exposed.HEAP32[ptr >> 2] = value;
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
			exposed.HEAP32[ptr >> 2] 		 = tempI64[0];
			exposed.HEAP32[ptr + 4 >> 2] = tempI64[1];
			break;
		case 'float':
			HEAPF32[ptr >> 2] = value;
			break;
		case 'double':
			HEAPF64[ptr >> 3] = value;
			break;
		default:
			utils.abort('invalid type for setValue: ' + type);
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

					utils.assert(bits % 8 === 0);

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
			typeof exposed._malloc === 'function' ? exposed._malloc : staticAlloc,
			exposed.stackAlloc,
			staticAlloc,
			dynamicAlloc
		][
			allocator === undefined ? ALLOC_STATIC : allocator
		](Math.max(size, singleType ? 1 : types.length));
	}


	if (zeroinit) {
		let stop;

		ptr = ret;

		utils.assert((ret & 3) == 0);

		stop = ret + (size & ~3);

		for (; ptr < stop; ptr += 4) {
			exposed.HEAP32[ptr >> 2] = 0;
		}

		stop = ret + size;

		while (ptr < stop) {
			exposed.HEAP8[ptr++ >> 0] = 0;
		}

		return ret;
	}

	if (singleType === 'i8') {
		if (slab.subarray || slab.slice) {
			exposed.HEAPU8.set(slab, ret);			
		}
		else {
			exposed.HEAPU8.set(new Uint8Array(slab), ret);
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

const UTF8ToString = ptr => utils.UTF8ArrayToString(exposed.HEAPU8, ptr);

const Pointer_stringify = (ptr, length) => {
	if (length === 0 || !ptr) { return ''; }

	let hasUtf = 0;
	let t;
	let i = 0;

	while (true) {
		t = exposed.HEAPU8[ptr + i >> 0];
		hasUtf |= t;

		if (t == 0 && !length) {
			break;
		}

		i++;

		if (length && i == length) {
			break;
		}
	}

	if (!length) {
		length = i;
	}

	let ret = '';

	if (hasUtf < 128) {
		const MAX_CHUNK = 1024;
		let curr;

		while (length > 0) {
			curr 	= String.fromCharCode.apply(String, exposed.HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
			ret 	= ret ? ret + curr : curr;

			ptr 	 += MAX_CHUNK;
			length -= MAX_CHUNK;
		}

		return ret;
	}

	return UTF8ToString(ptr);
};

const ___assert_fail = (condition, filename, line, func) => {
	utils.abort(
		'Assertion failed: ' + 
		Pointer_stringify(condition) + ', at: ' + 
		[filename ? Pointer_stringify(filename) : 'unknown filename', line, func ? Pointer_stringify(func) : 'unknown function']
	);
};

const abortOnCannotGrowMemory = () => {
	utils.abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH = 1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC = 0 ');
};

const allocateUTF8 = str => {
	const size = utils.lengthBytesUTF8(str) + 1;
	const ret  = exposed._malloc(size);

	if (ret) {
		utils.stringToUTF8Array(str, exposed.HEAP8, ret, size);
	}

	return ret;
};

const allocateUTF8OnStack = str => {
	const size = utils.lengthBytesUTF8(str) + 1;
	const ret  = exposed.stackAlloc(size);

	utils.stringToUTF8Array(str, exposed.HEAP8, ret, size);

	return ret;
};

const getMemory = size => {
	if (!exposed.staticSealed) { return; }

	staticAlloc(size);
	dynamicAlloc(size);
	
	return exposed._malloc(size);
};

const getTotalMemory = () => TOTAL_MEMORY;

const writeArrayToMemory = (array, buffer) => {
	exposed.HEAP8.set(array, buffer);
};

const writeAsciiToMemory = (str, buffer, dontAddNull) => {
	for (let i = 0; i < str.length; ++i) {
		exposed.HEAP8[buffer++ >> 0] = str.charCodeAt(i);
	}

	if (!dontAddNull) {
		exposed.HEAP8[buffer >> 0] = 0;
	}
};

const alignMemory = (size, factor) => {

	const STACK_ALIGN = 16;

	if (!factor) {
		factor = STACK_ALIGN;
	}

	return Math.ceil(size / factor) * factor;
};


updateGlobalBufferViews();


let STACK_BASE = 0;

exposed.DYNAMICTOP_PTR = staticAlloc(4);
STACK_BASE = exposed.STACKTOP = alignMemory(exposed.STATICTOP);

const STACK_MAX 	 = STACK_BASE + TOTAL_STACK;
const DYNAMIC_BASE = alignMemory(STACK_MAX);

exposed.HEAP32[exposed.DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;
exposed.staticSealed = true;


export default {
	___assert_fail,
	_emscripten_memcpy_big,
	TOTAL_STACK,
	Pointer_stringify,
	abortOnCannotGrowMemory,
	allocate,
	allocateUTF8,
	allocateUTF8OnStack,
	enlargeMemory,
	exposed,
	getMemory,
	getTotalMemory,
	staticAlloc,
	updateGlobalBuffer,
	updateGlobalBufferViews,
	writeArrayToMemory,
	writeAsciiToMemory
};
