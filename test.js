const { connectToKeyboard } = require('./dist');

(async () => {
  const keyboard = await connectToKeyboard('ergodox-ez');
  // keyboard.on('keyDown', (col, row) => console.log('Key press event!'));
})();
