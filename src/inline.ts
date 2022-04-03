import { StringDecoder } from "node:string_decoder";

/*
 * UU-Encoding variant
 * (length)
 * each 3 bytes are encoded into 4 bytes.
 * - reminder 1 byte is encoded into 2 bytes.
 * - reminder 2 bytes are encoded into 3 bytes.
 * 
 * (encoding)
 * For each 3-bytes (24-bits), split into four 6-bits values, then for each values,
 *  a) add 0x20 if not 0x00
 *  b) set 0x60 if 0x00
 * 
 * This operation maps 6-bit values x (0x00-0x3f) to y (0x21-0x60).
 * This operation can be reversed by
 *  x = (y ^ 0x20) & 0x3f
 * 
 * For the reminder bytes, pad its tail by 0 to reach 3-bytes and truncate the encoded bytes as
 *  a) if reminder was 1-byte, truncate result to 2-bytes.
 *  b) if reminder was 2-bytes, truncate result to 3-bytes.
 * 
 * This truncation is safe because 1 x 8-bits can be covered by encoded 2 x 6-bits,
 * and 2 x 8-bits can be covered by encoded 3 x 6-bits without data loss.
 */

export function encode(src: Buffer): string {
    const rem = src.length % 3;
    const units = (src.length - rem) / 3;
    const dest = Buffer.alloc(4 * units + (rem === 0 ? 0 : rem + 1));

    for (let i = 0; i < units; i++) {
        const off = 3 * i;
        const b0 = src[off] >> 2;
        const b1 = ((src[off] & 0x03) << 4) | ((src[off + 1] & 0xf0) >> 4);
        const b2 = ((src[off + 1] & 0x0f) << 2) | ((src[off + 2] & 0xc0) >> 6);
        const b3 = src[off + 2] & 0x3f;

        dest[4 * i + 0] = b0 === 0 ? 0x60 : (b0 + 0x20);
        dest[4 * i + 1] = b1 === 0 ? 0x60 : (b1 + 0x20);
        dest[4 * i + 2] = b2 === 0 ? 0x60 : (b2 + 0x20);
        dest[4 * i + 3] = b3 === 0 ? 0x60 : (b3 + 0x20);
    }

    if (rem > 0) {
        const off = 3 * units;
        const a0 = src[off];
        const a1 = rem > 1 ? src[off + 1] : 0;

        const b0 = a0 >> 2;
        const b1 = ((a0 & 0x03) << 4) | ((a1 & 0xf0) >> 4);
        const b2 = (a1 & 0x0f) << 2;

        dest[4 * units + 0] = b0 === 0 ? 0x60 : (b0 + 0x20);
        dest[4 * units + 1] = b1 === 0 ? 0x60 : (b1 + 0x20);
        if (rem > 1) {
            dest[4 * units + 2] = b2 === 0 ? 0x60 : (b2 + 0x20);
        }
    }

    return new StringDecoder().end(dest);
}