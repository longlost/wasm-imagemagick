

import {
	ASMJS_PAGE_SIZE,
	ENVIRONMENT_IS_WEB,
	ENVIRONMENT_IS_WORKER,
	WASM_PAGE_SIZE
} from './constants.js';

import utils 	 from './utils.js';
import memory  from './memory.js';
import runtime from './runtime.js';
import mod 		 from './module.js';


// const dataURIPrefix = 'data:application/octet-stream;base64,';

// const isDataURI = filename => String.prototype.startsWith ? 
// 																filename.startsWith(dataURIPrefix) : 
// 																filename.indexOf(dataURIPrefix) === 0;

// const locateFile = path => {
	
// 	if (mod.Module['locateFile']) {
// 		return mod.Module['locateFile'](path, mod.scriptDirectory);
// 	} 
// 	else {
// 		return mod.scriptDirectory + path;
// 	}
// };

const mergeMemory = newBuffer => {
	const oldBuffer = mod.Module['buffer'];

	if (newBuffer.byteLength < oldBuffer.byteLength) {
		utils.err('the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here');
	}

	const oldView = new Int8Array(oldBuffer);
	const newView = new Int8Array(newBuffer);

	newView.set(oldView);
	memory.updateGlobalBuffer(newBuffer);
	memory.updateGlobalBufferViews();
};

const receiveInstance = instance => {
	const exported = instance.exports;

	if (exported.memory) {
		mergeMemory(exported.memory);
	}

	mod.Module['asm'] 			= exported;
	mod.Module['usingWasm'] = true;

	runtime.removeRunDependency('wasm-instantiate');
};

const receiveInstantiatedSource = output => {
	receiveInstance(output['instance']);
};

const wasmReallocBuffer = size => {
	const PAGE_MULTIPLE = mod.Module['usingWasm'] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE;
	const old 					= mod.Module['buffer'];
	const oldSize 			= old.byteLength;

	size = utils.alignUp(size, PAGE_MULTIPLE);		

	if (mod.Module['usingWasm']) {
		try {

			const wasmPageSize = 64 * 1024;
			const result 			 = mod.Module['wasmMemory'].grow((size - oldSize) / wasmPageSize);

			if (result !== (-1 | 0)) {
				return mod.Module['buffer'] = mod.Module['wasmMemory'].buffer;
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
	'debugger': () => {
		debugger;
	}
};

const info = {
	'global': 	null,
	'env': 			null,
	'asm2wasm': asm2wasmImports,
	'parent': 	mod.Module
};


mod.Module['wasmTableSize'] 	 = 1862;
mod.Module['wasmMaxTableSize'] = 1862;


const integrateWasmJS = () => {
	// let wasmTextFile 	 = 'magick.wast';
	// let wasmBinaryFile = 'magick.wasm';
	// let asmjsCodeFile  = 'magick.temp.asm.js';


	// if (!isDataURI(wasmTextFile)) {
	// 	wasmTextFile = locateFile(wasmTextFile);
	// }

	// if (!isDataURI(wasmBinaryFile)) {
	// 	wasmBinaryFile = locateFile(wasmBinaryFile);
	// }

	// if (!isDataURI(asmjsCodeFile)) {
	// 	asmjsCodeFile = locateFile(asmjsCodeFile);
	// }

	// const getBinary = () => {
	// 	try {
	// 		if (mod.Module['wasmBinary']) {
	// 			return new Uint8Array(mod.Module['wasmBinary']);
	// 		}

	// 		if (mod.Module['readBinary']) {
	// 			return mod.Module['readBinary'](wasmBinaryFile);
	// 		}
	// 		else {
	// 			throw 'both async and sync fetching of the wasm failed';
	// 		}
	// 	}
	// 	catch (error) {
	// 		utils.abort(error);
	// 	}
	// };

	// const getBinaryPromise = async () => {
	// 	if (
	// 		!mod.Module['wasmBinary'] && 
	// 		(ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && 
	// 		typeof fetch === 'function'
	// 	) {

	// 		try {
	// 			const response = await fetch(wasmBinaryFile, {credentials: 'same-origin'});

	// 			if (!response.ok) {
	// 				throw `failed to load wasm binary file at '${wasmBinaryFile}'`;
	// 			}

	// 			return response.arrayBuffer();
	// 		}
	// 		catch (_) {
	// 			return getBinary();
	// 		}
	// 	}

	// 	return new Promise((resolve, reject) => {
	// 		resolve(getBinary());
	// 	});
	// };

	const doNativeWasm = async (global, env, providedBuffer) => {

		if (typeof WebAssembly !== 'object') {
			utils.err('no native wasm support detected');

			return false;
		}

		if (!(mod.Module['wasmMemory'] instanceof WebAssembly.Memory)) {
			utils.err('no native wasm Memory in use');

			return false;
		}

		env['memory'] 			= mod.Module['wasmMemory'];
		info['global'] 			= {'NaN': NaN, 'Infinity': Infinity};
		info['global.Math'] = Math;
		info['env'] 				= env;		

		runtime.addRunDependency('wasm-instantiate');

		if (mod.Module['instantiateWasm']) {
			try {
				return mod.Module['instantiateWasm'](info, receiveInstance);
			}
			catch (error) {
				utils.err(`Module.instantiateWasm callback failed with error: ${error}`);

				return false;
			}
		}		

		// const instantiateArrayBuffer = async receiver => {
		// 	try {
		// 		const binary = await getBinaryPromise();
		// 		const output = await WebAssembly.instantiate(binary, info);
				
		// 		receiver(output);
		// 	}
		// 	catch (error) {
		// 		utils.err(`failed to asynchronously prepare wasm: ${error}`);
		// 		utils.abort(error);
		// 	}
		// };

		// if (
		// 	!mod.Module['wasmBinary'] && 
		// 	typeof WebAssembly.instantiateStreaming === 'function' && 
		// 	!isDataURI(wasmBinaryFile) && 
		// 	typeof fetch === 'function'
		// ) {

		// 	try {
		// 		const output = await WebAssembly.instantiateStreaming(
		// 			fetch(wasmBinaryFile, {credentials: 'same-origin'}), 
		// 			info
		// 		);

		// 		receiveInstantiatedSource(output);
		// 	}
		// 	catch (error) {
		// 		utils.err(`wasm streaming compile failed: ${error}`);
		// 		utils.err('falling back to ArrayBuffer instantiation');
		// 		instantiateArrayBuffer(receiveInstantiatedSource);
		// 	}
		// }
		// else {
		// 	instantiateArrayBuffer(receiveInstantiatedSource);
		// }

		const instantiateArrayBuffer = async receiver => {
			try {
				const magickWasm = await import(
					/* webpackChunkName: 'magick-wasm' */ 
					'wasm-imagemagick/dist/magick.wasm'
				);

				const response = await fetch(magickWasm.default);
				const buffer 	 = await response.arrayBuffer();
				const output 	 = await WebAssembly.instantiate(buffer, info);
				
				receiver(output);
			}
			catch (error) {
				utils.err(`failed to asynchronously prepare wasm: ${error}`);
				utils.abort(error);
			}
		};


		if (
			!mod.Module['wasmBinary'] && 
			typeof WebAssembly.instantiateStreaming === 'function' && 
			typeof fetch === 'function'
		) {

			try {

				const magickWasm = await import(
					/* webpackChunkName: 'magick-wasm' */ 
					'wasm-imagemagick/dist/magick.wasm'
				);

				const output = await WebAssembly.instantiateStreaming(
					fetch(magickWasm.default, {credentials: 'same-origin'}), 
					info
				);

				receiveInstantiatedSource(output);
			}
			catch (error) {
				utils.err(`wasm streaming compile failed: ${error}`);
				utils.err('falling back to ArrayBuffer instantiation');
				instantiateArrayBuffer(receiveInstantiatedSource);
			}
		}
		else {
			instantiateArrayBuffer(receiveInstantiatedSource);
		}

		return {};
	};


	mod.Module['asmPreload'] 		= mod.Module['asm'];
	mod.Module['reallocBuffer'] = wasmReallocBuffer;

	mod.Module['asm'] = (global, env, providedBuffer) => {
		env = fixImports(env);

		if (!env['table']) {
			let TABLE_SIZE = mod.Module['wasmTableSize'];

			if (TABLE_SIZE === undefined) {
				TABLE_SIZE = 1024;
			}

			const MAX_TABLE_SIZE = mod.Module['wasmMaxTableSize'];

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

			mod.Module['wasmTable'] = env['table'];
		}

		if (!env['memoryBase']) {
			env['memoryBase'] = mod.Module['STATIC_BASE'];
		}

		if (!env['tableBase']) {
			env['tableBase'] = 0;
		}

		const exported = doNativeWasm(global, env, providedBuffer);

		utils.assert(exported, 'no binaryen method succeeded.');

		return exported;
	};
};


export default integrateWasmJS;
