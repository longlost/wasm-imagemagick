

import {
	ASMJS_PAGE_SIZE,
	ENVIRONMENT_IS_WEB,
	ENVIRONMENT_IS_WORKER,
	WASM_PAGE_SIZE
} from './constants.js';

import {
	abort,
	alignUp,
	assert,
	err
} from './utils.js';

import {
	Module,
	scriptDirectory
} from './module.js';

import {
	updateGlobalBuffer,
	updateGlobalBufferViews
} from './memory.js';

import {
	addRunDependency,
	removeRunDependency
} from './runtime.js';


const dataURIPrefix = 'data:application/octet-stream;base64,';

const isDataURI = filename => String.prototype.startsWith ? 
																filename.startsWith(dataURIPrefix) : 
																filename.indexOf(dataURIPrefix) === 0;

const locateFile = path => {
	
	if (Module['locateFile']) {
		return Module['locateFile'](path, scriptDirectory);
	} 
	else {
		return scriptDirectory + path;
	}
};

const mergeMemory = newBuffer => {
	const oldBuffer = Module['buffer'];

	if (newBuffer.byteLength < oldBuffer.byteLength) {
		err('the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here');
	}

	const oldView = new Int8Array(oldBuffer);
	const newView = new Int8Array(newBuffer);

	newView.set(oldView);
	updateGlobalBuffer(newBuffer);
	updateGlobalBufferViews();
};

const receiveInstance = instance => {
	const exported = instance.exports;

	if (exported.memory) {
		mergeMemory(exported.memory);
	}

	Module['asm'] 			= exported;
	Module['usingWasm'] = true;

	removeRunDependency('wasm-instantiate');
};

const receiveInstantiatedSource = output => {
	receiveInstance(output['instance']);
};

const wasmReallocBuffer = size => {
	const PAGE_MULTIPLE = Module['usingWasm'] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE;
	const old 					= Module['buffer'];
	const oldSize 			= old.byteLength;

	size = alignUp(size, PAGE_MULTIPLE);		

	if (Module['usingWasm']) {
		try {

			const wasmPageSize = 64 * 1024;
			const result 			 = Module['wasmMemory'].grow((size - oldSize) / wasmPageSize);

			if (result !== (-1 | 0)) {
				return Module['buffer'] = Module['wasmMemory'].buffer;
			}
			else {
				return null;
			}
		}
		catch (_) {
			return null;
		}
	}
};

const fixImports = imports => imports;


const asm2wasmImports = {
	'f64-rem':  (x, y) => x % y,
	'debugger': () => debugger
};

const info = {
	'global': 	null,
	'env': 			null,
	'asm2wasm': asm2wasmImports,
	'parent': 	Module
};


Module['wasmTableSize'] 	 = 1862;
Module['wasmMaxTableSize'] = 1862;


const integrateWasmJS = () => {
	let wasmTextFile 	 = 'magick.wast';
	let wasmBinaryFile = 'magick.wasm';
	let asmjsCodeFile  = 'magick.temp.asm.js';

	if (!isDataURI(wasmTextFile)) {
		wasmTextFile = locateFile(wasmTextFile);
	}

	if (!isDataURI(wasmBinaryFile)) {
		wasmBinaryFile = locateFile(wasmBinaryFile);
	}

	if (!isDataURI(asmjsCodeFile)) {
		asmjsCodeFile = locateFile(asmjsCodeFile);
	}

	const getBinary = () => {
		try {
			if (Module['wasmBinary']) {
				return new Uint8Array(Module['wasmBinary']);
			}

			if (Module['readBinary']) {
				return Module['readBinary'](wasmBinaryFile);
			}
			else {
				throw 'both async and sync fetching of the wasm failed';
			}
		}
		catch (error) {
			abort(error);
		}
	};

	const getBinaryPromise = async () => {
		if (
			!Module['wasmBinary'] && 
			(ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && 
			typeof fetch === 'function'
		) {

			try {
				const response = await fetch(wasmBinaryFile, {credentials: 'same-origin'});

				if (!response.ok) {
					throw `failed to load wasm binary file at '${wasmBinaryFile}'`;
				}

				return response['arrayBuffer']();
			}
			catch (_) {
				return getBinary();
			}
		}

		return new Promise((resolve, reject) => {
			resolve(getBinary());
		});
	};

	const doNativeWasm = async (global, env, providedBuffer) => {

		if (typeof WebAssembly !== 'object') {
			err('no native wasm support detected');

			return false;
		}

		if (!(Module['wasmMemory'] instanceof WebAssembly.Memory)) {
			err('no native wasm Memory in use');

			return false;
		}

		env['memory'] 			= Module['wasmMemory'];
		info['global'] 			= {'NaN': NaN, 'Infinity': Infinity};
		info['global.Math'] = Math;
		info['env'] 				= env;		

		addRunDependency('wasm-instantiate');

		if (Module['instantiateWasm']) {
			try {
				return Module['instantiateWasm'](info, receiveInstance);
			}
			catch (e) {
				err('Module.instantiateWasm callback failed with error: ' + e);

				return false;
			}
		}		

		const instantiateArrayBuffer = async receiver => {
			try {
				const binary = await getBinaryPromise();
				const output = await WebAssembly.instantiate(binary, info);
				
				receiver(output);
			}
			catch (error) {
				err(`failed to asynchronously prepare wasm: ${error}`);
				abort(error);
			}
		};

		if (
			!Module['wasmBinary'] && 
			typeof WebAssembly.instantiateStreaming === 'function' && 
			!isDataURI(wasmBinaryFile) && 
			typeof fetch === 'function'
		) {

			try {
				const output = await WebAssembly.instantiateStreaming(
					fetch(wasmBinaryFile, {credentials: 'same-origin'}), 
					info
				);

				receiveInstantiatedSource(output);
			}
			catch (error) {
				err(`wasm streaming compile failed: ${reason}`);
				err('falling back to ArrayBuffer instantiation');
				instantiateArrayBuffer(receiveInstantiatedSource);
			}
		}
		else {
			instantiateArrayBuffer(receiveInstantiatedSource);
		}

		return {};
	};


	Module['asmPreload'] 		= Module['asm'];
	Module['reallocBuffer'] = wasmReallocBuffer;

	Module['asm'] = (global, env, providedBuffer) => {
		env = fixImports(env);

		if (!env['table']) {
			let TABLE_SIZE = Module['wasmTableSize'];

			if (TABLE_SIZE === undefined) {
				TABLE_SIZE = 1024;
			}

			const MAX_TABLE_SIZE = Module['wasmMaxTableSize'];

			if (typeof WebAssembly === 'object' && typeof WebAssembly.Table === 'function') {

				if (MAX_TABLE_SIZE !== undefined) {
					env['table'] = new WebAssembly.Table({
						'initial':  TABLE_SIZE,
						'maximum':  MAX_TABLE_SIZE,
						'element': 'anyfunc'
					});
				} 
				else {
					env['table'] = new WebAssembly.Table({
						'initial':  TABLE_SIZE,
						'element': 'anyfunc'
					});
				}
			}
			else {
				env['table'] = new Array(TABLE_SIZE);
			}

			Module['wasmTable'] = env['table'];
		}

		if (!env['memoryBase']) {
			env['memoryBase'] = Module['STATIC_BASE'];
		}

		if (!env['tableBase']) {
			env['tableBase'] = 0;
		}

		const exported = doNativeWasm(global, env, providedBuffer);

		assert(exported, 'no binaryen method succeeded.');

		return exported;
	};
};


export default integrateWasmJS;
