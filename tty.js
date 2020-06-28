

import {
	ENVIRONMENT_IS_NODE, 
	ERRNO_CODES
} from './constants.js';

import {
	ErrnoError,
	err,
	intArrayFromString,
	out,
	registerDevice,
	UTF8ArrayToString
} from './utils.js';


const TTY = {
	ttys: [],

	init() {},

	shutdown() {},

	register(dev, ops) {

		TTY.ttys[dev] = {
			input: 	[],
			output: [],
			ops
		};

		registerDevice(dev, TTY.stream_ops);
	},

	stream_ops: {
		open(stream) {
			const tty = TTY.ttys[stream.node.rdev];

			if (!tty) {
				throw new ErrnoError(ERRNO_CODES.ENODEV);
			}

			stream.tty 			= tty;
			stream.seekable = false;
		},

		close(stream) {
			stream.tty.ops.flush(stream.tty);
		},

		flush(stream) {
			stream.tty.ops.flush(stream.tty);
		},

		read(stream, buffer, offset, length, pos) {

			if (!stream.tty || !stream.tty.ops.get_char) {
				throw new ErrnoError(ERRNO_CODES.ENXIO);
			}

			let bytesRead = 0;

			for (let i = 0; i < length; i++) {
				let result;

				try {
					result = stream.tty.ops.get_char(stream.tty);
				}
				catch (_) {
					throw new ErrnoError(ERRNO_CODES.EIO);
				}

				if (result === undefined && bytesRead === 0) {
					throw new ErrnoError(ERRNO_CODES.EAGAIN);
				}

				if (result === null || result === undefined) {
					break;
				}

				bytesRead++;
				buffer[offset + i] = result;
			}

			if (bytesRead) {
				stream.node.timestamp = Date.now();
			}

			return bytesRead;
		},

		write(stream, buffer, offset, length, pos) {

			if (!stream.tty || !stream.tty.ops.put_char) {
				throw new ErrnoError(ERRNO_CODES.ENXIO);
			}

			for (let i = 0; i < length; i++) {
				try {
					stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
				}
				catch (_) {
					throw new ErrnoError(ERRNO_CODES.EIO);
				}
			}

			if (length) {
				stream.node.timestamp = Date.now();
			}

			return i;
		}
	},

	default_tty_ops: {

		get_char(tty) {

			if (!tty.input.length) {
				let result = null;

				if (ENVIRONMENT_IS_NODE) {

					// This is a workaround for bundlers to skip 
					// these dynamic require statements that 
					// pull in modules that are built into Node.
					const bundlerIgnoredRequire = m => eval('require')(m);

					const fs = bundlerIgnoredRequire('fs');

					const BUFSIZE 				= 256;
					const buf 						= new Buffer(BUFSIZE);
					const isPosixPlatform = process.platform !== 'win32';

					let usingDevice = false;
					let fd 					= process.stdin.fd;
					let bytesRead 	= 0;

					if (isPosixPlatform) {
						try {
							fd 					= fs.openSync('/dev/stdin', 'r');
							usingDevice = true;
						}
						catch (_) {}
					}

					try {
						bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
					}
					catch (error) {
						if (error.toString().indexOf('EOF') !== -1) {
							bytesRead = 0;
						}
						else {
							throw error;
						}
					}

					if (usingDevice) {
						fs.closeSync(fd);
					}

					if (bytesRead > 0) {
						result = buf.slice(0, bytesRead).toString('utf-8');
					}
					else {
						result = null;
					}
				} 
				else if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
					result = window.prompt('Input: ');

					if (result !== null) {
						result += '\n';
					}
				}
				else {

					// This is a workaround for bundlers to skip 
					// these dynamic require statements that 
					// pull in modules that are built into Node.
					const bundlerIgnoredRequire = m => eval('require')(m);

					const readline = bundlerIgnoredRequire('readline');

					if (typeof readline === 'function') {
						result = readline();

						if (result !== null) {
							result += '\n';
						}
					}
				}

				if (!result) {
					return null;
				}

				tty.input = intArrayFromString(result, true);
			}

			return tty.input.shift();
		},

		put_char(tty, val) {

			if (val === null || val === 10) {
				out(UTF8ArrayToString(tty.output, 0));
				tty.output = [];
			}
			else {
				if (val !== 0) {
					tty.output.push(val);
				}
			}
		},

		flush(tty) {
			if (tty.output && tty.output.length > 0) {
				out(UTF8ArrayToString(tty.output, 0));
				tty.output = [];
			}
		}
	},

	default_tty1_ops: {

		put_char(tty, val) {

			if (val === null || val === 10) {
				err(UTF8ArrayToString(tty.output, 0));
				tty.output = [];
			}
			else {
				if (val !== 0) {
					tty.output.push(val);
				}
			}
		},

		flush(tty) {
			if (tty.output && tty.output.length > 0) {
				err(UTF8ArrayToString(tty.output, 0));
				tty.output = [];
			}
		}
	}
};


export default TTY;
