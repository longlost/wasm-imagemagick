

import utils from './utils.js';


const invoke = name => (...args) => {
	const sp = utils.Module['stackSave']();

	try {
		return utils.Module[name](...args);
	}
	catch (error) {
		utils.Module['stackRestore'](sp);

		if (typeof error !== 'number' && error !== 'longjmp') { 
			throw error; 
		}

		utils.Module['setThrew'](1, 0);
	}
};

const invoke_dii 				 = invoke('dynCall_dii');
const invoke_i 					 = invoke('dynCall_i');
const invoke_ii 				 = invoke('dynCall_ii');
const invoke_iii 				 = invoke('dynCall_iii');
const invoke_iiii 			 = invoke('dynCall_iiii');
const invoke_iiiii 			 = invoke('dynCall_iiiii');
const invoke_iiiiii 		 = invoke('dynCall_iiiiii');
const invoke_iiiiiii 	 	 = invoke('dynCall_iiiiiii');
const invoke_iiiiiiii 	 = invoke('dynCall_iiiiiiii');
const invoke_iiiiiiiii 	 = invoke('dynCall_iiiiiiiii');
const invoke_iiiiiiiiii  = invoke('dynCall_iiiiiiiiii');
const invoke_iiiiiiiiiii = invoke('dynCall_iiiiiiiiiii');
const invoke_iifi 			 = invoke('dynCall_iifi');
const invoke_iij 				 = invoke('dynCall_iij');
const invoke_iiijj 			 = invoke('dynCall_iiijj');
const invoke_ji 				 = invoke('dynCall_ji');
const invoke_v 					 = invoke('dynCall_v');
const invoke_vi 				 = invoke('dynCall_vi');
const invoke_vii 				 = invoke('dynCall_vii');
const invoke_viii 			 = invoke('dynCall_viii');
const invoke_viiii 			 = invoke('dynCall_viiii');
const invoke_viiiii 		 = invoke('dynCall_viiiii');
const invoke_viiiiii 		 = invoke('dynCall_viiiiii');
const invoke_viiiiiiiii  = invoke('dynCall_viiiiiiiii');
const invoke_viid 			 = invoke('dynCall_viid');
const invoke_viidddddddd = invoke('dynCall_viidddddddd');
const invoke_vij 				 = invoke('dynCall_vij');


export default {
	invoke_dii,
	invoke_i,
	invoke_ii,
	invoke_iii,
	invoke_iiii,
	invoke_iiiii,
	invoke_iiiiii,
	invoke_iiiiiii,
	invoke_iiiiiiii,
	invoke_iiiiiiiii,
	invoke_iiiiiiiiii,
	invoke_iiiiiiiiiii,
	invoke_iifi,
	invoke_iij,
	invoke_iiijj,
	invoke_ji,
	invoke_v,
	invoke_vi,
	invoke_vii,
	invoke_viii,
	invoke_viiii,
	invoke_viiiii,
	invoke_viiiiii,
	invoke_viiiiiiiii,
	invoke_viid,
	invoke_viidddddddd,
	invoke_vij
};
