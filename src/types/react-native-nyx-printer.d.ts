declare module 'react-native-nyx-printer' {
  export class NyxTextFormat {
    textSize: number;
    underline: boolean;
    textScaleX: number;
    textScaleY: number;
    letterSpacing: number;
    lineSpacing: number;
    topPadding: number;
    leftPadding: number;
    align: number;
    style: number;
    font: number;
    toObject(): Record<string, number | boolean>;
  }

  export function printText(
    text: string,
    textFormat?: NyxTextFormat,
  ): Promise<number>;

  export function printBarcode(
    content: string,
    width: number,
    height: number,
  ): Promise<number>;

  export function printQrCode(
    content: string,
    width: number,
    height: number,
  ): Promise<number>;

  export function printBitmap(inputBytes: number[]): Promise<number>;
}
