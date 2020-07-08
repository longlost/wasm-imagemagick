

import {
	STATIC_BASE,
	WASM_PAGE_SIZE
} from './constants.js';

import utils 	 from './utils.js';
import memory  from './memory.js';
import runtime from './runtime.js';


const mergeMemory = newBuffer => {
	const oldBuffer = memory.exposed.buffer;

	if (newBuffer.byteLength < oldBuffer.byteLength) {
		utils.err('the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here');
	}

	const oldView = new Int8Array(oldBuffer);
	const newView = new Int8Array(newBuffer);

	newView.set(oldView);
	memory.updateGlobalBuffer(newBuffer);
	memory.updateGlobalBufferViews();
};

const receiveInstantiatedSource = output => {
	const {exports: exported, memory: instanceMemory} = output.instance;

	if (instanceMemory) {
		mergeMemory(instanceMemory);
	}

	runtime.removeRunDependency('wasm-instantiate');

	return exported;
};

const asm2wasmImports = {
	'f64-rem':  (x, y) => x % y,
	'debugger': () => {
		debugger;
	}
};

const info = {
	global: 	{'Math': Math, 'NaN': NaN, 'Infinity': Infinity},
	env: 			null,
	asm2wasm: asm2wasmImports
};

const doNativeWasm = async (env, providedBuffer) => {

	if (typeof WebAssembly !== 'object') {
		utils.err('No native wasm support detected.');

		return false;
	}

	if (!(memory.exposed.wasmMemory instanceof WebAssembly.Memory)) {
		utils.err('No native wasm Memory in use.');

		return false;
	}

	env.memory = memory.exposed.wasmMemory;
	info.env 	 = env;		

	runtime.addRunDependency('wasm-instantiate');
	runtime.addRunDependency('wasm-instantiate');

	const instantiateArrayBuffer = async receiver => {
		try {
			const magickWasm = await import(
				/* webpackChunkName: 'magick-wasm' */ 
				'wasm-imagemagick/dist/magick.wasm'
			);

			const response = await fetch(magickWasm.default);
			const buffer 	 = await response.arrayBuffer();
			const output 	 = await WebAssembly.instantiate(buffer, info);
			
			return receiver(output);
		}
		catch (error) {
			utils.err(`Failed to asynchronously prepare wasm: ${error}`);
			utils.abort(error);
		}
	};


	if (typeof WebAssembly.instantiateStreaming === 'function') {

		try {

			const magickWasm = await import(
				/* webpackChunkName: 'magick-wasm' */ 
				'wasm-imagemagick/dist/magick.wasm'
			);

			const output = await WebAssembly.instantiateStreaming(
				fetch(magickWasm.default, {credentials: 'same-origin'}), 
				info
			);

			return receiveInstantiatedSource(output);
		}
		catch (error) {
			utils.err(`Wasm streaming compile failed: ${error}`);
			utils.err('Falling back to ArrayBuffer instantiation.');
			
			return instantiateArrayBuffer(receiveInstantiatedSource);
		}
	}
	else {
		return instantiateArrayBuffer(receiveInstantiatedSource);
	}
};


const integrateWasm = async (env, providedBuffer) => {

	if (!env.table) {

		const TABLE_SIZE = 1862;			

		if (typeof WebAssembly === 'object' && typeof WebAssembly.Table === 'function') {
			env.table = new WebAssembly.Table({
				initial:  TABLE_SIZE,
				maximum:  TABLE_SIZE,
				element: 'anyfunc'
			});
		}
		else {
			env.table = new Array(TABLE_SIZE);
		}
	}

	if (!env.memoryBase) {
		env.memoryBase = STATIC_BASE;
	}

	if (!env.tableBase) {
		env.tableBase = 0;
	}

	const exported = await doNativeWasm(env, providedBuffer);

	utils.assert(exported, 'No binaryen method succeeded.');

	return exported;
};


export default integrateWasm;
