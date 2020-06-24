
// Use this module for applications in the browser.


import {FS, callMain} from './wasm-interface.js';


FS.mkdir('/pictures');
FS.currentPath = '/pictures';


const readAsArrayBuffer = file => {

	const reader = new FileReader();
	reader.readAsArrayBuffer(file);

	return new Promise((resolve, reject) => {

		reader.onload = () => {
			resolve(reader.result);
		};

		reader.onerror = reject;
	});
};


const getProcessedFiles = () => {
	const dir 	= FS.open('/pictures');	
  const items = dir.node.contents;

  const files = items.map(item => {
  	const {destFilename} = item;
  	const read = FS.readFile(destFilename);

  	// Cleanup read file.
    FS.unlink(destFilename);

    // TODO:
    //
    // 			Get file.type somehow.

    return new File([read], destFilename, {type: file.type});
  });
    
  return files;
};


const magick = async (files, commands) => {

  // Clean up exitCode.
  exitCode = undefined;

  const bufferPromises = files.map(file => readAsArrayBuffer(file));
  const buffers 			 = await Promise.all(bufferPromises);

  // ImageMagick can work with more than one image at a time.
  files.forEach((file, index) => {
  	const buffer = buffers[index];
		const data 	 = new Uint8Array(buffer);

		FS.writeFile(file.name, data);
  });

  callMain(commands);

  // Cleanup source files.
  // 'mogrify' then output files have same name, so skip.
  if (commands[0] !== 'mogrify') {
  	files.forEach(file => {
    	FS.unlink(file.name);
  	});
  }
    
  const processed = getProcessedFiles();

  if (exitCode === 0) {
		return processed;
	}
	else {
		throw new Error(`ImageMagick processing failed with exitCode: ${exitCode}`);
	}

};

export default magick;
