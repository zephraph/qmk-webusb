import { EventEmitter } from 'events';
import { usb } from 'webusb';
import { probeConfiguration } from './usb';
import { getPreset, Preset } from './presets';

export interface KeyboardConfig {
  /** The number of keys on the keyboard */
  keyCount: number;
  /** Used to retrieve the USB connection to the keyboard. Make this as specific as possible. */
  usbSelector: USBDeviceFilter;
}

export const connectToKeyboard = async (
  presetOrConfig: KeyboardConfig | Preset
) => {
  const config =
    typeof presetOrConfig === 'string'
      ? getPreset(presetOrConfig)
      : presetOrConfig;
  const device = await usb.requestDevice({
    filters: [config.usbSelector],
  });
  return new Keyboard(config, device);
};

export class Keyboard extends EventEmitter {
  private connected: boolean = false;
  private device: USBDevice;
  // @ts-ignore
  private config: KeyboardConfig;

  constructor(config: KeyboardConfig, device: USBDevice) {
    super();
    this.config = config;
    this.device = device;
  }

  async connect() {
    await this.device.open();
    const { configuration, iface } = probeConfiguration(this.device);
    if (!configuration || !iface) {
      throw new Error("Couldn't claim usb interface");
    }
    console.log({ configuration, iface }, this.device.configuration);
    await this.device.selectConfiguration(configuration);
    await this.device.claimInterface(iface);
    console.log(this.device.configuration);
  }

  async disconnect() {
    await this.device.close();
    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }
}
