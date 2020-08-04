# wasm-imagemagick

This utility is based off the [WASM-ImageMagick](https://github.com/KnicKnic/WASM-ImageMagick) library.  

Inspiration for creating this tool came from the need to support mobile devices.

Support for node and shell environments has been dropped in order to reduce the footprint of the generated emscripten glue code for faster load times on mobile. 

Also this utility does not have a built in web worker abstraction, allowing the developer to control concurrence and worker termination, since battery life is a concern with mobile development.

It is HIGHLY recommended to run this code in a Web Worker thread! I suggest using the wonderful [Comlink](https://github.com/GoogleChromeLabs/comlink) library, to make working with Web Workers a breeze.


### Api

Since ImageMagick can work with multiple input image files, `magick` accepts an array of file items.
This must coincide with the number of input files in the `commands` array.

`inputName` and `outputName` tell `magick` where to read/write to the virtual File System stub provided by emscripten, since this is how ImageMagic handles files in an OS environment.

`commands` are identical to the standard ImageMagic commands api.


`magick` outputs a File object for `convert` and `mogrify` processes. 
An array of one or more strings is returned for `identify` processes.


### Example usage.

npm install --save @longlost/wasm-imagemagick

or

yarn add @longlost/wasm-imagemagick


```
// processor.js

import magick from '@longlost/wasm-imagemagick/wasm-imagemagick.js';

const processor = async file => {
  try {

    // This example creates a new image in an attempt to reduce 
    // the file size without sacrificing too much fidelity.
    
    const inputName  = file.name;  
    const outputName = `small_${file.name};
    const fileItem   = {file, inputName};

    const commands  = [
      'convert', inputName,
      '-auto-orient',
      '-sampling-factor', '4:2:0',
      '-strip', 
      '-auto-gamma', 
      '-adaptive-resize', '60%', 
      '-quality', '82', 
      '-unsharp', '0x0.75+0.75+0.008', 
      outputName
    ];

    const processedFile = await magick({
      commands,
      fileCollection: [fileItem], 
      outputName,
      outputType: file.type
    });

    return processedFile;
  } 
  catch (error) {
    // Do something clever with the error...
  }
};

export default processor;


// app.js

import processor from './processor.js';

(async function() {

  const file = someJSFileObject; /* Procure a Javascript File Object. */
  
  const processed = await processor(file);

  const tempUrl = window.URL.createObjectURL(processed);  
  const img     = document.querySelector('#my-image-element');
  
  img.onload = () => {
    window.URL.revokeObjectURL(tempUrl);
  };
  
  img.src = tempUrl;
  
}());

```
