import { EventEmitter } from 'events';
import { USB } from 'webusb';
import {
  probeConfiguration,
  devicesFound,
  getCommand,
  Commands,
  LegacyCommands,
  assertLegacyCommand,
  packCommands,
  Utf8ArrayToStr,
} from './usb';
import { getPreset, Preset } from './presets';
import { sleep } from './utils';

export interface KeyboardConfig {
  /** The number of keys on the keyboard */
  keyCount: number;
  /** Used to retrieve the USB connection to the keyboard. Make this as specific as possible. */
  usbSelector: USBDeviceFilter;
  keyLayoutMap: number[][];
  /** Used to translate key event coordinates to an active key index*/
  keyIndexTranslator?: (col: number, row: number) => number;

  /** Temporary hard coded pairing key */
  pairingKey: {
    id: number;
    layer: number;
  };
}

export const connectToKeyboard = async (
  presetOrConfig: KeyboardConfig | Preset
) => {
  const config =
    typeof presetOrConfig === 'string'
      ? getPreset(presetOrConfig)
      : presetOrConfig;
  const usb = new USB({
    devicesFound,
  });
  const device = await usb.requestDevice({
    filters: [config.usbSelector],
  });
  const keyboard = new Keyboard(config, device);
  return keyboard.connect();
};

export class Keyboard extends EventEmitter {
  private connected: boolean = false;
  private paired: boolean = false;
  private device: USBDevice;
  public config: KeyboardConfig;
  private legacy: boolean = false;
  private inEndpoint?: number;
  private outEndpoint?: number;
  private activeKeys: boolean[];
  private layer: number = 0;

  constructor(config: KeyboardConfig, device: USBDevice) {
    super();
    this.config = config;
    this.device = device;
    this.activeKeys = new Array(config.keyCount).fill(false);
  }

  async connect(): Promise<Keyboard> {
    await this.device.open();
    const {
      configuration,
      iface,
      inEndpoint,
      outEndpoint,
    } = probeConfiguration(this.device);
    this.inEndpoint = inEndpoint;
    this.outEndpoint = outEndpoint;

    if (!configuration || !iface) {
      throw new Error("Couldn't claim usb interface");
    }
    await this.device.selectConfiguration(configuration);
    await this.device.claimInterface(iface);
    this.connected = true;
    this.handleIncomingCommands();
    await this.pair();
    return this;
  }

  async disconnect() {
    await this.device.close();
    this.connected = false;
  }

  isConnected() {
    return this.device && this.connected;
  }

  isPaired() {
    return !!this.paired;
  }

  getCurrentLayer() {
    return this.layer;
  }

  protected sendCommand(cmd: Commands | LegacyCommands, params: number[] = []) {
    let command: number;
    if (this.legacy) {
      assertLegacyCommand(cmd);
      command = getCommand(cmd, true);
    } else {
      command = getCommand(cmd);
    }
    const packet = new Uint8Array([command].concat(params));
    return this.device.transferOut(this.outEndpoint!, packet);
  }

  private async handleIncomingCommands() {
    do {
      try {
        const packet = await this.device.transferIn(this.inEndpoint!, 64);
        const cmds = packCommands(packet);
        for (const cmd of cmds) {
          const [status, event] = cmd;
          if (status === 0x00) {
            if (!this.isPaired()) {
              switch (event) {
                case getCommand('EVT_PAIRED'):
                  this.paired = true;
                  if (this.legacy === false) {
                    this.sendCommand('CMD_LIVE_TRAINING', [2]);
                  }
                  setTimeout(() => {
                    this.sendCommand('CMD_GET_LAYER');
                  }, 200);
                  break;
                case 0x01:
                case 0x04:
                  if (this.isPaired() && event === 0x04) {
                    this.legacy = true;
                  }
                  const version = Utf8ArrayToStr(
                    (cmd.slice(2, cmd.length - 1) as unknown) as Uint8Array
                  );
                  const [layoutId, revisionId] = version.split('/');
                  console.log('legacy setup', { layoutId, revisionId });
                  break;
              }
            } else {
              let col,
                row = 0;
              switch (event) {
                case getCommand('EVT_KEYDOWN'):
                  [, , col, row] = cmd;
                  this.handleKeyEvent('down', col, row);
                  this.emit('keyDown', col, row);
                  break;
                case getCommand('EVT_KEYUP'):
                  [, , col, row] = cmd;
                  this.handleKeyEvent('up', col, row);
                  this.emit('keyUp', col, row);
                  break;
                case getCommand('EVT_LAYER'):
                  console.log(`layer changed from ${this.layer} to ${cmd[2]}`);
                  this.layer = cmd[2];
                  break;
                case getCommand('EVT_LIVE_TRAINING'):
                  console.log('live training');
                  break;
                default:
                  console.log('unknown command', cmd);
                  break;
              }
            }
          }
        }
      } catch (e) {
        if (e.message.includes('disconnected')) {
          this.connected = false;
          console.error('Your keyboard was disconnected');
        } else {
          console.log('Timeout, keeping the connection alive');
        }
      }
    } while (this.isConnected());
  }

  private handleKeyEvent(state: 'up' | 'down', col: number, row: number) {
    console.log(`key press ${state} on ${col} ${row}`);
    let index = this.config.keyIndexTranslator
      ? this.config.keyIndexTranslator(col, row)
      : this.config.keyLayoutMap[col][row];
    this.activeKeys[index] = state === 'down' ? true : false;
  }

  private async pair() {
    console.log('Attempting to pair, press the oryx key');
    this.activeKeys[this.config.pairingKey.id] = false;
    this.layer = this.config.pairingKey.layer;
    do {
      await this.sendCommand('CMD_PAIR');
      await sleep(1000);
    } while (this.isConnected() && this.paired === false);
    console.log('paired');
  }
}
