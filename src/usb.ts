export const CMD_PAIR = 0x00;
export const CMD_LANDING_PAGE = 0x01;
export const CMD_GET_LAYER = 0x02;

export const usbCommands = {
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

export function Uint8ArrayToString(array: Uint8Array) {
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

interface Configuration {
  configuration?: number;
  iface?: number;
  inEndpoint?: number;
  outEndpoint?: number;
}

export function probeConfiguration(device: USBDevice) {
  const conf: Configuration = {
    configuration: device.configuration?.configurationValue,
  };

  device.configuration?.interfaces.forEach(iface => {
    const alternate = iface.alternates.find(alt => alt.interfaceClass === 255);
    if (alternate) {
      conf.iface = iface.interfaceNumber;
      const outEndpoint = alternate.endpoints.find(
        endpoint => endpoint.direction === 'out'
      );
      const inEndpoint = alternate.endpoints.find(
        endpoint => endpoint.direction === 'in'
      );
      conf.inEndpoint = inEndpoint?.endpointNumber;
      conf.outEndpoint = outEndpoint?.endpointNumber;
    }
  });

  return conf;
}
export function Utf8ArrayToStr(array: Uint8Array) {
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
