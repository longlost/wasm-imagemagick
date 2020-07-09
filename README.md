# wasm-imagemagick
This utility is based off the library at https://github.com/KnicKnic/WASM-ImageMagick.  

Inspiration for creating this tool came from the need to support mobile devices.

Support for node and shell environments has been dropped in order to reduce the footprint of the generated emscripten glue code for faster load times on mobile. 

Also this utility does not have a built in web worker abstraction, allowing the developer to control concurrence and worker termination, since battery life is a concern with mobile development.

It is HIGHLY recommended to run this code in a web worker thread.


### Api

Since ImageMagick can work with multiple input image files, `magick` accepts an array of file items.
This must coinside with the number of input files in the `commands` array.

`inputName` and `outputName` tell `magick` where to read/write to the virtual File System stub provided by emscripten, since this is how
ImageMagic deals with image files in an OS environment.

`commands` are identical to the standard ImageMagic commands api.


### Example usage.

```
// processor.js

import magick from '@longlost/wasm-imagemagick/wasm-imagemagick.js';

const processor = async file => {
  const inputName  = `input_${file.name}`;  
  const outputName = file.name;  
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

  const processedFile = await magick([fileItem], outputName, commands);
  
  return processedFile;
};

export processor;


// app.js

import * as processor from './processor.js';

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
