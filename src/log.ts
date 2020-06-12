export default function log(...strings: string[]) {
  console.log(...strings);
}

export const debug = (...strings: string[]) => {
  if (__DEV__) {
    log(...strings);
  }
};
