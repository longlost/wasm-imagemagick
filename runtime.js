

import mod 	 from './module.js';
import utils from './utils.js';
import FS 	 from './fs.js';


const ensureInitRuntime = () => {
	utils.exposed.___emscripten_environ_constructor();
};

const exitRuntime = () => {
	FS.quit();
};

const exit = (status, implicit) => {
	if (implicit && status === 0) { return; }

	utils.quit(status, new mod.ExitStatus(status));
};


let runDependencies = 0;

const addRunDependency = () => {
	runDependencies += 1;
};

const removeRunDependency = () => {
	runDependencies -= 1;
};


export default {
	addRunDependency,
	ensureInitRuntime,
	exit,
	removeRunDependency
};
