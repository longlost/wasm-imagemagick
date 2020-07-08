

const Module = {};


Module['thisProgram'] = './this.program';

function ExitStatus(status) {
	this.name 	 = 'ExitStatus';
	this.message = `Program terminated with exit(${status})`;
	this.status  = status;
}

ExitStatus.prototype = new Error;
ExitStatus.prototype.constructor = ExitStatus;


export default {
	ExitStatus,
	Module
};
