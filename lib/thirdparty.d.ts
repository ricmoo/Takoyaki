declare module "aes-js" {
    export class Counter {
        constructor(iv: Uint8Array);
    }
    export namespace ModeOfOperation {
        class ctr{
            constructor(key: Uint8Array, counter?: Counter);
            decrypt(data: Uint8Array): Uint8Array;
            encrypt(data: Uint8Array): Uint8Array;
        }
    }
}
