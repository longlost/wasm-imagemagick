

import {
	ENVIRONMENT_IS_WEB,
	ENVIRONMENT_IS_WORKER,
	ENVIRONMENT_IS_NODE,
	ENVIRONMENT_IS_SHELL
} from './constants.js';
import {assert} from './utils.js';


const getReaders = () => {

	if (ENVIRONMENT_IS_NODE) {

		let nodeFS;
		let nodePath;

		const reader = (filename, binary) => {

			if (!nodeFS) {
				nodeFS = require('fs');
			}

			if (!nodePath) {
				nodePath = require('path');
			}

			const normalized = nodePath['normalize'](filename);
			const result 		 = nodeFS['readFileSync'](normalized);

			return binary ? result : result.toString();
		};

		const readBinary = filename => {
			let result = reader(filename, true);

			if (!result.buffer) {
				result = new Uint8Array(result);
			}

			assert(result.buffer);

			return result;
		};

		return {reader, readBinary};
	}

	if (ENVIRONMENT_IS_SHELL) {

		const readBinary = f => {

			if (typeof readbuffer === 'function') {
				return new Uint8Array(readbuffer(f));
			}

			const data = read(f, 'binary');

			assert(typeof data === 'object');

			return data;
		};

		return {reader: read, readBinary};
	}

	if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {

		const reader = url => {
			const xhr = new XMLHttpRequest;

			xhr.open('GET', url, false);
			xhr.send(null);

			return xhr.responseText;
		};

		if (ENVIRONMENT_IS_WORKER) {

			const readBinary = url => {
				const xhr = new XMLHttpRequest;

				xhr.open('GET', url, false);
				xhr.responseType = 'arraybuffer';
				xhr.send(null);

				return new Uint8Array(xhr.response);
			};

			return {reader, readBinary};
		}

		return {reader, readBinary: undefined};
	}
};


const {reader, readBinary} = getReaders();


export {reader, readBinary};
