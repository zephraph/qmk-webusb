#!/Users/justinbennett/.nvm/versions/node/v12.16.1/bin/node

// const { connectToKeyboard } = require('./dist');

// (async () => {
//   const keyboard = await connectToKeyboard('ergodox-ez');
//   await keyboard.connect();
//   await keyboard.disconnect();
// })();

var HID = require('node-hid');

// Linux: choose driverType
// default is 'hidraw', can also be 'libusb'
if (process.argv[2]) {
  var type = process.argv[2];
  console.log('driverType:', type);
  HID.setDriverType(type);
}

console.log('devices:', HID.devices());
