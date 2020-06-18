const sleep = timeout => new Promise(resolve => setTimeout(resolve, timeout));

const HARDCODED = {
  productId: 0x1307,
  geometry: 'ergodox-ez',
  keyLayoutMap: [
    [0, 1, 2, 3, 4, 5, 6, 38, 39, 40, 41, 42, 43, 44],
    [7, 8, 9, 10, 11, 12, 13, 45, 46, 47, 48, 49, 50, 51],
    [14, 15, 16, 17, 18, 19, -1, -1, 52, 53, 54, 55, 56, 57],
    [20, 21, 22, 23, 24, 25, 26, 58, 59, 60, 61, 62, 63, 64],
    [27, 28, 29, 30, 31, -1, -1, -1, -1, 65, 66, 67, 68, 69],
    [-1, 37, 36, 35, 34, 32, 33, 70, 71, 72, 75, 74, 73],
  ],
  size: 76,
  pairingKey: { layerIdx: 0, keyIdx: 6 },
};

const USB = require('webusb').USB;

const devicesFound = devices =>
  new Promise(resolve => {
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      const input = process.stdin.read();

      if (input === '\u0003') {
        process.exit();
      } else {
        const index = parseInt(input);
        if (index && index <= devices.length) {
          process.stdin.setRawMode(false);
          resolve(devices[index - 1]);
        }
      }
    });

    console.log("select a device to see it's active configuration:");
    devices.forEach((device, index) => {
      console.log(`${index + 1}: ${device.productName || device.serialNumber}`);
    });
  });

const usb = new USB({
  devicesFound,
});

let device;

let configuration;
let iface;
let inEndpoint;
let outEndpoint;

let geometry;
let activeKeys;

(async () => {
  try {
    device = await usb.requestDevice({
      filters: [{ productId: HARDCODED.productId }],
    });
    console.log(device);
    await device.open();
    geometry = HARDCODED.geometry;
    activeKeys = new Array(HARDCODED.size);
    const a = probeConfiguration(device);
    configuration = a.configuration;
    iface = a.iface;
    inEndpoint = a.inEndpoint;
    outEndpoint = a.outEndpoint;
    console.log({ configuration, iface, inEndpoint, outEndpoint });
    await device.selectConfiguration(configuration);
    await device.claimInterface(iface);
    connected = true;
    handleIncomingPackets();
    pairing = true;
    const pairingKey = HARDCODED.pairingKey;
    activeKeys[pairingKey.keyIdx] = false;
    currentLayer = pairingKey.layerIdx;
    do {
      console.log('trying to pair');
      await sendPacket('CMD_PAIR');
      await sleep(1000);
    } while (connected === true && paired === false);
  } catch (error) {
    console.log(error.message);
  }
})();

function probeConfiguration(device) {
  const conf = {
    configuration: device.configuration.configurationValue,
    iface: null,
    inEndpoint: null,
    outEndpoint: null,
  };

  device.configuration.interfaces.forEach(iface => {
    const alternate = iface.alternates.find(alt => alt.interfaceClass === 255);
    if (alternate) {
      conf.iface = iface.interfaceNumber;
      const outEndpoint = alternate.endpoints.find(
        endpoint => endpoint.direction === 'out'
      );
      const inEndpoint = alternate.endpoints.find(
        endpoint => endpoint.direction === 'in'
      );
      conf.inEndpoint = inEndpoint.endpointNumber;
      conf.outEndpoint = outEndpoint.endpointNumber;
    }
  });

  return conf;
}

let connected = false;
let legacy = false;
let paired = false;
let pairing = false;
let currentLayer;
const handleIncomingPackets = async () => {
  let layoutId;
  let revisionId;
  // let layout
  let error;
  do {
    try {
      // console.log({ connected, paired, pairing, legacy })

      const cmds = [];
      let currentCmd = [];
      const packet = await device.transferIn(inEndpoint, 64);
      console.log(packet.data.buffer);
      for (let i = 0; i < packet.data.byteLength; i++) {
        const byte = packet.data.getInt8(i);
        if (byte === -2) {
          cmds.push(currentCmd);
          currentCmd = [];
        } else {
          currentCmd.push(byte);
        }
      }
      console.log({ cmds });
      cmds.forEach(cmd => {
        //// when do we get 2 or more cmds?
        const status = cmd[0];
        let col;
        let row;
        if (status === 0x00) {
          const event = cmd[1];
          if (paired === false) {
            console.log(event);
            switch (event) {
              case getCommand('EVT_PAIRED'): // pairing successful
                console.log('=== paired');
                paired = true;
                pairing = false;
                if (legacy === false) {
                  sendPacket('CMD_LIVE_TRAINING', [2]);
                }
                // request the keyboards current layer
                // after a slight timeout so the Ergodox sends
                // the value when it comes from a layer momentary switch
                setTimeout(() => {
                  sendPacket('CMD_GET_LAYER');
                }, 200);
                break;
              case 0x01:
              case 0x04: {
                console.log('=== 0x01 or 0x04');
                if (paired === false && event === 0x04) {
                  legacy = true;
                }
                const version = Utf8ArrayToStr(cmd.slice(2, cmd.length - 1));

                const versionBits = version.split('/');
                layoutId = versionBits[0];
                revisionId = versionBits[1];
                //   layout = Layout.create({
                // 					layoutId: layoutId,
                // 					geometry: geometry,
                // 					noCache: true,
                //   })
                break;
              }
              default:
                break;
            }
          } else {
            switch (event) {
              case getCommand('EVT_KEYDOWN'):
                console.log('=== key down');
                col = cmd[2];
                row = cmd[3];
                handleKeyevent('down', col, row);
                break;
              case getCommand('EVT_KEYUP'):
                console.log('=== key up');
                col = cmd[2];
                row = cmd[3];
                handleKeyevent('up', col, row);
                break;
              case getCommand('EVT_LAYER'): {
                console.log('=== layer');

                const layer = cmd[2];
                currentLayer = layer;
                break;
              }
              case getCommand('EVT_LIVE_TRAINING'):
                console.log('=== live training');
                break;
              default:
                console.log('=== unknown');
                console.info('Unknown command, ignoring');
                console.info(cmd);
                break;
            }
          }
        }
      });
    } catch (e) {
      if (e.message.includes('disconnected')) {
        connected = false;
        error = 'Your keyboard was disconnected.';
      } else {
        console.info('Timeout, keeping the connection alive');
      }
    }
  } while (device !== null && connected === true);
};

function handleKeyevent(press, col, row) {
  let index = 0;
  if (geometry === HARDCODED.geometry) {
    index = HARDCODED.keyLayoutMap[col][row];
  }
  if (press === 'down') {
    activeKeys[index] = true;
  } else {
    activeKeys[index] = false;
  }
}

function getCommand(cmd) {
  return usbCommands[legacy === true ? 'legacy' : 'current'][cmd];
}

const usbCommands = {
  legacy: {
    CMD_PAIR: 0,
    CMD_LANDING_PAGE: 1,
    CMD_GET_LAYER: 2,
    EVT_PAIRED: 0,
    EVT_KEYDOWN: 1,
    EVT_KEYUP: 2,
    EVT_LAYER: 3,
  },
  current: {
    CMD_PAIR: 0,
    CMD_LANDING_PAGE: 1,
    CMD_GET_LAYER: 2,
    CMD_LIVE_TRAINING: 3,
    EVT_PAIRED: 0,
    EVT_LAYER: 2,
    EVT_LIVE_TRAINING: 3,
    EVT_KEYDOWN: 17,
    EVT_KEYUP: 18,
  },
};

function Uint8ArrayToString(array) {
  /* eslint-disable  no-bitwise */
  const len = array.length;
  let out;
  let i;
  let c;
  let char2;
  let char3;

  out = '';
  i = 0;
  while (i < len) {
    c = array[(i += 1)];
    switch (c >> 4) {
      case 0:
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
      case 7:
        // 0xxxxxxx
        out += String.fromCharCode(c);
        break;
      case 12:
      case 13:
        // 110x xxxx   10xx xxxx
        char2 = array[(i += 1)];
        out += String.fromCharCode(((c & 0x1f) << 6) | (char2 & 0x3f));
        break;
      case 14:
        // 1110 xxxx  10xx xxxx  10xx xxxx
        char2 = array[(i += 1)];
        char3 = array[(i += 1)];
        out += String.fromCharCode(
          ((c & 0x0f) << 12) | ((char2 & 0x3f) << 6) | ((char3 & 0x3f) << 0)
        );
        break;
      default:
        break;
    }
  }

  return out;
}

function Utf8ArrayToStr(array) {
  var out, i, len, c;
  var char2, char3;

  out = '';
  len = array.length;
  i = 0;
  while (i < len) {
    c = array[i++];
    switch (c >> 4) {
      case 0:
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
      case 7:
        // 0xxxxxxx
        out += String.fromCharCode(c);
        break;
      case 12:
      case 13:
        //                               // 110x xxxx   10xx xxxx
        char2 = array[i++];
        out += String.fromCharCode(((c & 0x1f) << 6) | (char2 & 0x3f));
        break;
      case 14:
        //                                                                     // 1110 xxxx  10xx xxxx  10xx xxxx
        char2 = array[i++];
        char3 = array[i++];
        out += String.fromCharCode(
          ((c & 0x0f) << 12) | ((char2 & 0x3f) << 6) | ((char3 & 0x3f) << 0)
        );
        break;
      default:
        break;
    }
  }

  return out;
}

const sendPacket = async (cmd, params = []) => {
  const command = getCommand(cmd);
  const packet = new Uint8Array([command].concat(params));
  return await device.transferOut(outEndpoint, packet);
};
