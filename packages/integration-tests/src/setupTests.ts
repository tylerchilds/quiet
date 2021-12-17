import {setEngine} from "pkijs";
import {CryptoEngine} from "pkijs";
import {Crypto} from "@peculiar/webcrypto";

const webcrypto = new Crypto();
setEngine(
  "newEngine",
  webcrypto,
  // @ts-expect-error
  new CryptoEngine({
    name: "",
    crypto: webcrypto,
    subtle: webcrypto.subtle,
  })
);

global.crypto = webcrypto;
