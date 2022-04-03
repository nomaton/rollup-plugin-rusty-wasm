import test from "ava";
import * as inline from "../inline";

test("inline.encode(): 3n zero's", t => {
    // 00000000 00000000 00000000
    // => 000000 000000 000000 000000
    // => 01100000 01100000 01100000 01100000
    const buffer = Buffer.from([0, 0, 0]);
    const actual = inline.encode(buffer);
    const expected = "````";
    t.is(actual, expected);
});

test("inline.encode(): 3n+1 0xff's", t => {
    // 11111111 11111111 11111111 11111111
    // => 111111 111111 111111 111111 111111 110000
    // => 1011111 1011111 1011111 1011111 1011111 1010000
    const buffer = Buffer.from([0xff, 0xff, 0xff, 0xff]);
    const actual = inline.encode(buffer);
    const expected = "_____P";
    t.is(actual, expected);
});

test("inline.encode(): 3n+2 0xff's", t => {
    // 11111111 11111111 11111111 11111111 11111111
    // => 111111 111111 111111 111111 111111 111111 111100
    // => 1011111 1011111 1011111 1011111 1011111 1011111 1011100
    const buffer = Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff]);
    const actual = inline.encode(buffer);
    const expected = "______\\";
    t.is(actual, expected);
});